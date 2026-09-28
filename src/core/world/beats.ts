/**
 * The walk's grid without the camera: section spans (design.md §6.2), beat ranges, holds and text
 * zones (§6.1, §6.4), scroll marks (§8, §11.2) and the framing fractions the DOM lays out against.
 *
 * This is what the DOM layer and boot need, so it ships in the boot chunk. The camera keys and the
 * beat notes in journey.ts ship with the stage instead, which keeps about 3 KB gzip out of boot.
 * journey.ts re-exports everything here. Its BEATS rows repeat each beat's range, hold and zone so
 * the camera table still reads on its own; beats.test.ts fails if the two drift. Owner: core-journey.
 */

import type { SectionId } from '../sections/ids'

export const J = 1000

export const jvhToU = (jvh: number) => jvh / J
export const uToJvh = (u: number) => u * J

// ---------------------------------------------------------------------------- sections (§6.2)

export interface SectionSpan {
  readonly id: SectionId
  /** [start, end) in jvh. */
  readonly jvh: readonly [number, number]
  /** Where a jump lands. */
  readonly arrivalJvh: number
  /** DOM <section> height in svh. The last section adds the final 100 svh viewport. */
  readonly heightSvh: number
}

export const SECTION_SPANS = {
  threshold: { id: 'threshold', jvh: [0, 245], arrivalJvh: 0, heightSvh: 245 },
  cabin: { id: 'cabin', jvh: [245, 572], arrivalJvh: 345, heightSvh: 327 },
  grove: { id: 'grove', jvh: [572, 862], arrivalJvh: 666, heightSvh: 290 },
  contact: { id: 'contact', jvh: [862, 1000], arrivalJvh: 886, heightSvh: 238 },
} as const satisfies Record<SectionId, SectionSpan>

export function sectionAtJvh(jvh: number): SectionId {
  if (jvh < SECTION_SPANS.cabin.jvh[0]) return 'threshold'
  if (jvh < SECTION_SPANS.grove.jvh[0]) return 'cabin'
  if (jvh < SECTION_SPANS.contact.jvh[0]) return 'grove'
  return 'contact'
}

// ---------------------------------------------------------------------------- beats (§6.1)

export type BeatId =
  | 'T0' | 'T1'
  | 'F1' | 'F2' | 'F3' | 'F4'
  | 'C1' | 'C2' | 'C3' | 'C4'
  | 'I0' | 'I1' | 'I2a' | 'I2b' | 'I2c' | 'I2d' | 'I3' | 'I4'
  | 'P0' | 'P1' | 'P2' | 'P3'
  | 'G0' | 'G1' | 'G2' | 'G3' | 'G4'
  | 'E0' | 'E1' | 'E2' | 'E3'

/**
 * Where the DOM copy sits while the beat holds (§6.4). Desktop: L, R (30rem columns, 6vw in),
 * TL (inscription area), pane (terminal over the 3D pane), panel (grove chart, right third),
 * mount (finale album layout). Portrait maps every text zone to B (bottom card).
 */
export type TextZone = 'L' | 'R' | 'TL' | 'pane' | 'panel' | 'mount' | 'B'

/** A beat's place in the walk, without its camera keys. */
export interface BeatSpan {
  readonly id: BeatId
  readonly section: SectionId
  /** [start, end) in jvh. Beats tile 0..1000 with no gaps. */
  readonly jvh: readonly [number, number]
  /** Scroll range where the camera barely moves so the copy can be read. */
  readonly hold: readonly [number, number] | null
  readonly zone: TextZone | null
}

const span = (
  id: BeatId,
  section: SectionId,
  jvh: readonly [number, number],
  hold: readonly [number, number] | null,
  zone: TextZone | null,
): BeatSpan => ({ id, section, jvh, hold, zone })

export const BEAT_SPANS: readonly BeatSpan[] = [
  span('T0', 'threshold', [0, 40], [0, 35], 'L'),
  span('T1', 'threshold', [40, 90], null, null),
  span('F1', 'threshold', [90, 150], [100, 142], 'L'),
  span('F2', 'threshold', [150, 168], null, null),
  span('F3', 'threshold', [168, 222], [175, 215], 'L'),
  span('F4', 'threshold', [222, 245], null, null),
  span('C1', 'cabin', [245, 275], [250, 272], 'L'),
  span('C2', 'cabin', [275, 292], null, null),
  span('C3', 'cabin', [292, 308], [296, 306], null),
  span('C4', 'cabin', [308, 322], null, null),
  span('I0', 'cabin', [322, 336], null, null),
  span('I1', 'cabin', [336, 380], [345, 375], 'L'),
  span('I2a', 'cabin', [380, 405], [387, 403], 'R'),
  span('I2b', 'cabin', [405, 430], [412, 428], 'L'),
  span('I2c', 'cabin', [430, 455], [437, 453], 'R'),
  span('I2d', 'cabin', [455, 480], [462, 478], 'L'),
  span('I3', 'cabin', [480, 528], [488, 524], 'pane'),
  span('I4', 'cabin', [528, 572], null, 'R'),
  span('P0', 'grove', [572, 584], null, null),
  span('P1', 'grove', [584, 608], [588, 604], 'R'),
  span('P2', 'grove', [608, 628], null, null),
  span('P3', 'grove', [628, 645], null, null),
  span('G0', 'grove', [645, 660], null, null),
  span('G1', 'grove', [660, 715], [666, 712], 'TL'),
  span('G2', 'grove', [715, 740], null, null),
  span('G3', 'grove', [740, 835], [742, 833], 'panel'),
  span('G4', 'grove', [835, 862], null, null),
  span('E0', 'contact', [862, 880], null, null),
  span('E1', 'contact', [880, 935], [886, 932], 'L'),
  span('E2', 'contact', [935, 985], null, null),
  span('E3', 'contact', [985, 1000], [985, 1000], 'mount'),
]

export const BEAT_IDS: readonly BeatId[] = BEAT_SPANS.map((b) => b.id)

export function beatSpanAt(jvh: number): BeatSpan {
  const clamped = Math.min(Math.max(jvh, 0), J - 1e-9)
  return BEAT_SPANS.find((b) => clamped >= b.jvh[0] && clamped < b.jvh[1]) ?? (BEAT_SPANS[BEAT_SPANS.length - 1] as BeatSpan)
}

export function beatSpanById(id: BeatId): BeatSpan {
  const b = BEAT_SPANS.find((x) => x.id === id)
  if (!b) throw new Error(`unknown beat ${id}`)
  return b
}

/** The beat's hold, or the whole beat when it has none. */
export const holdOf = (id: BeatId): readonly [number, number] => {
  const b = beatSpanById(id)
  return b.hold ?? b.jvh
}

/** True inside any beat's hold range. */
export const inHold = (jvh: number) => BEAT_SPANS.some((b) => b.hold !== null && jvh >= b.hold[0] && jvh <= b.hold[1])

// ---------------------------------------------------------------------------- marks and seams (§8, §11.2)

/** Scroll positions that trigger or scrub something. Values in jvh. */
export const MARKS = {
  heroFadeOut: [40, 65],
  /** Prefetch the cabin chunk at u ≥ 0.12 (§11.3). */
  prefetchCabin: 120,
  /** Prefetch grove (+ contact) on entering the cabin, u ≥ 0.245. */
  prefetchGrove: 245,
  doorPortalOn: 274,
  doorSwing: [276, 290],
  doorCreak: 277,
  /** Approximate; the rig derives the real crossing from camera z vs layout.cabin.door.planeZ. */
  doorPlane: 316,
  /** Clicking the door or lattice smooth-scrolls here (a local scroll, not a dive). */
  doorClickTarget: 318,
  moonGate: [562, 572],
  stageSwap: 572,
  mistWall: [608, 642],
  guqin: 622,
  reveal: [628, 645],
  /** Casting plays the first time the chart is on screen, u ≥ 0.655 or a #grove jump. */
  castStart: 655,
  /** "Read the chart" smooth-scrolls here. */
  readChart: 742,
  finaleStart: 935,
  sealStamp: 985,
} as const

/** Fog above this density counts as cover for quality changes and mount/unmount (§11.1, §11.3). */
export const FOG_COVER = 0.12

/** SectionHost mounts a section when the camera is this close (in u) to its span. `RIG.preloadU`. */
export const PRELOAD_U = 0.06

// ---------------------------------------------------------------------------- framing (§6.1, §6.4)

/**
 * Where the subject sits on screen. `camera.setViewOffset` moves the principal point so the
 * subject centres in the part of the screen the copy doesn't use; the camera itself never moves
 * for text. Values are fractions of the viewport; +x is right, +y is down.
 */
export const FRAMING = {
  /** Landscape principal-point shift per text zone: L and TL copy on the left → subject centred in the right 60%. */
  zoneShiftX: { L: 0.2, TL: 0.2, R: -0.2, pane: 0, panel: -1 / 6, mount: 0, B: 0 } satisfies Record<TextZone, number>,
  /** G3: the DOM chart panel takes the right third of a landscape screen, under the header. */
  chartPanelFraction: 1 / 3,
  /** G3 portrait: the R4 circle fits the width, centred this far from the top; the chart sheet sits below. */
  planPortraitCentreY: 0.3,
  /** G3 portrait: height fraction the plan view may use (the sheet peeks from the bottom 30%). */
  planPortraitHeight: 0.6,
} as const

// ---------------------------------------------------------------------------- stills (§14.1)

/** `?still=<beat>` renders the beat at this jvh for the album stills and og.png (scripts/shots.mjs). */
export const STILLS: Partial<Record<BeatId, number>> = {
  T0: 0,
  C3: 301,
  I1: 360,
  E1: 909,
  E3: 1000,
}

/** Journey position for a still: the table above, else the middle of the beat's hold (or of the beat). */
export function stillJvh(id: BeatId): number {
  const fixed = STILLS[id]
  if (fixed !== undefined) return fixed
  const [a, z] = holdOf(id)
  return (a + z) / 2
}
