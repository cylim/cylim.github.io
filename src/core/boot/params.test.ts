import { describe, expect, it } from 'vitest'
import { parseBootParams } from './params'
import { sectionFromHash } from '../sections/ids'
import { initialJourneyState, isSettled, underFogCover, visibleSections } from '../store/journey'

describe('parseBootParams', () => {
  it('reads the e2e switches', () => {
    const p = parseBootParams('?e2e=1&tier=high&now=2026-01-01T04:00:00Z&mode=immersive&still=E3&renderTest=door')
    expect(p).toEqual({
      e2e: true,
      tier: 'high',
      now: Date.parse('2026-01-01T04:00:00Z'),
      mode: 'immersive',
      still: 'E3',
    })
  })

  it('ignores junk', () => {
    expect(parseBootParams('?tier=ultra&now=soon&mode=vr&renderTest=')).toMatchObject({
      tier: null,
      now: null,
      mode: null,
      e2e: false,
    })
    // ?debug had no panel behind it (QM-5); it is no longer a switch. ?renderTest is the dev
    // server's (core/render/Stage.tsx), not a boot param, so production never reads it (QM-9).
    expect(parseBootParams('?debug')).not.toHaveProperty('debug')
    expect(parseBootParams('?renderTest=door')).not.toHaveProperty('renderTest')
  })
})

describe('sectionFromHash', () => {
  it('maps hashes, accepts #threshold, falls back to the threshold', () => {
    expect(sectionFromHash('#cabin')).toBe('cabin')
    expect(sectionFromHash('#threshold')).toBe('threshold')
    expect(sectionFromHash('')).toBe('threshold')
    expect(sectionFromHash('#nowhere')).toBe('threshold')
  })
})

describe('isSettled', () => {
  it('is true in static mode unless a dive runs', () => {
    const s = initialJourneyState()
    expect(isSettled(s)).toBe(true)
    expect(isSettled({ ...s, dive: { phase: 'in', amount: 0.5, to: 'grove', waiting: false } })).toBe(false)
  })

  it('waits for every visible section when the stage is live', () => {
    const s = { ...initialJourneyState(), mode: 'immersive' as const, stage: 'live' as const, active: 'grove' as const, u: 0.666 }
    expect(isSettled(s)).toBe(false)
    expect(isSettled({ ...s, ready: { grove: true } })).toBe(true)
    // At the cabin door the threshold is still in view.
    expect(visibleSections(0.25)).toEqual(['threshold', 'cabin'])
    expect(isSettled({ ...s, u: 0.25, active: 'cabin', ready: { cabin: true } })).toBe(false)
  })

  it('is not settled in immersive mode before the stage is live', () => {
    const s = { ...initialJourneyState(), mode: 'immersive' as const }
    expect(isSettled(s)).toBe(false)
    expect(isSettled({ ...s, stage: 'lost' })).toBe(true)
  })
})

describe('underFogCover', () => {
  const s = initialJourneyState()
  it('counts dives, the moon-gate paper, catch-up fog and the mist wall as cover', () => {
    expect(underFogCover(s)).toBe(false)
    expect(underFogCover({ ...s, dive: { phase: 'hold', amount: 1, to: 'grove', waiting: true } })).toBe(true)
    expect(underFogCover({ ...s, paper: 1 })).toBe(true)
    expect(underFogCover({ ...s, lagFog: 0.8 })).toBe(true)
    expect(underFogCover({ ...s, fogBase: 0.14 })).toBe(true)
    // Inside the hall fogBase is the night fade, not paper fog.
    expect(underFogCover({ ...s, fogBase: 0.14, insideCabin: true })).toBe(false)
  })
})
