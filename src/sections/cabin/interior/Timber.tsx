import { useMemo, useRef } from 'react'
import {
  BoxGeometry,
  Euler,
  type Group,
  InstancedBufferAttribute,
  InstancedMesh,
  LineSegments,
  Matrix4,
  Quaternion,
  type ShaderMaterial,
  type Texture,
  Vector3,
  type BufferGeometry,
} from 'three'
import { hall } from '../../../core/world/layout'
import { useDisposeOnUnmount } from '../../shared/lifetime'
import { pickTwin, usePortalTwins } from '../shared/portal'
import { deskLines, frameLines, postGeometry } from './frame'
import { LineBuilder } from './lines'
import { circuitWoodMaterial, glowMaterial } from './materials'
import { hallPlanks, type PlankInstance } from './planks'

function instanced(geometry: BufferGeometry, material: ShaderMaterial, items: readonly PlankInstance[]): InstancedMesh {
  const n = items.length
  const uv = new Float32Array(n * 4)
  const meta = new Float32Array(n * 4)
  const mesh = new InstancedMesh(geometry, material, n)
  const m = new Matrix4()
  const q = new Quaternion()
  const e = new Euler()
  const p = new Vector3()
  const s = new Vector3()
  items.forEach((it, i) => {
    m.compose(p.fromArray(it.position), q.setFromEuler(e.set(...it.rotation)), s.fromArray(it.scale))
    mesh.setMatrixAt(i, m)
    uv.set(it.uv, i * 4)
    meta.set(it.meta, i * 4)
  })
  geometry.setAttribute('iUv', new InstancedBufferAttribute(uv, 4))
  geometry.setAttribute('iMeta', new InstancedBufferAttribute(meta, 4))
  mesh.computeBoundingSphere()
  return mesh
}

/** Posts: each a 6.5 m round column with the grain (and its traces) running up it. */
function postInstances(): PlankInstance[] {
  return hall.postPairs.z.flatMap((z, row) =>
    hall.postPairs.x.map((x, col): PlankInstance => ({
      position: [x, hall.floor.y, z],
      rotation: [0, (row * 2 + col) * 1.3, 0],
      scale: [1, 1, 1],
      uv: [0, 0, 1, 1],
      meta: [0.3, 0, 0, 0.75 + 0.25 * (((row * 7 + col * 3) % 5) / 4)],
    })),
  )
}

/**
 * The hall's wood and line work: every plank (near room, dissolve zone, floor, back wall) in one
 * instanced CircuitWood draw, the twelve posts in a second, and all static line work (plinths,
 * 斗拱 bracket sets, beams, the desk, the wires into the pane) in a third.
 */
export function Timber({ trace, inside }: { trace: Texture; inside: boolean }) {
  const wood = usePortalTwins(() => circuitWoodMaterial(trace))
  const glow = usePortalTwins(glowMaterial, 'additive')
  const anchor = useRef<Group>(null)
  const { planks, posts, lines } = useMemo(() => {
    const [dx, dy, dz] = hall.desk.pos
    const builder = frameLines(new LineBuilder())
    deskLines(builder, new Vector3(dx, dy, dz))
    return {
      planks: instanced(new BoxGeometry(1, 1, 1), wood.outside, hallPlanks()),
      posts: instanced(postGeometry(), wood.outside, postInstances()),
      lines: new LineSegments(builder.build(), glow.outside),
    }
  }, [wood, glow])
  useDisposeOnUnmount(anchor, () => [planks.geometry, posts.geometry, lines.geometry, planks, posts, wood.outside, wood.inside, glow.outside, glow.inside])

  return (
    <group ref={anchor} name="hall-timber">
      <primitive object={planks} material={pickTwin(wood, inside)} />
      <primitive object={posts} material={pickTwin(wood, inside)} />
      <primitive object={lines} material={pickTwin(glow, inside)} />
    </group>
  )
}
