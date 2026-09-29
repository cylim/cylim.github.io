import { MARKS, afterGrove } from '../../core/world/journey'
import { breakpoint, layout } from '../../theme/tokens'

/**
 * The finale's timing and geometry (design.md §8.7 E2–E3), pure so it can be tested.
 *
 * - The mount panels slide in late in E2, once the camera has turned north, and slide out again
 *   if the visitor scrolls back. They are scroll-driven, not once per visit.
 * - E3 is time-based and plays once per visit: the colophon writes itself first, then the 林 seal
 *   stamps the corner, as a painter inscribes before sealing. Under reduced motion or e2e both land
 *   at once. Scrolling back never unstamps.
 */
export const FINALE = {
  /**
   * Mount panels in from here (jvh); the camera faces north by about 960 (full walk; `afterGrove`).
   * A getter: a detour can join the grove walk and move the exit.
   */
  get mountOpenAt() {
    return afterGrove(968)
  },
  /** The DOM slides the panels over 900 ms (walk.css .mount); scissor only once they cover the sides. */
  mountSlideMs: 900,
  /** E3 arrival → the colophon starts writing. */
  colophonAfterMs: 400,
  /** E3 arrival → the seal stamps, once the colophon has had time to write itself. */
  sealAfterMs: 2600,
  /** Pins move less than this (CSS px) while the camera only breathes, so the stage can idle. */
  pinSlop: 6,
} as const

export const finaleShowing = (jvh: number) => jvh >= MARKS.finaleStart
export const mountOpenAt = (jvh: number) => jvh >= FINALE.mountOpenAt
export const signedAt = (jvh: number) => jvh >= MARKS.sealStamp

/** A rectangle in CSS px. */
export interface Rect {
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
}

/**
 * Width of each paper-mount panel (walk.css: max(0, 50vw − 37.5svh), desktop layout only), which
 * leaves a centred 3:4 window. 0 on phones and on portrait screens, which get a 12 px border instead.
 */
export function mountWidth(width: number, height: number): number {
  if (width < breakpoint.desktop) return 0
  return Math.max(0, width / 2 - 0.375 * height)
}

/** The album window: between the mounts on landscape, inside the 12 px border on phones. */
export function albumWindow(width: number, height: number): Rect {
  const m = mountWidth(width, height)
  if (m > 0) return { x: m, y: 0, w: width - 2 * m, h: height }
  const b = width < breakpoint.desktop ? layout.mountBorderPortrait : 0
  return { x: b, y: b, w: width - 2 * b, h: height - 2 * b }
}

/**
 * The renderer scissor while the mounts are closed: whole CSS pixels that cover the window, so the
 * mounts' hairline borders never show a gap. null when there is no mount (portrait, phones).
 */
export function scissorRect(width: number, height: number): Rect | null {
  const m = mountWidth(width, height)
  if (m <= 0) return null
  const x = Math.floor(m)
  return { x, y: 0, w: Math.min(width, Math.ceil(width - m)) - x, h: Math.ceil(height) }
}

export const insideRect = (r: Rect, x: number, y: number, margin = 0) =>
  x >= r.x + margin && x <= r.x + r.w - margin && y >= r.y + margin && y <= r.y + r.h - margin

export interface Pin {
  readonly x: number
  readonly y: number
  readonly visible: boolean
}

/** Whether a new projection differs enough from the last written one to be worth a store write. */
export function pinMoved(prev: Pin | undefined, next: Pin, slop: number): boolean {
  if (!prev || prev.visible !== next.visible) return true
  if (!next.visible) return false
  return Math.abs(prev.x - next.x) > slop || Math.abs(prev.y - next.y) > slop
}
