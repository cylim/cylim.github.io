// The chart clock both the grove director and the DOM chart source follow (design.md §9.6, qimen-spec §12.6).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createChartClock, msUntilTurn, type ChartClockState, type RecastCause } from './live'
import { computeChart } from './index'

const KL = { utcOffsetMinutes: 480 }
const FIXTURE_A = Date.parse('2026-09-28T19:30:00+08:00')

/** A minimal store with the journey store's shape (getState / setState / subscribe with prev). */
function fakeStore(init: ChartClockState) {
  let state = init
  const listeners = new Set<(s: ChartClockState, p: ChartClockState) => void>()
  return {
    getState: () => state,
    setState(patch: Partial<ChartClockState>) {
      const prev = state
      state = { ...state, ...patch }
      for (const l of listeners) l(state, prev)
    },
    subscribe(l: (s: ChartClockState, p: ChartClockState) => void) {
      listeners.add(l)
      return () => void listeners.delete(l)
    },
  }
}

function setup(init: Partial<ChartClockState> = {}) {
  let now = FIXTURE_A
  const store = fakeStore({ chartInstantMs: null, nowOverride: null, ...init })
  const instant = (s: ChartClockState) => s.chartInstantMs ?? s.nowOverride ?? now
  const clock = createChartClock({ store, options: KL, instant, now: () => now })
  return { store, clock, instant, advance: (ms: number) => (now += ms), nowMs: () => now }
}

describe('msUntilTurn', () => {
  it('waits until 50 ms past the next turn, at most a day', () => {
    const c = computeChart(FIXTURE_A, KL)
    expect(msUntilTurn(c, FIXTURE_A)).toBe(90 * 60_000 + 50)
    expect(msUntilTurn(c, Date.parse(c.nextChangeUtc) + 1000)).toBe(0)
    expect(msUntilTurn({ ...c, nextChangeUtc: '2027-01-01T00:00:00Z' }, FIXTURE_A)).toBe(86_400_000)
  })
})

describe('createChartClock', () => {
  beforeEach(() => void vi.useFakeTimers())
  afterEach(() => void vi.useRealTimers())

  it('casts, and returns null outside the term table instead of throwing', () => {
    const { clock } = setup()
    expect(clock.castAt(FIXTURE_A)?.pillars.hour.name).toBe('丙戌')
    expect(clock.castAt(Date.parse('1800-01-01T00:00:00Z'))).toBeNull()
  })

  it('steps the moment on show by 时辰 and leaves live mode; 0 does nothing', () => {
    const { clock, store } = setup()
    clock.step(0)
    expect(store.getState().chartInstantMs).toBeNull()
    clock.step(1)
    expect(store.getState().chartInstantMs).toBe(Date.parse('2026-09-28T13:00:00Z'))
    clock.step(-2)
    expect(store.getState().chartInstantMs).toBe(Date.parse('2026-09-28T09:00:00Z'))
  })

  it('while live, recasts just after each turn and re-arms for the next', () => {
    const { clock, advance } = setup()
    const causes: RecastCause[] = []
    const stop = clock.follow(
      () => computeChart(FIXTURE_A, KL),
      (c) => causes.push(c),
    )
    advance(90 * 60_000)
    vi.advanceTimersByTime(90 * 60_000 + 49)
    expect(causes).toEqual([])
    vi.advanceTimersByTime(1)
    expect(causes).toEqual(['turn'])
    stop()
    vi.advanceTimersByTime(10 * 3_600_000)
    expect(causes).toEqual(['turn'])
  })

  it('recasts when the moment changes; a picked moment or ?now= arms no turn', () => {
    const { clock, store } = setup()
    const causes: RecastCause[] = []
    const stop = clock.follow(
      () => computeChart(FIXTURE_A, KL),
      (c) => causes.push(c),
    )
    store.setState({ chartInstantMs: FIXTURE_A - 7_200_000 })
    expect(causes).toEqual(['moment'])
    vi.advanceTimersByTime(3 * 3_600_000)
    expect(causes).toEqual(['moment'])
    store.setState({ chartInstantMs: null, nowOverride: FIXTURE_A })
    vi.advanceTimersByTime(3 * 3_600_000)
    expect(causes).toEqual(['moment', 'moment'])
    stop()
  })
})
