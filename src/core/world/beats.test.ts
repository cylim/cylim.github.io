import { describe, expect, it } from 'vitest'
import { BEAT_SPANS, beatSpanAt, holdOf, inHold, stillJvh } from './beats'
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
})
