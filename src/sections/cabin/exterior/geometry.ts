/**
 * Geometry for the cabin shell (design.md §8.3). Every static part is merged per material into one
 * BufferGeometry, so the exterior costs about a dozen draw calls. Per-part ink weights ride on an
 * `iInk` vertex attribute, which ink.vert.glsl reads the same way it reads the instanced one.
 */

import {
  BoxGeometry,
  BufferGeometry,
  Float32BufferAttribute,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix3,
  Matrix4,
  Quaternion,
  Vector3,
  type Material,
} from 'three'
import { cabin, type Vec3 } from '../../../core/world/layout'
import { rng } from '../../../env'
import { DOOR_LEAF } from './door'
import { FRAME, latticeBars, RIDGE_Y, ROOF, STEPS, wallPlanks } from './layout'

const { footprint, floorY, eavesY, door, latticeWindow, chimney, overhang } = cabin

/** Per-face corners of a unit box: normal, then the two in-plane axes. */
const FACES: readonly (readonly [Vec3, Vec3, Vec3])[] = [
  [[1, 0, 0], [0, 0, -1], [0, 1, 0]],
  [[-1, 0, 0], [0, 0, 1], [0, 1, 0]],
  [[0, 1, 0], [1, 0, 0], [0, 0, -1]],
  [[0, -1, 0], [1, 0, 0], [0, 0, 1]],
  [[0, 0, 1], [1, 0, 0], [0, 1, 0]],
  [[0, 0, -1], [-1, 0, 0], [0, 1, 0]],
]

/**
 * Accumulates triangles into one non-indexed geometry. `uvScale` switches a part to world-space UVs
 * in metres divided by the scale: tops read (x, z), sides read (along the face, y). The stone uses
 * them for its Voronoi cracks, so the cells keep one size across blocks of any shape.
 */
export class GeometryBuilder {
  private readonly pos: number[] = []
  private readonly nor: number[] = []
  private readonly uv: number[] = []
  private readonly ink: number[] = []
  private readonly p = new Vector3()
  private readonly n = new Vector3()
  private readonly nm = new Matrix3()

  box(matrix: Matrix4, ink = 1, uvScale?: readonly [number, number]): this {
    this.nm.getNormalMatrix(matrix)
    for (const [n, a, b] of FACES) {
      const corners = [
        [-0.5, -0.5],
        [0.5, -0.5],
        [0.5, 0.5],
        [-0.5, 0.5],
      ] as const
      const verts = corners.map(([u, v]) => ({
        p: new Vector3(n[0] * 0.5 + a[0] * u + b[0] * v, n[1] * 0.5 + a[1] * u + b[1] * v, n[2] * 0.5 + a[2] * u + b[2] * v).applyMatrix4(matrix),
        uv: [u + 0.5, v + 0.5] as const,
      }))
      this.n.set(n[0], n[1], n[2]).applyMatrix3(this.nm).normalize()
      for (const i of [0, 1, 2, 0, 2, 3]) {
        const vert = verts[i]
        if (!vert) continue
        this.push(vert.p, this.n, uvScale ? this.worldUv(vert.p, this.n, uvScale) : vert.uv, ink)
      }
    }
    return this
  }

  /** A box from centre, size and yaw (radians about +Y). */
  block(centre: Vec3, size: Vec3, yaw = 0, ink = 1, uvScale?: readonly [number, number]): this {
    const m = new Matrix4().compose(new Vector3(...centre), new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), yaw), new Vector3(...size))
    return this.box(m, ink, uvScale)
  }

  /** Every triangle of an indexed or plain geometry, transformed. */
  geometry(geo: BufferGeometry, matrix: Matrix4, ink = 1): this {
    const flat = geo.index ? geo.toNonIndexed() : geo
    const pos = flat.getAttribute('position')
    const nor = flat.getAttribute('normal')
    const uv = flat.getAttribute('uv')
    this.nm.getNormalMatrix(matrix)
    for (let i = 0; i < pos.count; i++) {
      this.p.fromBufferAttribute(pos, i).applyMatrix4(matrix)
      this.n.fromBufferAttribute(nor, i).applyMatrix3(this.nm).normalize()
      this.push(this.p, this.n, uv ? [uv.getX(i), uv.getY(i)] : [0, 0], ink)
    }
    if (flat !== geo) flat.dispose()
    return this
  }

  build(): BufferGeometry {
    const g = new BufferGeometry()
    g.setAttribute('position', new Float32BufferAttribute(this.pos, 3))
    g.setAttribute('normal', new Float32BufferAttribute(this.nor, 3))
    g.setAttribute('uv', new Float32BufferAttribute(this.uv, 2))
    g.setAttribute('iInk', new Float32BufferAttribute(this.ink, 1))
    g.computeBoundingSphere()
    return g
  }

  private worldUv(p: Vector3, n: Vector3, [sx, sy]: readonly [number, number]): readonly [number, number] {
    if (Math.abs(n.y) > 0.7) return [p.x / sx, p.z / sy]
    const tx = n.z
    const tz = -n.x
    const len = Math.hypot(tx, tz) || 1
    return [(p.x * tx + p.z * tz) / len / sx, p.y / sy]
  }

  private push(p: Vector3, n: Vector3, uv: readonly [number, number], ink: number) {
    this.pos.push(p.x, p.y, p.z)
    this.nor.push(n.x, n.y, n.z)
    this.uv.push(uv[0], uv[1])
    this.ink.push(ink)
  }
}

// ---------------------------------------------------------------------------- walls

/** One instanced box per plank, with per-plank ink, seed and a darker AO under the eaves. */
export function buildPlanks(material: Material): InstancedMesh {
  const planks = wallPlanks()
  const geo = new BoxGeometry(1, 1, 1)
  const ink = new Float32Array(planks.length)
  const seed = new Float32Array(planks.length)
  const ao = new Float32Array(planks.length)
  // ink.vert's `rim` attribute, reused as a flag: 1 = the leak box stands behind this plank.
  const rim = new Float32Array(planks.length)
  const mesh = new InstancedMesh(geo, material, planks.length)
  const m = new Matrix4()
  const q = new Quaternion()
  const up = new Vector3(0, 1, 0)
  planks.forEach((p, i) => {
    m.compose(new Vector3(...p.centre), q.setFromAxisAngle(up, p.yaw), new Vector3(...p.size))
    mesh.setMatrixAt(i, m)
    ink[i] = p.ink
    seed[i] = p.seed
    // Painters darken the band under the eaves; the gables sit under the barge overhang all the way up.
    const y = p.centre[1]
    const sheltered = p.wall === 'north' || p.wall === 'south' ? (y > eavesY ? 0.25 : 0) : Math.min(1, Math.max(0, (y - 2.2) / 0.85))
    ao[i] = 1 - 0.3 * sheltered
    rim[i] = p.centre[1] + p.size[1] / 2 <= eavesY + 1e-6 ? 1 : -1
  })
  geo.setAttribute('iInk', new InstancedBufferAttribute(ink, 1))
  geo.setAttribute('iSeed', new InstancedBufferAttribute(seed, 1))
  geo.setAttribute('ao', new InstancedBufferAttribute(ao, 1))
  geo.setAttribute('rim', new InstancedBufferAttribute(rim, 1))
  mesh.instanceMatrix.needsUpdate = true
  mesh.computeBoundingSphere()
  mesh.name = 'cabin-planks'
  return mesh
}

/** Corner posts, the eave plates and gable tie beams, the window frame and its 步步锦 lattice. */
export function buildTimber(): BufferGeometry {
  const b = new GeometryBuilder()
  const { x0, x1, zNorth, zSouth } = footprint
  const h = eavesY - floorY
  for (const [x, z, sx, sz] of [
    [x0, zNorth, -1, 1],
    [x1, zNorth, 1, 1],
    [x0, zSouth, -1, -1],
    [x1, zSouth, 1, -1],
  ] as const) {
    b.block([x + sx * 0.025, floorY + h / 2, z + sz * 0.025], [0.15, h, 0.15], 0, 0.98)
  }
  // Eave plates along the side walls and a tie beam across each gable at eaves height.
  for (const x of [x0, x1]) b.block([x + (x === x0 ? -0.03 : 0.03), eavesY - 0.05, (zNorth + zSouth) / 2], [0.13, 0.16, zNorth - zSouth + 0.3], 0, 1)
  for (const z of [zNorth, zSouth]) b.block([(x0 + x1) / 2, eavesY + 0.02, z + (z === zNorth ? 0.035 : -0.035)], [x1 - x0 + 0.3, 0.18, 0.12], 0, 1)
  // A king post under the ridge on each gable, the one vertical of the 梁架 left showing.
  for (const z of [zNorth, zSouth]) b.block([door.centre[0], (eavesY + RIDGE_Y) / 2, z + (z === zNorth ? 0.03 : -0.03)], [0.12, RIDGE_Y - eavesY, 0.1], 0, 0.95)

  // Window: frame, sill ledge, then the lattice bars flush with the wall.
  const [wx, wy, wz] = latticeWindow.centre
  const s = latticeWindow.size
  const f = FRAME.window
  const fz = wz + 0.02
  b.block([wx, wy + s / 2 + f / 2, fz], [s + 2 * f, f, 0.08], 0, 1)
  b.block([wx, wy - s / 2 - f / 2, fz], [s + 2 * f, f, 0.08], 0, 1)
  b.block([wx - s / 2 - f / 2, wy, fz], [f, s, 0.08], 0, 1)
  b.block([wx + s / 2 + f / 2, wy, fz], [f, s, 0.08], 0, 1)
  b.block([wx, wy - s / 2 - f - 0.02, wz + 0.06], [s + 2 * f + 0.1, 0.04, 0.12], 0, 0.95)
  for (const [x, y, w, bh] of latticeBars()) b.block([wx + x, wy + y, wz + 0.005], [w, bh, 0.028], 0, 0.9)
  return b.build()
}

// ---------------------------------------------------------------------------- door

const IRON = 1.25

/** The door frame: jambs, lintel and threshold. Static, and like the leaf not portal-masked: its jambs show inside the opening. */
export function buildDoorFrame(): BufferGeometry {
  const b = new GeometryBuilder()
  const [cx, sill, z] = door.centre
  const j = FRAME.jamb
  const hw = door.width / 2
  const jh = door.height + j
  for (const x of [cx - hw - j / 2, cx + hw + j / 2]) b.block([x, sill + jh / 2, z - 0.01], [j, jh, FRAME.depth], 0, 1)
  b.block([cx, sill + door.height + j / 2, z - 0.01], [door.width + 2 * j + 0.12, j, FRAME.depth + 0.02], 0, 1)
  // Threshold stone lip under the door: the leaf clears it by 2 cm.
  b.block([cx, sill - 0.01, z + 0.02], [door.width + 2 * j, 0.02, FRAME.depth + 0.06], 0, 0.9)
  return b.build()
}

/**
 * The door leaf in hinge-local metres: +X runs from the hinge (east jamb) to the free edge, +Y up
 * from the leaf's bottom, +Z out of the outer face. Five boards, two battens on the inside, two
 * iron strap hinges from the east edge and an iron ring pull on a square plate.
 */
export function buildDoorLeaf(): BufferGeometry {
  const b = new GeometryBuilder()
  const { width, height, thickness } = DOOR_LEAF
  const boards = 5
  const gap = 0.003
  const bw = (width - gap * (boards - 1)) / boards
  const rand = rng(29)
  for (let i = 0; i < boards; i++) {
    const x = bw / 2 + i * (bw + gap)
    b.block([x, height / 2, 0], [bw, height - rand() * 0.006, thickness], 0, 0.78 + rand() * 0.1)
  }
  for (const y of [0.32, height - 0.32]) b.block([width / 2, y, -thickness / 2 - 0.015], [width - 0.06, 0.12, 0.03], 0, 0.9)
  // Strap hinges: long iron straps from the hinge edge across the boards, on the outer face.
  for (const y of [0.3, height - 0.3]) {
    b.block([0.29, y, thickness / 2 + 0.004], [0.58, 0.05, 0.008], 0, IRON)
    b.block([0.58, y, thickness / 2 + 0.004], [0.06, 0.075, 0.008], 0, IRON)
    b.block([-0.01, y, 0], [0.035, 0.09, 0.035], 0, IRON)
  }
  // Ring pull near the free edge at hand height: a square plate and a ring hanging flat on it.
  const ringY = 1.0
  b.block([width - 0.16, ringY, thickness / 2 + 0.005], [0.075, 0.075, 0.01], 0, IRON)
  b.geometry(ringGeometry(), new Matrix4().makeTranslation(width - 0.16, ringY - 0.055, thickness / 2 + 0.016), IRON)
  return b.build()
}

function ringGeometry(): BufferGeometry {
  // A low-poly torus, built here so the exterior chunk doesn't pull in TorusGeometry for one ring.
  const R = 0.055
  const r = 0.008
  const seg = 16
  const tube = 5
  const pos: number[] = []
  const nor: number[] = []
  const at = (i: number, j: number) => {
    const u = (i / seg) * Math.PI * 2
    const v = (j / tube) * Math.PI * 2
    const cx = Math.cos(u)
    const cy = Math.sin(u)
    return {
      p: [(R + r * Math.cos(v)) * cx, (R + r * Math.cos(v)) * cy, r * Math.sin(v)],
      n: [Math.cos(v) * cx, Math.cos(v) * cy, Math.sin(v)],
    }
  }
  for (let i = 0; i < seg; i++) {
    for (let j = 0; j < tube; j++) {
      const q = [at(i, j), at(i + 1, j), at(i + 1, j + 1), at(i, j + 1)]
      for (const k of [0, 1, 2, 0, 2, 3]) {
        const v = q[k]
        if (!v) continue
        pos.push(...v.p)
        nor.push(...v.n)
      }
    }
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(pos, 3))
  g.setAttribute('normal', new Float32BufferAttribute(nor, 3))
  return g
}

// ---------------------------------------------------------------------------- stone

/** z of the footing's front face, the line between the two steps, and the lower step's front edge. */
function stepLines(): { front: number; mid: number; edge: number } {
  const [upper = -59.4, lower = -58.8] = cabin.steps
  return { front: footprint.zNorth + STEPS.footingLip, mid: (upper + lower) / 2, edge: lower + STEPS.depth / 2 }
}

/** World-UV scale that makes ink.frag's 鳞皴 Voronoi read as stone cracks: cells about 0.35 × 0.2 m. */
export const STONE_UV: readonly [number, number] = [17 * 0.35, 6.5 * 0.2]

/** Stone footings under the shell, the two steps up to the door and the chimney stack above the roof. */
export function buildStone(): BufferGeometry {
  const b = new GeometryBuilder()
  const { x0, x1, zNorth, zSouth } = footprint
  const lip = STEPS.footingLip
  b.block([(x0 + x1) / 2, floorY / 2, (zNorth + zSouth) / 2], [x1 - x0 + 2 * lip, floorY, zNorth - zSouth + 2 * lip], 0, 1, STONE_UV)
  // The upper step runs back to the footing; the lower one sits in front of it.
  const { front, mid, edge } = stepLines()
  b.block([door.centre[0], STEPS.rise, (front + mid) / 2], [1.6, 2 * STEPS.rise, mid - front], 0, 0.95, STONE_UV)
  b.block([door.centre[0], STEPS.rise / 2, (mid + edge) / 2], [1.9, STEPS.rise, edge - mid], 0, 0.9, STONE_UV)
  // The chimney shows only above the roof; below it the leak box fills the room.
  const [cx, , cz] = chimney.base
  const bottom = eavesY - 0.1
  const top = chimney.topY - 0.12
  const courses = 5
  const rand = rng(41)
  // Darker than the footings: a small stack of blackened stones.
  for (let i = 0; i < courses; i++) {
    const t0 = i / courses
    const h = (top - bottom) / courses
    const w = 0.5 - 0.06 * t0 + (rand() - 0.5) * 0.04
    b.block([cx + (rand() - 0.5) * 0.02, bottom + h * (i + 0.5), cz], [w, h + 0.004, w], (rand() - 0.5) * 0.06, 1.35 + rand() * 0.1, STONE_UV)
  }
  b.block([cx, chimney.topY - 0.06, cz], [0.58, 0.12, 0.58], 0.05, 1.5, STONE_UV)
  return b.build()
}

// ---------------------------------------------------------------------------- roof

/** Underside of the roof at x (the gable line). */
export const roofUnderside = (x: number) => RIDGE_Y - Math.abs(x - door.centre[0]) * Math.tan(ROOF.pitch)

/** Horizontal run from the ridge to the eave edge. */
const RUN = ROOF.halfSpan + overhang
const Z0 = footprint.zNorth + overhang
const Z1 = footprint.zSouth - overhang

/** Two thick thatch slabs at 40° overhanging all four sides (悬山), and a bundled ridge roll. */
export function buildRoof(): BufferGeometry {
  const b = new GeometryBuilder()
  const { pitch, thickness } = ROOF
  const slope = RUN / Math.cos(pitch)
  const over = thickness * Math.tan(pitch)
  const len = Z0 - Z1
  const ridgeX = door.centre[0]
  for (const side of [1, -1]) {
    // Slab local: +X down the slope, +Y out of the thatch, +Z along the ridge.
    const dirX = side * Math.cos(pitch)
    const dirY = -Math.sin(pitch)
    const nX = side * Math.sin(pitch)
    const nY = Math.cos(pitch)
    const along = slope + over
    const s = along / 2 - over
    const cx = ridgeX + dirX * s + nX * thickness / 2
    const cy = RIDGE_Y + dirY * s + nY * thickness / 2
    const m = new Matrix4().compose(new Vector3(cx, cy, (Z0 + Z1) / 2), new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), -side * pitch), new Vector3(along, thickness, len))
    b.box(m, 1)
  }
  const ridgeTop = RIDGE_Y + thickness / Math.cos(pitch)
  const m = new Matrix4().compose(new Vector3(ridgeX, ridgeTop - 0.02, (Z0 + Z1) / 2), new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), Math.PI / 4), new Vector3(0.3, 0.3, len + 0.12))
  b.box(m, 1.1)
  return b.build()
}

/**
 * Thatch ends as dense brush strokes: short tapered blades hanging from the eave and barge edges,
 * each a triangle, in a shuffled order so a tier's prefix thins them evenly. The instance matrix
 * places the blade's root on the edge; local +Y is up, the blade hangs along −Y, +Z faces out.
 */
export function buildFringe(material: Material): InstancedMesh {
  const blade = new BufferGeometry()
  blade.setAttribute('position', new Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, 0.08, -1, 0], 3))
  blade.setAttribute('normal', new Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1], 3))
  const rand = rng(53)
  const roots: { p: Vec3; yaw: number; out: Vec3 }[] = []
  const step = 0.032
  const ridgeX = door.centre[0]
  // Barge edges on both gables: the underside line from each eave corner up to the ridge.
  for (const [z, outZ] of [
    [Z0, 1],
    [Z1, -1],
  ] as const) {
    const n = Math.round((RUN * 2) / step)
    for (let i = 0; i <= n; i++) {
      const x = ridgeX - RUN + (i / n) * RUN * 2
      roots.push({ p: [x, roofUnderside(x), z], yaw: outZ > 0 ? 0 : Math.PI, out: [0, 0, outZ] })
    }
  }
  // Eave edges along both sides.
  for (const side of [1, -1]) {
    const x = ridgeX + side * RUN
    const n = Math.round((Z0 - Z1) / step)
    for (let i = 0; i <= n; i++) roots.push({ p: [x, roofUnderside(x), Z0 - (i / n) * (Z0 - Z1)], yaw: side * (Math.PI / 2), out: [side, 0, 0] })
  }
  for (let i = roots.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    const a = roots[i]
    const c = roots[j]
    if (a && c) {
      roots[i] = c
      roots[j] = a
    }
  }
  const mesh = new InstancedMesh(blade, material, roots.length)
  const ink = new Float32Array(roots.length)
  const m = new Matrix4()
  const q = new Quaternion()
  const tilt = new Quaternion()
  roots.forEach((r, i) => {
    const length = 0.07 + rand() * rand() * 0.26
    const width = 0.025 + rand() * 0.03
    const push = 0.01 + rand() * 0.05
    q.setFromAxisAngle(new Vector3(0, 1, 0), r.yaw + (rand() - 0.5) * 0.5)
    tilt.setFromAxisAngle(new Vector3(0, 0, 1), (rand() - 0.5) * 0.45)
    q.multiply(tilt)
    const pos = new Vector3(r.p[0] + r.out[0] * push, r.p[1] + 0.02 + rand() * 0.05, r.p[2] + r.out[2] * push)
    m.compose(pos, q, new Vector3(width, length, 1))
    mesh.setMatrixAt(i, m)
    ink[i] = 0.9 + rand() * 0.25
  })
  blade.setAttribute('iInk', new InstancedBufferAttribute(ink, 1))
  mesh.instanceMatrix.needsUpdate = true
  mesh.computeBoundingSphere()
  mesh.name = 'cabin-thatch-fringe'
  return mesh
}

// ---------------------------------------------------------------------------- light

/**
 * The leak box: exactly the size of the outside, inset under the planks (§8.3). Its north face sits
 * just behind the door leaf, and its floor just above the stone, so the 2 cm gap under the door
 * looks onto lit floor rather than footing.
 */
export function leakBoxMatrix(): Matrix4 {
  const [w, h, d] = cabin.leakBox.size
  const north = door.planeZ - DOOR_LEAF.thickness - 0.01
  return new Matrix4().compose(new Vector3(cabin.centre[0], floorY + h / 2 + 0.001, north - d / 2), new Quaternion(), new Vector3(w, h, d))
}

/**
 * The cyan floor spill (§8.3 C2): a strip that follows the sill, the two steps and the ground out
 * to 4.5 m, lifted a few millimetres. The shader cuts the trapezoid from it.
 */
export function buildSpillStrip(): BufferGeometry {
  const { zNorth } = footprint
  const { front: lip, mid, edge: low } = stepLines()
  const r = STEPS.rise
  const e = 0.004
  const cx = door.centre[0]
  // [z0, y0, z1, y1, halfWidth]: treads and risers from the door out.
  const segs: readonly (readonly [number, number, number, number, number])[] = [
    [zNorth, floorY + e, lip + e, floorY + e, 1.4],
    [lip + e, floorY, lip + e, 2 * r, 1.4],
    [lip + e, 2 * r + e, mid + e, 2 * r + e, 0.8],
    [mid + e, 2 * r, mid + e, r, 0.8],
    [mid + e, r + e, low + e, r + e, 0.95],
    [low + e, r, low + e, 0, 0.95],
    [low + e, e, zNorth + 4.5, e, 2.2],
  ]
  const pos: number[] = []
  for (const [z0, y0, z1, y1, hw] of segs) {
    const a = [cx - hw, y0, z0]
    const b2 = [cx + hw, y0, z0]
    const c = [cx + hw, y1, z1]
    const d = [cx - hw, y1, z1]
    pos.push(...a, ...b2, ...c, ...a, ...c, ...d)
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(pos, 3))
  g.computeBoundingSphere()
  return g
}
