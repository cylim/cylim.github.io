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
