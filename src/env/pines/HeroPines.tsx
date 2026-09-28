import { useEffect, useMemo } from 'react'
import type { BufferGeometry } from 'three'
import { cabin, threshold, terrainHeight, type Vec3 } from '../../core/world/layout'
import { createInkMaterial } from '../materials/createInkMaterial'
import { envMaterial } from '../materials/portal'
import { buildPine, fieldBranches, type PineSpec } from './pineGeometry'

// Azimuths are radians from +X (west) toward +Z (north): east is π, south is −π/2.
const EAST = Math.PI
const NORTH = Math.PI / 2
const SOUTH = -Math.PI / 2
const WEST = 0

const A = threshold.cornerPineA
const B = threshold.wipePineB
const leanA = Math.tan((A.leanDeg * Math.PI) / 180) * A.height

/**
 * Corner pine A (design §5.1, §8.1): 13 m, leaning 8° east. Its long second branch reaches east
 * and a little toward K0 at about 5.5 m, just under the top edge of the K0 frame at 13 m, so it
 * crosses the top right the way Ma Yuan's one-corner pines do.
 */
const PINE_A: PineSpec = {
  seed: 7101,
  height: A.height,
  trunkRadius: 0.42,
  lean: [-leanA, 0.3],
  bend: 0.45,
  crown: 2.1,
  padThickness: 0.9,
  detail: 'hero',
  branches: [
    { at: 0.29, azimuth: WEST + 0.3, length: 2.1, rise: 0.3, padRadius: 1.3 },
    { at: 0.41, azimuth: EAST - 0.28, length: 5.2, rise: 0.7, padRadius: 1.7, extraPads: 2 },
    { at: 0.52, azimuth: SOUTH + 0.5, length: 2.4, rise: 0.4, padRadius: 1.5 },
    { at: 0.63, azimuth: NORTH + 0.9, length: 3.0, rise: 0.5, padRadius: 1.6, extraPads: 1 },
    { at: 0.74, azimuth: WEST + 0.8, length: 2.6, rise: 0.4, padRadius: 1.5 },
    { at: 0.84, azimuth: EAST + 0.9, length: 2.2, rise: 0.3, padRadius: 1.3 },
    { at: 0.93, azimuth: SOUTH - 0.4, length: 1.6, rise: 0.2, padRadius: 1.1 },
  ],
}

/**
 * Wipe pine B (design §5.1, §8.2): 11 m, split trunk, first branches at 3.5 m, leaning west over
 * the path. At F2 the camera passes within 2.2 m of it on screen-left.
 */
const PINE_B: PineSpec = {
  seed: 7202,
  height: B.height,
  trunkRadius: 0.38,
  lean: [2.6, -0.4],
  bend: 0.4,
  crown: 1.8,
  padThickness: 0.85,
  detail: 'hero',
  split: { at: 1.4, lean: [-0.9, -0.7], height: 9.4 },
  branches: [
    { at: B.firstBranch / B.height, azimuth: WEST + 0.15, length: 2.8, rise: 0.4, padRadius: 1.5, extraPads: 1 },
    { at: 0.43, azimuth: NORTH - 0.3, length: 2.2, rise: 0.3, padRadius: 1.3 },
    { at: 0.55, azimuth: WEST - 0.5, length: 3.1, rise: 0.5, padRadius: 1.6 },
    { at: 0.66, azimuth: EAST + 0.4, length: 2.0, rise: 0.3, padRadius: 1.3 },
    { at: 0.78, azimuth: WEST + 0.7, length: 2.3, rise: 0.4, padRadius: 1.4 },
    { at: 0.9, azimuth: SOUTH, length: 1.6, rise: 0.2, padRadius: 1.1 },
  ],
}

/**
 * The close trunks behind the cabin (design §5.1, §8.3): 0.5 m radius, 14 m. Their crowns start
 * high (from 84% up), so at C1 they only brush the top of the frame and the cabin's peak rises
 * between the two trunks; at C3 the trunks cross the roofline with the crowns out of frame.
 */
const closeTrunk = (seed: number, lean: readonly [number, number]): PineSpec => ({
  seed,
  height: cabin.closeTrunks[0]?.height ?? 14,
  trunkRadius: cabin.closeTrunks[0]?.radius ?? 0.5,
  lean,
  bend: 0.3,
  crown: 1.9,
  padThickness: 0.9,
  detail: 'hero',
  branches: fieldBranches(seed, 3, 0.84, [1.4, 2.4], [1.1, 1.5]),
})

interface Hero {
  name: string
  base: Vec3
  spec: PineSpec
  inkWeight: number
}

const HEROES: readonly Hero[] = [
  { name: 'pine-a', base: A.base, spec: PINE_A, inkWeight: 1 },
  { name: 'pine-b', base: B.base, spec: PINE_B, inkWeight: 1 },
  ...cabin.closeTrunks.map((t, i): Hero => ({
    name: `close-trunk-${i}`,
    base: t.base,
    spec: closeTrunk(7300 + i, i === 0 ? [-0.4, -0.3] : [0.5, -0.2]),
    // 浓, not 焦 (design §5.1): near but behind the cabin's own darkest ink.
    inkWeight: 0.88,
  })),
]

/** Hand-placed pines with more branch tiers and 鳞皴 bark. Exempt from the scatter keep-outs. */
export function HeroPines() {
  const { geometries, materials } = useMemo(
    () => ({
      geometries: HEROES.map((h): BufferGeometry => buildPine(h.spec)),
      materials: HEROES.map((h) => envMaterial(createInkMaterial({ name: h.name, inkWeight: h.inkWeight, sway: true, ragged: true, needles: true, bark: true }))),
    }),
    [],
  )
  useEffect(
    () => () => {
      geometries.forEach((g) => g.dispose())
      materials.forEach((m) => m.dispose())
    },
    [geometries, materials],
  )
  return (
    <group name="hero-pines">
      {HEROES.map((h, i) => (
        <mesh
          key={h.name}
          name={h.name}
          geometry={geometries[i]}
          material={materials[i]}
          position={[h.base[0], terrainHeight(h.base[0], h.base[2]), h.base[2]]}
        />
      ))}
    </group>
  )
}
