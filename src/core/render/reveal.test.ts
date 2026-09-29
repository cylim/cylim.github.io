import { afterEach, describe, expect, it } from 'vitest'
import { REVEAL_FROM, cancelReveal, hurryReveal, isRevealing, revealThreshold, startReveal } from './reveal'

afterEach(() => cancelReveal())

describe('develop reveal (design.md §8.1)', () => {
  it('sweeps the threshold from 1.3 to 0 over the duration', () => {
    startReveal(1000, 1800)
    expect(revealThreshold(1000)).toBeCloseTo(REVEAL_FROM)
    expect(revealThreshold(1900)).toBeCloseTo(REVEAL_FROM / 2)
    expect(revealThreshold(2800)).toBe(0)
    expect(isRevealing()).toBe(false)
  })

  it('finishes within 300 ms once the visitor scrolls', () => {
    startReveal(0, 1800)
    const before = revealThreshold(600)
    hurryReveal(600, 300)
    expect(revealThreshold(600)).toBeCloseTo(before)
    expect(revealThreshold(750)).toBeCloseTo(before / 2)
    expect(revealThreshold(900)).toBe(0)
  })

  it('never slows a sweep that is already nearly done', () => {
    startReveal(0, 1800)
    hurryReveal(1700, 300)
    expect(revealThreshold(1800)).toBe(0)
  })

  it('reads 0 when nothing runs', () => {
    expect(revealThreshold(123)).toBe(0)
  })
})
