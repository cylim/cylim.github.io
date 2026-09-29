/**
 * The four pillars (qimen-spec.md §4). Day and hour read the basis wall clock; year and month
 * read the solar-term table at the absolute instant.
 */

import { wallDays } from './clock'
import { mod } from './constants'
import { lastTermWhere } from './termLookup'
import type { TermRow, Wall, ZiHour } from './types'

export interface DayHourIndices {
  /** Sexagenary index of the wall date itself; 1970-01-01 is 辛巳 = 17. */
  civilIdx: number
  /** Day pillar after the 子-hour rule (§4.1). */
  dayIdx: number
  /** Hour pillar (§4.2). */
  hourIdx: number
  /** Hour branch index, 0 = 子. */
  hourBranch: number
}

/** Branch index of a wall hour: 23 and 0 → 子, 1 and 2 → 丑 … 21 and 22 → 亥. */
export const hourBranchOf = (h: number): number => mod(Math.floor((h + 1) / 2), 12)

export function dayHourIndices(wall: Wall, ziHour: ZiHour): DayHourIndices {
  const late = wall.h === 23
  const civilIdx = mod(wallDays(wall) + 17, 60)
  const dayIdx = late && ziHour === 'zi23' ? mod(civilIdx + 1, 60) : civilIdx
  const hourBasisIdx = late && ziHour !== 'midnight' ? mod(civilIdx + 1, 60) : civilIdx
  const hourBranch = hourBranchOf(wall.h)
  // 五鼠遁: 甲己还加甲，乙庚丙作初 …
  const hourIdx = mod((hourBasisIdx % 5) * 12 + hourBranch, 60)
  return { civilIdx, dayIdx, hourIdx, hourBranch }
}

/** Year index from the latest 立春, month index from the latest 节, both at or before row `ti`. */
export function yearMonthIndices(terms: readonly TermRow[], ti: number): { yearIdx: number; monthIdx: number } {
  // 立春 falls on 3–5 February, so its UTC year is the calendar year it opens.
  const lichun = lastTermWhere(terms, ti, (index) => index === 3)
  const yearIdx = mod(new Date(lichun.startMs).getUTCFullYear() - 4, 60)
  const jie = lastTermWhere(terms, ti, (index) => index % 2 === 1)
  const m = mod((jie.index - 3) / 2, 12) // 0 = 寅 month (立春)
  // 五虎遁: 甲己之年丙作首 …
  const monthStem = mod((yearIdx % 5) * 2 + 2 + m, 10)
  const monthBranch = mod(m + 2, 12)
  return { yearIdx, monthIdx: mod(6 * monthStem - 5 * monthBranch, 60) }
}
