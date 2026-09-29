/**
 * The live chart's clock, shared by the stone chart (sections/grove/chart/director.ts) and the DOM
 * chart source (dom/chart/chartSource.ts), so both cast the same chart, step it the same way and
 * recast at the same moments (design.md §9.6, qimen-spec.md §12.6).
 *
 * lib/ stays a leaf: the journey store, the chart options and core's `chartInstant` come in as
 * dependencies. Not re-exported from ./index, which this module imports.
 */

import { resolveOptions } from './clock'
import { computeChart } from './index'
import { stepPeriodMs } from './schedule'
import type { QimenChart, QimenOptions } from './types'

/** The store fields the chart clock reads and writes (core's journey store has them). */
export interface ChartClockState {
  /** null = live (follows nowOverride, else the clock); a number = the visitor picked a moment. */
  readonly chartInstantMs: number | null
  /** ?now=, epoch ms. */
  readonly nowOverride: number | null
}

export interface ChartClockStore<S extends ChartClockState> {
  getState(): S
  setState(patch: { chartInstantMs: number | null }): void
  subscribe(listener: (state: S, prev: S) => void): () => void
}

/** Why the chart on show may have changed. */
export type RecastCause = 'moment' | 'turn' | 'visible'

export interface ChartClockDeps<S extends ChartClockState> {
  store: ChartClockStore<S>
  options: QimenOptions
  /** The instant a state shows: the picked moment, else ?now=, else the clock (core's `chartInstant`). */
  instant: (s: S) => number
  /** The clock the turn timer reads; tests fake it. Date.now by default. */
  now?: () => number
}

export interface ChartClock {
  /** The chart for an instant, or null where the engine has none (outside the 1930–2100 term table). */
  castAt(ms: number): QimenChart | null
  /** Picks the moment `steps` 时辰 from the one on show (leaving live mode); 0 changes nothing. */
  step(steps: number): void
  /**
   * Calls `recast` whenever the chart on show may have changed: the picked moment or ?now= changed
   * ('moment'), a 时辰 turned while live ('turn'), or the page became visible again ('visible': mobile
   * browsers throttle timers). `shown` is the caller's current chart, read after each recast to arm
   * the timer for its next turn. Returns the stop function.
   */
  follow(shown: () => QimenChart | null, recast: (cause: RecastCause) => void): () => void
}

/** The turn timer fires this long after the boundary, so the recast lands inside the new 时辰. */
const TURN_SLACK_MS = 50
/** setTimeout overflows past ~24.8 days: wait at most a day, then look again. */
const MAX_WAIT_MS = 86_400_000

/** How long to wait from `nowMs` until just after the chart's next turn. */
export function msUntilTurn(chart: QimenChart, nowMs: number): number {
  return Math.max(0, Math.min(Date.parse(chart.nextChangeUtc) - nowMs + TURN_SLACK_MS, MAX_WAIT_MS))
}

export function createChartClock<S extends ChartClockState>(deps: ChartClockDeps<S>): ChartClock {
  const { store, options, instant } = deps
  const now = deps.now ?? Date.now

  const castAt = (ms: number): QimenChart | null => {
    try {
      return computeChart(ms, options)
    } catch {
      return null
    }
  }

  const step = (steps: number): void => {
    if (steps === 0) return
    store.setState({ chartInstantMs: stepPeriodMs(resolveOptions(options), instant(store.getState()), steps) })
  }

  const follow = (shown: () => QimenChart | null, recast: (cause: RecastCause) => void): (() => void) => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const arm = () => {
      clearTimeout(timer)
      const s = store.getState()
      const chart = shown()
      // A picked moment or ?now= never turns by itself.
      if (s.chartInstantMs !== null || s.nowOverride !== null || !chart) return
      timer = setTimeout(() => fire('turn'), msUntilTurn(chart, now()))
    }
    const fire = (cause: RecastCause) => {
      recast(cause)
      arm()
    }
    const unsubscribe = store.subscribe((s, prev) => {
      if (s.chartInstantMs !== prev.chartInstantMs || s.nowOverride !== prev.nowOverride) fire('moment')
    })
    const onVisible = () => {
      if (document.visibilityState === 'visible') fire('visible')
    }
    const hasDocument = typeof document !== 'undefined'
    if (hasDocument) document.addEventListener('visibilitychange', onVisible)
    arm()
    return () => {
      unsubscribe()
      clearTimeout(timer)
      if (hasDocument) document.removeEventListener('visibilitychange', onVisible)
    }
  }

  return { castAt, step, follow }
}
