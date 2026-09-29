import { describe, expect, it, vi } from 'vitest'
import { BEATS, MARKS } from '../core/world/journey'
import { CARDS, cardOpacity, focusJvh, rollProgress, trackJvh } from './cards'
import { INSCRIPTION_WINDOWS, inscriptionAt } from './chrome/Inscriptions'

// The full walk, grove included: these tests pin the design tables and the grove's code, whatever
// content/features.ts says (the live, groveless walk is covered by core/world/groveOff.test.ts).
vi.mock('../content/features', () => ({ features: { grove: true } }))

const card = (id: string) => {
  const c = CARDS.find((x) => x.beat === id)
  if (!c) throw new Error(id)
  return c
}

describe('card timing in the walk', () => {
  it('has one card per beat with a text zone, and none for zone-less beats', () => {
    const zoned = BEATS.filter((b) => b.zone !== null).map((b) => b.id)
    expect(CARDS.map((c) => c.beat).toSorted()).toEqual(zoned.toSorted())
  })

  it('every card is fully visible only while its frame is pinned', () => {
    for (const c of CARDS) {
      const b = BEATS.find((x) => x.id === c.beat)
      if (!b) throw new Error(c.beat)
      const pinned: [number, number] = [b.jvh[0], b.jvh[0] + trackJvh(c)]
      if (c.roll) continue
      expect(c.show[0], c.beat).toBeGreaterThanOrEqual(pinned[0])
      expect(c.show[1], c.beat).toBeLessThanOrEqual(pinned[1])
    }
  })

  it('shows the hero from the first frame and fades it out 40–65 (design.md §6.1 T1)', () => {
    const t0 = CARDS[0]
    if (!t0) throw new Error('no T0')
    expect(cardOpacity(t0, 0)).toBe(1)
    expect(cardOpacity(t0, MARKS.heroFadeOut[0])).toBe(1)
    expect(cardOpacity(t0, 52)).toBeGreaterThan(0)
    expect(cardOpacity(t0, 52)).toBeLessThan(1)
    expect(cardOpacity(t0, MARKS.heroFadeOut[1])).toBe(0)
  })

  it('fades in before a hold and out after it', () => {
    const f1 = CARDS.find((c) => c.beat === 'F1')
    if (!f1) throw new Error('no F1')
    expect(cardOpacity(f1, 90)).toBe(0)
    expect(cardOpacity(f1, 97)).toBeGreaterThan(0)
    expect(cardOpacity(f1, 120)).toBe(1)
    expect(cardOpacity(f1, 150)).toBe(0)
  })

  it('the timeline credits have rolled away before the moon gate whiteout', () => {
    const i4 = CARDS.find((c) => c.roll)
    if (!i4) throw new Error('no roll')
    expect(cardOpacity(i4, MARKS.moonGate[0])).toBe(0)
    expect(rollProgress(i4, 500)).toBe(0)
    expect(rollProgress(i4, MARKS.moonGate[0])).toBe(1)
  })

  it('keyboard focus in a hidden card glides to the nearest point where it shows whole (A11Y-1, A11Y-2)', () => {
    // Already showing: stay put.
    expect(focusJvh(card('I3'), 500)).toBeNull()
    // Tab from the last I2d link into the terminal: forward to the start of the I3 hold.
    const i3 = card('I3')
    const to = focusJvh(i3, 470)
    expect(to).toBe(i3.show[0] + 1)
    expect(cardOpacity(i3, to as number)).toBe(1)
    // "Read the chart" reached by Tab at G0 (before the hold), or by Shift+Tab from the G3 panel.
    const g1 = card('G1')
    expect(focusJvh(g1, 656)).toBe(g1.show[0] + 1)
    expect(focusJvh(g1, 790)).toBe(g1.show[1] - 1)
    for (const c of CARDS) for (const j of [0, 300, 600, 900, 1000]) {
      const t = focusJvh(c, j)
      expect(cardOpacity(c, t ?? j), `${c.beat} from ${j}`).toBe(1)
    }
  })

  it('the contact card stays through E2 and the finale', () => {
    const e1 = CARDS.find((c) => c.beat === 'E1')
    if (!e1) throw new Error('no E1')
    for (const j of [900, 960, 1000]) expect(cardOpacity(e1, j)).toBe(1)
  })
})

describe('section inscriptions', () => {
  it('run from the first hold to the last hold of their section, and give way to the colophon', () => {
    expect(INSCRIPTION_WINDOWS).toEqual({ cabin: [250, 524], grove: [588, 833], contact: [886, 1000] })
    expect(inscriptionAt(100)).toBeNull()
    expect(inscriptionAt(260)).toBe('cabin')
    expect(inscriptionAt(700)).toBe('grove')
    expect(inscriptionAt(900)).toBe('contact')
    expect(inscriptionAt(MARKS.sealStamp)).toBeNull()
  })
})
