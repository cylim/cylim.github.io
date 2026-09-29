/**
 * The walk as data: design.md §6.1 beat table, §6.2 sections and hash targets, §6.3 rig rules,
 * §6.4 portrait overrides, §11.2 seams. The single tuning file for the camera.
 *
 * Scroll is measured in journey vh (jvh). The journey is J = 1000 jvh and u = jvh / J. With the grove
 * paused (content/features.ts) the tables are the same full walk, rebuilt by `groveless` at the end
 * of the beat table: J is 783 and everything from the exit on sits 217 jvh earlier (beats.ts).
 * Pure data plus tiny pure helpers; no three.js. Owner: core-journey.
 *
 * Keyframe model
 * - Every beat carries independent channels (pos, look, fov, fog, roll, up, paper). A channel is a
 *   list of keys `{ at: jvh, v }`. Channels interpolate on their own; a beat may leave a channel empty.
 * - pos and look: centripetal Catmull-Rom through all keys of the channel, in order, with a
 *   piecewise-linear jvh → curve-parameter map between keys (arc-length inside each segment).
 *   Consecutive keys with equal values are a stationary hold: dedupe before building the curve
 *   and hold the parameter flat between them.
 * - up: normalised lerp between keys.
 * - fov, fog, roll, paper: piecewise-linear between keys, constant before the first and after the last.
 * - `cut: true` on a key means "do not interpolate into this key": the channel jumps at `at`.
 *   Used at 572, where the camera teleports under full paper from the hall to the path, and with the
 *   grove paused at 628, from the mist wall to the southern trees.
 * - `fit: 'plan'` on a pos key means the rig replaces y with h_fit (R4 circle plus 1 m margin
 *   fits the chart viewport; about 34 m at 16:9) and recomputes it on resize.
 *
 * How the key jvh values were chosen (retune freely; the tests only check order and speed):
 * - Hold boundaries from the design table are explicit keys. "A → B" in a hold beat puts A at the
 *   hold start and B at the hold end; a single value is held across the hold.
 * - Pass-through waypoints ("→ B" in a beat without a hold) sit at their chord-length position
 *   between the neighbouring hold keys, so the camera keeps an even speed between holds (§6.3).
 *   Exceptions, where the beat's own jvh range carries meaning: C2 creeps during the door swing
 *   (key at 286, where the nudge starts), C4 crosses the door plane at about 316 (keys 311, 314, 322), I0 creeps during
 *   ignition (336), and the mist wall run is pinned to P2 626, P3 633/645, G0 660.
 * - Scalar "A → B" spans the beat's jvh range; a single scalar value applies from the beat start.
 */

import type { SectionId } from '../sections/ids'
import type { Vec3 } from './layout'
import { GROVE_ON, J, MIST_CUT, PRELOAD_U, afterGrove, isGroveBeat, withoutGrove, type BeatId, type TextZone } from './beats'

// Spans, beat ranges, marks, framing and stills live in beats.ts (the boot chunk's share of the walk).
export * from './beats'

/**
 * Where the camera is placed when a fog-dive swaps into a section, before it glides onto the
 * arrival along the real path (§6.2, §11.1). `atJvh` means "the path pose at that jvh"; `back`
 * pulls that pose back along its view axis; `pos` and `look` are an explicit pose.
 */
export interface EmergePose {
  readonly atJvh?: number
  readonly back?: number
  readonly pos?: Vec3
  readonly look?: Vec3
  readonly note: string
}

export const EMERGE: Record<SectionId, EmergePose> = {
  threshold: { atJvh: 0, back: 3, note: 'T0 pose pulled 3 m back' },
  cabin: { atJvh: 312, note: 'C4 pose just outside the open door; every jump into the cabin still passes the door' },
  grove: { pos: [0, 40, -140], look: [0, 0.45, -150.5], note: 'Descends through cloud onto the G1 seat' },
  contact: { atJvh: afterGrove(872), note: 'E0 pose among the southern trees' },
}

// ---------------------------------------------------------------------------- beats (§6.1)

export interface Key<T> {
  readonly at: number
  readonly v: T
  /** Jump to this key instead of interpolating into it. */
  readonly cut?: true
  /** pos only: y is replaced by the plan-view h_fit. */
  readonly fit?: 'plan'
}

export interface Beat {
  readonly id: BeatId
  readonly section: SectionId
  /** [start, end) in jvh. Beats tile 0..1000 with no gaps. */
  readonly jvh: readonly [number, number]
  /** Scroll range where the camera barely moves so the copy can be read. */
  readonly hold: readonly [number, number] | null
  readonly pos: readonly Key<Vec3>[]
  readonly look: readonly Key<Vec3>[]
  /** Vertical FOV in degrees (desktop landscape). */
  readonly fov: readonly Key<number>[]
  /**
   * Fog density before the tier multiplier. `medium: 'ink'` → uFog.x of the ink pass (exp² to paper).
   * `medium: 'night'` → the interior materials' own exp² fade to `night` (§7.4).
   */
  readonly fog: readonly Key<number>[]
  readonly medium: 'ink' | 'night'
  /** Camera roll in degrees; positive leans right (clockwise as the viewer sees it). */
  readonly roll: readonly Key<number>[]
  /** camera.up; only the plan view (G2–G4) changes it. */
  readonly up: readonly Key<Vec3>[]
  /** Scroll-driven paper overlay 0..1, run through the same dissolve as a fog-dive (§11.2). */
  readonly paper: readonly Key<number>[]
  readonly zone: TextZone | null
  readonly notes: string
}

type BeatInput = Omit<Beat, 'pos' | 'look' | 'fov' | 'fog' | 'roll' | 'up' | 'paper' | 'medium' | 'hold'> &
  Partial<Pick<Beat, 'pos' | 'look' | 'fov' | 'fog' | 'roll' | 'up' | 'paper' | 'medium' | 'hold'>>

const beat = (b: BeatInput): Beat => ({
  hold: null,
  pos: [],
  look: [],
  fov: [],
  fog: [],
  medium: 'ink',
  roll: [],
  up: [],
  paper: [],
  ...b,
})

const k = <T>(at: number, v: T, extra?: Pick<Key<T>, 'cut' | 'fit'>): Key<T> => ({ at, v, ...extra })

/** h_fit placeholder for 16:9 with the chart panel on the right third; the rig recomputes it. */
export const H_FIT_DEFAULT = 34

const FULL_BEATS: readonly Beat[] = [
  // ------------------------------------------------------------ threshold, 0–245
  beat({
    id: 'T0', section: 'threshold', jvh: [0, 40], hold: [0, 35], zone: 'L',
    pos: [k(0, [0, 1.6, 24]), k(35, [0, 1.6, 22.5])],
    look: [k(0, [0.8, 2.8, -20]), k(35, [0.8, 2.8, -20])],
    fov: [k(0, 40)],
    fog: [k(0, 0.04)],
    roll: [k(0, 0)],
    up: [k(0, [0, 1, 0])],
    paper: [k(0, 0)],
    notes: 'Hero copy. Lantern glint near centre. Canvas develops from paper on the first frame.',
  }),
  beat({
    id: 'T1', section: 'threshold', jvh: [40, 90], zone: null,
    pos: [k(84, [0.2, 1.7, 7])],
    look: [k(84, [-0.4, 2.1, -30])],
    fov: [k(40, 40), k(90, 42)],
    fog: [k(40, 0.04), k(90, 0.032)],
    notes: 'Step in. Hero copy fades out 40–65.',
  }),
  beat({
    id: 'F1', section: 'threshold', jvh: [90, 150], hold: [100, 142], zone: 'L',
    pos: [k(100, [-0.6, 1.7, 2]), k(142, [-0.8, 1.7, -6])],
    look: [k(100, [1.2, 1.9, -34]), k(142, [1.2, 1.9, -34])],
    fog: [k(100, 0.03)],
    roll: [k(90, 0), k(100, 1.5), k(142, 1.5)],
    notes: 'Services I: "What I build", services 1 and 2. Roll 1.5° into the curve.',
  }),
  beat({
    id: 'F2', section: 'threshold', jvh: [150, 168], zone: null,
    pos: [k(159, [0.6, 1.7, -14])],
    look: [k(159, [-0.8, 1.8, -40])],
    roll: [k(159, 0)],
    notes: 'The wipe: pine B passes within 2.2 m on screen-left and fills 40% of the frame.',
  }),
  beat({
    id: 'F3', section: 'threshold', jvh: [168, 222], hold: [175, 215], zone: 'L',
    pos: [k(175, [0.9, 1.7, -22]), k(215, [0.4, 1.7, -30])],
    look: [k(175, [-0.6, 1.8, -52]), k(215, [-0.6, 1.8, -52])],
    roll: [k(175, -1.5), k(215, -1.5)],
    notes: 'Services II: services 3 and 4. The lean flips with the second bend of the S-curve.',
  }),
  beat({
    id: 'F4', section: 'threshold', jvh: [222, 245], zone: null,
    // At its chord-length place between the F3 hold end (12 m back) and the C1 hold (5 m on), so the
    // camera keeps one speed into the cabin clearing instead of braking from 233 (L6).
    pos: [k(240, [1.4, 1.8, -42])],
    look: [k(240, [4, 2.0, -60])],
    fog: [k(222, 0.03), k(245, 0.022)],
    roll: [k(245, 0)],
    notes: 'The cabin resolves out of the mist ahead-right. Cyan in the plank gaps.',
  }),

  // ------------------------------------------------------------ cabin, 245–572
  beat({
    id: 'C1', section: 'cabin', jvh: [245, 275], hold: [250, 272], zone: 'L',
    // Far enough back (13 m) that the peak's summit clears the 40° roof: closer, the ridge hides it.
    pos: [k(250, [4, 1.7, -46.4]), k(272, [4, 1.7, -47.2])],
    look: [k(250, [4, 3.3, -60]), k(272, [4, 3.3, -60])],
    notes: 'Portrait: door centred and closed. 木屋 inscription and bridge line. Main peak above the roof.',
  }),
  beat({
    id: 'C2', section: 'cabin', jvh: [275, 292], zone: null,
    // Creeps up to the door while it swings; the nudge west starts from here, not from 292.
    pos: [k(286, [4.1, 1.68, -52.8])],
    look: [k(286, [4, 2.4, -60])],
    notes: 'The door swings 0° → 95° over 276–290, scrubbed by scroll. Stencil portal on from 274.',
  }),
  beat({
    id: 'C3', section: 'cabin', jvh: [292, 308], hold: [296, 306], zone: null,
    // 4 m west, not the design's 2.6: the west wall's face (x 6.5) only shows from well past it.
    pos: [k(296, [8.1, 2.3, -51.8]), k(306, [8.1, 2.3, -51.8])],
    look: [k(296, [4.6, 3.1, -60.6]), k(306, [4.6, 3.1, -60.6])],
    notes: 'The nudge (signature moment 1, §8.3): 4 m west, 0.6 m up, eyes on the door; the west wall, the doorway and the close trunks over the roofline share the frame.',
  }),
  beat({
    id: 'C4', section: 'cabin', jvh: [308, 322], zone: null,
    pos: [k(311, [4.4, 1.7, -57.2]), k(314, [4, 1.65, -59.0]), k(322, [4, 1.65, -61.6])],
    look: [k(314, [4, 1.9, -80]), k(322, [4, 1.9, -80])],
    fov: [k(308, 42), k(322, 55)],
    // Exterior ink fog holds to the door plane; past it the value is the hall's night fade (§7.4).
    fog: [k(316, 0.022), k(316, 0.03, { cut: true })],
    notes: 'Swing back onto the door axis and dolly through while vFOV widens. Door plane crossed at about 316.',
  }),
  beat({
    id: 'I0', section: 'cabin', jvh: [322, 336], zone: null, medium: 'night',
    pos: [k(336, [4, 1.7, -63.5])],
    look: [k(336, [4, 2.3, -90])],
    fog: [k(322, 0.03)],
    notes: 'Ignition: traces light from under the camera (time-based, 2.5 s).',
  }),
  beat({
    id: 'I1', section: 'cabin', jvh: [336, 380], hold: [345, 375], zone: 'L', medium: 'night',
    pos: [k(345, [4, 2.3, -65]), k(375, [4, 2.5, -67])],
    look: [k(345, [4, 3.8, -96]), k(375, [4, 3.8, -96])],
    fov: [k(336, 55), k(380, 52)],
    notes: 'The hall. Cabin intro. #cabin arrives at 345.',
  }),
  beat({
    id: 'I2a', section: 'cabin', jvh: [380, 405], hold: [387, 403], zone: 'R', medium: 'night',
    pos: [k(387, [5.0, 1.75, -71.4]), k(403, [5.0, 1.75, -71.4])],
    look: [k(387, [0.9, 2.3, -75]), k(403, [0.9, 2.3, -75])],
    fov: [k(387, 50)],
    notes: 'Project scroll 1.',
  }),
  beat({
    id: 'I2b', section: 'cabin', jvh: [405, 430], hold: [412, 428], zone: 'L', medium: 'night',
    pos: [k(412, [3.0, 1.75, -77.4]), k(428, [3.0, 1.75, -77.4])],
    look: [k(412, [7.1, 2.3, -81]), k(428, [7.1, 2.3, -81])],
    notes: 'Project scroll 2.',
  }),
  beat({
    id: 'I2c', section: 'cabin', jvh: [430, 455], hold: [437, 453], zone: 'R', medium: 'night',
    pos: [k(437, [5.0, 1.75, -83.4]), k(453, [5.0, 1.75, -83.4])],
    look: [k(437, [0.9, 2.3, -87]), k(453, [0.9, 2.3, -87])],
    notes: 'Project scroll 3.',
  }),
  beat({
    id: 'I2d', section: 'cabin', jvh: [455, 480], hold: [462, 478], zone: 'L', medium: 'night',
    pos: [k(462, [3.0, 1.75, -89.4]), k(478, [3.0, 1.75, -89.4])],
    look: [k(462, [7.1, 2.3, -93]), k(478, [7.1, 2.3, -93])],
    fov: [k(478, 50)],
    notes: 'Project scroll 4 and the "Also" list.',
  }),
  beat({
    id: 'I3', section: 'cabin', jvh: [480, 528], hold: [488, 524], zone: 'pane', medium: 'night',
    pos: [k(488, [4, 1.75, -96.9]), k(524, [4, 1.75, -97.2])],
    look: [k(488, [4, 1.85, -99.9]), k(524, [4, 1.85, -99.9])],
    fov: [k(488, 45), k(524, 45)],
    notes: 'The terminal, square-on (§10). The DOM terminal overlays the projected pane.',
  }),
  beat({
    id: 'I4', section: 'cabin', jvh: [528, 572], zone: 'R', medium: 'night',
    pos: [k(546, [5.7, 1.8, -100.4]), k(572, [4.2, 2.1, -104.4])],
    look: [k(546, [4, 2.35, -112]), k(572, [4, 2.35, -112])],
    fov: [k(546, 50)],
    paper: [k(562, 0), k(571, 1)],
    notes: 'Step round the desk to the moon gate. Timeline scrolls past in zone R. Whiteout 562–572; stage swap at 572 under full paper.',
  }),

  // ------------------------------------------------------------ grove, 572–862
  beat({
    id: 'P0', section: 'grove', jvh: [572, 584], zone: null,
    pos: [k(572, [3.0, 1.7, -69], { cut: true }), k(584, [2.6, 1.7, -74])],
    look: [k(572, [1.6, 1.5, -95], { cut: true }), k(584, [1.6, 1.5, -95])],
    fov: [k(572, 45, { cut: true })],
    fog: [k(572, 0.3, { cut: true }), k(584, 0.032)],
    paper: [k(573, 1), k(578, 0)],
    notes: 'Emerge out of paper behind a small cabin. The camera never looks back.',
  }),
  beat({
    id: 'P1', section: 'grove', jvh: [584, 608], hold: [588, 604], zone: 'R',
    // design.md §6.1 walks (2.3, 1.75, −79) → (1.8, 1.8, −88) over the hold, which puts the camera
    // over the water by 596: the stream and stones leave the frame for most of the hold. Holding on
    // the north bank and looking a little down and east keeps the stones, the far bank and the
    // bamboo's leaning culms in the picture while the intro reads; P2 crosses the stones.
    pos: [k(588, [2.0, 1.75, -76.5]), k(604, [1.9, 1.76, -78.8])],
    look: [k(588, [-0.8, 0.6, -100]), k(604, [-0.8, 0.6, -100])],
    notes: 'The stream and stepping stones. Grove intro line.',
  }),
  beat({
    id: 'P2', section: 'grove', jvh: [608, 628], zone: null,
    pos: [k(626, [0.5, 3.2, -112])],
    look: [k(626, [0.3, 3.3, -132])],
    fog: [k(608, 0.032), k(628, 0.14)],
    notes: 'The mist wall: near-whiteout, trees 3 m away are ghosts. Guqin harmonic at 622. The grove chunk must be ready here.',
  }),
  beat({
    id: 'P3', section: 'grove', jvh: [628, 645], zone: null,
    pos: [k(633, [0.3, 3.7, -119]), k(645, [0, 4.5, -124])],
    look: [k(645, [0, 0.45, -150])],
    fog: [k(630, 0.14), k(642, 0.012)],
    notes: 'The mist parts: crest and tilt down. The clearing opens; the lantern glints beyond the south trees.',
  }),
  beat({
    id: 'G0', section: 'grove', jvh: [645, 660], zone: null,
    pos: [k(660, [0, 7.0, -132])],
    look: [k(660, [0, 0.45, -150.3])],
    notes: 'Descend.',
  }),
  beat({
    id: 'G1', section: 'grove', jvh: [660, 715], hold: [666, 712], zone: 'TL',
    pos: [k(666, [0, 8.5, -134]), k(712, [0, 8.8, -134.6])],
    look: [k(666, [0, 0.45, -150.5]), k(712, [0, 0.45, -150.5])],
    fov: [k(715, 45)],
    notes: 'The seat. Casting plays (§9.5). #grove arrives at 666.',
  }),
  beat({
    id: 'G2', section: 'grove', jvh: [715, 740], zone: null,
    pos: [k(740, [0, H_FIT_DEFAULT, -150.001], { fit: 'plan' })],
    look: [k(740, [0, 0, -150])],
    fov: [k(740, 40)],
    fog: [k(715, 0.012), k(740, 0.008)],
    up: [k(715, [0, 1, 0]), k(740, [0, 0, -1])],
    notes: 'Rise and pitch straight down; camera.up blends so south stays at the top of the screen.',
  }),
  beat({
    id: 'G3', section: 'grove', jvh: [740, 835], hold: [742, 833], zone: 'panel',
    pos: [k(742, [0, H_FIT_DEFAULT, -150.001], { fit: 'plan' }), k(833, [0, H_FIT_DEFAULT, -150.001], { fit: 'plan' })],
    look: [k(742, [0, 0, -150]), k(833, [0, 0, -150])],
    up: [k(833, [0, 0, -1])],
    notes: 'Plan view. Chart panel, time controls, glosses, compass. No drift. Ground mist → 0. Chart shifted with setViewOffset.',
  }),
  beat({
    id: 'G4', section: 'grove', jvh: [835, 862], zone: null,
    pos: [k(850, [0, 12, -156]), k(862, [0.6, 3.4, -170])],
    // design.md §6.1 has (0, 0.45, −152) here, which sits behind a camera at z −156 and would spin
    // the view 180° out of the plan view. Looking ahead over the south rings keeps the tilt-up
    // continuous: south stays at the top of the screen until the horizon comes up.
    look: [k(850, [0, 0.45, -163]), k(862, [1.0, 2.2, -186.5])],
    fov: [k(835, 40), k(862, 45)],
    fog: [k(835, 0.008), k(862, 0.012)],
    up: [k(850, [0, 1, 0])],
    notes: 'Glide over the rings toward the lantern; up returns to +Y.',
  }),

  // ------------------------------------------------------------ contact, 862–1000
  beat({
    id: 'E0', section: 'contact', jvh: [862, 880], zone: null,
    pos: [k(876, [0.5, 1.8, -175.5])],
    look: [k(876, [0, 2.6, -188])],
    fov: [k(880, 50)],
    fog: [k(880, 0.02)],
    notes: 'Warm: lantern light on the nearest trunks.',
  }),
  beat({
    id: 'E1', section: 'contact', jvh: [880, 935], hold: [886, 932], zone: 'L',
    pos: [k(886, [0.3, 1.2, -179.8]), k(932, [0.3, 1.25, -180.2])],
    // design.md §6.1 looks at y 3.6 with 48°, which cuts the lantern at its plinth; a little lower and
    // wider keeps the whole lantern and its light pool while the peak still fills the top 40%.
    look: [k(886, [-0.5, 3.2, -188]), k(932, [-0.5, 3.2, -188])],
    notes: 'Low angle, 高远: signpost, lantern, peak above. #contact arrives at 886.',
  }),
  beat({
    id: 'E2', section: 'contact', jvh: [935, 985], zone: null,
    pos: [k(938.6, [-9, 6, -184]), k(953, [-24, 16, -200]), k(971.2, [-16, 25, -228]), k(985, [3, 30, -240])],
    look: [k(938.6, [-0.4, 2.5, -187.5]), k(953, [0, 0, -170]), k(971.2, [1, 0, -150]), k(985, [1.3, 0, -128])],
    fov: [k(935, 50), k(985, 40)],
    fog: [k(935, 0.02), k(985, 0.006)],
    notes: 'The painting (signature moment 3): ascending orbit round the east side, looking back north. If the spline wobbles, use the parametric orbit in layout.exit.orbitCentre.',
  }),
  beat({
    id: 'E3', section: 'contact', jvh: [985, 1000], hold: [985, 1000], zone: 'mount',
    pos: [k(1000, [3, 30, -240])],
    // §6.1 looks at (1.5, 0, −142) with 45°, which spends the bottom quarter of the 3:4 window on the
    // cliff under the ledge. Lower and at 40° the lantern sits at the foot and the ridges at the top.
    look: [k(1000, [1.3, 0, -128])],
    notes: 'Signed: the colophon writes itself, then the 林 seal stamps; map pins, "Walk again".',
  }),
]

// ------------------------------------------------------------ the walk with the grove paused

/**
 * P2 and P3 with the grove paused. The mist wall is the cut: the fog is at its 0.14 peak, a flash of
 * paper covers the last few jvh of P2, and under it the camera jumps from the crest (z −112) to the
 * south of the empty clearing, so the grove is never seen. The mist then parts on the southern trees
 * with the lantern glowing through them, and the walk carries on into E0.
 */
const MIST_PAPER = [620, MIST_CUT - 1] as const
const P2_WITHOUT_GROVE: Partial<Beat> = {
  paper: [k(MIST_PAPER[0], 0), k(MIST_PAPER[1], 1)],
  notes: 'The mist wall: near-whiteout, then full paper at 627 for the cut to the southern trees. Guqin harmonic at 622.',
}
const P3_WITHOUT_GROVE: Partial<Beat> = {
  pos: [k(MIST_CUT, [0.7, 1.9, -159], { cut: true }), k(645, [0.55, 1.85, -167.5])],
  look: [k(MIST_CUT, [0.3, 2.3, -188], { cut: true }), k(645, [0.1, 2.5, -188])],
  fov: [k(MIST_CUT, 45)],
  fog: [k(MIST_CUT, 0.14), k(640, 0.018)],
  paper: [k(MIST_CUT + 1, 1), k(636, 0)],
  notes: 'The mist parts on the southern trees; the lantern glows through them. Cut from the mist wall under full paper at 628.',
}

const shiftKeys = <T>(keys: readonly Key<T>[]): Key<T>[] => keys.map((key) => ({ ...key, at: afterGrove(key.at) }))

/** A full-walk beat on the groveless walk: beats.ts `withoutGrove`, plus its keys moved with it. */
function beatWithoutGrove(b: Beat): Beat {
  const moved = withoutGrove(b)
  if (b.id === 'P2') return { ...moved, ...P2_WITHOUT_GROVE }
  if (b.id === 'P3') return { ...moved, ...P3_WITHOUT_GROVE }
  if (b.section === 'grove') return moved
  return {
    ...moved,
    pos: shiftKeys(b.pos),
    look: shiftKeys(b.look),
    fov: shiftKeys(b.fov),
    fog: shiftKeys(b.fog),
    roll: shiftKeys(b.roll),
    up: shiftKeys(b.up),
    paper: shiftKeys(b.paper),
  }
}

export const BEATS: readonly Beat[] = GROVE_ON ? FULL_BEATS : FULL_BEATS.filter((b) => !isGroveBeat(b.id)).map(beatWithoutGrove)

// ---------------------------------------------------------------------------- rig (§6.3)

export const RIG = {
  /**
   * maath easing.damp3 smooth times in seconds. The eyes turn slightly before the body.
   * `emerge` is the position smoothing while a fog-dive clears, so the glide from the emerge pose
   * onto the arrival is still moving when the paper lifts.
   */
  damping: { position: 0.35, positionLowTier: 0.25, look: 0.25, fov: 0.35, roll: 0.35, shift: 0.35, emerge: 0.6 },
  /** Clamp frame delta so a background tab doesn't lurch. */
  maxDelta: 1 / 20,
  /** On holds only. The weight eases in and out over `fade` seconds so a hold edge never pops. */
  breath: { amplitude: 0.02, hz: 0.1, yawDeg: 0.15, yawHz: 0.07, fade: 1 },
  /** Desktop exterior holds only; off in the cabin, the grove, on touch and with reduced motion. */
  parallax: { yawDeg: 1.2, pitchDeg: 0.6, smoothTime: 0.8 },
  /** Beats whose hold gets pointer parallax: the exterior holds outside the grove and the finale. */
  parallaxBeats: ['T0', 'F1', 'F3', 'C1', 'C3', 'P1', 'E1'] as readonly BeatId[],
  /**
   * Lag fog: engages once the camera lags its scroll target by more than `startLag` metres, then
   * follows the lag ((lag − clearLag) / (startLag − clearLag), capped at 1) until it is under
   * `clearLag`. It rises over `rise` seconds and falls over `fall` so the cover never pops.
   */
  catchUp: { startLag: 25, clearLag: 5, rise: 0.12, fall: 0.3 },
  /** The camera dollies this far forward during a dive-in. */
  diveDolly: 2.5,
  /**
   * Touch zoom in the G3 plan view (design.md §9.7): a tapped palace fills `fill` of the chart
   * viewport's width (the smaller side on a landscape tablet), easing over `smoothTime` seconds; the
   * zoom never goes past `max`. Instant with reduced motion.
   */
  planZoom: { fill: 0.7, smoothTime: 0.4, max: 12 },
  /**
   * Compass mode (design.md §9.9) takes the camera to the plan view: switching it on anywhere else
   * in the grove glides the scroll into the G3 read hold, `holdMargin` jvh inside its edges.
   */
  compass: { holdMargin: 4 },
  near: 0.1,
  far: 600,
  /** SectionHost mounts a section when the camera is this close (in u) to its span. */
  preloadU: PRELOAD_U,
} as const

// ---------------------------------------------------------------------------- portrait (§6.4)

export interface PortraitOverride {
  /** Replaces the beat's pos channel. */
  readonly pos?: readonly Key<Vec3>[]
  /** Replaces the beat's look channel (before the portrait look lift). */
  readonly look?: readonly Key<Vec3>[]
  /** Replaces x on every pos key (I2: camera on the hall centre line). */
  readonly posX?: number
  readonly fov?: number
  readonly notes: string
}

const FULL_PORTRAIT = {
  /** Portrait vFOV derives from this horizontal FOV, clamped to `vFovClamp`. */
  hFovDeg: 46,
  vFovClamp: [55, 68] as const,
  /** Cabin interior on mobile (§8.4). */
  interiorVFov: 62,
  /** Ground-level look targets rise this much so the horizon sits near 62% of the height. */
  lookLift: 1.5,
  /** setViewOffset centres the subject in the top 55%; copy cards are bottom-anchored (zone B). */
  subjectTop: 0.55,
  /**
   * Portrait subject height as a fraction from the top, per beat; the default is the middle of the
   * top 55%. I3 frames the pane in the top half, G3 centres the R4 circle 30% down, and E2/E3 are
   * already hanging scrolls, so they stay centred. C1 looks level at the door's height and drops the
   * horizon to 44% so the gable fits above the door without tilting the walls; P3 has no card, so
   * the reveal centres the rings.
   */
  subjectY: { default: 0.275, C1: 0.44, I3: 0.25, P3: 0.5, G1: 0.25, G3: 0.3, E2: 0.5, E3: 0.5 } as Partial<Record<BeatId, number>> & { default: number },
  /** Beats whose look targets are near the ground and get `lookLift` in portrait (not the tilt-downs or the plan view). */
  lookLiftBeats: ['T0', 'T1', 'F1', 'F2', 'F3', 'F4', 'C1', 'C2', 'C3', 'C4', 'P0', 'P1', 'P2', 'E0', 'E1'] as readonly BeatId[],
  overrides: {
    T0: { pos: [k(0, [0, 1.6, 28]), k(35, [0, 1.6, 26.5])], notes: 'Hero accent top-left; name, role, pitch and links in zone B.' },
    // The portrait C1 is 7 m nearer than landscape, so F4's waypoint sits earlier to keep the approach even.
    F4: { pos: [k(232, [1.4, 1.8, -42])], look: [k(232, [4, 2.0, -60])], notes: 'As landscape, keyed at its portrait chord-length place.' },
    // design.md §8.3 Mobile: "Door at about 30% of the frame height". The landscape pose, 13 m back for
    // the peak, leaves the door at 12% of a phone's height. From 7 m, level at eye height with the
    // horizon at 44%, the door is 21–22%: the most that keeps the gable (up to its ridge cap at the
    // top edge) and the door's foot and cyan bar above the card, whose top sits at 60–66% of the
    // height on 360–390 px phones. A 30% door cuts the gable or puts the foot under the card. The
    // peak hides behind the roof from here.
    C1: {
      pos: [k(250, [4, 1.7, -53.0]), k(272, [4, 1.7, -53.2])],
      look: [k(250, [4, 0.2, -60]), k(272, [4, 0.2, -60])],
      notes: 'Door portrait: door about 30% of the frame height, the whole gable above it.',
    },
    C2: {
      pos: [k(286, [4.05, 1.68, -55.2])],
      look: [k(286, [4, 0.6, -60])],
      notes: 'Keeps creeping toward the door while it swings, from the nearer portrait C1.',
    },
    // Not the design's 1.8 m nudge: from x 5.8 the west wall (x 6.5) faces away. A narrower frame
    // needs the camera further back, not less far west, to hold the wall, the doorway and the trunks.
    C3: {
      pos: [k(296, [7.3, 2.2, -51.6]), k(306, [7.3, 2.2, -51.6])],
      look: [k(296, [4.9, 2.4, -60.6]), k(306, [4.9, 2.4, -60.6])],
      notes: 'Nudge 3.3 m west and 3 m further back than landscape: west wall, doorway and close trunks in a 46° wide frame.',
    },
    // On the centre line (§6.4) and 2.3 m further back than landscape, looking at the scroll's middle
    // with its cords: at the landscape distance the 62° frame cuts the top rod and cords (L5). Further
    // back the scroll is also closer to face-on (it is yawed 25° toward the centre line).
    I2a: {
      pos: [k(387, [4, 1.75, -69.1]), k(403, [4, 1.75, -69.1])],
      look: [k(387, [0.9, 2.6, -75]), k(403, [0.9, 2.6, -75])],
      notes: 'Camera on the centre line x = 4, looking at the whole scroll, rods and cords; card in zone B.',
    },
    I2b: {
      pos: [k(412, [4, 1.75, -75.1]), k(428, [4, 1.75, -75.1])],
      look: [k(412, [7.1, 2.6, -81]), k(428, [7.1, 2.6, -81])],
      notes: 'As I2a.',
    },
    I2c: {
      pos: [k(437, [4, 1.75, -81.1]), k(453, [4, 1.75, -81.1])],
      look: [k(437, [0.9, 2.6, -87]), k(453, [0.9, 2.6, -87])],
      notes: 'As I2a.',
    },
    I2d: {
      pos: [k(462, [4, 1.75, -87.1]), k(478, [4, 1.75, -87.1])],
      look: [k(462, [7.1, 2.6, -93]), k(478, [7.1, 2.6, -93])],
      notes: 'As I2a.',
    },
    // The portrait frame is about 35° wide: from the landscape seat the 1.6 m pane overruns both
    // edges, so step back 0.9 m to hold it whole in the top half.
    I3: {
      pos: [k(488, [4, 1.8, -96.0]), k(524, [4, 1.8, -96.3])],
      notes: 'Frame the pane in the top half; the terminal opens as a bottom sheet (§10.2).',
    },
    G1: {
      pos: [k(666, [0, 18, -138]), k(712, [0, 18, -138])],
      look: [k(666, [0, 0.45, -151]), k(712, [0, 0.45, -151])],
      notes: 'Steeper seat.',
    },
    G3: { notes: 'The R4 circle fits the screen width and centres 30% from the top; the chart sheet sits below.' },
    // The portrait frame is only about 29° wide at 58°: centring the signpost would cut the lantern
    // at the right edge. The pair is centred instead, from the tips of the east-pointing boards to
    // the lantern's eave: signpost left, lantern right, both whole in the top 55% above the zone-B
    // card. The look target sits at board height (y 0 plus the 1.5 m portrait look lift), so only
    // the foot of the peak shows. A metre further back than landscape: from the landscape seat the
    // boards' tips and the lantern's base touch the two edges of a 390 px frame.
    E1: {
      fov: 58,
      pos: [k(886, [-0.1, 1.2, -178.8]), k(932, [-0.1, 1.25, -179.2])],
      look: [k(886, [-0.5, 0, -188]), k(932, [-0.5, 0, -188])],
      notes: 'Signpost and lantern centred as a pair, above the card.',
    },
    // The walk laid out from lantern to ridges spans under 30° of view, and a phone's frame is 55° or
    // more tall. Tilt up to put the painting in the lower part of the scroll, the lantern near the foot,
    // and leave the paper above it for the colophon, as a hanging scroll leaves its sky empty.
    E2: {
      look: [k(938.6, [-0.4, 2.5, -187.5]), k(953, [0, 0, -170]), k(971.2, [1, 0, -150]), k(985, [1.3, 0, -27])],
      notes: 'Portrait is already a hanging scroll: no mount panels, a 12 px paper-mount border only.',
    },
    E3: { fov: 55, look: [k(1000, [1.3, 0, -27])], notes: 'As E2; the painting in the lower part, paper above for the colophon.' },
  } satisfies Partial<Record<BeatId, PortraitOverride>>,
} as const

/**
 * With the grove paused, P3 looks level at the southern trees instead of tilting down onto the rings,
 * so it takes the look lift and the default subject height, and the exit overrides move up.
 */
function portraitWithoutGrove() {
  const { P3: _p3, ...subjectY } = FULL_PORTRAIT.subjectY
  const overrides: Partial<Record<BeatId, PortraitOverride>> = {}
  for (const [id, o] of Object.entries(FULL_PORTRAIT.overrides) as [BeatId, PortraitOverride][]) {
    if (isGroveBeat(id)) continue
    overrides[id] = { ...o, ...(o.pos && { pos: shiftKeys(o.pos) }), ...(o.look && { look: shiftKeys(o.look) }) }
  }
  return {
    ...FULL_PORTRAIT,
    subjectY: subjectY as typeof FULL_PORTRAIT.subjectY,
    lookLiftBeats: [...FULL_PORTRAIT.lookLiftBeats, 'P3'] as readonly BeatId[],
    overrides: overrides as typeof FULL_PORTRAIT.overrides,
  }
}

export const PORTRAIT: typeof FULL_PORTRAIT = GROVE_ON ? FULL_PORTRAIT : portraitWithoutGrove()

// ---------------------------------------------------------------------------- helpers

export function beatAt(jvh: number): Beat {
  const clamped = Math.min(Math.max(jvh, 0), J - 1e-9)
  return BEATS.find((b) => clamped >= b.jvh[0] && clamped < b.jvh[1]) ?? (BEATS[BEATS.length - 1] as Beat)
}

/** A beat's row. A paused grove beat answers with its full-walk row, so the grove's modules still load. */
export function beatById(id: BeatId): Beat {
  const b = BEATS.find((x) => x.id === id) ?? FULL_BEATS.find((x) => x.id === id)
  if (!b) throw new Error(`unknown beat ${id}`)
  return b
}

export type Channel = 'pos' | 'look' | 'fov' | 'fog' | 'roll' | 'up' | 'paper'
type ChannelValue<C extends Channel> = Beat[C] extends readonly Key<infer T>[] ? T : never

/** Every key of one channel across the walk, in jvh order. */
export function channelKeys<C extends Channel>(channel: C): readonly Key<ChannelValue<C>>[] {
  const out: Key<ChannelValue<C>>[] = []
  for (const b of BEATS) out.push(...(b[channel] as readonly Key<ChannelValue<C>>[]))
  return out
}

/** Piecewise-linear sample of a scalar channel at `jvh`, honouring cuts. */
export function sampleScalar(keys: readonly Key<number>[], jvh: number): number {
  const first = keys[0]
  if (!first) return 0
  if (jvh <= first.at) return first.v
  for (let i = 1; i < keys.length; i++) {
    const a = keys[i - 1] as Key<number>
    const b = keys[i] as Key<number>
    if (jvh < b.at) {
      if (b.cut || b.at === a.at) return a.v
      const t = (jvh - a.at) / (b.at - a.at)
      return a.v + (b.v - a.v) * t
    }
  }
  return (keys[keys.length - 1] as Key<number>).v
}
