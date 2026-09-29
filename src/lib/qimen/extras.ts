/**
 * 旬空, 驿马 and 暗干 (qimen-spec.md §12). The next change instant is in schedule.ts.
 */

import { BRANCH_PALACE, BRANCHES, HORSE_OF, QIYI, mod } from './constants'
import type { EarthPlate, Placement } from './plates'
import type { Branch, OuterPalaceNo, PalaceNo, Stem } from './types'

export interface VoidOf {
  branches: Branch[]
  palaces: OuterPalaceNo[]
}

/** The two void branches of a pillar's 旬, and their palaces deduped and sorted (§12.1). */
export function voidOf(idx: number): VoidOf {
  const b0 = mod(Math.floor(idx / 10) * 10 + 10, 12)
  const bs = [b0, b0 + 1]
  const palaces = [...new Set(bs.map((b) => BRANCH_PALACE[b] as OuterPalaceNo))].toSorted((a, b) => a - b)
  return { branches: bs.map((b) => BRANCHES[b] as Branch), palaces }
}

/** 驿马 from the hour branch (§12.2). */
export function horseOf(hourBranch: number): { branch: Branch; palace: OuterPalaceNo } {
  const b = HORSE_OF[hourBranch] as number
  return { branch: BRANCHES[b] as Branch, palace: BRANCH_PALACE[b] as OuterPalaceNo }
}

/** 暗干 (§12.4): 时干加值使, starting at 中五 when that palace's earth stem is the same stem. */
export function hiddenStems(earth: EarthPlate, pl: Placement, yang: boolean): { start: PalaceNo; stems: Record<PalaceNo, Stem> } {
  const s = yang ? 1 : -1
  const start: PalaceNo = earth[pl.dt] === pl.useStem ? 5 : pl.dt
  const k0 = QIYI.indexOf(pl.useStem)
  const stems = {} as Record<PalaceNo, Stem>
  for (let p = 1; p <= 9; p++) stems[p as PalaceNo] = QIYI[mod(k0 + s * (p - start), 9)] as Stem
  return { start, stems }
}
