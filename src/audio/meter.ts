/**
 * Level meters for checking cues against the sheet (design.md §12): RMS and sample peak in dBFS
 * across channels, and integrated loudness per ITU-R BS.1770-4 (K-weighting, 400 ms blocks with
 * 75% overlap, absolute −70 LUFS and relative −10 LU gates). Pure; calibrate.ts and the tests use it.
 */

import { gainToDb } from './cues'

type Channels = readonly ArrayLike<number>[]

/** RMS over every channel together (mean square across channels), dBFS. */
export function rmsDb(channels: Channels, from = 0, to?: number): number {
  let sum = 0
  let count = 0
  for (const c of channels) {
    const end = to ?? c.length
    for (let i = from; i < end; i++) sum += (c[i] as number) ** 2
    count += Math.max(0, end - from)
  }
  return gainToDb(Math.sqrt(sum / Math.max(1, count)))
}

export function peakDb(channels: Channels, from = 0, to?: number): number {
  let p = 0
  for (const c of channels) {
    const end = to ?? c.length
    for (let i = from; i < end; i++) p = Math.max(p, Math.abs(c[i] as number))
  }
  return gainToDb(p)
}

interface Biquad {
  b0: number
  b1: number
  b2: number
  a1: number
  a2: number
}

/** The two K-weighting stages for any sample rate (the libebur128 derivation of BS.1770's 48 kHz coefficients). */
function kWeighting(sr: number): [Biquad, Biquad] {
  let f0 = 1681.974450955533
  const g = 3.999843853973347
  let q = 0.7071752369554196
  let k = Math.tan((Math.PI * f0) / sr)
  const vh = 10 ** (g / 20)
  const vb = vh ** 0.4996667741545416
  let a0 = 1 + k / q + k * k
  const shelf = {
    b0: (vh + (vb * k) / q + k * k) / a0,
    b1: (2 * (k * k - vh)) / a0,
    b2: (vh - (vb * k) / q + k * k) / a0,
    a1: (2 * (k * k - 1)) / a0,
    a2: (1 - k / q + k * k) / a0,
  }
  f0 = 38.13547087602444
  q = 0.5003270373238773
  k = Math.tan((Math.PI * f0) / sr)
  a0 = 1 + k / q + k * k
  const highpass = { b0: 1, b1: -2, b2: 1, a1: (2 * (k * k - 1)) / a0, a2: (1 - k / q + k * k) / a0 }
  return [shelf, highpass]
}

function run(x: ArrayLike<number>, f: Biquad): Float64Array {
  const y = new Float64Array(x.length)
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0
  for (let i = 0; i < x.length; i++) {
    const v = x[i] as number
    const out = f.b0 * v + f.b1 * x1 + f.b2 * x2 - f.a1 * y1 - f.a2 * y2
    x2 = x1
    x1 = v
    y2 = y1
    y1 = out
    y[i] = out
  }
  return y
}

const loudness = (z: number) => -0.691 + 10 * Math.log10(z)
const mean = (zs: readonly number[]) => zs.reduce((a, b) => a + b, 0) / zs.length

/** Mean-square power of each 400 ms block (75% overlap), summed across channels after K-weighting. */
function blockPowers(channels: Channels, sr: number): number[] {
  const [shelf, highpass] = kWeighting(sr)
  const weighted = channels.map((c) => run(run(c, shelf), highpass))
  const block = Math.round(0.4 * sr)
  const hop = Math.round(0.1 * sr)
  const length = weighted[0]?.length ?? 0
  const powers: number[] = []
  for (let start = 0; start + block <= length; start += hop) {
    let z = 0
    for (const w of weighted) {
      let sum = 0
      for (let i = start; i < start + block; i++) sum += (w[i] as number) ** 2
      z += sum / block
    }
    powers.push(z)
  }
  return powers
}

/** Integrated loudness in LUFS for stereo (or mono) channels at `sr`. −Infinity when everything is gated out. */
export function integratedLufs(channels: Channels, sr: number): number {
  const absolute = blockPowers(channels, sr).filter((z) => loudness(z) > -70)
  if (!absolute.length) return -Infinity
  const relative = loudness(mean(absolute)) - 10
  const gated = absolute.filter((z) => loudness(z) > relative)
  return loudness(mean(gated))
}

/** Momentary loudness (400 ms blocks every 100 ms), LUFS. */
export const momentaryLufs = (channels: Channels, sr: number): number[] => blockPowers(channels, sr).map(loudness)

/** The loudest 400 ms block, in LUFS. */
export function maxMomentaryLufs(channels: Channels, sr: number): number {
  return loudness(blockPowers(channels, sr).reduce((a, b) => Math.max(a, b), 0))
}
