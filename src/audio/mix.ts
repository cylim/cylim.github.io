/**
 * What the beds and the master should be doing at a journey state (design.md §12): a pure function,
 * so the whole cue sheet is testable without an AudioContext. The engine applies it with smoothing.
 */

import type { JourneyState } from '../core/store/journey'
import { J, MARKS } from '../core/world/beats'
import { channelKeys, sampleScalar, type Key } from '../core/world/journey'
import { pathZone, type Vec3 } from '../core/world/layout'
import { smoothstep } from './dsp'
import { BED_EDGE, BED_SPANS, CRACKLE_RISE, CUTOFF, GRIND_FULL_SPEED, HUM_THROUGH_DOOR, LEVEL, SILENCE_AFTER_SEAL, WIND_INSIDE, dbToGain, type Span } from './cues'

export type MixState = Pick<JourneyState, 'jvh' | 'insideCabin' | 'dive' | 'paper' | 'ringSpeed' | 'finale'>

export interface Mix {
  /** Output gains, linear. For beds 1 means 0 LUFS; 0 is silent. */
  wind: number
  pine: number
  stream: number
  hum: number
  crackle: number
  grind: number
  /** Stream pan, −1 left to 1 right: where the stepping stones sit on screen. */
  streamPan: number
  /** Hum low-pass, Hz: closed outside, opening through the door, open inside. */
  humCutoff: number
  /** Bed gain under a fog-dive or the moon-gate paper, linear. */
  duck: number
  /** Master low-pass, Hz. */
  cutoff: number
  /** A dive or the paper is driving the cutoff and the duck, so they should follow fast. */
  diving: boolean
  /** The seal has stamped and the finale holds: nothing but silence. */
  silence: boolean
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
/** Log-frequency interpolation, so a sweep sounds even. */
const sweep = (fromHz: number, toHz: number, t: number) => fromHz * (toHz / fromHz) ** t

/** 0..1: inside the span, with ±BED_EDGE crossfades on edges that aren't the ends of the walk. */
export function spanWeight(jvh: number, [a, b]: Span, edge = BED_EDGE): number {
  const rise = a <= 0 ? 1 : smoothstep(a - edge, a + edge, jvh)
  const fall = b >= J ? 1 : 1 - smoothstep(b - edge, b + edge, jvh)
  return rise * fall
}

const bedWeight = (jvh: number, spans: readonly Span[]) => Math.max(0, ...spans.map((s) => spanWeight(jvh, s)))

/** The forest bed drops away in the mist wall and returns as the mist parts (§8.5). */
function mistDip(jvh: number): number {
  const [close, closed] = CUTOFF.mistClose
  return jvh < MARKS.reveal[0] ? 1 - smoothstep(close, closed, jvh) : smoothstep(MARKS.reveal[0], MARKS.reveal[1], jvh)
}

/** The master's cutoff from the place alone: open, closing into the mist wall, then the revealed sky. */
function placeCutoff(jvh: number): number {
  const [close, closed] = CUTOFF.mistClose
  if (jvh < close) return CUTOFF.open
  if (jvh < MARKS.reveal[0]) return sweep(CUTOFF.open, CUTOFF.mist, clamp01((jvh - close) / (closed - close)))
  return CUTOFF.reveal
}

/** How far the door has swung, 0..1 (§8.3, scrubbed by scroll). */
const doorOpen = (jvh: number) => clamp01((jvh - MARKS.doorSwing[0]) / (MARKS.doorSwing[1] - MARKS.doorSwing[0]))

// The camera's ground track from the beat table, piecewise-linear between keys: close enough to
// place a sound, and it follows any retuning of the path.
const track = (channel: 'pos' | 'look', axis: 0 | 2): Key<number>[] =>
  channelKeys(channel).map((k: Key<Vec3>) => ({ at: k.at, v: k.v[axis], ...(k.cut ? { cut: k.cut } : {}) }))
const posX = track('pos', 0)
const posZ = track('pos', 2)
const lookX = track('look', 0)
const lookZ = track('look', 2)
const STONES = { x: (pathZone.steppingStones.x0 + pathZone.steppingStones.x1) / 2, z: pathZone.steppingStones.z }
/** Metres at which the stones' pan is halved. */
const STREAM_NEAR = 3

/**
 * Pan for the stream: the sine of the stepping stones' bearing off the view direction, facing south
 * (−Z) screen-right is west (+X). Straight ahead or behind is centre, and so is close by: stepping
 * over the stones puts the water all around you, not hard to one side.
 */
export function streamPan(jvh: number): number {
  const px = sampleScalar(posX, jvh)
  const pz = sampleScalar(posZ, jvh)
  let fx = sampleScalar(lookX, jvh) - px
  let fz = sampleScalar(lookZ, jvh) - pz
  const fl = Math.hypot(fx, fz) || 1
  fx /= fl
  fz /= fl
  let tx = STONES.x - px
  let tz = STONES.z - pz
  const tl = Math.hypot(tx, tz) || 1
  tx /= tl
  tz /= tl
  // Screen-right on the ground is the forward direction turned a quarter clockwise from above: (−fz, fx).
  const side = tx * -fz + tz * fx
  return Math.min(1, Math.max(-1, side * (tl / (tl + STREAM_NEAR))))
}

export function mixAt(s: MixState): Mix {
  const { jvh } = s
  const cover = Math.max(s.dive.amount, s.paper)
  const silence = s.finale.sealStamped && jvh >= SILENCE_AFTER_SEAL.fromJvh

  const humOpen = s.insideCabin ? 1 : HUM_THROUGH_DOOR * doorOpen(jvh)
  const crackleT = clamp01((jvh - CRACKLE_RISE[0]) / (CRACKLE_RISE[1] - CRACKLE_RISE[0]))

  return {
    wind: dbToGain(LEVEL.wind) * bedWeight(jvh, BED_SPANS.wind) * (s.insideCabin ? WIND_INSIDE : 1),
    pine: dbToGain(LEVEL.pine) * bedWeight(jvh, BED_SPANS.pine) * mistDip(jvh),
    stream: dbToGain(LEVEL.stream) * bedWeight(jvh, BED_SPANS.stream),
    hum: dbToGain(lerp(LEVEL.humOutside, LEVEL.humInside, humOpen)) * bedWeight(jvh, BED_SPANS.hum),
    crackle: dbToGain(lerp(LEVEL.crackle[0], LEVEL.crackle[1], crackleT)) * bedWeight(jvh, BED_SPANS.crackle),
    grind: dbToGain(LEVEL.grind) * clamp01(s.ringSpeed / GRIND_FULL_SPEED),
    streamPan: streamPan(jvh),
    humCutoff: sweep(CUTOFF.humClosed, CUTOFF.humOpen, humOpen),
    duck: dbToGain(LEVEL.duck * cover),
    cutoff: sweep(placeCutoff(jvh), CUTOFF.dive, cover),
    diving: cover > 0.001,
    silence,
  }
}
