import { describe, expect, it, vi } from 'vitest'
import { color, inkRamp } from '../../../theme/tokens'
import { MARKS } from '../../world/journey'
import { glints as anchors } from '../../world/layout'
import { POST, autoFlatten, finaleMistWeight, fogBreath, forestDepth, forestFogTint, understoreyMist } from './postFx'
import { FOG_COVER } from '../../world/journey'
import { LANTERN_FOG_FADE, glintFrame, glintSlots, lanternFlicker, resetGlints, setGlint } from './glints'
import { rampBands, srgbLumaOfHex } from './InkEffect'

// The full walk, grove included: these tests pin the design tables and the grove's code, whatever
// content/features.ts says (the live, groveless walk is covered by core/world/groveOff.test.ts).
vi.mock('../../../content/features', () => ({ features: { grove: true } }))

describe('glints (design.md §7.3.2)', () => {
  it('sit on the lantern flame and the cabin leak', () => {
    expect(glintSlots[0].pos.toArray()).toEqual([...anchors.lantern])
    expect(glintSlots[1].pos.toArray()).toEqual([...anchors.cabin])
  })

  it('lantern: hidden inside 25 m (the flame billboard takes over), 3 px far, 4 px near', () => {
    const g = glintSlots[0]
    expect(glintFrame(0, g, 20, 0, 1).alpha).toBe(0)
    expect(glintFrame(0, g, 211, 0, 1)).toEqual({ alpha: 1, core: 3 })
    expect(glintFrame(0, g, 35, 0, 1).core).toBe(4)
  })

  it('lantern: goes out in the mist wall (P2) and returns as it parts (P3)', () => {
    const g = glintSlots[0]
    // Every other outdoor beat keeps it: T0 0.04, the path 0.032, the grove seat 0.012.
    for (const fog of [0.04, 0.032, 0.012]) expect(glintFrame(0, g, 150, 620, 1, fog).alpha).toBe(1)
    expect(glintFrame(0, g, 150, 620, 1, FOG_COVER).alpha).toBe(0)
    expect(glintFrame(0, g, 150, 628, 1, 0.14).alpha).toBe(0)
    const mid = glintFrame(0, g, 150, 620, 1, (LANTERN_FOG_FADE[0] + LANTERN_FOG_FADE[1]) / 2).alpha
    expect(mid).toBeGreaterThan(0)
    expect(mid).toBeLessThan(1)
    // The cabin pinprick ignores fog: it only ever shows in the thin finale air.
    expect(glintFrame(1, glintSlots[1], 100, 990, 1, 0.14).alpha).toBe(1)
  })

  it('lantern flicker stays within 0.92–1.0', () => {
    for (let t = 0; t < 10; t += 0.013) {
      const f = lanternFlicker(t)
      expect(f).toBeGreaterThanOrEqual(0.92)
      expect(f).toBeLessThanOrEqual(1)
    }
  })

  it('cabin pinprick only in the finale', () => {
    const g = glintSlots[1]
    expect(glintFrame(1, g, 100, 900, 1).alpha).toBe(0)
    expect(glintFrame(1, g, 100, MARKS.finaleStart + 20, 1).alpha).toBe(1)
  })

  it('manual mode uses the given alpha; reset restores the rules', () => {
    setGlint(1, { auto: false, alpha: 0.5, pos: [1, 2, 3] })
    expect(glintFrame(1, glintSlots[1], 100, 0, 1).alpha).toBe(0.5)
    resetGlints()
    expect(glintSlots[1].auto).toBe(true)
    expect(glintSlots[1].pos.toArray()).toEqual([...anchors.cabin])
  })
})

describe('uFlatten (§7.3.3)', () => {
  it('ramps across E2', () => {
    expect(autoFlatten(900)).toBe(0)
    expect(autoFlatten((MARKS.finaleStart + MARKS.sealStamp) / 2)).toBeCloseTo(0.5)
    expect(autoFlatten(1000)).toBe(1)
  })
})

describe('ink ramp bands', () => {
  it('uses the token stops and their midpoints', () => {
    const b = rampBands()
    const stops = inkRamp.map((s) => s[0])
    expect(b.stops.toArray()).toEqual(stops.slice(1, 5))
    expect(b.edges.x).toBeCloseTo((stops[0]! + stops[1]!) / 2)
    expect(b.paper).toBeCloseTo((stops[4]! + stops[5]!) / 2)
  })

  it('normalises by the luma of paper', () => {
    expect(srgbLumaOfHex('#FFFFFF')).toBeCloseTo(1)
    expect(srgbLumaOfHex(color.paper)).toBeGreaterThan(0.9)
    expect(srgbLumaOfHex(color.inkJiao)).toBeLessThan(0.1)
  })
})

describe('the finale painting mist (§8.7 E2)', () => {
  it('takes over from the walk fog as the orbit rises, and holds through E3', () => {
    expect(finaleMistWeight(900)).toBe(0)
    expect(finaleMistWeight(MARKS.finaleStart)).toBe(0)
    expect(finaleMistWeight(MARKS.finaleStart + 15)).toBeGreaterThan(0)
    expect(finaleMistWeight(MARKS.finaleStart + 15)).toBeLessThan(1)
    expect(finaleMistWeight(MARKS.sealStamp)).toBe(1)
    expect(finaleMistWeight(1000)).toBe(1)
  })

  it('recedes near to far: the lantern keeps its ink, the ridges pale', () => {
    const { aerial, rate, start } = POST.finaleMist
    const at = (d: number) => aerial * (1 - Math.exp(-rate * Math.max(d - start, 0)))
    expect(at(55)).toBe(0) // the lantern from E3
    expect(at(90)).toBeLessThan(0.15) // the grove
    expect(at(180)).toBeGreaterThan(0.25) // the cabin
    expect(at(450)).toBeGreaterThan(0.5) // the northern ridges
  })
})

describe('the forest deepens (§8.2)', () => {
  it('drifts the far fog toward paper-shade on the walk only', () => {
    expect(forestFogTint(20)).toBe(0)
    expect(forestFogTint(205)).toBeGreaterThan(0.9 * POST.fogTint)
    expect(forestFogTint(262)).toBe(0)
    expect(forestFogTint(600)).toBe(0)
    expect(forestDepth(150)).toBeGreaterThan(0)
    expect(forestDepth(150)).toBeLessThan(1)
  })

  it('lays understorey mist on the walk, the path and the exit, never in the grove or the cabin', () => {
    for (const jvh of [18, 121, 236]) expect(understoreyMist(jvh)).toBe(1)
    for (const jvh of [330, 500]) expect(understoreyMist(jvh)).toBe(0)
    expect(understoreyMist(600)).toBe(1)
    for (const jvh of [666, 742, 790]) expect(understoreyMist(jvh)).toBe(0)
    expect(understoreyMist(910)).toBeCloseTo(0.7)
  })
})

describe('forest fog breathing (§8.2)', () => {
  it('breathes ±0.004 on the walk only, and eases in at its ends', () => {
    const base = 0.03
    expect(fogBreath(60, 3, base)).toBe(1)
    expect(fogBreath(300, 3, base)).toBe(1)
    let lo = 1
    let hi = 1
    for (let t = 0; t < 12; t += 0.1) {
      lo = Math.min(lo, fogBreath(160, t, base))
      hi = Math.max(hi, fogBreath(160, t, base))
    }
    expect(base * hi - base).toBeCloseTo(POST.fogBreath.amount, 4)
    expect(base - base * lo).toBeCloseTo(POST.fogBreath.amount, 4)
    expect(Math.abs(fogBreath(92, 3, base) - 1)).toBeLessThan(Math.abs(fogBreath(160, 3, base) - 1))
  })
})
