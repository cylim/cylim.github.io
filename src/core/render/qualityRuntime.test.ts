import type { RootState } from '@react-three/fiber'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PREFS_KEY } from '../boot/prefs'
import { journey } from '../store/journey'
import { QualityRuntime } from './qualityRuntime'

const store = new Map<string, string>()

function fakeState(): RootState {
  const gl = { getContext: () => ({ getExtension: () => null, getParameter: () => 'ANGLE (NVIDIA GeForce)', RENDERER: 0 }) }
  return { frameloop: 'always', invalidate: () => {}, gl } as unknown as RootState
}

beforeEach(() => {
  store.clear()
  vi.stubGlobal('window', { devicePixelRatio: 1 })
  vi.stubGlobal('screen', { width: 1280, height: 800 })
  vi.stubGlobal('matchMedia', () => ({ matches: false }))
  vi.stubGlobal('navigator', { hardwareConcurrency: 8 })
  vi.stubGlobal('location', { search: '' })
  vi.stubGlobal('document', { visibilityState: 'visible' })
  vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('quality runtime: Settings → Quality (issue M3)', () => {
  it('lifts the pinned ceiling when the visitor goes back to Auto', () => {
    let now = 0
    vi.spyOn(performance, 'now').mockImplementation(() => now)
    store.set(PREFS_KEY, JSON.stringify({ quality: 'low' }))
    journey.setState({ tier: 'low', reducedMotion: false, dive: { ...journey.getState().dive, amount: 0 }, paper: 0, lagFog: 0, fogBase: 0.03, insideCabin: false })

    const runtime = new QualityRuntime('skip', 1, { setDpr: () => {}, setPostTier: () => {}, onReveal: () => {}, onSlow: () => {}, onLive: () => {} })
    runtime.tierChanged('low')
    const state = fakeState()
    const run = (ms: number) => {
      for (const end = now + ms; now < end; ) {
        now += 16
        runtime.frame(state)
      }
    }
    run(2000)
    expect(journey.getState().stage).toBe('live')

    // Pinned Low: a fast device stays on Low.
    run(12000)
    expect(journey.getState().tier).toBe('low')

    store.set(PREFS_KEY, JSON.stringify({ quality: 'auto' }))
    runtime.qualityChanged()
    run(30000)
    expect(journey.getState().tier).not.toBe('low')
  })
})

const hooks = (dprs: number[]) => ({ setDpr: (d: number) => void dprs.push(d), setPostTier: () => {}, onReveal: () => {}, onSlow: () => {}, onLive: () => {} })

describe('quality runtime: devicePixelRatio changes (QM-P8)', () => {

  it('follows the window to a 2x display and back on high', () => {
    journey.setState({ tier: 'high' })
    const dprs: number[] = []
    const runtime = new QualityRuntime('skip', 1, hooks(dprs))
    runtime.devicePixelRatioChanged(2)
    expect(dprs).toEqual([2])
    runtime.setDpr(2)
    runtime.devicePixelRatioChanged(1)
    expect(dprs).toEqual([2, 1])
  })

  it('keeps a step the monitor took and never leaves the tier range', () => {
    journey.setState({ tier: 'medium' })
    const dprs: number[] = []
    // A 2x screen, medium stepped down from its 1.5 cap to 1.25.
    vi.stubGlobal('window', { devicePixelRatio: 2 })
    const runtime = new QualityRuntime('skip', 1.25, hooks(dprs))
    // Zoomed out to 1.5x: 1.25 × 0.75, clamped to medium's floor of 1.
    runtime.devicePixelRatioChanged(1.5)
    expect(dprs).toEqual([1])
    runtime.setDpr(1)
    // Back to 2x: 1 × 4/3, under medium's 1.5 cap.
    runtime.devicePixelRatioChanged(2)
    expect(dprs[1]).toBeCloseTo(4 / 3)
    // The same ratio again is not a change.
    runtime.devicePixelRatioChanged(2)
    expect(dprs).toHaveLength(2)
  })
})

describe('quality runtime: devicePixelRatio read each frame (QM-P8)', () => {
  it('notices a new ratio even when no media-query event came', () => {
    journey.setState({ tier: 'high', reducedMotion: false })
    const win = { devicePixelRatio: 1 }
    vi.stubGlobal('window', win)
    const dprs: number[] = []
    const runtime = new QualityRuntime('e2e', 1, hooks(dprs))
    const state = fakeState()
    runtime.frame(state)
    expect(dprs).toEqual([])
    win.devicePixelRatio = 2
    runtime.frame(state)
    expect(dprs).toEqual([2])
  })
})

/** A benchmark-mode runtime on low; `run` feeds it frames of the given lengths. */
const start = () => {
  let now = 0
  vi.spyOn(performance, 'now').mockImplementation(() => now)
  const calls = { slow: 0, live: 0 }
  const runtime = new QualityRuntime('benchmark', 1, {
    setDpr: () => {},
    setPostTier: () => {},
    onReveal: () => {},
    onSlow: () => void calls.slow++,
    onLive: () => void calls.live++,
  })
  const state = fakeState()
  const run = (frameMs: (i: number) => number, frames: number) => {
    for (let i = 0; i < frames; i++) {
      now += frameMs(i)
      runtime.frame(state)
    }
    return calls
  }
  return { run, runtime }
}

interface Mark {
  verdict: string
  gaveUp: boolean
  samples: number[]
}

const marks = () => performance.getEntriesByName('cy.benchmark').map((m) => (m as PerformanceMark).detail as Mark)

describe('quality runtime: the hidden benchmark (design.md §13.2)', () => {
  let warn: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    journey.setState({ tier: 'low', reducedMotion: false })
    performance.clearMarks('cy.benchmark')
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it('switches to the album only after a second slow run on low, and warns then', () => {
    const { run } = start()
    // One run is 8 warmup frames and 60 measured ones.
    expect(run(() => 30, 69).slow).toBe(0)
    expect(warn).not.toHaveBeenCalled()
    expect(run(() => 30, 69).slow).toBe(1)
    expect(warn).toHaveBeenCalledOnce()
  })

  it('keeps the walk when a cold first run is slow and the retry is fast', () => {
    const { run } = start()
    run(() => 30, 69)
    expect(run(() => 16, 75)).toEqual({ slow: 0, live: 1 })
    expect(warn).not.toHaveBeenCalled()
  })

  it('leaves stalls out of the samples', () => {
    const { run } = start()
    // A chunk parse or texture upload: four 400 ms stalls early in the run.
    expect(run((i) => (i > 10 && i < 20 && i % 2 ? 400 : 16), 100)).toEqual({ slow: 0, live: 1 })
    const [mark] = marks()
    expect(mark?.samples).toHaveLength(60)
    expect(Math.max(...(mark?.samples ?? []))).toBeLessThan(250)
  })

  it('still reaches a verdict when every frame is a stall', () => {
    const { run } = start()
    // Under 4 fps: nothing is kept as a sample, so each run gives up after 3 s on every frame.
    expect(run(() => 400, 60).slow).toBe(1)
    expect(marks().map((m) => [m.verdict, m.gaveUp])).toEqual([
      ['static', true],
      ['static', true],
    ])
  })

  it('waits while hidden frames arrive and measures once the tab is visible', () => {
    const doc = { visibilityState: 'hidden' }
    vi.stubGlobal('document', doc)
    const { run } = start()
    // A background tab: throttled frames that would read as far too slow.
    expect(run(() => 100, 300)).toEqual({ slow: 0, live: 0 })
    doc.visibilityState = 'visible'
    expect(run(() => 16, 75)).toEqual({ slow: 0, live: 1 })
  })

  it('drops an interrupted run when the tab hides with its frames paused', () => {
    const doc = { visibilityState: 'visible' }
    vi.stubGlobal('document', doc)
    const { run, runtime } = start()
    // The first run is slow; the retry is 40 slow samples in when the tab hides.
    run(() => 30, 69)
    run(() => 30, 48)
    doc.visibilityState = 'hidden'
    runtime.visibilityChanged()
    doc.visibilityState = 'visible'
    runtime.visibilityChanged()
    // Kept, those 40 samples would outvote the 20 fast ones that finish the run.
    expect(run(() => 16, 75)).toEqual({ slow: 0, live: 1 })
  })
})
