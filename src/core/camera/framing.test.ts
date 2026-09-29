import { describe, expect, it, vi } from 'vitest'
import { buildFraming, fovKeys, hFit, planViewport, portraitBaseFov, projection, shiftXKeys, shiftYKeys, vFovFromH } from './framing'
import { channelKeys, sampleScalar } from '../world/journey'

// The full walk, grove included: these tests pin the design tables and the grove's code, whatever
// content/features.ts says (the live, groveless walk is covered by core/world/groveOff.test.ts).
vi.mock('../../content/features', () => ({ features: { grove: true } }))

const DEG = Math.PI / 180
const desktop = { width: 1280, height: 720, header: 0 }
const phone = { width: 390, height: 844, header: 0 }

describe('fov', () => {
  it('derives portrait vFOV from a 46° horizontal FOV, clamped to 55–68°', () => {
    expect(vFovFromH(46, 1)).toBeCloseTo(46, 9)
    expect(portraitBaseFov(390 / 844)).toBe(68)
    expect(portraitBaseFov(3 / 4)).toBeCloseTo(59.05, 1)
    expect(portraitBaseFov(0.95)).toBe(55)
  })

  it('uses the beat table in landscape', () => {
    expect(fovKeys(false, 16 / 9)).toEqual(channelKeys('fov'))
  })

  it('uses 62° in the hall, 58° at the signpost and the base elsewhere in portrait', () => {
    const keys = fovKeys(true, 390 / 844)
    expect(sampleScalar(keys, 10)).toBe(68)
    expect(sampleScalar(keys, 360)).toBe(62)
    expect(sampleScalar(keys, 500)).toBe(62)
    expect(sampleScalar(keys, 900)).toBe(58)
    expect(sampleScalar(keys, 780)).toBe(68)
    // The moon gate still cuts under full paper.
    expect(sampleScalar(keys, 571.9)).toBe(62)
    expect(sampleScalar(keys, 572)).toBe(68)
  })
})

describe('h_fit', () => {
  it('comes out near 34 m at 16:9 with the chart panel on the right third (design.md §6.1)', () => {
    expect(hFit(desktop, false, 40)).toBeGreaterThan(33)
    expect(hFit(desktop, false, 40)).toBeLessThan(35)
  })

  it('rises when the header eats into the chart viewport, and fits the width in portrait', () => {
    expect(hFit({ ...desktop, header: 56 }, false, 40)).toBeGreaterThan(hFit(desktop, false, 40))
    const h = hFit(phone, true, 68)
    // R4 + 1 m spans exactly the screen width at the ring plane.
    const halfWidth = (h - 0.06) * Math.tan(34 * DEG) * (390 / 844)
    expect(halfWidth).toBeCloseTo(12.3, 6)
  })

  it('is part of the framing and changes with the viewport', () => {
    expect(buildFraming(desktop).hFit).toBeCloseTo(hFit(desktop, false, 40), 9)
    expect(buildFraming(phone).portrait).toBe(true)
    expect(buildFraming({ width: 1920, height: 800, header: 56 }).hFit).not.toBeCloseTo(buildFraming(desktop).hFit, 2)
  })
})

describe('text-zone shift (design.md §6.4)', () => {
  const x = shiftXKeys(desktop, false)
  const y = shiftYKeys(desktop, false)
  it('centres the subject away from the copy', () => {
    expect(sampleScalar(x, 20)).toBe(0.2) // T0, zone L
    expect(sampleScalar(x, 395)).toBe(-0.2) // I2a, zone R
    expect(sampleScalar(x, 420)).toBe(0.2) // I2b, zone L
    expect(sampleScalar(x, 300)).toBe(0) // C3, the nudge: centred
    expect(sampleScalar(x, 500)).toBe(0) // I3, the pane: square-on
    expect(sampleScalar(x, 990)).toBe(0) // E3, the mount
  })

  it('centres the plan view in the chart viewport left of the panel', () => {
    expect(sampleScalar(x, 780)).toBeCloseTo(-1 / 6, 9)
    expect(sampleScalar(y, 780)).toBe(0)
    const withHeader = planViewport({ ...desktop, header: 56 }, false)
    expect(withHeader.shiftY).toBeCloseTo(28 / 720, 9)
  })

  it('lifts the subject into the top 55% in portrait, except the hanging-scroll finale', () => {
    const py = shiftYKeys(phone, true)
    expect(sampleScalar(py, 20)).toBeCloseTo(0.275 - 0.5, 9)
    expect(sampleScalar(py, 780)).toBeCloseTo(-0.2, 9)
    expect(sampleScalar(py, 995)).toBe(0)
    expect(shiftXKeys(phone, true)).toEqual([{ at: 0, v: 0 }])
  })
})

describe('projection', () => {
  it('is a plain frustum without a shift', () => {
    expect(projection(1000, 500, 40, 0, 0)).toEqual({ fov: 40, aspect: 2, view: null })
  })

  it('moves the principal point and keeps the visible vertical FOV', () => {
    const p = projection(1000, 500, 40, 0.2, -0.225)
    const [fullW, fullH, x, y, w, h] = p.view!
    expect(fullW / 2 - x).toBeCloseTo(700, 9) // principal point 20% right of centre
    expect(fullH / 2 - y).toBeCloseTo(0.275 * 500, 9) // and 22.5% above it
    expect([w, h]).toEqual([1000, 500])
    expect(p.aspect).toBeCloseTo(fullW / fullH, 9)
    const visible = (2 * Math.atan((Math.tan((p.fov * DEG) / 2) * h) / fullH)) / DEG
    expect(visible).toBeCloseTo(40, 9)
  })
})
