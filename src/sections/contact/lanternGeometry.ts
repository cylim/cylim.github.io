import { BufferAttribute, BufferGeometry, LatheGeometry, Vector2 } from 'three'
import { exit } from '../../core/world/layout'

/**
 * The stone lantern (design.md §8.7 E1), after the Northern Qi lamp pillar at Tongzi Temple,
 * Taiyuan: octagonal plinth, octagonal shaft, a lamp chamber with four openings, a flared
 * octagonal eave with only a slight lift at the corners, and a pearl finial. Not a Japanese
 * kasuga lantern: no broad umbrella roof, no legs.
 *
 * Every part is a lathe with 8 radial segments, which gives octagons for free. `phiStart` puts a
 * flat face (not a corner) on each compass point, so the four openings face N, W, S and E and the
 * one facing north looks up the path at the visitor.
 */

/** A profile point: corner radius and height, metres from the lantern's base. */
type Profile = readonly (readonly [r: number, y: number])[]

const SIDES = 8
const FACE = (Math.PI * 2) / SIDES
/** Lathe vertices sit at phi = phiStart + k·45°, so faces centre on k·45°. */
const PHI_START = -FACE / 2

/** Height of the lantern, flame height and chamber band, all in metres from the base. */
export const LANTERN = {
  height: exit.lantern.height,
  flameY: exit.lantern.flame[1] - exit.lantern.base[1],
  chamber: { r: 0.2, y0: 1.12, y1: 1.58, open0: 1.2, open1: 1.5 },
  eave: { r: 0.42, lift: 0.02 },
} as const

// 须弥座-like plinth in two steps with a waist, then a plain octagonal shaft.
const PLINTH_AND_SHAFT: Profile = [
  [0, 0],
  [0.42, 0],
  [0.42, 0.12],
  [0.35, 0.13],
  [0.35, 0.2],
  [0.27, 0.24],
  [0.27, 0.3],
  [0.33, 0.34],
  [0.33, 0.37],
  [0.13, 0.39],
  [0.12, 0.42],
  [0.12, 0.98],
]

// The capital flares out into a tray, whose top is the chamber floor.
const CAPITAL: Profile = [
  [0.12, 0.98],
  [0.16, 1.02],
  [0.28, 1.07],
  [0.28, 1.12],
  [0, 1.12],
]

// The eave: soffit out from the chamber top, a thin fascia, then a concave roof up to the finial seat.
const EAVE: Profile = [
  [0, LANTERN.chamber.y1],
  [LANTERN.chamber.r, LANTERN.chamber.y1],
  [LANTERN.eave.r, 1.615],
  [LANTERN.eave.r, 1.64],
  [0.32, 1.665],
  [0.2, 1.69],
  [0.11, 1.71],
  [0.07, 1.72],
  [0.07, 1.735],
  [0.045, 1.74],
  [0, 1.74],
]

/** Pearl finial (宝珠): a small sphere whose top is the lantern's full height. */
function pearlProfile(): Profile {
  const r = 0.03
  const cy = LANTERN.height - r
  const pts: [number, number][] = []
  for (let i = 0; i <= 6; i++) {
    const a = -Math.PI / 2 + (i / 6) * Math.PI
    pts.push([Math.max(r * Math.cos(a), 0), cy + r * Math.sin(a)])
  }
  return [[0.04, 1.74], [0.022, cy - r * 0.8], ...pts.slice(1)]
}

function lathe(profile: Profile, segments = SIDES): BufferGeometry {
  return new LatheGeometry(
    profile.map(([r, y]) => new Vector2(r, y)),
    segments,
    PHI_START,
    Math.PI * 2,
  )
}

/**
 * Lathe vertices between the corners lie on a circle; push them out onto the octagon's straight
 * sides, then lift the eave toward each corner by `lift` × how far out the ring is.
 */
function octagonalEave(): BufferGeometry {
  const sub = 4
  const geo = lathe(EAVE, SIDES * sub)
  const pos = geo.getAttribute('position') as BufferAttribute
  const apothem = Math.cos(FACE / 2)
  const { r: rMax, lift } = LANTERN.eave
  const r0 = LANTERN.chamber.r
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const z = pos.getZ(i)
    const r = Math.hypot(x, z)
    if (r < 1e-6) continue
    const phi = Math.atan2(x, z)
    // Angle from the centre of the face this vertex lies on, in [−22.5°, 22.5°].
    const off = phi - Math.round(phi / FACE) * FACE
    const k = apothem / Math.cos(off)
    const out = Math.max(0, (r - r0) / (rMax - r0))
    pos.setXYZ(i, x * k, pos.getY(i) + lift * out * out * (Math.abs(off) / (FACE / 2)) ** 2, z * k)
  }
  return geo
}

/**
 * The chamber wall: solid on the four diagonal faces, open on the four cardinal ones between
 * `open0` and `open1`, with a sill below and a lintel above each opening.
 */
function chamberWall(): BufferGeometry {
  const { r, y0, y1, open0, open1 } = LANTERN.chamber
  const wall = lathe([
    [r, y0],
    [r, open0],
    [r, open1],
    [r, y1],
  ]).toNonIndexed()
  const src = wall.getAttribute('position') as BufferAttribute
  const kept: number[] = []
  for (let t = 0; t < src.count; t += 3) {
    let cx = 0
    let cy = 0
    let cz = 0
    for (let v = 0; v < 3; v++) {
      cx += src.getX(t + v)
      cy += src.getY(t + v)
      cz += src.getZ(t + v)
    }
    const face = Math.round(Math.atan2(cx, cz) / FACE)
    const inOpening = cy / 3 > open0 && cy / 3 < open1
    if (inOpening && face % 2 === 0) continue
    for (let v = 0; v < 3; v++) kept.push(src.getX(t + v), src.getY(t + v), src.getZ(t + v))
  }
  const out = new BufferGeometry()
  out.setAttribute('position', new BufferAttribute(new Float32Array(kept), 3))
  return out
}

/** Concatenate non-indexed position buffers and give every triangle its own flat normal: cut stone. */
export function mergeFlat(parts: readonly BufferGeometry[]): BufferGeometry {
  const arrays = parts.map((g) => {
    const flat = g.index ? g.toNonIndexed() : g
    return (flat.getAttribute('position') as BufferAttribute).array
  })
  const total = arrays.reduce((n, a) => n + a.length, 0)
  const position = new Float32Array(total)
  let o = 0
  for (const a of arrays) {
    position.set(a, o)
    o += a.length
  }
  const geo = new BufferGeometry()
  geo.setAttribute('position', new BufferAttribute(position, 3))
  geo.computeVertexNormals()
  for (const g of parts) g.dispose()
  return geo
}

/** The whole lantern as one geometry (one draw call), base at the origin. */
export function buildLanternGeometry(): BufferGeometry {
  return mergeFlat([lathe(PLINTH_AND_SHAFT), lathe(CAPITAL), chamberWall(), octagonalEave(), lathe(pearlProfile(), 10)])
}
