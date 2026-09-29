import { useSyncExternalStore } from 'react'
import { chartInstant, journey, type JourneyState } from '../../core/store/journey'
import { computeChart } from '../../lib/qimen'
import { createChartClock } from '../../lib/qimen/live'
import type { QimenChart, QimenOptions } from '../../lib/qimen/types'
import { chartOptions } from '../../content'

/**
 * The chart everyone on the DOM side reads: the grove panel, the album SVG, the cast label and the
 * colophon. A tiny external store over the journey store: it recasts when the picked moment changes,
 * at each 时辰 boundary while live (`chart.nextChangeUtc`), and on visibilitychange, because mobile
 * browsers throttle timers (qimen-spec.md §12.6). The timing is lib/qimen/live.ts's, which the
 * grove's stone chart follows too.
 */

export interface ChartSnapshot {
  chart: QimenChart | null
  /** Set when the engine threw (outside the term table, or not built yet). */
  error: string | null
  instantMs: number
  live: boolean
}

type Store = Pick<typeof journey, 'getState' | 'setState' | 'subscribe'>

export interface ChartSourceDeps {
  store: Store
  compute: (ms: number, options: QimenOptions) => QimenChart
  now: () => number
  options: QimenOptions
}

export interface ChartSource {
  subscribe: (cb: () => void) => () => void
  getSnapshot: () => ChartSnapshot
}

export function createChartSource(deps: ChartSourceDeps): ChartSource {
  const clock = createChartClock({ store: deps.store, options: deps.options, instant: chartInstant, now: deps.now })
  let cache: (ChartSnapshot & { nextChangeMs: number; nowOverride: number | null }) | null = null

  const cast = (ms: number, live: boolean, s: JourneyState) => {
    try {
      const chart = deps.compute(ms, deps.options)
      cache = { chart, error: null, instantMs: ms, live, nextChangeMs: Date.parse(chart.nextChangeUtc), nowOverride: s.nowOverride }
    } catch (e) {
      cache = { chart: null, error: e instanceof Error ? e.message : String(e), instantMs: ms, live, nextChangeMs: Infinity, nowOverride: s.nowOverride }
    }
    return cache
  }

  const getSnapshot = (): ChartSnapshot => {
    const s = deps.store.getState()
    const live = s.chartInstantMs === null
    if (live) {
      const now = s.nowOverride ?? deps.now()
      if (cache?.live && cache.nowOverride === s.nowOverride && now >= cache.instantMs && now < cache.nextChangeMs) return cache
      return cast(now, true, s)
    }
    const ms = chartInstant(s)
    if (cache && !cache.live && cache.instantMs === ms) return cache
    return cast(ms, false, s)
  }

  // Recast (notify React) whenever the chart can change; the snapshot re-reads the store.
  const subscribe = (cb: () => void) => clock.follow(() => getSnapshot().chart, () => cb())

  return { subscribe, getSnapshot }
}

export const chartSource = createChartSource({
  store: journey,
  compute: (ms, options) => computeChart(ms, options),
  now: () => Date.now(),
  options: chartOptions,
})

/** The DOM side's chart clock (Earlier/Later, the hour slider, arbitrary casts); the grove director builds the same one. */
export const chartClock = createChartClock({ store: journey, options: chartOptions, instant: chartInstant })

/** Client-only chart: null on the server and during hydration (design.md §9.8). */
export function useChart(): ChartSnapshot | null {
  return useSyncExternalStore(chartSource.subscribe, chartSource.getSnapshot, () => null)
}

/** Cast for an arbitrary instant (terminal `qimen`, compass readouts); null outside the term table. */
export function castAt(ms: number): QimenChart | null {
  return chartClock.castAt(ms)
}
