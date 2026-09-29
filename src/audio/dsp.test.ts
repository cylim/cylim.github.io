import { describe, expect, it } from 'vitest'
import { GUQIN, crackleLoop, doorCreak, guqinHarmonic, peak, pineLoop, rms, seamless, seeded, streamLoop, whiteNoise, type Samples } from './dsp'

const SR = 48000

/** Frequency by autocorrelation over a window, searching lags for 200–400 Hz, refined by parabolic interpolation. */
function pitchAt(x: Samples, sr: number, fromS: number, seconds: number): number {
  const a = Math.round(fromS * sr)
  const n = Math.round(seconds * sr)
  const minLag = Math.floor(sr / 400)
  const maxLag = Math.ceil(sr / 200)
  const corr = (lag: number) => {
    let s = 0
    for (let i = a; i < a + n; i++) s += (x[i] as number) * (x[i + lag] as number)
    return s
  }
  let best = minLag
  let bestC = -Infinity
  for (let lag = minLag; lag <= maxLag; lag++) {
    const c = corr(lag)
    if (c > bestC) {
      bestC = c
      best = lag
    }
  }
  const c0 = corr(best - 1)
  const c2 = corr(best + 1)
  const shift = (0.5 * (c0 - c2)) / (c0 - 2 * bestC + c2)
  return sr / (best + shift)
}

const cents = (a: number, b: number) => 1200 * Math.log2(a / b)

describe('seeded noise', () => {
  it('repeats for the same seed', () => {
    const a = whiteNoise(1000, seeded(1))
    const b = whiteNoise(1000, seeded(1))
    expect(Array.from(a)).toEqual(Array.from(b))
    expect(Array.from(whiteNoise(1000, seeded(2)))).not.toEqual(Array.from(a))
  })

  it('is normalised to unit RMS', () => {
    expect(rms(whiteNoise(48000, seeded(3)))).toBeCloseTo(1, 5)
  })
})

describe('seamless loops', () => {
  it('runs the end straight into the start', () => {
    const x = whiteNoise(10000, seeded(4))
    const fade = 500
    const y = seamless(x, fade)
    expect(y.length).toBe(10000 - fade)
    // The last sample and the first are neighbours in the source, so the seam is one ordinary step.
    expect(y[y.length - 1]).toBe(x[y.length - 1])
    expect(y[0]).toBeCloseTo((x[0] as number) * Math.sin(Math.PI / 4 / fade) + (x[y.length] as number) * Math.cos(Math.PI / 4 / fade), 5)
  })

  it('keeps the beds seamless: the step across the loop point is no bigger than a typical step', () => {
    for (const loop of [pineLoop(SR, 3, seeded(5)), streamLoop(SR, 3, seeded(6))]) {
      let typical = 0
      for (let i = 1; i < loop.length; i++) typical += Math.abs((loop[i] as number) - (loop[i - 1] as number))
      typical /= loop.length - 1
      expect(Math.abs((loop[0] as number) - (loop[loop.length - 1] as number))).toBeLessThan(typical * 6)
    }
  })
})

describe('guqin harmonic (Karplus–Strong)', () => {
  const note = guqinHarmonic(SR, seeded(0x6c696d))

  it('is D4, 294 Hz', () => {
    expect(Math.abs(cents(pitchAt(note, SR, 0.3, 0.5), GUQIN.hz))).toBeLessThan(5)
  })

  it('slides 20 cents down at the tail', () => {
    const early = pitchAt(note, SR, 0.5, 0.5)
    const late = pitchAt(note, SR, GUQIN.slide[1], 0.3)
    expect(cents(late, early)).toBeGreaterThan(-GUQIN.slideCents - 5)
    expect(cents(late, early)).toBeLessThan(-GUQIN.slideCents + 5)
  })

  it('decays over about 4 s and ends in silence', () => {
    const level = (s: number) => 20 * Math.log10(rms(note, Math.round(s * SR), Math.round((s + 0.2) * SR)))
    const perSecond = (level(0.3) - level(2.3)) / 2
    expect(perSecond).toBeGreaterThan(10)
    expect(perSecond).toBeLessThan(20)
    expect(peak(note)).toBeCloseTo(1, 5)
    expect(Math.abs(note[note.length - 1] as number)).toBeLessThan(1e-3)
  })
})

describe('door creak and crackle', () => {
  it('creaks for 1.2 s at peak 1, fading in and out', () => {
    const creak = doorCreak(SR, seeded(8))
    expect(creak.length).toBe(Math.round(1.2 * SR))
    expect(peak(creak)).toBeCloseTo(1, 5)
    expect(rms(creak, 0, 480)).toBeLessThan(rms(creak, SR * 0.3, SR * 0.6))
    expect(rms(creak, creak.length - 480)).toBeLessThan(rms(creak, SR * 0.3, SR * 0.6))
  })

  it('crackles sparsely', () => {
    const c = crackleLoop(SR, 9, seeded(9))
    let active = 0
    for (const v of c) if (Math.abs(v) > 0.01) active++
    expect(active / c.length).toBeLessThan(0.05)
    expect(active).toBeGreaterThan(0)
    expect(Math.abs(c[0] as number)).toBe(0)
    expect(Math.abs(c[c.length - 1] as number)).toBe(0)
  })
})
