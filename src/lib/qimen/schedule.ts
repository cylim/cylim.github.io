/**
 * When the chart can next change (qimen-spec.md §12.6): the next 时辰 boundary of the basis
 * clock, or the next term start, whichever is first.
 *
 * The spec's sketch assumes the basis offset holds until the boundary. That is exact for fixed
 * offsets, but a DST jump can move the boundary by an hour and true solar time drifts about a
 * second per 时辰, so this re-reads the offset at the candidate instant. Values are identical
 * to the sketch whenever the offset does not change in between.
 */

import { basisClock, basisOffsetMinutes, type BasisClock } from './clock'
import { dayHourIndices } from './pillars'
import type { ResolvedOptions, Wall, ZiHour } from './types'

/** Wall time (as UTC ms) of the next boundary: the next odd hour, and 00:00 unless zi23. */
export function nextBoundaryWall(wall: Wall, ziHour: ZiHour): number {
  const hrStart = Date.UTC(wall.y, wall.mo - 1, wall.d, wall.h)
  if (ziHour !== 'zi23' && wall.h === 23) return hrStart + 3600000
  return hrStart + (wall.h % 2 === 1 ? 2 : 1) * 3600000
}

const offsetMs = (t: number, o: ResolvedOptions): number => Math.round(basisOffsetMinutes(t, o) * 60000)

/** Smallest whole second whose wall time (at the offset in force then) reaches `boundary`. */
const reach = (boundary: number, offMs: number): number => Math.ceil((boundary - offMs) / 1000) * 1000

/** First instant after `clock` at which the day or hour pillar changes. */
export function nextHourChangeMs(o: ResolvedOptions, clock: BasisClock, depth = 0): number {
  const boundary = nextBoundaryWall(clock.wall, o.ziHour)
  const off0 = Math.round(clock.offsetMinutes * 60000)
  let c = reach(boundary, off0)
  if (o.timeBasis === 'trueSolar') {
    for (let k = 0; k < 3; k++) c = reach(boundary, offsetMs(c, o))
    return c
  }
  if (offsetMs(c, o) === off0 || depth > 1) return c
  // The zone's offset changes first: find the first second of the new offset.
  let lo = clock.instantS
  let hi = c
  while (hi - lo > 1000) {
    const mid = lo + Math.floor((hi - lo) / 2000) * 1000
    if (offsetMs(mid, o) === off0) lo = mid
    else hi = mid
  }
  const at = basisClock(hi, o)
  const before = dayHourIndices(clock.wall, o.ziHour)
  const after = dayHourIndices(at.wall, o.ziHour)
  if (after.hourIdx !== before.hourIdx || after.dayIdx !== before.dayIdx) return hi
  return nextHourChangeMs(o, at, depth + 1)
}

const HOUR = 3_600_000

/** First instant after `ms` at which the day or hour pillar changes. */
const nextChange = (o: ResolvedOptions, ms: number): number => nextHourChangeMs(o, basisClock(ms, o))

/**
 * First instant of the chart period (the 时辰, or half of 子 under split and midnight) that holds
 * `ms`, found from the real boundaries rather than by taking wall time off at the current offset,
 * so a DST change inside the period cannot move it onto the previous one.
 */
export function periodStartMs(o: ResolvedOptions, ms: number): number {
  const t = Math.floor(ms / 1000) * 1000
  // A period is two wall hours, longer across a fall-back: look back until a boundary is in reach.
  let from = t - 3 * HOUR
  for (let k = 0; k < 16 && nextChange(o, from) > t; k++) from -= 3 * HOUR
  let start = nextChange(o, from)
  for (let next = nextChange(o, start); next <= t && next > start; next = nextChange(o, start)) start = next
  return start
}

/**
 * Start of the chart period `steps` away from the one holding `ms` (negative = earlier), for
 * Earlier and Later, the hour slider and the hour marker. Every step lands in a different period,
 * DST nights included: a spring-forward gap is stepped over, a fall-back hour is not stepped into twice.
 */
export function stepPeriodMs(o: ResolvedOptions, ms: number, steps: number): number {
  let s = periodStartMs(o, ms)
  for (let k = 0; k < steps; k++) s = nextChange(o, s)
  for (let k = 0; k > steps; k--) s = periodStartMs(o, s - 1000)
  return s
}
