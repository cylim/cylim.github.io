import { BufferGeometry, Float32BufferAttribute, IcosahedronGeometry, Vector3 } from 'three'
import { lerp, rng } from '../random'

/**
 * An axe-cut boulder (斧劈皴 rock, design §5.1): a lumpy icosahedron chopped by a few planes into
 * flat, angular facets, sitting on y = 0. Flat-shaded, with baked AO darker toward the foot.
 * `size` is the bounding box (x, y, z) in metres. Also fit for stepping and standing stones.
 */
export function buildRock(seed: number, size: readonly [number, number, number], chops = 5): BufferGeometry {
  const rand = rng(seed)
  const ico = new IcosahedronGeometry(1, 1)
  const pos = ico.getAttribute('position')
  const v = new Vector3()
  const planes: { n: Vector3; d: number }[] = []
  for (let i = 0; i < chops; i++) {
    // Mostly steep cuts, as axe strokes fall, plus one sloping top.
    const up = i === 0 ? lerp(0.55, 0.85, rand()) : lerp(-0.1, 0.45, rand())
    const a = rand() * Math.PI * 2
    const n = new Vector3(Math.cos(a), up, Math.sin(a)).normalize()
    planes.push({ n, d: lerp(0.55, 0.8, rand()) })
  }
  // Polyhedron geometry is non-indexed: corners repeat once per face, so the lumps must be a
  // function of position, not a draw per vertex, or the facets tear apart.
  const lump = (p: Vector3) => {
    const s = Math.sin(p.x * 12.9898 + p.y * 78.233 + p.z * 37.719 + seed) * 43758.5453
    return s - Math.floor(s)
  }
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i)
    v.multiplyScalar(lerp(0.85, 1.15, lump(v)))
    for (const p of planes) {
      const k = v.dot(p.n) - p.d
      if (k > 0) v.addScaledVector(p.n, -k)
    }
    pos.setXYZ(i, v.x, v.y, v.z)
  }
  ico.computeBoundingBox()
  const box = ico.boundingBox
  if (!box) return ico
  const flat = ico
  const fp = flat.getAttribute('position')
  const ao: number[] = []
  const sx = size[0] / (box.max.x - box.min.x)
  const sy = size[1] / (box.max.y - box.min.y)
  const sz = size[2] / (box.max.z - box.min.z)
  for (let i = 0; i < fp.count; i++) {
    const y = (fp.getY(i) - box.min.y) * sy
    fp.setXYZ(i, (fp.getX(i) - (box.min.x + box.max.x) / 2) * sx, y - 0.08 * size[1], (fp.getZ(i) - (box.min.z + box.max.z) / 2) * sz)
    ao.push(lerp(0.6, 1, Math.min(1, y / (size[1] * 0.45))))
  }
  flat.setAttribute('ao', new Float32BufferAttribute(ao, 1))
  flat.computeVertexNormals()
  flat.computeBoundingSphere()
  return flat
}
