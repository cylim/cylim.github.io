/**
 * What the stone chart shows for one cast (design.md §9.2–9.5), derived from the engine's chart and
 * nothing else. Pure: no three, no React, so the tests can hold it against the DOM chart.
 *
 * Rings are built in the 伏吟 arrangement (every star and door in its home slot) and turn by
 * `ringOffsets`. The lit glyphs are "riders": they sit on a ring slot, turn with it, then lift off and
 * settle into the palace the engine put them in (落宫). Their landing palaces are read from
 * `chart.palaces`, so a settled chart is the DOM chart by construction; the tests check that the ring
 * arithmetic lands each rider on the same palace.
 */

import { DEITY_SLOTS, HOME_DOOR, HOME_STAR, PALACE_NUMBERS, RING, inscription, ringOffsets, slotOf } from '../../../lib/qimen'
import type { Branch, Door, Dun, OuterPalaceNo, PalaceNo, QimenChart, RingOffsets, Star, Stem } from '../../../lib/qimen/types'

export type RingId = 'heaven' | 'human' | 'spirit'
export const RING_IDS: readonly RingId[] = ['heaven', 'human', 'spirit']

export const OUTER_PALACES: readonly OuterPalaceNo[] = RING

/** Where a rider sits in its palace (and which part of its ring slot it rides on). */
export type RiderRole = 'star' | 'star2' | 'stem' | 'stem2' | 'door' | 'deity'

export interface Rider {
  /** Stable across casts: the same light rides the same slot of the same ring. */
  readonly key: string
  readonly ring: RingId
  readonly role: RiderRole
  readonly text: string
  /** Home slot on its ring (stars, stems, doors), or the deity index 0 = 值符 … 7 (deities). */
  readonly index: number
  /** Where it settles for this chart. */
  readonly palace: OuterPalaceNo
  /** Gloss key for the tooltip: the full name (天禽 for the small 禽). */
  readonly gloss: string
}

/** A carving on a turning ring, in its home slot (or deity index), radial. */
export interface Carving {
  readonly key: string
  readonly ring: RingId
  readonly role: 'star' | 'stem' | 'stem2' | 'door' | 'deity'
  readonly text: string
  readonly index: number
}

export interface ChartModel {
  readonly offsets: RingOffsets
  readonly dun: Dun
  readonly ju: number
  /** Changes whenever the earth plate does (局 or 遁). */
  readonly plateKey: string
  readonly riders: readonly Rider[]
  readonly carvings: readonly Carving[]
  readonly earth: Readonly<Record<PalaceNo, Stem>>
  readonly zhiFu: OuterPalaceNo
  /**
   * Which star in the 值符 palace carries the cinnabar plate: the one that is the 值符 star. That is
   * 'star2', the small 禽, when the 旬首 hides in 中5 and 天禽 is the 值符 riding with 天芮 (qimen-spec
   * D14, §8), as the DOM panel, the terminal and the cabin pane mark it.
   */
  readonly zhiFuRole: 'star' | 'star2'
  readonly zhiShi: OuterPalaceNo
  /** The 值符 arc: where the 旬首 hides on the earth plate to where the 值符 star lands; null in 伏吟. */
  readonly arc: { readonly from: OuterPalaceNo; readonly to: OuterPalaceNo } | null
  readonly voids: readonly PalaceNo[]
  readonly horse: PalaceNo | null
  readonly hourBranch: Branch
  /** Carved on the north step: line one by field, then the four pillars. */
  readonly band: { readonly fields: readonly string[]; readonly pillars: string }
  /** Luo Shu brush path for the casting: 1 → 9 in the yang dun, 9 → 1 in the yin (§9.5). */
  readonly luoShuPath: readonly PalaceNo[]
}

const STAR_OF_HOME_SLOT: readonly Star[] = RING.map((p) => HOME_STAR[p])
const DOOR_OF_HOME_SLOT: readonly Door[] = RING.map((p) => HOME_DOOR[p])
/** The ring slot 天芮 comes home to; 天禽 rides with it (中五寄坤二). */
export const RUI_SLOT = slotOf(2)

/** 天英 → 英: the ring carves one character, and 芮·禽 on the shared slot (§9.3). */
const starChar = (s: Star) => s.slice(1)

function landing<T>(pick: (p: OuterPalaceNo) => T | null | undefined, want: T): OuterPalaceNo {
  const p = OUTER_PALACES.find((q) => pick(q) === want)
  if (p === undefined) throw new Error(`grove: ${String(want)} lands nowhere`)
  return p
}

export function buildModel(chart: QimenChart): ChartModel {
  const offsets = ringOffsets(chart)
  const palaces = chart.palaces
  const riders: Rider[] = []
  const carvings: Carving[] = []

  STAR_OF_HOME_SLOT.forEach((star, k) => {
    const palace = landing((p) => palaces[p].stars[0], star)
    const [stem, stem2] = palaces[palace].heaven
    riders.push({ key: `star:${k}`, ring: 'heaven', role: 'star', text: star, index: k, palace, gloss: star })
    if (stem) riders.push({ key: `stem:${k}`, ring: 'heaven', role: 'stem', text: stem, index: k, palace, gloss: stem })
    const extra = palaces[palace].stars[1]
    if (extra) riders.push({ key: `star2:${k}`, ring: 'heaven', role: 'star2', text: starChar(extra), index: k, palace, gloss: extra })
    if (stem2) riders.push({ key: `stem2:${k}`, ring: 'heaven', role: 'stem2', text: stem2, index: k, palace, gloss: stem2 })

    // The heaven plate carries each star's home earth stem; 芮's slot also carries the centre's.
    const home = RING[k] as OuterPalaceNo
    carvings.push({ key: `c-star:${k}`, ring: 'heaven', role: 'star', text: k === RUI_SLOT ? `${starChar(star)}·${starChar(HOME_STAR[5])}` : starChar(star), index: k })
    carvings.push({ key: `c-stem:${k}`, ring: 'heaven', role: 'stem', text: palaces[home].earth, index: k })
    if (k === RUI_SLOT) carvings.push({ key: `c-stem2:${k}`, ring: 'heaven', role: 'stem2', text: palaces[5].earth, index: k })
  })

  DOOR_OF_HOME_SLOT.forEach((door, k) => {
    const palace = landing((p) => palaces[p].door, door)
    riders.push({ key: `door:${k}`, ring: 'human', role: 'door', text: door, index: k, palace, gloss: door })
    carvings.push({ key: `c-door:${k}`, ring: 'human', role: 'door', text: door, index: k })
  })

  DEITY_SLOTS.forEach((_, k) => {
    const palace = landing((p) => palaces[p].deitySlot, k)
    const name = palaces[palace].deity ?? ''
    riders.push({ key: `deity:${k}`, ring: 'spirit', role: 'deity', text: name, index: k, palace, gloss: name })
    carvings.push({ key: `c-deity:${k}`, ring: 'spirit', role: 'deity', text: name, index: k })
  })

  const earth = Object.fromEntries(PALACE_NUMBERS.map((p) => [p, palaces[p].earth])) as Record<PalaceNo, Stem>
  const zhiFu = chart.zhiFu.palace
  const hides = chart.xunShou.palace === 5 ? 2 : chart.xunShou.palace
  const ins = inscription(chart)
  const horse = PALACE_NUMBERS.find((p) => palaces[p].flags.horse) ?? null
  return {
    offsets,
    dun: chart.dun,
    ju: chart.ju,
    plateKey: `${chart.dun}${chart.ju}`,
    riders,
    carvings,
    earth,
    zhiFu,
    zhiFuRole: palaces[zhiFu].stars[1] === chart.zhiFu.star ? 'star2' : 'star',
    zhiShi: chart.zhiShi.palace,
    arc: hides === zhiFu ? null : { from: hides, to: zhiFu },
    voids: PALACE_NUMBERS.filter((p) => palaces[p].flags.hourVoid),
    horse,
    hourBranch: chart.pillars.hour.branch,
    band: { fields: [ins.structure, ins.termYuan, ins.xunShou], pillars: ins.pillars },
    luoShuPath: chart.dun === 'yang' ? PALACE_NUMBERS : PALACE_NUMBERS.toReversed(),
  }
}

/** What a settled chart shows in each outer palace, read back from the riders (tests compare it to the engine). */
export interface PalaceReadout {
  deity: string | null
  stars: string[]
  heaven: string[]
  door: string | null
  earth: string
}

export function readPalaces(model: ChartModel): Record<PalaceNo, PalaceReadout> {
  const out = {} as Record<PalaceNo, PalaceReadout>
  for (const p of PALACE_NUMBERS) out[p] = { deity: null, stars: [], heaven: [], door: null, earth: model.earth[p] }
  for (const r of model.riders) {
    const cell = out[r.palace]
    if (r.role === 'star' || r.role === 'star2') cell.stars[r.role === 'star' ? 0 : 1] = r.gloss
    else if (r.role === 'stem' || r.role === 'stem2') cell.heaven[r.role === 'stem' ? 0 : 1] = r.text
    else if (r.role === 'door') cell.door = r.text
    else cell.deity = r.text
  }
  return out
}
