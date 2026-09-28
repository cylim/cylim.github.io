import { describe, expect, it } from 'vitest'
import type { Tier } from '../store/journey'
import { PerfMonitor, benchmarkVerdict, displayHzFrom, frameCapFor, median, stepDown, stepUp } from './perf'
import { TIERS, clampDpr, dprRange, startDpr } from './quality'

const range = (t: Tier) => dprRange(t, 2, 2560 * 1600 * 4)

describe('benchmark', () => {
  it('takes the median, robust to compile hitches', () => {
    expect(median([10, 11, 300, 12, 9])).toBe(11)
    expect(median([10, 20])).toBe(15)
    expect(median([])).toBe(0)
  })

  it('applies the design.md §13.2 thresholds', () => {
    expect(benchmarkVerdict('high', 11.9)).toBe('keep')
    expect(benchmarkVerdict('high', 12.1)).toBe('down')
    expect(benchmarkVerdict('medium', 18.1)).toBe('down')
    expect(benchmarkVerdict('medium', 17)).toBe('keep')
    expect(benchmarkVerdict('low', 22.1)).toBe('static')
    expect(benchmarkVerdict('low', 21)).toBe('keep')
  })
})

describe('DPR ranges (§13.3)', () => {
  it('caps by tier and device, with 1.75 on high above 8 MP', () => {
    expect(dprRange('low', 3, 1e6)).toEqual({ cap: 1, floor: 0.75 })
    expect(dprRange('medium', 3, 1e6)).toEqual({ cap: 1.5, floor: 1 })
    expect(dprRange('high', 3, 1e6)).toEqual({ cap: 2, floor: 1.25 })
    expect(dprRange('high', 2, 9e6).cap).toBe(1.75)
    expect(startDpr('high', 2, 9e6)).toBe(1.75)
  })

  it('never puts the floor above the cap on a 1x screen', () => {
    expect(dprRange('high', 1, 2e6)).toEqual({ cap: 1, floor: 1 })
    expect(clampDpr(0.5, dprRange('high', 1, 2e6))).toBe(1)
  })
})

describe('stepping', () => {
  it('drops DPR by 0.25 to the floor before dropping a tier', () => {
    let level = { tier: 'high' as Tier, dpr: range('high').cap }
    const seen: string[] = []
    for (let i = 0; i < 12; i++) {
      const next = stepDown(level, range)
      if (!next) break
      seen.push(`${next.tier}@${next.dpr}`)
      level = next
    }
    expect(seen).toEqual(['high@1.5', 'high@1.25', 'medium@1.25', 'medium@1', 'low@1', 'low@0.75'])
    expect(stepDown(level, range)).toBeNull()
  })

  it('steps back up only as far as the benchmark ceiling', () => {
    const ceiling = { tier: 'medium' as Tier, dpr: 1.5 }
    let level = { tier: 'low' as Tier, dpr: 0.75 }
    const seen: string[] = []
    for (let i = 0; i < 12; i++) {
      const next = stepUp(level, ceiling, range)
      if (!next) break
      seen.push(`${next.tier}@${next.dpr}`)
      level = next
    }
    expect(seen).toEqual(['low@1', 'medium@1', 'medium@1.25', 'medium@1.5'])
  })
})

function feed(m: PerfMonitor, fps: number, ms: number, t0: number) {
  const out: string[] = []
  const dt = 1000 / fps
  let t = t0
  for (; t < t0 + ms; t += dt) {
    const s = m.sample(t)
    if (s) out.push(`${s}@${Math.round(t - t0)}`)
  }
  return { out, t }
}

describe('PerfMonitor', () => {
  it('declines after 2 s under 45 fps and inclines after 4 s over 58 fps', () => {
    const m = new PerfMonitor()
    const slow = feed(m, 30, 2600, 0)
    expect(slow.out).toHaveLength(1)
    expect(slow.out[0]).toMatch(/^decline@2[0-5]\d\d$/)
    m.reset()
    const fast = feed(m, 60, 4600, slow.t)
    expect(fast.out).toHaveLength(1)
    expect(fast.out[0]).toMatch(/^incline@4[0-5]\d\d$/)
  })

  it('stays quiet between the thresholds', () => {
    expect(feed(new PerfMonitor(), 52, 10_000, 0).out).toEqual([])
  })

  it('scales its thresholds to a 30 fps cap', () => {
    const m = new PerfMonitor()
    m.setTargetFps(30)
    expect(feed(m, 29.5, 6000, 0).out.every((s) => s.startsWith('incline'))).toBe(true)
  })

  it('locks after three flips, then stays silent', () => {
    const m = new PerfMonitor()
    let t = 0
    for (let i = 0; i < 4 && !m.locked; i++) {
      t = feed(m, i % 2 ? 60 : 30, 5000, t).t
      m.reset()
    }
    expect(m.locked).toBe(true)
    expect(feed(m, 20, 5000, t).out).toEqual([])
  })
})

describe('frame cap (§13.3)', () => {
  it('follows the tier table', () => {
    expect(frameCapFor('high', 40, 120)).toBeNull()
    expect(frameCapFor('medium', 55, 60)).toBeNull()
    expect(frameCapFor('medium', 55, 120)).toBe(60)
    expect(frameCapFor('low', 45, 60)).toBe(30)
    expect(frameCapFor('low', 58, 60)).toBeNull()
    expect(frameCapFor('low', 58, 144)).toBe(60)
    expect(frameCapFor('low', null, 60)).toBeNull()
  })

  it('reads the display rate from frame intervals', () => {
    expect(Math.round(displayHzFrom([8.3, 8.4, 8.3, 30]))).toBe(120)
  })
})

describe('TIERS', () => {
  it('matches design.md §13.3', () => {
    expect([TIERS.low.pines, TIERS.medium.pines, TIERS.high.pines]).toEqual([300, 700, 1500])
    expect([TIERS.low.fogMultiplier, TIERS.medium.fogMultiplier, TIERS.high.fogMultiplier]).toEqual([1.3, 1.1, 1])
    expect([TIERS.low.msaa, TIERS.medium.msaa, TIERS.high.msaa]).toEqual([0, 0, 4])
    expect([TIERS.low.bloomLevels, TIERS.medium.bloomLevels, TIERS.high.bloomLevels]).toEqual([0, 4, 6])
    expect([TIERS.low.dust, TIERS.medium.dust, TIERS.high.dust]).toEqual([0, 300, 800])
    expect([TIERS.low.inkEdges, TIERS.medium.inkEdges, TIERS.high.inkEdges]).toEqual([false, true, true])
    expect([TIERS.low.inkBoil, TIERS.medium.inkBoil, TIERS.high.inkBoil]).toEqual([false, false, true])
  })
})
