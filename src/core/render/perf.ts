/**
 * Pure quality logic (design.md §13.2–13.3): benchmark verdicts, DPR ranges and steps, the runtime
 * performance monitor and frame caps. No DOM, no three; QualityController wires it to frames.
 */

import type { Tier } from '../store/journey'
import { BENCHMARK, PERF_MONITOR, clampDpr, stepTier, type DprRange } from './quality'

export function median(xs: readonly number[]): number {
  if (xs.length === 0) return 0
  const s = xs.toSorted((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? (s[m] ?? 0) : ((s[m - 1] ?? 0) + (s[m] ?? 0)) / 2
}

export type BenchmarkVerdict = 'keep' | 'down' | 'static'

/** §13.2: over 22 ms on low → album; over 18 ms on medium → low; over 12 ms on high → medium. */
export function benchmarkVerdict(tier: Tier, medianMs: number): BenchmarkVerdict {
  if (tier === 'low') return medianMs > BENCHMARK.lowToStaticMs ? 'static' : 'keep'
  if (tier === 'medium') return medianMs > BENCHMARK.mediumToLowMs ? 'down' : 'keep'
  return medianMs > BENCHMARK.highToMediumMs ? 'down' : 'keep'
}

/** Frame-time budget per tier (§13.4 p95 targets), used for "two consecutive frames in budget". */
export const FRAME_BUDGET_MS: Readonly<Record<Tier, number>> = { low: 33.4, medium: 20, high: 16.7 }

/** vsync jitter allowance on top of the budget. */
export const BUDGET_SLACK_MS = 2

export interface QualityLevel {
  tier: Tier
  dpr: number
}

const RANK: Readonly<Record<Tier, number>> = { low: 0, medium: 1, high: 2 }
export const tierRank = (t: Tier) => RANK[t]

/** One step down: DPR by 0.25 to the tier's floor first, then a tier. Null at the bottom. */
export function stepDown(level: QualityLevel, range: (t: Tier) => DprRange): QualityLevel | null {
  const r = range(level.tier)
  if (level.dpr > r.floor + 1e-6) return { tier: level.tier, dpr: Math.max(level.dpr - PERF_MONITOR.dprStep, r.floor) }
  if (level.tier === 'low') return null
  const tier = stepTier(level.tier, -1)
  return { tier, dpr: clampDpr(level.dpr, range(tier)) }
}

/**
 * One step back up, never above `ceiling` (the level the benchmark settled on): DPR first, then
 * a tier, entering the higher tier at its floor.
 */
export function stepUp(level: QualityLevel, ceiling: QualityLevel, range: (t: Tier) => DprRange): QualityLevel | null {
  const r = range(level.tier)
  const dprCeiling = level.tier === ceiling.tier ? Math.min(r.cap, ceiling.dpr) : r.cap
  if (level.dpr < dprCeiling - 1e-6) return { tier: level.tier, dpr: Math.min(level.dpr + PERF_MONITOR.dprStep, dprCeiling) }
  if (tierRank(level.tier) >= tierRank(ceiling.tier)) return null
  const tier = stepTier(level.tier, 1)
  return { tier, dpr: clampDpr(level.dpr, range(tier)) }
}

export type PerfSignal = 'decline' | 'incline'

/**
 * drei-PerformanceMonitor-style watcher with the design's asymmetric windows: a decline after
 * 2 s under 45 fps, an incline after 4 s over 58 fps, locked after three direction flips.
 * Thresholds scale down with a frame cap (30 fps on a slow low-tier phone).
 */
export class PerfMonitor {
  private bucketStart = -1
  private bucketFrames = 0
  private belowSince: number | null = null
  private aboveSince: number | null = null
  private last: PerfSignal | null = null
  private flips = 0
  private targetFps = 60

  get locked(): boolean {
    return this.flips >= PERF_MONITOR.flipflops
  }

  setTargetFps(fps: number): void {
    this.targetFps = fps
  }

  /** Forget the running windows (after a hitch, a tab switch, a throttle or a quality change). */
  reset(): void {
    this.bucketStart = -1
    this.bucketFrames = 0
    this.belowSince = null
    this.aboveSince = null
  }

  /** Feed one rendered frame. Returns a signal when a window completes. */
  sample(nowMs: number): PerfSignal | null {
    if (this.locked) return null
    if (this.bucketStart < 0) {
      this.bucketStart = nowMs
      this.bucketFrames = 0
      return null
    }
    this.bucketFrames++
    const span = nowMs - this.bucketStart
    if (span < 250) return null
    const fps = (this.bucketFrames * 1000) / span
    const bucketStart = this.bucketStart
    this.bucketStart = nowMs
    this.bucketFrames = 0

    const scale = Math.min(1, this.targetFps / 60)
    if (fps < PERF_MONITOR.declineFps * scale) this.belowSince ??= bucketStart
    else this.belowSince = null
    if (fps > PERF_MONITOR.inclineFps * scale) this.aboveSince ??= bucketStart
    else this.aboveSince = null

    let signal: PerfSignal | null = null
    if (this.belowSince !== null && nowMs - this.belowSince >= PERF_MONITOR.declineAfterMs) signal = 'decline'
    else if (this.aboveSince !== null && nowMs - this.aboveSince >= PERF_MONITOR.inclineAfterMs) signal = 'incline'
    if (!signal) return null
    if (this.last && this.last !== signal) this.flips++
    this.last = signal
    this.belowSince = null
    this.aboveSince = null
    return signal
  }
}

/**
 * §13.3 frame cap in fps, or null for the display rate. Low: 30 if the first 5 s averaged under
 * 50 fps, else 60. Medium: 60. High: display rate. A 60 cap only matters on faster displays.
 */
export function frameCapFor(tier: Tier, firstSecondsFps: number | null, displayHz: number): number | null {
  const sixty = displayHz > 65 ? 60 : null
  if (tier === 'high') return null
  if (tier === 'medium') return sixty
  if (firstSecondsFps !== null && firstSecondsFps < 50) return 30
  return sixty
}

/** Frames at a steady display rate, from the median frame interval. */
export function displayHzFrom(intervalsMs: readonly number[]): number {
  const m = median(intervalsMs)
  return m > 0 ? 1000 / m : 60
}
