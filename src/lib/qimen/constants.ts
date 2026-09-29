/**
 * Static Qimen data (qimen-spec.md §2). Chinese names only: English glosses belong to
 * src/content/glossary.ts, keyed by these strings.
 */

import type { Branch, Deity, Door, GanZhi, OuterPalaceNo, PalaceNo, SolarTermName, Star, Stem } from './types'

export const STEMS: readonly Stem[] = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸']
export const BRANCHES: readonly Branch[] = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']

/** tyme4ts `SolarTerm#getIndex()` order, 0 = 冬至. Odd indices are 节. */
export const TERM_NAMES: readonly SolarTermName[] = [
  '冬至', '小寒', '大寒', '立春', '雨水', '惊蛰', '春分', '清明', '谷雨', '立夏', '小满', '芒种',
  '夏至', '小暑', '大暑', '立秋', '处暑', '白露', '秋分', '寒露', '霜降', '立冬', '小雪', '大雪',
]

/** [上元, 中元, 下元] 局 by term index (§5), the 烟波钓叟歌 table. A test checks it against its generator. */
export const JU_TABLE: readonly (readonly [number, number, number])[] = [
  [1, 7, 4], [2, 8, 5], [3, 9, 6], [8, 5, 2], [9, 6, 3], [1, 7, 4], [3, 9, 6], [4, 1, 7], [5, 2, 8], [4, 1, 7], [5, 2, 8], [6, 3, 9],
  [9, 3, 6], [8, 2, 5], [7, 1, 4], [2, 5, 8], [1, 4, 7], [9, 3, 6], [7, 1, 4], [6, 9, 3], [5, 8, 2], [6, 9, 3], [5, 8, 2], [4, 7, 1],
]

/** 三奇六仪 laying order. QIYI[x] is also the 仪 that hides the 甲 of 旬 x. */
export const QIYI: readonly Stem[] = ['戊', '己', '庚', '辛', '壬', '癸', '丁', '丙', '乙']

/** 坎艮震巽离坤兑乾: forward is clockwise, i.e. increasing compass bearing. Slot k is bearing k × 45°. */
export const RING: readonly OuterPalaceNo[] = [1, 8, 3, 4, 9, 2, 7, 6]

export const HOME_STAR: Readonly<Record<PalaceNo, Star>> = {
  1: '天蓬', 2: '天芮', 3: '天冲', 4: '天辅', 5: '天禽', 6: '天心', 7: '天柱', 8: '天任', 9: '天英',
}
export const HOME_DOOR: Readonly<Record<OuterPalaceNo, Door>> = {
  1: '休门', 8: '生门', 3: '伤门', 4: '杜门', 9: '景门', 2: '死门', 7: '惊门', 6: '开门',
}

/** 八神 slots 0..7 under `huXuan`. */
export const DEITY_SLOTS: readonly Deity[] = ['值符', '螣蛇', '太阴', '六合', '白虎', '玄武', '九地', '九天']

/** Palace of each branch, 子..亥 (§12.1). */
export const BRANCH_PALACE: readonly OuterPalaceNo[] = [1, 8, 8, 3, 4, 4, 9, 2, 2, 7, 6, 6]
/** 驿马 branch index by hour branch index: 申子辰→寅, 巳酉丑→亥, 寅午戌→申, 亥卯未→巳. */
export const HORSE_OF: readonly number[] = [2, 11, 8, 5, 2, 11, 8, 5, 2, 11, 8, 5]

export const PALACE_NUMBERS: readonly PalaceNo[] = [1, 2, 3, 4, 5, 6, 7, 8, 9]

/** South-up display grid, rows top to bottom. */
export const LUO_SHU_GRID: readonly (readonly PalaceNo[])[] = [
  [4, 9, 2],
  [3, 5, 7],
  [8, 1, 6],
]

export type Compass8 = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW'

export interface PalaceInfo {
  /** Trigram name, or 中 for the centre. */
  readonly trigram: string
  readonly direction: Compass8 | 'C'
  /** Compass bearing of the palace centre line; null for 5. Each outer palace spans ±22.5°. */
  readonly azimuth: number | null
  readonly element: '水' | '木' | '火' | '土' | '金'
  readonly branches: readonly Branch[]
  /** 二十四山, clockwise. */
  readonly mountains: readonly string[]
}

/** §2.2. */
export const PALACES: Readonly<Record<PalaceNo, PalaceInfo>> = {
  1: { trigram: '坎', direction: 'N', azimuth: 0, element: '水', branches: ['子'], mountains: ['壬', '子', '癸'] },
  8: { trigram: '艮', direction: 'NE', azimuth: 45, element: '土', branches: ['丑', '寅'], mountains: ['丑', '艮', '寅'] },
  3: { trigram: '震', direction: 'E', azimuth: 90, element: '木', branches: ['卯'], mountains: ['甲', '卯', '乙'] },
  4: { trigram: '巽', direction: 'SE', azimuth: 135, element: '木', branches: ['辰', '巳'], mountains: ['辰', '巽', '巳'] },
  9: { trigram: '离', direction: 'S', azimuth: 180, element: '火', branches: ['午'], mountains: ['丙', '午', '丁'] },
  2: { trigram: '坤', direction: 'SW', azimuth: 225, element: '土', branches: ['未', '申'], mountains: ['未', '坤', '申'] },
  7: { trigram: '兑', direction: 'W', azimuth: 270, element: '金', branches: ['酉'], mountains: ['庚', '酉', '辛'] },
  6: { trigram: '乾', direction: 'NW', azimuth: 315, element: '金', branches: ['戌', '亥'], mountains: ['戌', '乾', '亥'] },
  5: { trigram: '中', direction: 'C', azimuth: null, element: '土', branches: [], mountains: [] },
}

/** 二十四山 clockwise from 子; mountain k is centred on bearing k × 15°. */
export const MOUNTAINS: readonly string[] = [
  '子', '癸', '丑', '艮', '寅', '甲', '卯', '乙', '辰', '巽', '巳', '丙',
  '午', '丁', '未', '坤', '申', '庚', '酉', '辛', '戌', '乾', '亥', '壬',
]

/** Non-negative remainder. */
export const mod = (a: number, n: number): number => ((a % n) + n) % n

/** 中五寄坤二. */
export const lodge = (p: PalaceNo): OuterPalaceNo => (p === 5 ? 2 : p)

export const ringIdx = (p: OuterPalaceNo): number => RING.indexOf(p)

/** Ring slot of any palace; palace 5 counts as 2 (design.md §9.5). */
export const slotOf = (p: PalaceNo): number => ringIdx(lodge(p))

/** Sexagenary pillar from an index, taken mod 60. */
export function gz(i: number): GanZhi {
  const index = mod(i, 60)
  const stem = STEMS[index % 10] as Stem
  const branch = BRANCHES[index % 12] as Branch
  return { index, stem, branch, name: stem + branch }
}
