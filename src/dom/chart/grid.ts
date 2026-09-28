import type { PalaceNo } from '../../lib/qimen/types'

/** South-up Luo Shu, rows top to bottom (design.md §9.1): 巽4 离9 坤2 / 震3 中5 兑7 / 艮8 坎1 乾6. */
export const SOUTH_UP: readonly (readonly PalaceNo[])[] = [
  [4, 9, 2],
  [3, 5, 7],
  [8, 1, 6],
]

/** Reading order for screen readers: 1 to 9, the order practitioners count in. */
export const READING_ORDER: readonly PalaceNo[] = [1, 2, 3, 4, 5, 6, 7, 8, 9]

function cellOf(p: PalaceNo): [row: number, col: number] {
  for (let r = 0; r < 3; r++) {
    const c = SOUTH_UP[r]?.indexOf(p) ?? -1
    if (c >= 0) return [r, c]
  }
  return [1, 1]
}

/**
 * Roving focus in the chart grid: arrow keys move between palaces in their visual (south-up)
 * positions and stop at the edges; Home and End jump to the first and last palace in reading order.
 * Returns null for keys the grid doesn't handle.
 */
export function moveInGrid(from: PalaceNo, key: string): PalaceNo | null {
  const [r, c] = cellOf(from)
  const at = (row: number, col: number) => SOUTH_UP[row]?.[col] ?? from
  switch (key) {
    case 'ArrowUp':
      return at(Math.max(0, r - 1), c)
    case 'ArrowDown':
      return at(Math.min(2, r + 1), c)
    case 'ArrowLeft':
      return at(r, Math.max(0, c - 1))
    case 'ArrowRight':
      return at(r, Math.min(2, c + 1))
    case 'Home':
      return READING_ORDER[0] ?? from
    case 'End':
      return READING_ORDER[READING_ORDER.length - 1] ?? from
    default:
      return null
  }
}

/** CSS grid area per palace, matching `grid-template-areas: "p4 p9 p2" "p3 p5 p7" "p8 p1 p6"`. */
export const gridArea = (p: PalaceNo) => `p${p}`
