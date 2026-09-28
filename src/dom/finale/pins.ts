import type { FinaleWindow } from './window'

/**
 * Where each E3 map pin's label goes (design.md §8.7 E3). A pin is a cinnabar dot on its projected
 * world point and a label pill beside it. The meadow projects just above the cabin at E3 (about
 * 30–40 px apart), so the default "above-right" pills of Start and Work collide, and a pill must
 * never cover the cabin's cyan speck just under the Work point.
 *
 * Pins are placed in priority order. Each takes the first spot that stays inside the window and
 * clear of the pills placed before it, every dot and the obstacles: above-right, above-left,
 * below-right, below-left, then above-right or above-left lifted in steps, tied back to its dot by a
 * thin leader line. A pin with no clear spot is hidden (the lowest priority goes first).
 */

export interface PinPoint {
  readonly id: string
  readonly x: number
  readonly y: number
}

export interface PinSize {
  readonly w: number
  readonly h: number
}

export interface Rect {
  readonly left: number
  readonly top: number
  readonly right: number
  readonly bottom: number
}

export type PinSide = 'ne' | 'nw' | 'se' | 'sw'

export interface PinPlacement {
  readonly id: string
  /** The label's top-left corner relative to the point, CSS px. */
  readonly dx: number
  readonly dy: number
  readonly side: PinSide
  /** Extra lift above the default spot (the leader line gets longer). */
  readonly lift: number
}

/** Gap between the point and the label's nearest corner. */
export const PIN_GAP = 6
/** Half the dot's side plus a little air: nothing may sit on another pin's point. */
const DOT_KEEP = 5
/** Air between two labels. */
const LABEL_AIR = 4
const LIFT_STEP = 12
const LIFT_MAX = 72

/**
 * The cabin's cyan speck (glint slot 1, on the south wall) projects just under the Work point (the
 * roof) at E3; keep labels off it.
 */
export function speckKeepOut(p: { x: number; y: number }): Rect {
  return { left: p.x - 12, top: p.y + 4, right: p.x + 12, bottom: p.y + 32 }
}

const overlaps = (a: Rect, b: Rect, air = 0) =>
  a.left < b.right + air && b.left < a.right + air && a.top < b.bottom + air && b.top < a.bottom + air

const inside = (r: Rect, w: FinaleWindow) => r.left >= w.left && r.right <= w.right && r.top >= w.top && r.bottom <= w.bottom

function candidates(s: PinSize): { dx: number; dy: number; side: PinSide; lift: number }[] {
  const g = PIN_GAP
  const out = [
    { dx: g, dy: -g - s.h, side: 'ne' as const, lift: 0 },
    { dx: -g - s.w, dy: -g - s.h, side: 'nw' as const, lift: 0 },
    { dx: g, dy: g, side: 'se' as const, lift: 0 },
    { dx: -g - s.w, dy: g, side: 'sw' as const, lift: 0 },
  ]
  for (let lift = LIFT_STEP; lift <= LIFT_MAX; lift += LIFT_STEP) {
    out.push({ dx: g, dy: -g - s.h - lift, side: 'ne', lift }, { dx: -g - s.w, dy: -g - s.h - lift, side: 'nw', lift })
  }
  return out
}

export function placePins(
  points: readonly PinPoint[],
  sizes: Readonly<Record<string, PinSize>>,
  win: FinaleWindow,
  obstacles: readonly Rect[] = [],
): PinPlacement[] {
  const dots = points.map((p) => ({ id: p.id, r: { left: p.x - DOT_KEEP, top: p.y - DOT_KEEP, right: p.x + DOT_KEEP, bottom: p.y + DOT_KEEP } }))
  const labels: Rect[] = []
  const placed: PinPlacement[] = []
  for (const p of points) {
    const size = sizes[p.id]
    if (!size) continue
    const spot = candidates(size).find((c) => {
      const r = { left: p.x + c.dx, top: p.y + c.dy, right: p.x + c.dx + size.w, bottom: p.y + c.dy + size.h }
      return (
        inside(r, win) &&
        !labels.some((l) => overlaps(r, l, LABEL_AIR)) &&
        !dots.some((d) => d.id !== p.id && overlaps(r, d.r)) &&
        !obstacles.some((o) => overlaps(r, o))
      )
    })
    if (!spot) continue
    labels.push({ left: p.x + spot.dx, top: p.y + spot.dy, right: p.x + spot.dx + size.w, bottom: p.y + spot.dy + size.h })
    placed.push({ id: p.id, ...spot })
  }
  return placed
}

/**
 * The leader from the point to the label's nearest corner: length and angle (deg, CSS rotate). It runs
 * `into` px past the corner, under the label, because a pill's rounded corner is cut away there.
 */
export function leaderOf(pl: PinPlacement, size: PinSize, into = 12): { length: number; angle: number } {
  const tx = pl.side === 'ne' || pl.side === 'se' ? pl.dx : pl.dx + size.w
  const ty = pl.side === 'ne' || pl.side === 'nw' ? pl.dy + size.h : pl.dy
  return { length: Math.hypot(tx, ty) + into, angle: (Math.atan2(ty, tx) * 180) / Math.PI }
}
