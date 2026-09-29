import { describe, expect, it, vi } from 'vitest'
import { initialJourneyState, type DivePhase } from '../core/store/journey'
import { MARKS } from '../core/world/beats'
import { DETENT_MAX_PER_SECOND } from './cues'
import { createDetents, createRateGate, createTriggers, groveOnScreen, type Cue, type TriggerState } from './triggers'

// The full walk, grove included: these tests pin the design tables and the grove's code, whatever
// content/features.ts says (the live, groveless walk is covered by core/world/groveOff.test.ts).
vi.mock('../content/features', () => ({ features: { grove: true } }))

const state = (jvh: number, patch: Partial<TriggerState> = {}): TriggerState => {
  const s = initialJourneyState()
  return { jvh, dive: s.dive, insideCabin: false, ignitionPlayed: false, finale: s.finale, ...patch }
}
const dive = (phase: DivePhase, amount = 0.5): Partial<TriggerState> => ({ dive: { phase, amount, to: 'cabin', waiting: false } })

/** Walk from `from` to `to` in small scroll steps, collecting every cue. */
function walk(from: number, to: number, triggers = createTriggers({ jvh: from }), step = 2): Cue[] {
  const out: Cue[] = []
  const dir = Math.sign(to - from)
  let prev = state(from)
  for (let j = from + dir * step; dir > 0 ? j <= to : j >= to; j += dir * step) {
    const next = state(j)
    out.push(...triggers.step(prev, next))
    prev = next
  }
  return out
}

describe('forward-only marks', () => {
  it('creaks the door once, walking forward over 277', () => {
    expect(walk(250, 300)).toEqual(['creak'])
  })

  it('never plays a cue walking backwards over its mark', () => {
    expect(walk(700, 250)).toEqual([])
  })

  it('plays the whole forward sequence in walk order', () => {
    expect(walk(0, 1000)).toEqual(['creak', 'gate', 'guqin', 'reveal'])
  })

  it('does not replay on a jiggle across the mark, but re-arms after going back before the door', () => {
    const t = createTriggers({ jvh: 270 })
    expect(walk(270, 280, t)).toEqual(['creak'])
    expect(walk(280, 275, t)).toEqual([])
    expect(walk(275, 285, t)).toEqual([])
    expect(walk(285, MARKS.doorPortalOn - 2, t)).toEqual([])
    expect(walk(MARKS.doorPortalOn - 2, 290, t)).toEqual(['creak'])
  })

  it('stays quiet for marks already behind the listener when sound starts', () => {
    const t = createTriggers({ jvh: 623 })
    expect(walk(623, 700, t)).toEqual(['reveal'])
  })

  it('does not fire when sound starts right after a mark', () => {
    const t = createTriggers({ jvh: 630 })
    expect(walk(630, 700, t)).toEqual([])
  })

  it('stays silent when a jump (End key, scrollbar drag) passes a mark, and does not fire it later', () => {
    const t = createTriggers({ jvh: 100 })
    expect(t.step(state(100), state(400))).toEqual([])
    expect(walk(400, 450, t)).toEqual([])
  })

  it('stays silent when a dive swaps the scroll across marks', () => {
    const t = createTriggers({ jvh: 0 })
    expect(t.step(state(0, dive('in', 1)), state(345, dive('hold', 1)))).toEqual([])
    expect(t.step(state(600, dive('out', 0.4)), state(630, dive('out', 0.3)))).toEqual([])
  })
})

describe('store edges', () => {
  it('whooshes once when a dive starts going in', () => {
    const t = createTriggers({ jvh: 100 })
    expect(t.step(state(100), state(100, dive('in', 0.1)))).toEqual(['whoosh'])
    expect(t.step(state(100, dive('in', 0.1)), state(100, dive('in', 0.6)))).toEqual([])
    expect(t.step(state(100, dive('in', 1)), state(666, dive('hold', 1)))).toEqual([])
    expect(t.step(state(666, dive('hold', 1)), state(666, dive('out', 0.9)))).toEqual([])
  })

  it('swells the ignition on the first door crossing, before the cabin records it as played', () => {
    const t = createTriggers({ jvh: 310 })
    const inside = { insideCabin: true }
    expect(t.step(state(315), state(317, inside))).toEqual(['ignition'])
    expect(t.step(state(317, inside), state(330, { ...inside, ignitionPlayed: true }))).toEqual([])
  })

  it('swells once per session, and not at all once the cabin has already ignited', () => {
    const t = createTriggers({ jvh: 310 })
    expect(t.step(state(315), state(317, { insideCabin: true }))).toEqual(['ignition'])
    expect(t.step(state(317, { insideCabin: true }), state(315))).toEqual([])
    expect(t.step(state(315), state(317, { insideCabin: true }))).toEqual([])
    const late = createTriggers({ jvh: 310 })
    expect(late.step(state(315, { ignitionPlayed: true }), state(317, { insideCabin: true, ignitionPlayed: true }))).toEqual([])
  })

  it('swells when a dive into the cabin glides through the door', () => {
    const t = createTriggers({ jvh: 0 })
    expect(t.step(state(345, dive('out', 0.5)), state(345, { ...dive('out', 0.4), insideCabin: true }))).toEqual(['ignition'])
  })

  it('thuds the seal when it stamps', () => {
    const t = createTriggers({ jvh: 985 })
    const stamped = { finale: { mountOpen: true, sealStamped: true, colophonShown: false } }
    expect(t.step(state(986), state(987, stamped))).toEqual(['seal'])
    expect(t.step(state(987, stamped), state(988, stamped))).toEqual([])
  })
})

/** Run a detent clock through a speed profile at a frame rate; count the clicks. */
function clicks(speedAt: (t: number) => number, seconds: number, fps = 60): number {
  const d = createDetents()
  let n = 0
  for (let i = 1; i <= seconds * fps + 1; i++) {
    const t = i / fps
    if (d.step(speedAt(t), t, 1 / fps)) n++
  }
  return n
}

describe('detents', () => {
  it('clicks at each 45° slot', () => {
    expect(clicks((t) => (t <= 2 ? 2 : 0), 2.5)).toBe(4)
  })

  it('caps a fast scrub at 8 clicks per second and never builds a queue', () => {
    expect(clicks((t) => (t <= 1 ? 20 : 0), 1.5)).toBeLessThanOrEqual(DETENT_MAX_PER_SECOND)
    expect(clicks((t) => (t <= 3 ? 20 : 0), 3.5)).toBeLessThanOrEqual(DETENT_MAX_PER_SECOND * 3)
  })

  it('clicks as the rings settle into a slot they stopped just short of', () => {
    const d = createDetents()
    expect(d.step(1, 0.1, 0.9)).toBe(false)
    expect(d.step(0, 0.2, 0.1)).toBe(true)
  })

  it('stays silent at rest and after stopping past a slot', () => {
    const d = createDetents()
    expect(d.step(0, 0, 0.016)).toBe(false)
    expect(d.step(1, 0.1, 1.2)).toBe(true)
    expect(d.step(0, 0.5, 0.1)).toBe(false)
  })
})

describe('rate gate', () => {
  it('lets through at most the rate and drops the rest', () => {
    const gate = createRateGate(8)
    let passed = 0
    for (let i = 0; i < 100; i++) if (gate(i / 100)) passed++
    expect(passed).toBe(8)
  })
})

describe('groveOnScreen', () => {
  it('is true from the reveal to the end of the grove, and never mid-dive', () => {
    expect(groveOnScreen(state(500))).toBe(false)
    expect(groveOnScreen(state(620))).toBe(false)
    expect(groveOnScreen(state(700))).toBe(true)
    expect(groveOnScreen(state(861))).toBe(true)
    expect(groveOnScreen(state(900))).toBe(false)
    expect(groveOnScreen(state(700, dive('out')))).toBe(false)
  })
})
