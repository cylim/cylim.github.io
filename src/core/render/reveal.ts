/**
 * The first-frame "develop" (design.md §8.1): each pixel appears once `(1 − luminance) + noise × 0.3`
 * passes a threshold sweeping from 1.3 to 0, so the darkest ink lands first. Scrolling during the
 * sweep finishes it in 300 ms. QualityController starts it; the ink pass reads the threshold.
 */

export const REVEAL_FROM = 1.3

interface Sweep {
  /** Progress already made when this segment started (0..1). */
  p0: number
  t0: number
  durationMs: number
}

let sweep: Sweep | null = null

export function startReveal(nowMs: number, durationMs: number): void {
  sweep = { p0: 0, t0: nowMs, durationMs }
}

function progress(s: Sweep, nowMs: number): number {
  const f = s.durationMs <= 0 ? 1 : (nowMs - s.t0) / s.durationMs
  return Math.min(s.p0 + (1 - s.p0) * Math.max(f, 0), 1)
}

/** Finish whatever is left of the sweep within `durationMs`. */
export function hurryReveal(nowMs: number, durationMs: number): void {
  if (!sweep) return
  const p = progress(sweep, nowMs)
  if (p >= 1) return
  if (nowMs - sweep.t0 < 0) return
  const remaining = (1 - p) * sweep.durationMs
  if (remaining <= durationMs) return
  sweep = { p0: p, t0: nowMs, durationMs }
}

/** Current threshold: 1.3 → 0 while developing, 0 once done or when no sweep is running. */
export function revealThreshold(nowMs: number): number {
  if (!sweep) return 0
  const p = progress(sweep, nowMs)
  if (p >= 1) {
    sweep = null
    return 0
  }
  return REVEAL_FROM * (1 - p)
}

export function isRevealing(): boolean {
  return sweep !== null
}

export function cancelReveal(): void {
  sweep = null
}
