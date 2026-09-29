/**
 * The camera path (design.md §6.3): two centripetal Catmull-Rom splines, position and look-at,
 * through the beat-table keys in core/world/journey.ts, with a piecewise-linear jvh → spline
 * parameter map so holds are flat. Inside each segment the parameter is arc length, so the camera
 * moves at an even speed between two keys instead of bunching up near the tighter control point.
 *
 * A key with `cut` starts a new spline (the moon gate at 572), so nothing interpolates across the
 * teleport. Portrait overrides (§6.4) and the plan-view h_fit replace keys before the splines are
 * built; rebuild the path when either changes.
 */

import { CatmullRomCurve3, Vector3 } from 'three'
import { BEATS, PORTRAIT, type BeatId, type Key, type PortraitOverride } from '../world/journey'
import type { Vec3 } from '../world/layout'
import { keyTrack, sameVec3, trackParam, type KeyTrack } from '../scroll/progress'

export interface PathVariant {
  /** Aspect below 1: §6.4 portrait overrides and look lift. */
  readonly portrait: boolean
  /** Plan-view camera height for keys marked `fit: 'plan'`. */
  readonly hFit: number
}

const withY = (v: Vec3, y: number): Vec3 => [v[0], y, v[2]]

/** Every key of a Vec3 channel across the walk, with the variant applied. */
export function vecKeys(channel: 'pos' | 'look', variant: PathVariant): Key<Vec3>[] {
  // PORTRAIT and BEATS are live bindings (a detour can join the grove walk): read them per call.
  const overrides: Partial<Record<BeatId, PortraitOverride>> = PORTRAIT.overrides
  const lookLift: ReadonlySet<BeatId> = new Set(PORTRAIT.lookLiftBeats)
  const out: Key<Vec3>[] = []
  for (const b of BEATS) {
    let keys: readonly Key<Vec3>[] = b[channel]
    if (variant.portrait) {
      const o = overrides[b.id]
      if (channel === 'pos' && o?.pos) keys = o.pos
      if (channel === 'look' && o?.look) keys = o.look
      const x = o?.posX
      if (channel === 'pos' && x !== undefined) keys = keys.map((k) => ({ ...k, v: [x, k.v[1], k.v[2]] as Vec3 }))
      if (channel === 'look' && lookLift.has(b.id)) keys = keys.map((k) => ({ ...k, v: withY(k.v, k.v[1] + PORTRAIT.lookLift) }))
    }
    for (const k of keys) out.push(k.fit === 'plan' ? { ...k, v: withY(k.v, variant.hFit) } : k)
  }
  return out
}

/** Samples per segment for the arc-length table. Segments are short; 24 keeps the error under a centimetre. */
const LUT_STEPS = 24

interface Piece {
  /** jvh of the piece's first key; the piece applies from here to the next piece. */
  readonly from: number
  readonly track: KeyTrack<Vec3>
  readonly curve: CatmullRomCurve3 | null
  /** Per segment: cumulative arc length at LUT_STEPS + 1 evenly spaced curve parameters, normalised to 0..1. */
  readonly lut: readonly Float64Array[]
}

function buildPiece(keys: readonly Key<Vec3>[]): Piece {
  const track = keyTrack(keys, sameVec3)
  const n = track.points.length
  if (n < 2) return { from: keys[0]?.at ?? 0, track, curve: null, lut: [] }
  const curve = new CatmullRomCurve3(
    track.points.map((p) => new Vector3(...p)),
    false,
    'centripetal',
  )
  const a = new Vector3()
  const b = new Vector3()
  const lut: Float64Array[] = []
  for (let i = 0; i < n - 1; i++) {
    const table = new Float64Array(LUT_STEPS + 1)
    curve.getPoint(i / (n - 1), a)
    for (let j = 1; j <= LUT_STEPS; j++) {
      curve.getPoint((i + j / LUT_STEPS) / (n - 1), b)
      table[j] = (table[j - 1] as number) + a.distanceTo(b)
      a.copy(b)
    }
    const total = table[LUT_STEPS] as number
    for (let j = 1; j <= LUT_STEPS; j++) table[j] = total > 0 ? (table[j] as number) / total : j / LUT_STEPS
    lut.push(table)
  }
  return { from: keys[0]?.at ?? 0, track, curve, lut }
}

/** Arc-length fraction s (0..1) along a segment → curve parameter fraction inside that segment. */
function arcToLocal(table: Float64Array, s: number): number {
  let j = 1
  while (j < LUT_STEPS && (table[j] as number) < s) j++
  const l0 = table[j - 1] as number
  const l1 = table[j] as number
  const f = l1 > l0 ? (s - l0) / (l1 - l0) : 0
  return (j - 1 + f) / LUT_STEPS
}

/** One Vec3 channel as a chain of splines split at cuts. */
export class SplineTrack {
  private readonly pieces: readonly Piece[]
  /** jvh values where the channel teleports. */
  readonly cuts: readonly number[]

  constructor(keys: readonly Key<Vec3>[]) {
    const groups: Key<Vec3>[][] = [[]]
    for (const k of keys) {
      if (k.cut && (groups[groups.length - 1] as Key<Vec3>[]).length > 0) groups.push([])
      ;(groups[groups.length - 1] as Key<Vec3>[]).push(k)
    }
    this.pieces = groups.filter((g) => g.length > 0).map(buildPiece)
    this.cuts = this.pieces.slice(1).map((p) => p.from)
  }

  sample(jvh: number, out: Vector3): Vector3 {
    let piece = this.pieces[0]
    for (const p of this.pieces) if (jvh >= p.from) piece = p
    if (!piece) return out.set(0, 0, 0)
    const { track, curve, lut } = piece
    const n = track.points.length
    const param = trackParam(track, jvh)
    const i = Math.min(Math.floor(param), n - 1)
    const s = param - i
    if (!curve || i >= n - 1 || s <= 0) return out.set(...(track.points[i] as Vec3))
    return curve.getPoint((i + arcToLocal(lut[i] as Float64Array, s)) / (n - 1), out)
  }
}

/** Normalised lerp between keys of a unit-vector channel (camera.up); constant beyond the ends. */
export function sampleUnit(keys: readonly Key<Vec3>[], jvh: number, out: Vector3): Vector3 {
  const first = keys[0]
  if (!first) return out.set(0, 1, 0)
  if (jvh <= first.at) return out.set(...first.v)
  for (let i = 1; i < keys.length; i++) {
    const a = keys[i - 1] as Key<Vec3>
    const b = keys[i] as Key<Vec3>
    if (jvh < b.at) {
      if (b.cut || b.at === a.at) return out.set(...a.v)
      const t = (jvh - a.at) / (b.at - a.at)
      out.set(a.v[0] + (b.v[0] - a.v[0]) * t, a.v[1] + (b.v[1] - a.v[1]) * t, a.v[2] + (b.v[2] - a.v[2]) * t)
      return out.lengthSq() > 1e-12 ? out.normalize() : out.set(...b.v)
    }
  }
  return out.set(...(keys[keys.length - 1] as Key<Vec3>).v)
}

export interface CameraPath {
  readonly variant: PathVariant
  readonly pos: SplineTrack
  readonly look: SplineTrack
}

export function buildCameraPath(variant: PathVariant): CameraPath {
  return { variant, pos: new SplineTrack(vecKeys('pos', variant)), look: new SplineTrack(vecKeys('look', variant)) }
}
