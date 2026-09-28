/**
 * Stone geometry for the board (design.md §8.6, §9.2): the floor disc, the nine chipped slabs, the
 * north step, the turning rings with their raised dividers, the luopan apron and its ink, and the
 * small carved and painted pieces. All in dial space (see layout.ts), built once.
 *
 * Stone meshes carry the ink material's optional attributes: `ao` darkens the tops toward bluestone
 * (a lit top face alone reads too pale) and mottles them like a wash; `iInk` varies the slabs.
 */

import { BufferAttribute, BufferGeometry, Color, Float32BufferAttribute } from 'three'
import { grove } from '../../../core/world/layout'
import { slotOf } from '../../../lib/qimen'
import type { OuterPalaceNo, PalaceNo } from '../../../lib/qimen/types'
import { DEG, DOT, TRIGRAM, bearingPoint, blockOffset, palaceLocal, trigramSpot } from './layout'

type V3 = readonly [number, number, number]

/** Seeded PRNG, so the chips and moss are the same on every visit. */
export function rng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Flat-shaded triangles with the ink attributes. The winding follows each face's outward hint. */
class Builder {
  private pos: number[] = []
  private nor: number[] = []
  private ao: number[] = []
  private ink: number[] = []

  tri(a: V3, b: V3, c: V3, hint: V3, ao: readonly [number, number, number] | number = 1, ink = 1): void {
    const ux = b[0] - a[0]
    const uy = b[1] - a[1]
    const uz = b[2] - a[2]
    const vx = c[0] - a[0]
    const vy = c[1] - a[1]
    const vz = c[2] - a[2]
    let nx = uy * vz - uz * vy
    let ny = uz * vx - ux * vz
    let nz = ux * vy - uy * vx
    const len = Math.hypot(nx, ny, nz)
    if (len < 1e-12) return
    const flip = nx * hint[0] + ny * hint[1] + nz * hint[2] < 0
    if (flip) {
      nx = -nx
      ny = -ny
      nz = -nz
    }
    const [p1, p2] = flip ? [c, b] : [b, c]
    const aos = typeof ao === 'number' ? [ao, ao, ao] : flip ? [ao[0], ao[2], ao[1]] : ao
    for (const [i, p] of [a, p1, p2].entries()) {
      this.pos.push(p[0], p[1], p[2])
      this.nor.push(nx / len, ny / len, nz / len)
      this.ao.push(aos[i] ?? 1)
      this.ink.push(ink)
    }
  }

  quad(a: V3, b: V3, c: V3, d: V3, hint: V3, ao: readonly [number, number, number, number] | number = 1, ink = 1): void {
    const q = typeof ao === 'number' ? [ao, ao, ao, ao] : ao
    this.tri(a, b, c, hint, [q[0] ?? 1, q[1] ?? 1, q[2] ?? 1], ink)
    this.tri(a, c, d, hint, [q[0] ?? 1, q[2] ?? 1, q[3] ?? 1], ink)
  }

  build(): BufferGeometry {
    const g = new BufferGeometry()
    g.setAttribute('position', new Float32BufferAttribute(this.pos, 3))
    g.setAttribute('normal', new Float32BufferAttribute(this.nor, 3))
    g.setAttribute('uv', new Float32BufferAttribute(new Float32Array((this.pos.length / 3) * 2), 2))
    g.setAttribute('ao', new Float32BufferAttribute(this.ao, 1))
    g.setAttribute('iInk', new Float32BufferAttribute(this.ink, 1))
    g.computeBoundingSphere()
    return g
  }
}

const UP: V3 = [0, 1, 0]
const at = (b: number, r: number, y: number): V3 => {
  const [x, z] = bearingPoint(b, r)
  return [x, y, z]
}
const radial = (b: number): V3 => {
  const [x, z] = bearingPoint(b, 1)
  return [x, 0, z]
}

// ---------------------------------------------------------------------------- slabs

interface SlabSpec {
  cx: number
  cz: number
  halfX: number
  halfZ: number
  top: number
  base: number
  ink: number
  chips: number
}

/** A dressed stone block: mottled top, a chipped bevel, sides down to its bed. */
function slab(b: Builder, s: SlabSpec, rand: () => number): void {
  const perEdge = 12
  const corners: [number, number][] = [
    [-s.halfX, -s.halfZ],
    [s.halfX, -s.halfZ],
    [s.halfX, s.halfZ],
    [-s.halfX, s.halfZ],
  ]
  const loop: { x: number; z: number; nx: number; nz: number }[] = []
  for (let e = 0; e < 4; e++) {
    const [x0, z0] = corners[e] as [number, number]
    const [x1, z1] = corners[(e + 1) % 4] as [number, number]
    for (let i = 0; i < perEdge; i++) {
      const t = i / perEdge
      // Inward normal: straight in along an edge, diagonal at a corner.
      const nx = i === 0 || x0 === x1 ? -Math.sign(x0) : 0
      const nz = i === 0 || z0 === z1 ? -Math.sign(z0) : 0
      loop.push({ x: x0 + (x1 - x0) * t, z: z0 + (z1 - z0) * t, nx, nz })
    }
  }
  // Chips: a run of one to three bevel points bitten deeper, likelier at the corners.
  const chip = loop.map(() => 0)
  for (let j = 0; j < loop.length; j++) {
    const corner = j % perEdge === 0
    if (rand() < (corner ? 0.5 : 0.07) * s.chips) {
      const depth = 0.03 + rand() * 0.07
      const run = 1 + Math.floor(rand() * 3)
      for (let k = 0; k < run; k++) {
        const i = (j + k) % loop.length
        chip[i] = Math.max(chip[i] ?? 0, depth * (k === 0 || k === run - 1 ? 0.6 : 1))
      }
    }
  }
  const bevel = 0.028
  const n = loop.length
  const inner: V3[] = []
  const outer: V3[] = []
  const bed: V3[] = []
  const mid: V3[] = []
  const aoTop: number[] = []
  const aoMid: number[] = []
  for (let j = 0; j < n; j++) {
    const p = loop[j] as (typeof loop)[number]
    const c = chip[j] ?? 0
    const inset = bevel + c
    const diag = p.nx !== 0 && p.nz !== 0 ? Math.SQRT1_2 : 1
    const ix = s.cx + p.x + p.nx * inset * diag
    const iz = s.cz + p.z + p.nz * inset * diag
    inner.push([ix, s.top, iz])
    outer.push([s.cx + p.x + p.nx * c * 0.3 * diag, s.top - bevel - c * 0.8, s.cz + p.z + p.nz * c * 0.3 * diag])
    bed.push([s.cx + p.x, s.base, s.cz + p.z])
    mid.push([s.cx + (ix - s.cx) * 0.55, s.top, s.cz + (iz - s.cz) * 0.55])
    aoTop.push(0.26 + rand() * 0.08)
    aoMid.push(0.27 + rand() * 0.08)
  }
  const centre: V3 = [s.cx, s.top, s.cz]
  const aoC = 0.28 + rand() * 0.06
  for (let j = 0; j < n; j++) {
    const k = (j + 1) % n
    const i0 = inner[j] as V3
    const i1 = inner[k] as V3
    const m0 = mid[j] as V3
    const m1 = mid[k] as V3
    const o0 = outer[j] as V3
    const o1 = outer[k] as V3
    const b0 = bed[j] as V3
    const b1 = bed[k] as V3
    const am0 = aoMid[j] ?? 0.3
    const am1 = aoMid[k] ?? 0.3
    const at0 = aoTop[j] ?? 0.3
    const at1 = aoTop[k] ?? 0.3
    b.tri(centre, m0, m1, UP, [aoC, am0, am1], s.ink)
    b.quad(m0, i0, i1, m1, UP, [am0, at0, at1, am1], s.ink)
    const out: V3 = [(o0[0] + o1[0]) / 2 - s.cx, 0.6, (o0[2] + o1[2]) / 2 - s.cz]
    b.quad(i0, o0, o1, i1, out, [at0, 0.34, 0.34, at1], s.ink)
    b.quad(o0, b0, b1, o1, [out[0], 0, out[2]], [0.4, 0.22, 0.22, 0.4], s.ink)
  }
}

const P = grove.platform
export const SLAB_HALF = (P.slab - P.grout) / 2
/** The grout bed sits this far under the slab tops, so the joints read as shallow dark lines. */
const GROUT_DEPTH = 0.05

/** Nine 3 m slabs on a grout bed, plus the north step (design.md §9.2). */
export function platformGeometry(): BufferGeometry {
  const b = new Builder()
  const rand = rng(9)
  const half = P.size / 2
  const bedTop = P.topY - GROUT_DEPTH
  const floor = grove.floorDisc.topY
  b.quad([-half, bedTop, -half], [half, bedTop, -half], [half, bedTop, half], [-half, bedTop, half], UP, 0.12, 1.1)
  const sides: [V3, V3, V3][] = [
    [[-half, 0, -half], [half, 0, -half], [0, 0, -1]],
    [[half, 0, -half], [half, 0, half], [1, 0, 0]],
    [[half, 0, half], [-half, 0, half], [0, 0, 1]],
    [[-half, 0, half], [-half, 0, -half], [-1, 0, 0]],
  ]
  for (const [p0, p1, n] of sides) {
    b.quad([p0[0], bedTop, p0[2]], [p1[0], bedTop, p1[2]], [p1[0], floor, p1[2]], [p0[0], floor, p0[2]], n, [0.5, 0.5, 0.3, 0.3])
  }
  for (const p of [1, 2, 3, 4, 5, 6, 7, 8, 9] as const) {
    const [cx, cz] = palaceLocal(p)
    slab(b, { cx, cz, halfX: SLAB_HALF, halfZ: SLAB_HALF, top: P.topY, base: bedTop - 0.01, ink: 0.93 + rand() * 0.12, chips: 1 }, rand)
  }
  const step = grove.northStep
  const sz = (step.zNorth + step.zSouth) / 2 - grove.centre[2]
  slab(b, { cx: 0, cz: sz, halfX: step.width / 2, halfZ: (step.zNorth - step.zSouth) / 2, top: step.topY, base: floor - 0.01, ink: 0.95, chips: 0.6 }, rand)
  return b.build()
}

/** The stone floor disc under the platform (design.md §8.6). */
export function floorDiscGeometry(): BufferGeometry {
  const b = new Builder()
  const { radius, topY } = grove.floorDisc
  const segs = 96
  for (let i = 0; i < segs; i++) {
    const b0 = (i / segs) * 360
    const b1 = ((i + 1) / segs) * 360
    b.tri([0, topY, 0], at(b0, radius, topY), at(b1, radius, topY), UP, [0.62, 0.72, 0.72], 1.25)
    b.quad(at(b0, radius, topY), at(b1, radius, topY), at(b1, radius, 0), at(b0, radius, 0), radial((b0 + b1) / 2), [0.7, 0.7, 0.45, 0.45], 1.25)
  }
  return b.build()
}

// ---------------------------------------------------------------------------- rings

interface RingSpec {
  r0: number
  r1: number
  top: number
  /** Raised dividers between sectors, at these bearings. */
  dividers: readonly number[]
  aoTop: number
}

function ring(b: Builder, s: RingSpec, rand: () => number): void {
  const segs = 144
  for (let i = 0; i < segs; i++) {
    const b0 = (i / segs) * 360
    const b1 = ((i + 1) / segs) * 360
    const mottle = s.aoTop + (rand() - 0.5) * 0.05
    b.quad(at(b0, s.r0, s.top), at(b0, s.r1, s.top), at(b1, s.r1, s.top), at(b1, s.r0, s.top), UP, mottle)
    const bm = (b0 + b1) / 2
    b.quad(at(b0, s.r1, s.top), at(b1, s.r1, s.top), at(b1, s.r1, 0), at(b0, s.r1, 0), radial(bm), [0.7, 0.7, 0.35, 0.35])
    b.quad(at(b0, s.r0, s.top), at(b1, s.r0, s.top), at(b1, s.r0, 0), at(b0, s.r0, 0), radial(bm + 180), [0.6, 0.6, 0.3, 0.3])
  }
  // Raised stone dividers: short ribs across the ring, so each sector reads as its own stone.
  const w = 0.05 / 2
  const h = 0.025
  for (const bearing of s.dividers) {
    const [tx, tz] = [-Math.cos(bearing * DEG), -Math.sin(bearing * DEG)]
    const corner = (r: number, side: number, y: number): V3 => {
      const [x, z] = bearingPoint(bearing, r)
      return [x + tx * w * side, y, z + tz * w * side]
    }
    const r0 = s.r0 + 0.02
    const r1 = s.r1 - 0.02
    const y0 = s.top
    const y1 = s.top + h
    b.quad(corner(r0, -1, y1), corner(r1, -1, y1), corner(r1, 1, y1), corner(r0, 1, y1), UP, s.aoTop + 0.08)
    b.quad(corner(r0, 1, y0), corner(r1, 1, y0), corner(r1, 1, y1), corner(r0, 1, y1), [tx, 0, tz], 0.6)
    b.quad(corner(r0, -1, y0), corner(r1, -1, y0), corner(r1, -1, y1), corner(r0, -1, y1), [-tx, 0, -tz], 0.6)
    b.quad(corner(r1, -1, y0), corner(r1, 1, y0), corner(r1, 1, y1), corner(r1, -1, y1), radial(bearing), 0.6)
    b.quad(corner(r0, -1, y0), corner(r0, 1, y0), corner(r0, 1, y1), corner(r0, -1, y1), radial(bearing + 180), 0.6)
  }
}

const RINGS = grove.rings
/** Each ring stone reaches into the space between the radii, leaving the 4 cm gap of §9.2. */
const EDGE = (RINGS.human.r0 - RINGS.heaven.r1 - RINGS.gap) / 2
const sectorDividers = Array.from({ length: 8 }, (_, k) => k * 45 + 22.5)

export function turningRingGeometry(id: 'heaven' | 'human' | 'spirit', seed: number): BufferGeometry {
  const b = new Builder()
  const r = RINGS[id]
  const aoTop = { heaven: 0.38, human: 0.4, spirit: 0.42 }[id]
  ring(b, { r0: r.r0 - EDGE, r1: r.r1 + EDGE, top: r.topY, dividers: sectorDividers, aoTop }, rng(seed))
  return b.build()
}

export function apronGeometry(): BufferGeometry {
  const b = new Builder()
  const r = RINGS.mountains
  ring(b, { r0: r.r0 - EDGE, r1: r.r1, top: r.topY, dividers: [], aoTop: 0.95 }, rng(24))
  return b.build()
}

// ---------------------------------------------------------------------------- flat painted pieces

/** Plain triangles (position only) for MeshBasicMaterial pieces: ink lines, paper bars, marks. */
class Flat {
  readonly pos: number[] = []
  quad(a: V3, b: V3, c: V3, d: V3): void {
    this.pos.push(...a, ...b, ...c, ...a, ...c, ...d)
  }
  tri(a: V3, b: V3, c: V3): void {
    this.pos.push(...a, ...b, ...c)
  }
  /** A flat bar from (x0, z0) to (x1, z1), `w` wide. */
  bar(x0: number, z0: number, x1: number, z1: number, w: number, y: number): void {
    const len = Math.hypot(x1 - x0, z1 - z0) || 1
    const nx = (-(z1 - z0) / len) * (w / 2)
    const nz = ((x1 - x0) / len) * (w / 2)
    this.quad([x0 + nx, y, z0 + nz], [x1 + nx, y, z1 + nz], [x1 - nx, y, z1 - nz], [x0 - nx, y, z0 - nz])
  }
  /** Annular sector between two bearings. */
  sector(r0: number, r1: number, b0: number, b1: number, y: number, segs = 8): void {
    for (let i = 0; i < segs; i++) {
      const a0 = b0 + ((b1 - b0) * i) / segs
      const a1 = b0 + ((b1 - b0) * (i + 1)) / segs
      this.quad(at(a0, r0, y), at(a0, r1, y), at(a1, r1, y), at(a1, r0, y))
    }
  }
  disc(x: number, z: number, r: number, y: number, segs = 10, jitter?: () => number): void {
    const pts: V3[] = []
    for (let i = 0; i < segs; i++) {
      const a = (i / segs) * Math.PI * 2
      const k = jitter ? 0.75 + jitter() * 0.5 : 1
      pts.push([x + Math.cos(a) * r * k, y, z + Math.sin(a) * r * k])
    }
    for (let i = 0; i < segs; i++) this.tri([x, y, z], pts[i] as V3, pts[(i + 1) % segs] as V3)
  }
  ring(x: number, z: number, r0: number, r1: number, y: number, segs = 14): void {
    const p = (a: number, r: number): V3 => [x + Math.cos(a) * r, y, z + Math.sin(a) * r]
    for (let i = 0; i < segs; i++) {
      const a0 = (i / segs) * Math.PI * 2
      const a1 = ((i + 1) / segs) * Math.PI * 2
      this.quad(p(a0, r0), p(a0, r1), p(a1, r1), p(a1, r0))
    }
  }
  build(): BufferGeometry {
    const g = new BufferGeometry()
    g.setAttribute('position', new Float32BufferAttribute(this.pos, 3))
    g.computeBoundingSphere()
    return g
  }
}

/** The apron's ink: 24 sector lines across it, 5° ticks in its outer 0.2 m, and two rules (§9.2). */
export function apronInkGeometry(): BufferGeometry {
  const f = new Flat()
  const r = RINGS.mountains
  const y = r.topY + 0.002
  const tick0 = r.r1 - r.tickBand
  for (let k = 0; k < 24; k++) {
    const bearing = k * 15 + 7.5
    const [x0, z0] = bearingPoint(bearing, r.r0 + 0.04)
    const [x1, z1] = bearingPoint(bearing, tick0)
    f.bar(x0, z0, x1, z1, 0.024, y)
  }
  for (let i = 0; i < 72; i++) {
    const [x0, z0] = bearingPoint(i * 5, i % 3 === 0 ? tick0 : tick0 + 0.06)
    const [x1, z1] = bearingPoint(i * 5, r.r1 - 0.03)
    f.bar(x0, z0, x1, z1, i % 3 === 0 ? 0.02 : 0.014, y)
  }
  f.sector(tick0 - 0.012, tick0 + 0.012, 0, 360, y, 144)
  f.sector(r.r0 + 0.03, r.r0 + 0.05, 0, 360, y, 144)
  return f.build()
}

/** The hour marker: an inverted ink wedge over one 15° mountain, centred on bearing 0 (rotate it). */
export function hourWedgeGeometry(): BufferGeometry {
  const f = new Flat()
  const r = RINGS.mountains
  f.sector(r.r0 + 0.06, r.r1 - r.tickBand - 0.02, -7.2, 7.2, r.topY + 0.003, 6)
  return f.build()
}

/** Trigram bars (§9.2, bars never ☰): yin lines break with a 28% gap; bottom line nearest the centre. */
export function trigramGeometry(lines: (p: OuterPalaceNo) => readonly boolean[] | null): BufferGeometry {
  const f = new Flat()
  const y = P.topY + 0.004
  for (const p of [1, 8, 3, 4, 9, 2, 7, 6] as const) {
    const bars = lines(p)
    if (!bars) continue
    const [cx, cz] = palaceLocal(p)
    const spot = trigramSpot(p)
    const [ox, oz] = blockOffset(spot.u, spot.v)
    const [rx, rz] = bearingPoint(spot.out, 1)
    const [tx, tz] = [-rz, rx]
    const L = TRIGRAM.length
    bars.forEach((solid, i) => {
      const d = (i - 1) * TRIGRAM.pitch
      const mx = cx + ox + rx * d
      const mz = cz + oz + rz * d
      const pieces: [number, number][] = solid ? [[-L / 2, L / 2]] : [[-L / 2, -(L * TRIGRAM.gap) / 2], [(L * TRIGRAM.gap) / 2, L / 2]]
      for (const [a, c] of pieces) f.bar(mx + tx * a, mz + tz * a, mx + tx * c, mz + tz * c, TRIGRAM.bar, y)
    })
  }
  return f.build()
}

/** 点苔: moss as ink dots clustered on the joints between the slabs. */
export function mossGeometry(): BufferGeometry {
  const f = new Flat()
  const rand = rng(33)
  const half = P.size / 2
  const joints = [-P.slab / 2, P.slab / 2]
  const y = P.topY + 0.003
  for (let c = 0; c < 26; c++) {
    const vertical = rand() < 0.5
    const line = joints[Math.floor(rand() * 2)] ?? 0
    const along = (rand() * 2 - 1) * (half - 0.2)
    const n = 2 + Math.floor(rand() * 5)
    for (let i = 0; i < n; i++) {
      const a = along + (rand() - 0.5) * 0.35
      const off = (rand() - 0.5) * 0.2
      const [x, z] = vertical ? [line + off, a] : [a, line + off]
      f.disc(x, z, 0.012 + rand() * 0.03, y, 7, rand)
    }
  }
  return f.build()
}

/** A unit dot (filled) and a unit hollow dot for the Luo Shu numerals, instanced per palace. */
export function dotGeometry(hollow: boolean): BufferGeometry {
  const f = new Flat()
  if (hollow) f.ring(0, 0, DOT.inner, DOT.r, 0, 16)
  else f.disc(0, 0, DOT.r, 0, 16)
  return f.build()
}

/** 旬空: a small hollow circle (§9.3), unit placement. */
export function markRingGeometry(): BufferGeometry {
  const f = new Flat()
  f.ring(0, 0, 0.082, 0.108, 0, 20)
  return f.build()
}

/** A bar one unit long on +X, `DOT.join` wide, for the numeral joins (scaled per instance). */
export function joinGeometry(): BufferGeometry {
  const f = new Flat()
  f.bar(0, 0, 1, 0, DOT.join, 0)
  return f.build()
}

/** 值符 plate: a flat square-cornered plate, unit size (scaled per use). */
export function plateGeometry(): BufferGeometry {
  const f = new Flat()
  f.quad([-0.5, 0, -0.5], [0.5, 0, -0.5], [0.5, 0, 0.5], [-0.5, 0, 0.5])
  return f.build()
}

/** 值使: a brush circle (圈点), thick on one side, thin where the brush lifts, not quite closed. */
/** Brush width along the 值使 circle: loaded at the start, lifting off before it closes. */
const brushRingWidth = (t: number) => 0.012 + 0.05 * Math.sin(Math.PI * Math.min(1, t * 1.1)) ** 0.7

export function brushRingGeometry(rx: number, rz: number): BufferGeometry {
  const f = new Flat()
  const segs = 48
  const start = 0.35
  const sweep = Math.PI * 2 * 0.94
  const w = brushRingWidth
  const p = (t: number, grow: number): V3 => {
    const a = start + sweep * t
    return [Math.cos(a) * (rx + grow), 0, Math.sin(a) * (rz + grow)]
  }
  for (let i = 0; i < segs; i++) {
    const t0 = i / segs
    const t1 = (i + 1) / segs
    f.quad(p(t0, -w(t0) / 2), p(t0, w(t0) / 2), p(t1, w(t1) / 2), p(t1, -w(t1) / 2))
  }
  return f.build()
}

/** A tapered ribbon along a polyline (brush path, 值符 arc); draw a prefix with setDrawRange. */
export function ribbonGeometry(points: readonly (readonly [number, number])[], width: (t: number) => number, y: number): BufferGeometry {
  const f = new Flat()
  const n = points.length
  for (let i = 0; i < n - 1; i++) {
    const [x0, z0] = points[i] as [number, number]
    const [x1, z1] = points[i + 1] as [number, number]
    const len = Math.hypot(x1 - x0, z1 - z0) || 1
    const [nx, nz] = [-(z1 - z0) / len, (x1 - x0) / len]
    const w0 = width(i / (n - 1)) / 2
    const w1 = width((i + 1) / (n - 1)) / 2
    f.quad([x0 + nx * w0, y, z0 + nz * w0], [x1 + nx * w1, y, z1 + nz * w1], [x1 - nx * w1, y, z1 - nz * w1], [x0 - nx * w0, y, z0 - nz * w0])
  }
  return f.build()
}

/** Points along the Luo Shu path through the palace centres, with a slight brush wobble. */
export function luoShuPoints(path: readonly PalaceNo[]): [number, number][] {
  const out: [number, number][] = []
  const rand = rng(5)
  const steps = 10
  for (let i = 0; i < path.length - 1; i++) {
    const [x0, z0] = palaceLocal(path[i] as PalaceNo)
    const [x1, z1] = palaceLocal(path[i + 1] as PalaceNo)
    const [lx, lz] = [x1 - x0, z1 - z0]
    const len = Math.hypot(lx, lz) || 1
    const bow = (rand() - 0.5) * 0.25
    for (let s = 0; s < steps; s++) {
      const t = s / steps
      const sway = Math.sin(Math.PI * t) * bow
      out.push([x0 + lx * t - (lz / len) * sway, z0 + lz * t + (lx / len) * sway])
    }
  }
  out.push(palaceLocal(path.at(-1) as PalaceNo))
  return out
}

/** The 值符 arc as the album draws it: a quadratic bowed sideways by a third of its length. */
export function arcPoints(from: PalaceNo, to: PalaceNo): [number, number][] {
  const [x0, z0] = palaceLocal(from)
  const [x1, z1] = palaceLocal(to)
  const [dx, dz] = [x1 - x0, z1 - z0]
  const [qx, qz] = [(x0 + x1) / 2 - dz / 3, (z0 + z1) / 2 + dx / 3]
  const out: [number, number][] = []
  const n = 40
  for (let i = 0; i <= n; i++) {
    const t = i / n
    const a = (1 - t) * (1 - t)
    const b = 2 * (1 - t) * t
    const c = t * t
    out.push([a * x0 + b * qx + c * x1, a * z0 + b * qz + c * z1])
  }
  return out
}

/** The selection wash for a palace (§9.7): its slab and the ring sectors on its bearing, with an outline. */
export function washGeometry(p: PalaceNo, fill: Color, line: Color): BufferGeometry {
  const fillPos = new Flat()
  const linePos = new Flat()
  const [cx, cz] = palaceLocal(p)
  const h = SLAB_HALF
  const y = P.topY + 0.006
  fillPos.quad([cx - h, y, cz - h], [cx + h, y, cz - h], [cx + h, y, cz + h], [cx - h, y, cz + h])
  const edge = 0.06
  linePos.bar(cx - h, cz - h, cx + h, cz - h, edge, y)
  linePos.bar(cx + h, cz - h, cx + h, cz + h, edge, y)
  linePos.bar(cx + h, cz + h, cx - h, cz + h, edge, y)
  linePos.bar(cx - h, cz + h, cx - h, cz - h, edge, y)
  if (p !== 5) {
    const bearing = slotOf(p) * 45
    for (const r of [RINGS.heaven, RINGS.human, RINGS.spirit, RINGS.mountains]) {
      const yy = r.topY + 0.03
      fillPos.sector(r.r0, r.r1, bearing - 22.5, bearing + 22.5, yy)
      linePos.sector(r.r0, r.r0 + edge, bearing - 22.5, bearing + 22.5, yy)
      linePos.sector(r.r1 - edge, r.r1, bearing - 22.5, bearing + 22.5, yy)
      for (const side of [-22.5, 22.5]) {
        const [x0, z0] = bearingPoint(bearing + side, r.r0)
        const [x1, z1] = bearingPoint(bearing + side, r.r1)
        linePos.bar(x0, z0, x1, z1, edge, yy)
      }
    }
  }
  const pos = [...fillPos.pos, ...linePos.pos]
  const col: number[] = []
  const push = (c: Color, a: number, count: number) => {
    for (let i = 0; i < count; i++) col.push(c.r, c.g, c.b, a)
  }
  push(fill, 0.15, fillPos.pos.length / 3)
  push(line, 0.9, linePos.pos.length / 3)
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(pos, 3))
  g.setAttribute('color', new BufferAttribute(new Float32Array(col), 4))
  g.computeBoundingSphere()
  return g
}

const tipPoint = (z: number): V3[] => [0, 1, 2, 3].map((): V3 => [0, 0, z])

/** The floating needle (天池): iron, its south tip cinnabar (指南). Points north along +Z. */
export function needleGeometry(iron: Color, tip: Color): BufferGeometry {
  const pos: number[] = []
  const col: number[] = []
  const len = 0.8
  const w = 0.05
  const t = 0.016
  const tipAt = -0.44
  const section = (z: number, s: number): V3[] => [
    [w * s, 0, z],
    [0, t * s, z],
    [-w * s, 0, z],
    [0, -t * s, z],
  ]
  const piece = (a: readonly V3[], b: readonly V3[], c: Color) => {
    for (let i = 0; i < 4; i++) {
      const a0 = a[i] as V3
      const a1 = a[(i + 1) % 4] as V3
      const b0 = b[i] as V3
      const b1 = b[(i + 1) % 4] as V3
      pos.push(...a0, ...b0, ...b1, ...a0, ...b1, ...a1)
      for (let k = 0; k < 6; k++) col.push(c.r, c.g, c.b)
    }
  }
  const mid = section(0, 1)
  const cut = section(tipAt, 1 - Math.abs(tipAt) / len)
  piece(tipPoint(len), mid, iron)
  piece(mid, cut, iron)
  piece(cut, tipPoint(-len), tip)
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(pos, 3))
  g.setAttribute('color', new Float32BufferAttribute(col, 3))
  g.computeBoundingSphere()
  return g
}
