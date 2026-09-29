import { describe, expect, it, vi } from 'vitest'
import { initialJourneyState } from '../core/store/journey'
import { MARKS } from '../core/world/beats'
import { CUTOFF, GRIND_FULL_SPEED, LEVEL, gainToDb } from './cues'
import { mixAt, spanWeight, streamPan, type MixState } from './mix'

// The full walk, grove included: these tests pin the design tables and the grove's code, whatever
// content/features.ts says (the live, groveless walk is covered by core/world/groveOff.test.ts).
vi.mock('../content/features', () => ({ features: { grove: 'walk' } }))

const at = (patch: Partial<MixState> = {}): MixState => {
  const s = initialJourneyState()
  return { jvh: s.jvh, insideCabin: s.insideCabin, dive: s.dive, paper: s.paper, ringSpeed: s.ringSpeed, finale: s.finale, ...patch }
}
const db = (g: number) => gainToDb(g)
const diving = (amount: number): Partial<MixState> => ({ dive: { phase: 'in', amount, to: 'grove', waiting: false } })

describe('beds by place (design §12)', () => {
  it('opens on wind alone at the threshold', () => {
    const m = mixAt(at({ jvh: 20 }))
    expect(db(m.wind)).toBeCloseTo(LEVEL.wind, 5)
    expect(m.pine).toBe(0)
    expect(m.hum).toBe(0)
    expect(m.stream).toBe(0)
    expect(m.crackle).toBe(0)
  })

  it('adds the pine bed through the forest walk', () => {
    const m = mixAt(at({ jvh: 120 }))
    expect(db(m.wind)).toBeCloseTo(LEVEL.wind, 5)
    expect(db(m.pine)).toBeCloseTo(LEVEL.pine, 5)
  })

  it('crossfades pine out and the hum in at the cabin', () => {
    const edge = mixAt(at({ jvh: 245 }))
    expect(edge.pine).toBeGreaterThan(0)
    expect(edge.hum).toBeGreaterThan(0)
    const c1 = mixAt(at({ jvh: 260 }))
    expect(c1.pine).toBe(0)
    expect(db(c1.hum)).toBeCloseTo(LEVEL.humOutside, 5)
    expect(c1.humCutoff).toBeCloseTo(CUTOFF.humClosed, 5)
  })

  it('opens the hum partly through the swung door and fully inside', () => {
    const open = mixAt(at({ jvh: 300 }))
    expect(db(open.hum)).toBeGreaterThan(LEVEL.humOutside)
    expect(db(open.hum)).toBeLessThan(LEVEL.humInside)
    expect(open.humCutoff).toBeGreaterThan(CUTOFF.humClosed)
    expect(open.humCutoff).toBeLessThan(CUTOFF.humOpen)
    const inside = mixAt(at({ jvh: 400, insideCabin: true }))
    expect(db(inside.hum)).toBeCloseTo(LEVEL.humInside, 5)
    expect(inside.humCutoff).toBeCloseTo(CUTOFF.humOpen, 5)
    expect(inside.wind).toBe(0)
    expect(inside.pine).toBe(0)
  })

  it('ducks the wind once the camera is past the door plane', () => {
    const outside = mixAt(at({ jvh: 316 }))
    const inside = mixAt(at({ jvh: 316, insideCabin: true }))
    expect(inside.wind).toBeLessThan(outside.wind * 0.5)
  })

  it('runs the stream only over 580–612, on top of wind and pine', () => {
    expect(mixAt(at({ jvh: 560 })).stream).toBe(0)
    const p1 = mixAt(at({ jvh: 595 }))
    expect(db(p1.stream)).toBeCloseTo(LEVEL.stream, 5)
    expect(p1.wind).toBeGreaterThan(0)
    expect(p1.pine).toBeGreaterThan(0)
    expect(mixAt(at({ jvh: 625 })).stream).toBe(0)
  })

  it('drops the pine bed in the mist wall and brings it back as the mist parts', () => {
    expect(mixAt(at({ jvh: 622 })).pine).toBe(0)
    expect(mixAt(at({ jvh: 636 })).pine).toBeGreaterThan(0)
    expect(db(mixAt(at({ jvh: 700 })).pine)).toBeCloseTo(LEVEL.pine, 5)
  })

  it('raises the lantern crackle from −34 to −28 dB across the contact span', () => {
    expect(mixAt(at({ jvh: 840 })).crackle).toBe(0)
    const near = db(mixAt(at({ jvh: 880 })).crackle)
    expect(near).toBeGreaterThan(LEVEL.crackle[0] - 0.5)
    expect(near).toBeLessThan(LEVEL.crackle[0] + 1.5)
    expect(db(mixAt(at({ jvh: 1000 })).crackle)).toBeCloseTo(LEVEL.crackle[1], 5)
  })

  it('keeps wind from the grove to the end of the walk', () => {
    expect(db(mixAt(at({ jvh: 700 })).wind)).toBeCloseTo(LEVEL.wind, 5)
    expect(db(mixAt(at({ jvh: 1000 })).wind)).toBeCloseTo(LEVEL.wind, 5)
  })
})

describe('master low-pass, duck and silence', () => {
  it('rests at 12 kHz and closes to 300 Hz under a full dive, ducking the beds −18 dB', () => {
    expect(mixAt(at({ jvh: 120 })).cutoff).toBeCloseTo(CUTOFF.open, 5)
    const full = mixAt(at({ jvh: 120, ...diving(1) }))
    expect(full.cutoff).toBeCloseTo(CUTOFF.dive, 5)
    expect(db(full.duck)).toBeCloseTo(LEVEL.duck, 5)
    expect(full.diving).toBe(true)
    const half = mixAt(at({ jvh: 120, ...diving(0.5) }))
    expect(half.cutoff).toBeLessThan(CUTOFF.open)
    expect(half.cutoff).toBeGreaterThan(CUTOFF.dive)
    expect(db(half.duck)).toBeCloseTo(LEVEL.duck / 2, 5)
    expect(mixAt(at({ jvh: 120 })).duck).toBe(1)
  })

  it('treats the moon-gate paper like a dive', () => {
    const m = mixAt(at({ jvh: 570, insideCabin: true, paper: 1 }))
    expect(m.cutoff).toBeCloseTo(CUTOFF.dive, 5)
    expect(db(m.duck)).toBeCloseTo(LEVEL.duck, 5)
  })

  it('closes into the mist wall and opens to 16 kHz after the reveal', () => {
    expect(mixAt(at({ jvh: MARKS.mistWall[0] - 1 })).cutoff).toBeCloseTo(CUTOFF.open, 5)
    expect(mixAt(at({ jvh: 622 })).cutoff).toBeCloseTo(CUTOFF.mist, 5)
    expect(mixAt(at({ jvh: MARKS.reveal[0] })).cutoff).toBeCloseTo(CUTOFF.reveal, 5)
    expect(mixAt(at({ jvh: 900 })).cutoff).toBeCloseTo(CUTOFF.reveal, 5)
  })

  it('goes silent after the seal stamps, only while the finale holds', () => {
    const sealed = { finale: { mountOpen: true, sealStamped: true, colophonShown: true } }
    expect(mixAt(at({ jvh: 990, ...sealed })).silence).toBe(true)
    expect(mixAt(at({ jvh: 900, ...sealed })).silence).toBe(false)
    expect(mixAt(at({ jvh: 990 })).silence).toBe(false)
  })
})

describe('ring grind', () => {
  it('follows ring speed up to its full level', () => {
    expect(mixAt(at({ jvh: 700 })).grind).toBe(0)
    const slow = mixAt(at({ jvh: 700, ringSpeed: GRIND_FULL_SPEED / 4 })).grind
    const full = mixAt(at({ jvh: 700, ringSpeed: GRIND_FULL_SPEED })).grind
    expect(slow).toBeGreaterThan(0)
    expect(slow).toBeLessThan(full)
    expect(db(full)).toBeCloseTo(LEVEL.grind, 5)
    expect(mixAt(at({ jvh: 700, ringSpeed: GRIND_FULL_SPEED * 5 })).grind).toBe(full)
  })
})

describe('stream pan', () => {
  it('stays on screen and near centre while the stones are ahead', () => {
    for (let jvh = 576; jvh <= 612; jvh += 2) {
      const p = streamPan(jvh)
      expect(Math.abs(p)).toBeLessThanOrEqual(1)
      expect(Number.isFinite(p)).toBe(true)
    }
    expect(Math.abs(streamPan(590))).toBeLessThan(0.3)
  })

  it('moves smoothly', () => {
    for (let jvh = 580; jvh < 612; jvh += 0.5) expect(Math.abs(streamPan(jvh + 0.5) - streamPan(jvh))).toBeLessThan(0.1)
  })
})

describe('spanWeight', () => {
  it('is full inside, zero outside, and crossfades inner edges but not the ends of the walk', () => {
    expect(spanWeight(0, [0, 322])).toBe(1)
    expect(spanWeight(1000, [572, 1000])).toBe(1)
    expect(spanWeight(150, [90, 245])).toBe(1)
    expect(spanWeight(60, [90, 245])).toBe(0)
    expect(spanWeight(90, [90, 245])).toBeCloseTo(0.5, 5)
    expect(spanWeight(245, [90, 245])).toBeCloseTo(0.5, 5)
  })
})
