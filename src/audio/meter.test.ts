import { describe, expect, it } from 'vitest'
import { integratedLufs, peakDb, rmsDb } from './meter'

const SR = 48000
const sine = (hz: number, amp: number, seconds: number, sr = SR) =>
  Float32Array.from({ length: Math.round(seconds * sr) }, (_, i) => amp * Math.sin((2 * Math.PI * hz * i) / sr))

describe('meters', () => {
  it('reads a full-scale sine at −3 dBFS RMS and 0 dBFS peak', () => {
    const s = sine(1000, 1, 1)
    expect(rmsDb([s])).toBeCloseTo(-3.01, 1)
    expect(peakDb([s])).toBeCloseTo(0, 2)
  })

  it('reads RMS across channels together', () => {
    const s = sine(1000, 1, 1)
    expect(rmsDb([s, new Float32Array(s.length)])).toBeCloseTo(-6.02, 1)
  })

  // BS.1770-4: a 0 dBFS 1 kHz sine in one channel reads −3.01 LKFS.
  it('reads the BS.1770 reference tone', () => {
    const s = sine(997, 1, 5)
    expect(integratedLufs([s, new Float32Array(s.length)], SR)).toBeCloseTo(-3.01, 1)
  })

  it('follows level and works at 44.1 kHz', () => {
    const s = sine(997, 10 ** (-20 / 20), 5, 44100)
    expect(integratedLufs([s, s], 44100)).toBeCloseTo(-20, 0)
  })

  it('gates silence out', () => {
    expect(integratedLufs([new Float32Array(SR * 2)], SR)).toBe(-Infinity)
  })
})
