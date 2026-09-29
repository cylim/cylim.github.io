/**
 * 时辰 helpers for the live chart (design.md §9.6): the current two-hour period on the chart's
 * basis clock, its wall-clock range, the next turn, and stepping by 时辰 for Earlier/Later.
 * Table-free: nothing here pulls in the solar-term data.
 */

import { basisClock, resolveOptions } from '../qimen/clock'
import { BRANCHES, gz } from '../qimen/constants'
import { dayHourIndices } from '../qimen/pillars'
import { nextHourChangeMs, periodStartMs, stepPeriodMs } from '../qimen/schedule'
import type { Branch, GanZhi, QimenOptions, ResolvedOptions, Wall } from '../qimen/types'

export interface Shichen {
  branch: Branch
  /** 0 = 子 … 11 = 亥. */
  branchIndex: number
  /** The hour pillar under the chart's 子-hour rule, e.g. 丙戌. */
  hour: GanZhi
  /** First instant of this chart period, epoch ms. */
  startMs: number
  /** First instant of the next one: when the chart turns next, terms aside. */
  nextMs: number
  /** Wall clock of the basis, 'HH:mm': start, last minute, and the next turn. e.g. 19:00, 20:59, 21:00. */
  start: string
  end: string
  next: string
  /** Basis − UTC in minutes. */
  offsetMinutes: number
}

const pad = (n: number): string => String(n).padStart(2, '0')
const hhmm = (w: Wall): string => `${pad(w.h)}:${pad(w.mi)}`
function shichenOf(instantMs: number, o: ResolvedOptions): Shichen {
  const clock = basisClock(instantMs, o)
  const { hourIdx, hourBranch } = dayHourIndices(clock.wall, o.ziHour)
  // From the real period boundaries (lib/qimen/schedule.ts), not wall time taken off at the current
  // offset: across a DST change that landed on the previous period (qimen QM-2).
  const startMs = periodStartMs(o, instantMs)
  const nextMs = nextHourChangeMs(o, clock)
  return {
    branch: BRANCHES[hourBranch] as Branch,
    branchIndex: hourBranch,
    hour: gz(hourIdx),
    startMs,
    nextMs,
    start: hhmm(basisClock(startMs, o).wall),
    end: hhmm(basisClock(nextMs - 60000, o).wall),
    next: hhmm(basisClock(nextMs, o).wall),
    offsetMinutes: clock.offsetMinutes,
  }
}

/** The 时辰 in force at an instant, on the chart's basis clock (same options as computeChart). */
export function shichenAt(instant: Date | number, options?: QimenOptions): Shichen {
  return shichenOf(typeof instant === 'number' ? instant : instant.getTime(), resolveOptions(options))
}

/**
 * Start instant of the chart period `steps` away (negative = earlier). Under split and midnight
 * the 子 hour is two periods, 23:00 and 00:00. The same stepping as the chart clock's Earlier and
 * Later (lib/qimen/schedule.ts stepPeriodMs), so every step lands in a different period on DST
 * nights too.
 */
export function shiftShichen(instant: Date | number, steps: number, options?: QimenOptions): number {
  return stepPeriodMs(resolveOptions(options), typeof instant === 'number' ? instant : instant.getTime(), steps)
}

/** Basis wall clock of an instant: 'YYYY-MM-DD HH:mm' and 'HH:mm', for "Cast for …" and "Next turn at …". */
export function localStamp(instant: Date | number, options?: QimenOptions): { dateTime: string; time: string; date: string } {
  const { wall } = basisClock(typeof instant === 'number' ? instant : instant.getTime(), resolveOptions(options))
  const date = `${String(wall.y).padStart(4, '0')}-${pad(wall.mo)}-${pad(wall.d)}`
  return { date, time: hhmm(wall), dateTime: `${date} ${hhmm(wall)}` }
}
