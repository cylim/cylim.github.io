import { useMemo, useRef } from 'react'
import { BufferGeometry, Euler, Float32BufferAttribute, Matrix4, Quaternion, Vector3, type Mesh } from 'three'
import { buildRock, createInkMaterial } from '../../../env'
import { useDisposeOnUnmount } from '../../shared/lifetime'
import { standingStones, steppingStones, type StonePlacement } from './plan'

/**
 * buildRock geometries are non-indexed and all carry the same attributes, so merging them is a
 * concatenation: one draw call per stone group.
 */
function mergeRocks(stones: readonly StonePlacement[], chops: number): BufferGeometry {
  const parts = stones.map((s) =>
    buildRock(s.seed, s.size, chops).applyMatrix4(
      new Matrix4().compose(new Vector3(...s.pos), new Quaternion().setFromEuler(new Euler(0, s.yaw, s.tilt)), new Vector3(1, 1, 1)),
    ),
  )
  const merged = new BufferGeometry()
  const first = parts[0]
  if (!first) return merged
  for (const name of Object.keys(first.attributes)) {
    const size = first.getAttribute(name).itemSize
    const data = parts.flatMap((g) => Array.from(g.getAttribute(name).array))
    merged.setAttribute(name, new Float32BufferAttribute(data, size))
  }
  for (const g of parts) g.dispose()
  merged.computeBoundingSphere()
  return merged
}

// R3F never disposes objects passed as props (geometry={…}, material={…}), so useDisposeOnUnmount
// frees them on a real unmount and keeps them warm while the grove is only hidden in <Activity>.

/**
 * The five stepping stones across the stream (design.md §8.5 P1): flattened, noise-displaced
 * icosahedra in `stone`. The ink weight lands their tone on the stone token: pale lit tops, darker
 * flanks, and a wet dark foot from the rock's baked AO.
 */
export function SteppingStones() {
  const geometry = useMemo(() => mergeRocks(steppingStones(), 4), [])
  const material = useMemo(
    () => createInkMaterial({ name: 'stepping-stones', inkWeight: 0.5, cun: 'axe', cunClass: 'stone', cunScale: 0.12, cunStrength: 0.55, doubleSided: false }),
    [],
  )
  const mesh = useRef<Mesh>(null)
  useDisposeOnUnmount(mesh, () => [geometry, material])
  return <mesh ref={mesh} name="stepping-stones" geometry={geometry} material={material} />
}

/**
 * The plain, unlettered 1.8 m stones at (−3, 0, −131) and (3, 0, −131) that mark the grove
 * entrance (§5.1). Grove stones draw their axe-cut strokes on every tier (§13.3).
 */
export function StandingStones() {
  const geometry = useMemo(() => mergeRocks(standingStones(), 4), [])
  const material = useMemo(
    () => createInkMaterial({ name: 'standing-stones', inkWeight: 0.68, cun: 'axe', cunClass: 'hero', cunScale: 0.24, cunStrength: 0.8, doubleSided: false }),
    [],
  )
  const mesh = useRef<Mesh>(null)
  useDisposeOnUnmount(mesh, () => [geometry, material])
  return <mesh ref={mesh} name="standing-stones" geometry={geometry} material={material} />
}
