import { describe, expect, it } from 'vitest'
import { BEAT_SPANS, HOLD_STRETCH, beatSpanAt, holdOf, inHold, scrollSvh, scrollSvhBetween, stillJvh } from './beats'
import { BEATS, beatAt } from './journey'

describe('beats.ts, the boot share of the beat table', () => {
  it('matches every BEATS row in journey.ts: id, section, range, hold and zone', () => {
    const rows = BEATS.map(({ id, section, jvh, hold, zone }) => ({ id, section, jvh, hold, zone }))
    expect(BEAT_SPANS).toEqual(rows)
  })

  it('finds the same beat as the camera table', () => {
    for (const jvh of [0, 39.9, 40, 316, 345, 527.5, 572, 742, 999.99, 1000, 1200]) expect(beatSpanAt(jvh).id).toBe(beatAt(jvh).id)
  })

  it('knows holds and stills', () => {
    expect(holdOf('I3')).toEqual([488, 524])
    expect(holdOf('C2')).toEqual([275, 292])
    expect(inHold(500)).toBe(true)
    expect(inHold(300)).toBe(true)
    expect(inHold(560)).toBe(false)
    expect(stillJvh('C3')).toBe(301)
    expect(stillJvh('G3')).toBe((742 + 833) / 2)
  })

  it('scrolls holds HOLD_STRETCH times longer than the rest of the walk', () => {
    expect(HOLD_STRETCH).toBeGreaterThan(1)
    expect(scrollSvh(0)).toBe(0)
    // I3 holds 488–524: the beat's lead-in scrolls 1:1, the hold stretches.
    expect(scrollSvhBetween(480, 488)).toBe(8)
    expect(scrollSvhBetween(488, 524)).toBe(36 * HOLD_STRETCH)
    expect(scrollSvhBetween(530, 560)).toBe(30)
    // Still one scroll position per journey position.
    for (let jvh = 1; jvh <= 1000; jvh += 7) expect(scrollSvh(jvh)).toBeGreaterThan(scrollSvh(jvh - 1))
  })
})
