import { describe, expect, it, vi } from 'vitest'
import {
  BEATS,
  J,
  SECTION_SPANS,
  beatAt,
  channelKeys,
  jvhToU,
  sampleScalar,
  scrollSvh,
  sectionAtJvh,
  sectionHeightSvh,
  uToJvh,
  type Channel,
} from './journey'
import { SECTION_IDS } from '../sections/ids'

// The full walk, grove included: these tests pin the design tables and the grove's code, whatever
// content/features.ts says (the live, groveless walk is covered by core/world/groveOff.test.ts).
vi.mock('../../content/features', () => ({ features: { grove: true } }))

describe('jvh and u', () => {
  it('maps the design arrivals to u (design.md §6.2)', () => {
    expect(jvhToU(0)).toBe(0)
    expect(jvhToU(345)).toBeCloseTo(0.345)
    expect(jvhToU(666)).toBeCloseTo(0.666)
    expect(jvhToU(886)).toBeCloseTo(0.886)
    expect(jvhToU(J)).toBe(1)
    expect(uToJvh(jvhToU(572))).toBeCloseTo(572)
  })
})

describe('sections', () => {
  it('tile 0..1000 in walk order and hold their arrivals', () => {
    let at = 0
    for (const id of SECTION_IDS) {
      const s = SECTION_SPANS[id]
      expect(s.jvh[0]).toBe(at)
      expect(s.arrivalJvh).toBeGreaterThanOrEqual(s.jvh[0])
      expect(s.arrivalJvh).toBeLessThan(s.jvh[1])
      expect(sectionAtJvh(s.arrivalJvh)).toBe(id)
      at = s.jvh[1]
    }
    expect(at).toBe(J)
  })

  it('DOM heights total the scroll length of J plus 100 svh (design.md §0)', () => {
    const total = SECTION_IDS.reduce((n, id) => n + sectionHeightSvh(id), 0)
    expect(total).toBeCloseTo(scrollSvh(J) + 100, 9)
  })
})

describe('beat table', () => {
  it('beats tile 0..1000 with no gaps, holds inside their beat', () => {
    let at = 0
    for (const b of BEATS) {
      expect(b.jvh[0], b.id).toBe(at)
      expect(b.jvh[1], b.id).toBeGreaterThan(b.jvh[0])
      if (b.hold) {
        expect(b.hold[0], b.id).toBeGreaterThanOrEqual(b.jvh[0])
        expect(b.hold[1], b.id).toBeLessThanOrEqual(b.jvh[1])
      }
      expect(sectionAtJvh(b.jvh[0]), b.id).toBe(b.section)
      at = b.jvh[1]
    }
    expect(at).toBe(J)
    expect(beatAt(345).id).toBe('I1')
    expect(beatAt(666).id).toBe('G1')
    expect(beatAt(886).id).toBe('E1')
    expect(beatAt(1000).id).toBe('E3')
  })

  it('every channel key sits inside its beat and keys run in jvh order', () => {
    const channels: Channel[] = ['pos', 'look', 'fov', 'fog', 'roll', 'up', 'paper']
    for (const b of BEATS) {
      for (const c of channels) {
        for (const key of b[c]) {
          expect(key.at, `${b.id}.${c}`).toBeGreaterThanOrEqual(b.jvh[0])
          expect(key.at, `${b.id}.${c}`).toBeLessThanOrEqual(b.jvh[1])
        }
      }
    }
    for (const c of channels) {
      const keys = channelKeys(c)
      for (let i = 1; i < keys.length; i++) {
        expect(keys[i]!.at, `${c} key ${i}`).toBeGreaterThanOrEqual(keys[i - 1]!.at)
      }
    }
  })

  it('the camera never sprints between keys, except the one cut at 572', () => {
    const pos = channelKeys('pos')
    for (let i = 1; i < pos.length; i++) {
      const a = pos[i - 1]!
      const b = pos[i]!
      if (b.cut || b.fit || a.fit) continue
      const d = Math.hypot(b.v[0] - a.v[0], b.v[1] - a.v[1], b.v[2] - a.v[2])
      const speed = d / Math.max(b.at - a.at, 1e-6)
      expect(speed, `${a.at} → ${b.at}`).toBeLessThan(2)
    }
    expect(pos.filter((k) => k.cut).map((k) => k.at)).toEqual([572])
  })
})

describe('sampleScalar', () => {
  const keys = [
    { at: 0, v: 0 },
    { at: 10, v: 1 },
    { at: 20, v: 5, cut: true as const },
    { at: 30, v: 0 },
  ]
  it('interpolates linearly and clamps at the ends', () => {
    expect(sampleScalar(keys, -5)).toBe(0)
    expect(sampleScalar(keys, 5)).toBeCloseTo(0.5)
    expect(sampleScalar(keys, 25)).toBeCloseTo(2.5)
    expect(sampleScalar(keys, 99)).toBe(0)
  })
  it('jumps at a cut instead of interpolating into it', () => {
    expect(sampleScalar(keys, 19.9)).toBe(1)
    expect(sampleScalar(keys, 20)).toBe(5)
  })
  it('reads the fog peak of the mist wall', () => {
    expect(sampleScalar(channelKeys('fog'), 629)).toBeCloseTo(0.14)
    expect(sampleScalar(channelKeys('fog'), 700)).toBeCloseTo(0.012)
  })
})
