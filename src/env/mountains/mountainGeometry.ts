/**
 * Mountain silhouettes (design §5, §7.2; stack.md §5 mountain.frag). Ridge heights are computed
 * here, per column, and baked into a `ridge` attribute; the shader adds fine ragged detail below
 * that line and discards above it, so the silhouette writes depth and the ink pass contours it.
 * Normals are painted, not physical: each flank faces the way its ridge slopes, so the painter's
 * light lights left-rising flanks and leaves right-falling ones for the axe-cut strokes.
 */

import { BufferGeometry, Float32BufferAttribute, Vector3 } from 'three'
import { dirToBearing, mountains, threshold } from '../../core/world/layout'
import { fbm1, lerp } from '../random'

/** Card bottoms sit below the lowland beyond the ledge (y −25), so no ridge ever shows a floor. */
export const MOUNTAIN_BASE_Y = -32

export interface RingLayer {
  radius: number
  seed: number
  /** Ridge height range above y 0, metres. */
  low: number
  high: number
  /** Ridge wavelength along the ring, metres. */
  wavelength: number
  /** 0 = near and dark .. 1 = far and pale. */
  tone: number
  /** How much further out the southern arc stands (radius × (1 + push) due south). */
  southPush: number
}

/**
 * Near rings stay lower than far ones, so from K0 each layer peeks over the one in front (平远),
 * and every crest clears the ground mist (about 15 m thick at K0) so the layers read as pale ink
 * rising out of it: crests at roughly 58%, 64% and 70% of the K0 frame height, just over the
 * forest band (design §8.1 asks for 55 to 65%).
 */
export const RING_LAYERS: readonly RingLayer[] = [
  { radius: mountains.ridgeRing.radii[0] ?? 160, seed: 5, low: 13, high: 32, wavelength: 70, tone: 0, southPush: mountains.ridgeRing.southPush[0] ?? 0 },
  { radius: mountains.ridgeRing.radii[1] ?? 230, seed: 17, low: 22, high: 54, wavelength: 105, tone: 0.2, southPush: mountains.ridgeRing.southPush[1] ?? 0 },
  { radius: mountains.ridgeRing.radii[2] ?? 320, seed: 29, low: 36, high: 86, wavelength: 150, tone: 0.4, southPush: mountains.ridgeRing.southPush[2] ?? 0 },
]

function ringRidge(layer: RingLayer, s: number, bearing: number): number {
  const f = fbm1(s / layer.wavelength, layer.seed)
  let h = lerp(layer.low, layer.high, Math.pow(Math.min(1, Math.max(0, (f - 0.25) / 0.55)), 1.4))
  // The near ring dips in the south, under the main peak, so the peak rises clear of it from the signpost
  // (E1). Only a little: pushed out to 230 m it sits low under the peak anyway, and a deep dip
  // flattens its crest into a ruled line.
  if (layer.radius < 200) h *= 1 - 0.25 * Math.exp(-(((bearing - 180) / 35) ** 2))
  return h
}

/** Radius multiplier of a ring layer at angle th (radians from +X toward +Z): 1 in the north, 1 + push due south. */
export function ringStretch(layer: RingLayer, th: number): number {
  const south = Math.max(0, -Math.sin(th))
  return 1 + layer.southPush * south * south * (3 - 2 * south)
}

/**
 * Painted normals want a slope that changes over a brush's width, not per column: a sign flip
 * between two columns lights one flank and darkens the next as a hard vertical seam down the card.
 */
function smoothSlopes(tops: readonly number[], positions: readonly number[], window: number, wrap: boolean): number[] {
  const n = tops.length
  const at = (i: number) => (wrap ? (((i % n) + n) % n) : Math.min(n - 1, Math.max(0, i)))
  return tops.map((_, i) => {
    const a = at(i - window)
    const b = at(i + window)
    const run = wrap ? window * 2 * ((positions[1] ?? 1) - (positions[0] ?? 0)) : (positions[b] ?? 0) - (positions[a] ?? 0)
    return run === 0 ? 0 : ((tops[b] ?? 0) - (tops[a] ?? 0)) / run
  })
}

function band(columns: { x: number; z: number; top: number; s: number; n: Vector3 }[]): BufferGeometry {
  const pos: number[] = []
  const nrm: number[] = []
  const uv: number[] = []
  const ridge: number[] = []
  for (const c of columns) {
    for (const y of [MOUNTAIN_BASE_Y, c.top]) {
      pos.push(c.x, y, c.z)
      nrm.push(c.n.x, c.n.y, c.n.z)
      uv.push(c.s, y)
      ridge.push(c.top)
    }
  }
  const idx: number[] = []
  for (let i = 0; i < columns.length - 1; i++) {
    const a = i * 2
    idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3)
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(pos, 3))
  g.setAttribute('normal', new Float32BufferAttribute(nrm, 3))
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2))
  g.setAttribute('ridge', new Float32BufferAttribute(ridge, 1))
  g.setIndex(idx)
  g.computeBoundingSphere()
  return g
}

/**
 * One ridge layer as a closed band facing the ring centre. The southern arc stands further out
 * (`ringStretch`) and its heights scale with its distance from K0, so the threshold's crests keep
 * their elevation while the signpost (E0, E1) sees them far off.
 */
export function buildRing(layer: RingLayer): BufferGeometry {
  const [cx, , cz] = mountains.ridgeRing.centre
  const [kx, ky, kz] = threshold.k0
  const R = layer.radius
  const segments = Math.round((2 * Math.PI * R) / 6)
  const cols = Array.from({ length: segments + 1 }, (_, i) => {
    const th = (i / segments) * Math.PI * 2
    const dx = Math.cos(th)
    const dz = Math.sin(th)
    const r = R * ringStretch(layer, th)
    const x = cx + dx * r
    const z = cz + dz * r
    const h0 = ringRidge(layer, R * th, dirToBearing(dx, dz))
    const k = Math.hypot(x - kx, z - kz) / Math.max(1, Math.hypot(cx + dx * R - kx, cz + dz * R - kz))
    return { th, x, z, top: ky + (h0 - ky) * k }
  })
  const tops = cols.map((c) => c.top)
  const along = cols.map((c) => R * c.th)
  const slopes = smoothSlopes(tops, along, 2, true)
  const columns = cols.map((c, i) => {
    const inward = new Vector3(-Math.cos(c.th), 0, -Math.sin(c.th))
    const tangent = new Vector3(-Math.sin(c.th), 0, Math.cos(c.th))
    const n = inward.clone().add(new Vector3(0, 0.6, 0)).addScaledVector(tangent, -(slopes[i] ?? 0) * 1.6).normalize()
    return { x: c.x, z: c.z, top: c.top, s: R * c.th, n }
  })
  return band(columns)
}

interface PeakCard {
  centre: readonly [number, number, number]
  width: number
}

/** Blocky shoulders around a central summit: (offset from centre, height, width), metres. */
type Bumps = readonly (readonly [dx: number, h: number, w: number])[]

function buildPeakCard({ centre, width }: PeakCard, bumps: Bumps, seed: number): BufferGeometry {
  const x0 = centre[0] - width / 2
  const n = 180
  const tops: number[] = []
  const xs: number[] = []
  for (let i = 0; i <= n; i++) {
    const x = x0 + (i / n) * width
    let h = 14
    for (const [dx, bh, w] of bumps) {
      const t = (x - (centre[0] + dx)) / w
      h = Math.max(h, bh * Math.exp(-t * t * 1.5))
    }
    // Rocky irregularity, stronger on the higher ground.
    h += (fbm1(x / 14, seed) - 0.5) * (4 + h * 0.08)
    // Taper both ends into the ridge ring so the card never shows a vertical edge.
    const edge = Math.min(i, n - i) / (n * 0.12)
    tops.push(h * Math.min(1, edge))
    xs.push(x)
  }
  const slopes = smoothSlopes(tops, xs, 4, false)
  const columns = tops.map((top, i) => {
    const nrm = new Vector3(-(slopes[i] ?? 0) * 1.4, 0.45, 1).normalize()
    return { x: xs[i] ?? 0, z: centre[2], top, s: (xs[i] ?? 0) - x0, n: nrm }
  })
  return band(columns)
}

/**
 * The main peak (design §5.1): one card 220 m wide at z −340, summit y 115, a Fan Kuan massif
 * of blocky shoulders around a central summit. Faces north, toward the walk.
 */
export function buildMainPeak(): BufferGeometry {
  const p = mountains.mainPeak
  const S = p.summitY
  return buildPeakCard(p, [[0, S, 40], [-44, S * 0.66, 26], [36, S * 0.76, 30], [74, S * 0.45, 24], [-86, S * 0.36, 26], [-16, S * 0.84, 18]], 71)
}

/**
 * The cabin's peak (design §8.3 C1): a broad-shouldered massif with a heavy, rounded crown, the
 * way Fan Kuan's mountain fills the sky over the travellers. Faces north, toward the cabin.
 */
export function buildCabinPeak(): BufferGeometry {
  const p = mountains.cabinPeak
  const S = p.summitY
  return buildPeakCard(p, [[0, S, 30], [-12, S * 0.96, 22], [14, S * 0.9, 20], [-38, S * 0.66, 20], [40, S * 0.62, 22], [-62, S * 0.4, 18], [62, S * 0.36, 18]], 83)
}
