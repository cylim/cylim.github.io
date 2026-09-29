/**
 * The built-in solar-term table (qimen-spec.md §4.3), decoded on first use: about 4,150 rows
 * from 冬至 1928 to 大雪 2101, generated from tyme4ts by scripts/build-terms.mts.
 */

import { decodeTermSeconds } from './termCodec'
import { TERM_DATA } from './termData'
import { termRangeOf } from './termLookup'
import type { TermRow } from './types'

let rows: readonly TermRow[] | null = null

/** The built-in table, sorted by startMs, row 0 = 冬至 (index 0). */
export function termTable(): readonly TermRow[] {
  rows ??= decodeTermSeconds(TERM_DATA).map((s, i) => ({ startMs: s * 1000, index: i % 24 }))
  return rows
}

/** Instants the built-in table can chart, [fromMs, toMs): 1929-12-22 to 2101-12-07, so all of 1930–2100 in any zone. */
export const termRange = (): { fromMs: number; toMs: number } => termRangeOf(termTable())

export { termAt, termName, lastTermWhere } from './termLookup'
