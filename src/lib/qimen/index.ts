/**
 * Qimen engine public API. Pure TypeScript: no React, no three, no runtime calendar library.
 * Solar terms come from a build-time table generated from tyme4ts (qimen-spec.md §14.2,
 * scripts/build-terms.mts), covering instants from 1930 to 2100. Owner: qimen.
 *
 * Importing this module pulls in the term table: the engine is about 11.5 KB gzip, 6.2 KB of it
 * the table. Boot-time code should import it dynamically. labels.ts and ../calendar/shichen.ts
 * are table-free.
 */

import { buildChart } from './chart'
import { termTable } from './terms'
import type { QimenChart, QimenOptions } from './types'

export type * from './types'
export { buildChart } from './chart'
export { termTable, termRange } from './terms'
export { ringOffsets, deitySlot, palaceAtSlot, shortestSlots, turnBetween } from './rings'
export { resolveOptions, offsetMinutesFor, basisClock, basisOffsetMinutes, formatWall } from './clock'
export {
  CHART_VOCABULARY,
  DUN_ZH,
  JU_ZH,
  MARKS_ZH,
  PALACE_ZH,
  QIMEN_GLYPHS,
  YUAN_ZH,
  chartLabels,
  glossOf,
  inscription,
  missingGlosses,
  palaceLabels,
  plainPinyin,
  type ChartInscription,
  type ChartLabels,
  type Gloss,
  type GlossLookup,
  type PalaceLabels,
} from './labels'
export {
  BRANCHES,
  BRANCH_PALACE,
  DEITY_SLOTS,
  HOME_DOOR,
  HOME_STAR,
  JU_TABLE,
  LUO_SHU_GRID,
  MOUNTAINS,
  PALACES,
  PALACE_NUMBERS,
  QIYI,
  RING,
  STEMS,
  TERM_NAMES,
  gz,
  lodge,
  slotOf,
  type Compass8,
  type PalaceInfo,
} from './constants'

/**
 * Cast the hour chart for an instant (qimen-spec.md §3–§12) with the built-in term table.
 * `instant` is a Date or epoch milliseconds. Throws RangeError outside `termRange()`.
 */
export function computeChart(instant: Date | number, options?: QimenOptions): QimenChart {
  return buildChart(typeof instant === 'number' ? instant : instant.getTime(), termTable(), options)
}
