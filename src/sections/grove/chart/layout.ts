/**
 * Where everything sits on the board, in dial space: metres from the platform centre, world axes
 * (north +Z, east −X), heights as in the world. Pure numbers; the scene turns them into matrices.
 *
 * Rings read like a luopan: glyphs radial, tops outward. Palaces read like a chart: glyphs upright
 * to the viewer, tops south (design.md §9.2). A palace's glyphs are laid out in "block" coordinates
 * (u, v): u along +X (west, screen-right from the seat), v toward the south (screen-up), both from
 * the slab centre.
 */

import { dirToBearing, grove } from '../../../core/world/layout'
import type { OuterPalaceNo, PalaceNo } from '../../../lib/qimen/types'
import { glyph3d } from '../../../theme/tokens'
import type { RiderRole } from './model'

export const DEG = Math.PI / 180
const [CX, , CZ] = grove.centre

/** Ground point of a bearing at radius r: (−sin b, cos b) × r. */
export function bearingPoint(bearingDeg: number, r: number): [x: number, z: number] {
  const b = bearingDeg * DEG
  return [-Math.sin(b) * r, Math.cos(b) * r]
}

/** Clockwise tangent at a bearing, which is also the reading direction of a radial glyph. */
export function clockwiseTangent(bearingDeg: number): [x: number, z: number] {
  const b = bearingDeg * DEG
  return [-Math.cos(b), -Math.sin(b)]
}

export const riderBearing = (homeSlot: number, angle: number) => (homeSlot + angle) * 45
export const deityBearing = (spiritAngle: number, rel: number) => (spiritAngle + rel) * 45

export const palaceLocal = (p: PalaceNo): [x: number, z: number] => {
  const c = grove.palaceCentre[p]
  return [c[0] - CX, c[2] - CZ]
}

export const PLATFORM_Y = grove.platform.topY
/** Glyphs float a few millimetres over their stone: they never write depth (core/text). */
export const LIFT = { plate: 0.004, glyph: 0.008, overlay: 0.006 } as const
/** Lit glyphs rise this far off the ring while they fly into a palace (§9.5). */
export const FLIGHT_ARC = 0.3

const R = grove.rings
/** Radius and size of each glyph on the rings; `t` is a clockwise offset along the ring. */
export const ON_RING: Record<RiderRole | 'carveStar', { r: number; size: number; t?: number; y: number }> = {
  star: { r: 7.55, size: 0.5, y: R.heaven.topY },
  carveStar: { r: 7.55, size: 0.46, y: R.heaven.topY },
  star2: { r: 7.55, size: 0.3, t: 0.82, y: R.heaven.topY },
  stem: { r: 7.02, size: 0.4, y: R.heaven.topY },
  stem2: { r: 7.02, size: 0.26, t: 0.36, y: R.heaven.topY },
  door: { r: (R.human.r0 + R.human.r1) / 2, size: 0.46, y: R.human.topY },
  deity: { r: (R.spirit.r0 + R.spirit.r1) / 2, size: 0.46, y: R.spirit.topY },
}

export const MOUNTAIN = { r: 10.62, size: 0.44, big: 1.2, y: R.mountains.topY } as const

/** Palace glyph rows (§9.3), English off and on; `showEnglish` blends between them. */
interface Spot {
  u: number
  v: number
  size: number
}
export type BlockRole = RiderRole | 'earth' | 'void' | 'horse' | 'name' | 'lodged'

const OFF: Record<BlockRole, Spot> = {
  deity: { u: 0, v: 0.72, size: glyph3d.deity },
  void: { u: -1.1, v: 0.72, size: glyph3d.voidHorse },
  horse: { u: 1.1, v: 0.72, size: glyph3d.voidHorse },
  stem: { u: -0.75, v: 0.02, size: glyph3d.palaceStem },
  stem2: { u: -1.13, v: 0.42, size: 0.32 },
  star: { u: 0.45, v: 0.02, size: glyph3d.star },
  star2: { u: 1.22, v: 0.42, size: 0.32 },
  earth: { u: -0.75, v: -0.7, size: glyph3d.palaceStem },
  door: { u: 0.45, v: -0.7, size: glyph3d.door },
  name: { u: 0, v: -1.2, size: glyph3d.palaceName },
  lodged: { u: 0.72, v: 0.66, size: 0.2 },
}

const ON: Record<BlockRole, Spot> = {
  deity: { u: 0, v: 0.96, size: 0.44 },
  void: { u: -1.1, v: 0.96, size: glyph3d.voidHorse },
  horse: { u: 1.1, v: 0.96, size: glyph3d.voidHorse },
  stem: { u: -0.75, v: 0.3, size: 0.52 },
  stem2: { u: -1.13, v: 0.64, size: 0.28 },
  star: { u: 0.45, v: 0.3, size: 0.52 },
  star2: { u: 1.2, v: 0.64, size: 0.28 },
  earth: { u: -0.75, v: -0.44, size: 0.52 },
  door: { u: 0.45, v: -0.44, size: 0.52 },
  name: { u: 0, v: -1.2, size: 0.26 },
  lodged: { u: 0.72, v: 0.86, size: 0.18 },
}

/** English labels sit this far under their glyph (v), in the English-on layout. */
export const ENGLISH = { size: glyph3d.english, below: 0.38, deityBelow: 0.34 } as const

export function blockSpot(role: BlockRole, english: number): Spot {
  const a = OFF[role]
  const b = ON[role]
  const k = english
  return { u: a.u + (b.u - a.u) * k, v: a.v + (b.v - a.v) * k, size: a.size + (b.size - a.size) * k }
}

/** Block (u, v) to a dial-space offset from the slab centre, before the palace counter-rotation. */
export const blockOffset = (u: number, v: number): [x: number, z: number] => [u, -v]

// ---------------------------------------------------------------------------- earth plate carvings

/** Outward direction of an outer palace from the centre, in block (u, v): edges one axis, corners the diagonal. */
export function outward(p: OuterPalaceNo): [u: number, v: number] {
  const [x, z] = palaceLocal(p)
  return [Math.sign(x), Math.sign(-z)]
}

/**
 * Trigram bars on each outer slab's outer edge (§9.2), bottom line nearest the centre: edge palaces
 * at the middle of the outer edge, corner palaces in the outer corner, turned 45°.
 */
export function trigramSpot(p: OuterPalaceNo): { u: number; v: number; /** Bearing the bars stack toward. */ out: number } {
  const [du, dv] = outward(p)
  const d = du !== 0 && dv !== 0 ? 1.16 : 1.25
  const [x, z] = blockOffset(du, dv)
  return { u: du * d, v: dv * d, out: dirToBearing(x, z) }
}

export const TRIGRAM = { length: 0.42, bar: 0.045, pitch: 0.085, gap: 0.28 } as const

/** Where the name row starts (u), clear of the trigram in 艮8's north-east corner. */
export const nameRowStart = (p: PalaceNo) => (p === 8 ? -0.66 : -1.3)

/** Luo Shu dot numeral (§9.3): odd numbers hollow, even filled, joined; 5 is a quincunx. */
export interface DotNumeral {
  dots: readonly { u: number; v: number }[]
  hollow: boolean
  joins: readonly { u0: number; v0: number; u1: number; v1: number }[]
  width: number
}

export const DOT = { r: 0.03, inner: 0.017, pitch: 0.075, join: 0.008 } as const

export function dotNumeral(n: PalaceNo): DotNumeral {
  const hollow = n % 2 === 1
  if (n === 5) {
    const q = 0.06
    const dots = [{ u: q, v: 0 }, { u: 0, v: q }, { u: 2 * q, v: q }, { u: 0, v: -q }, { u: 2 * q, v: -q }]
    const joins = dots.slice(1).map((d) => ({ u0: q, v0: 0, u1: d.u, v1: d.v }))
    return { dots, hollow, joins, width: 2 * q }
  }
  const dots = Array.from({ length: n }, (_, i) => ({ u: i * DOT.pitch, v: 0 }))
  const joins = dots.slice(1).map((d, i) => ({ u0: i * DOT.pitch, v0: 0, u1: d.u, v1: 0 }))
  return { dots, hollow, joins, width: (n - 1) * DOT.pitch }
}

// ---------------------------------------------------------------------------- inscription band

const STEP = grove.northStep
/** The band sits on the north step's tread, read from the seat: tops to the south. */
export const BAND = {
  z: (STEP.zNorth + STEP.zSouth) / 2 - CZ,
  y: STEP.topY,
  line1: { dz: -0.13, size: 0.17 },
  line2: { dz: 0.14, size: 0.15 },
} as const
