import { J, MARKS, beatSpanById, holdOf, scrollSvhBetween, type BeatId } from '../core/world/beats'
import { features } from '../content/features'

/**
 * When each copy card shows in the immersive walk (design.md §6.1, §6.4, §8). Pure data plus the
 * opacity function the card driver runs on every scroll frame.
 *
 * Layout model: a card sits in a sticky frame one viewport tall, inside a track that runs from its
 * beat's start for `trackSvh + 100` svh (holds scroll longer than they read in jvh: beats.ts
 * HOLD_STRETCH). The frame therefore pins exactly while the scroll is inside [beat start, beat start
 * + trackJvh]; the card's opacity window (`show` plus fades) sits inside that.
 */

export type CardZone = 'L' | 'R' | 'pane' | 'panel' | 'mount'

export interface CardSpec {
  readonly beat: BeatId
  readonly zone: CardZone
  /** jvh window at full opacity. */
  readonly show: readonly [number, number]
  /** Fade lengths in jvh before show[0] and after show[1]. */
  readonly fade: readonly [inJvh: number, outJvh: number]
  /** How long the frame stays pinned, in jvh from the beat start. Defaults to the beat length. */
  readonly trackJvh?: number
  /** Credits roll: the card scrolls up through its zone as the page scrolls (I4 timeline). */
  readonly roll?: boolean
  /** Section inscription sits above this card (the card centres in the space below it). */
  readonly underInscription?: boolean
}

const FADE = 6

const ALL_CARDS: readonly CardSpec[] = [
  // Hero holds 0–35 and fades out 40–65 while the camera steps in.
  { beat: 'T0', zone: 'L', show: [0, MARKS.heroFadeOut[0]], fade: [0, MARKS.heroFadeOut[1] - MARKS.heroFadeOut[0]] },
  { beat: 'F1', zone: 'L', show: holdOf('F1'), fade: [FADE, FADE] },
  { beat: 'F3', zone: 'L', show: holdOf('F3'), fade: [FADE, FADE] },
  { beat: 'C1', zone: 'L', show: holdOf('C1'), fade: [4, 3], underInscription: true },
  { beat: 'I1', zone: 'L', show: holdOf('I1'), fade: [FADE, 4], underInscription: true },
  { beat: 'I2a', zone: 'R', show: holdOf('I2a'), fade: [4, 4] },
  { beat: 'I2b', zone: 'L', show: holdOf('I2b'), fade: [4, 4], underInscription: true },
  { beat: 'I2c', zone: 'R', show: holdOf('I2c'), fade: [4, 4] },
  { beat: 'I2d', zone: 'L', show: holdOf('I2d'), fade: [4, 4], underInscription: true },
  { beat: 'I3', zone: 'pane', show: holdOf('I3'), fade: [4, 4] },
  // The timeline rolls like end credits and is gone before the whiteout at 562.
  { beat: 'I4', zone: 'R', show: [530, MARKS.moonGate[0] - 6], fade: [2, 6], roll: true },
  { beat: 'P1', zone: 'R', show: holdOf('P1'), fade: [4, FADE] },
  { beat: 'G1', zone: 'L', show: holdOf('G1'), fade: [FADE, 3], underInscription: true },
  { beat: 'G3', zone: 'panel', show: holdOf('G3'), fade: [2, 2] },
  // The contact card stays through E2; at E3 it moves onto the right mount (css: html[data-beat=E3]).
  { beat: 'E1', zone: 'L', show: [holdOf('E1')[0], J], fade: [FADE, 0], trackJvh: J - beatSpanById('E1').jvh[0], underInscription: true },
  { beat: 'E3', zone: 'mount', show: holdOf('E3'), fade: [4, 0] },
]

/** The grove's cards: its intro by the stream, the seat and the chart panel. Gone while it is paused. */
const GROVE_CARDS: ReadonlySet<BeatId> = new Set(['P1', 'G1', 'G3'])

export const CARDS: readonly CardSpec[] = features.grove ? ALL_CARDS : ALL_CARDS.filter((c) => !GROVE_CARDS.has(c.beat))

export const cardByBeat = (id: BeatId): CardSpec | undefined => CARDS.find((c) => c.beat === id)

/** Pinned length of the card's frame in jvh. */
export function trackJvh(spec: CardSpec): number {
  const b = beatSpanById(spec.beat)
  return spec.trackJvh ?? b.jvh[1] - b.jvh[0]
}

/** Pinned length of the card's frame in scroll svh: the DOM track's height less the one viewport. */
export function trackSvh(spec: CardSpec): number {
  const start = beatSpanById(spec.beat).jvh[0]
  return scrollSvhBetween(start, start + trackJvh(spec))
}

const smooth = (t: number) => t * t * (3 - 2 * t)

/** Card opacity 0..1 at a journey position. */
export function cardOpacity(spec: CardSpec, jvh: number): number {
  const [a, b] = spec.show
  const [fi, fo] = spec.fade
  if (jvh >= a && jvh <= b) return 1
  if (jvh < a) return fi > 0 && jvh > a - fi ? smooth((jvh - (a - fi)) / fi) : 0
  return fo > 0 && jvh < b + fo ? smooth(1 - (jvh - b) / fo) : 0
}

/**
 * Where the walk has to be for the card to show at full opacity, as close to `jvh` as possible: null
 * when it already does. Keyboard focus that lands in a hidden card glides here (bindings.ts). The
 * target sits 1 jvh inside the window, so a scroll that lands a hair short still shows the card whole.
 */
export function focusJvh(spec: CardSpec, jvh: number): number | null {
  const [a, b] = spec.show
  if (jvh >= a && jvh <= b) return null
  const inset = Math.min(1, (b - a) / 2)
  return Math.min(Math.max(jvh, a + inset), b - inset)
}

/** Credits-roll progress 0..1 across the card's visible window. */
export function rollProgress(spec: CardSpec, jvh: number): number {
  const start = spec.show[0] - spec.fade[0]
  const end = spec.show[1] + spec.fade[1]
  return Math.min(1, Math.max(0, (jvh - start) / (end - start)))
}
