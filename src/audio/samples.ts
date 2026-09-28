/**
 * Every sample buffer the cues use, rendered from one seed (design.md §12). Pure: the page renders
 * it in samples.worker.ts so a phone's main thread never stalls, and calibrate.ts renders it inline.
 * About 8 MB at 48 kHz; the low beds (wind, grind) render at half rate.
 */

import { crackleLoop, doorCreak, grindLoop, guqinHarmonic, pineLoop, seeded, streamLoop, tick, whiteNoise, windLoop, type Samples } from './dsp'

export interface SampleSet {
  sampleRate: number
  /** Rate of the low beds, half the context's. */
  halfRate: number
  wind: [Samples, Samples]
  pine: Samples
  stream: Samples
  grind: Samples
  crackle: Samples
  noise: Samples
  guqin: Samples
  creak: Samples
  keys: Samples[]
  click: Samples
}

const KEY_VARIANTS = 6

export function renderSamples(sampleRate: number, seed: number): SampleSet {
  const sr = sampleRate
  const halfRate = Math.max(8000, Math.round(sr / 2))
  const r = seeded(seed)
  return {
    sampleRate,
    halfRate,
    wind: windLoop(halfRate, 7, r),
    pine: pineLoop(sr, 12, r),
    stream: streamLoop(sr, 7, r),
    grind: grindLoop(halfRate, 5, r),
    crackle: crackleLoop(sr, 9, r),
    noise: whiteNoise(Math.round(2 * sr), r),
    guqin: guqinHarmonic(sr, r),
    creak: doorCreak(sr, r),
    keys: Array.from({ length: KEY_VARIANTS }, () => tick(sr, 6, 2800, 1.1, r)),
    click: tick(sr, 1.5, 3500, 0.8, r),
  }
}

/** The set's sample memory, to hand over from the worker without copying. */
export function transferables(s: SampleSet): ArrayBuffer[] {
  return [...s.wind, s.pine, s.stream, s.grind, s.crackle, s.noise, s.guqin, s.creak, ...s.keys, s.click].map((x) => x.buffer)
}
