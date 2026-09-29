/**
 * Ring offsets for the grove's stone rings and the album SVG (design.md §9.5). The renderer
 * never derives positions itself: it builds each ring in the 伏吟 arrangement and turns it by
 * these offsets, in 45° slots. Slot k is bearing k × 45° in RING order; palace 5 counts as 2.
 */

import { RING, mod, slotOf } from './constants'
import type { Dun, OuterPalaceNo, QimenChart, RingOffsets } from './types'

/** Map any whole number of slots to −3..4, the shortest turn (4 = a half turn, 反吟). */
export const shortestSlots = (steps: number): number => {
  const n = mod(steps, 8)
  return n > 4 ? n - 8 : n
}

export function ringOffsets(chart: QimenChart): RingOffsets {
  return {
    heaven: shortestSlots(slotOf(chart.zhiFu.palace) - slotOf(chart.zhiFu.homePalace)),
    human: shortestSlots(slotOf(chart.zhiShi.palace) - slotOf(chart.zhiShi.homePalace)),
    spirit: slotOf(chart.zhiFu.palace),
    dun: chart.dun,
  }
}

/** Slot of deity slot `k` (0 = 值符 … 7 = 九天): clockwise from `spirit` in the yang dun, anticlockwise in the yin. */
export const deitySlot = (spirit: number, dun: Dun, k: number): number => mod(spirit + (dun === 'yang' ? k : -k), 8)

/** Palace at ring slot k (any integer). */
export const palaceAtSlot = (k: number): OuterPalaceNo => RING[mod(k, 8)] as OuterPalaceNo

/** Signed slots to turn a ring from one offset to another along the shortest path (−3..4). */
export const turnBetween = (from: number, to: number): number => shortestSlots(to - from)
