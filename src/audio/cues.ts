/**
 * The sound cue sheet (design.md §12) as data: levels, where each bed plays, filter settings and
 * rate caps. mix.ts turns it into gains for a journey state; voices.ts builds the sounds.
 *
 * What a level means depends on the cue. Continuous beds are loudness: LUFS (BS.1770, both
 * channels summed), measured alone at full weight. One-shots and the sparse crackle are sample
 * peaks in dBFS. voices.ts trims every graph so these numbers are what comes out on the mix bus
 * (calibrate.ts measures them).
 *
 * Summed at these levels the walk comes to about −27 LUFS integrated, hotter than the sheet's
 * "about −30". The sheet's levels set the balance; MASTER_DB then brings the whole walk to the
 * integrated target, and the limiter holds every peak under LEVEL.ceiling.
 */

import { J, MARKS, SCENE_SPANS } from '../core/world/beats'
import { onWalkChange } from '../core/world/walk'
import { motion } from '../theme/tokens'

export const dbToGain = (db: number): number => (db === -Infinity ? 0 : 10 ** (db / 20))
export const gainToDb = (gain: number): number => (gain <= 0 ? -Infinity : 20 * Math.log10(gain))

export const LEVEL = {
  wind: -30,
  pine: -28,
  stream: -30,
  humOutside: -40,
  humInside: -26,
  /**
   * At GRIND_FULL_SPEED and above. The sheet says −24; the grind plays over the grove beds, and at
   * −24 the casting came out as loud as the guqin, which must stay the loudest moment on the site.
   */
  grind: -26,
  /** Peak of the loudest pop, rising across the contact span. */
  crackle: [-34, -28],
  creak: -22,
  ignition: -24,
  keys: -32,
  whoosh: -24,
  guqin: -18,
  detent: -26,
  chime: -22,
  seal: -20,
  /** Beds under a fog-dive or the moon-gate paper. */
  duck: -18,
  /** Master limiter ceiling, after MASTER_DB. */
  ceiling: -14,
} as const

/** One trim on the whole mix, before the limiter: the walk at the sheet's balance, about −30 LUFS integrated. */
export const MASTER_DB = -3

export type BedId = 'wind' | 'pine' | 'stream' | 'hum' | 'crackle'
export type Span = readonly [number, number]

/**
 * Where each bed plays, in jvh (§12 table), by where the scenes draw (SCENE_SPANS: with the grove
 * paused, the path's pines run to the cut in the mist wall and the lantern's crackle starts there).
 * Inner edges crossfade over ±BED_EDGE. Walk-dependent, like CRACKLE_RISE and SILENCE_AFTER_SEAL:
 * live bindings, rebuilt when a detour joins the grove walk (core/world/walk.ts).
 */
const buildBedSpans = (): Record<BedId, readonly Span[]> => ({
  wind: [
    [0, 322],
    [SCENE_SPANS.grove[0], J],
  ],
  pine: [
    [90, SCENE_SPANS.threshold[1]],
    [584, SCENE_SPANS.grove[1]],
  ],
  stream: [[580, 612]],
  hum: [SCENE_SPANS.cabin],
  crackle: [SCENE_SPANS.contact],
})

export let BED_SPANS = buildBedSpans()

/** The crackle rises from LEVEL.crackle[0] to [1] across this span. */
export let CRACKLE_RISE: Span = SCENE_SPANS.contact

export const BED_EDGE = 8

/** Wind left behind once the camera is past the door plane, before its span ends at 322. */
export const WIND_INSIDE = 0.2

/** Master and hum low-pass cutoffs, Hz. */
export const CUTOFF = {
  /** The master's resting cutoff; a dive closes it to `dive` and reopens it. */
  open: 12000,
  dive: 300,
  /** The P2 mist wall closes the master over its first 10 jvh... */
  mist: 500,
  mistClose: [MARKS.mistWall[0], MARKS.mistWall[0] + 10] as Span,
  /** ...and the reveal opens it to 16 kHz over 2 s, for the rest of the walk. */
  reveal: 16000,
  revealSeconds: 2,
  humClosed: 250,
  humOpen: 6000,
} as const

/** How far the hum opens (0 closed, 1 inside) through the fully swung door, before the camera crosses. */
export const HUM_THROUGH_DOOR = 0.35

/** Ring speed, in 45° slots per second, at which the grind reaches LEVEL.grind. */
export const GRIND_FULL_SPEED = 3

export const DETENT_MAX_PER_SECOND = 8
/** Held-key autorepeat is about 30 per second; nothing faster is typing. */
export const KEYS_MAX_PER_SECOND = 30
/** A burst of recasts (stepping the hour) chimes once. */
export const CHIME_MIN_GAP_S = 10

/** Every random choice in the sound starts from this seed, so a visit sounds the same each time. */
export const SEED = 0x6c696d

export const FADE_IN_S = motion.soundFadeIn / 1000
export const FADE_OUT_S = motion.soundFadeIn / 1000

/** After the seal: let the thud ring this long, then fade the beds to silence. */
const buildSilence = () => ({ delay: 0.5, tau: 0.5, fromJvh: MARKS.sealStamp - 10 }) as const

export let SILENCE_AFTER_SEAL = buildSilence()

onWalkChange(() => {
  BED_SPANS = buildBedSpans()
  CRACKLE_RISE = SCENE_SPANS.contact
  SILENCE_AFTER_SEAL = buildSilence()
})
