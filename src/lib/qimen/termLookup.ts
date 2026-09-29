/**
 * Lookups over any sorted solar-term table (qimen-spec.md §4.3). Table-free, so modules that
 * only need the clock and pillars do not pull the built-in data into their bundle.
 */

import { TERM_NAMES } from './constants'
import type { SolarTermName, TermRow } from './types'

/**
 * Instants a table can chart: [fromMs, toMs). Lookups need 24 rows of history (the latest
 * 立春) and one row after the instant (the next term).
 */
export function termRangeOf(terms: readonly TermRow[]): { fromMs: number; toMs: number } {
  if (terms.length < 26) throw new RangeError('solar-term table needs at least 26 rows')
  return { fromMs: (terms[24] as TermRow).startMs, toMs: (terms[terms.length - 1] as TermRow).startMs }
}

/** Index of the last row with startMs ≤ t. Throws RangeError outside `termRangeOf` (no extrapolation). */
export function termAt(terms: readonly TermRow[], t: number): number {
  const { fromMs, toMs } = termRangeOf(terms)
  if (!(t >= fromMs && t < toMs)) throw new RangeError(`instant outside the solar-term table: ${Number.isFinite(t) ? new Date(t).toISOString() : t}`)
  let lo = 24
  let hi = terms.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if ((terms[mid] as TermRow).startMs <= t) lo = mid
    else hi = mid - 1
  }
  return lo
}

/** Latest row at or before row i whose index satisfies `pred`. */
export function lastTermWhere(terms: readonly TermRow[], i: number, pred: (index: number) => boolean): TermRow {
  for (let j = i; j >= 0; j--) {
    const row = terms[j] as TermRow
    if (pred(row.index)) return row
  }
  throw new RangeError('solar-term table starts too late')
}

export const termName = (index: number): SolarTermName => TERM_NAMES[index] as SolarTermName
