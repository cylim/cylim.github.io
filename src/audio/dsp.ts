/**
 * Sample-level synthesis for what Web Audio nodes can't express on their own (design.md §12):
 * seeded noise, seamless loops, the Karplus–Strong guqin, the stick-slip door creak, the sparse
 * lantern crackle and the textured beds. Pure functions over Float32Array at a given sample rate,
 * so node tests and the page share them. Everything is seeded: the same visit sounds the same,
 * and offline renders are repeatable.
 */

export type Samples = Float32Array<ArrayBuffer>
export type Rng = () => number

const TAU = Math.PI * 2

/** mulberry32: small and fast, and plenty for noise. */
export function seeded(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const bipolar = (r: Rng) => r() * 2 - 1

export function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

export function rms(x: ArrayLike<number>, from = 0, to = x.length): number {
  let sum = 0
  for (let i = from; i < to; i++) sum += (x[i] as number) ** 2
  return Math.sqrt(sum / Math.max(1, to - from))
}

export function peak(x: ArrayLike<number>, from = 0, to = x.length): number {
  let p = 0
  for (let i = from; i < to; i++) p = Math.max(p, Math.abs(x[i] as number))
  return p
}

/** Scale in place so the RMS or the sample peak equals `target`. */
export function scaleTo(x: Samples, target: number, measure: 'rms' | 'peak'): Samples {
  const m = measure === 'rms' ? rms(x) : peak(x)
  if (m > 0) for (let i = 0; i < x.length; i++) (x[i] as number) *= target / m
  return x
}

export function whiteNoise(n: number, r: Rng): Samples {
  const x = new Float32Array(n)
  for (let i = 0; i < n; i++) x[i] = bipolar(r)
  return scaleTo(x, 1, 'rms')
}

/** Paul Kellet's refined pink filter, unit RMS. The first 8192 samples warm the filter and are dropped. */
export function pinkNoise(n: number, r: Rng): Samples {
  const warm = 8192
  const x = new Float32Array(n)
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0
  for (let i = -warm; i < n; i++) {
    const w = bipolar(r)
    b0 = 0.99886 * b0 + w * 0.0555179
    b1 = 0.99332 * b1 + w * 0.0750759
    b2 = 0.969 * b2 + w * 0.153852
    b3 = 0.8665 * b3 + w * 0.3104856
    b4 = 0.55 * b4 + w * 0.5329522
    b5 = -0.7616 * b5 - w * 0.016898
    const y = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362
    b6 = w * 0.115926
    if (i >= 0) x[i] = y
  }
  return scaleTo(x, 1, 'rms')
}

/** Leaky-integrated white noise (−6 dB/octave above a few Hz), unit RMS. */
export function brownNoise(n: number, r: Rng): Samples {
  const warm = 4096
  const x = new Float32Array(n)
  let b = 0
  for (let i = -warm; i < n; i++) {
    b = (b + 0.02 * bipolar(r)) / 1.02
    if (i >= 0) x[i] = b
  }
  return scaleTo(x, 1, 'rms')
}

/**
 * Loop without a seam: equal-power crossfade the last `fade` samples into the first. Returns
 * x.length − fade samples whose end runs straight into their start.
 */
export function seamless(x: Samples, fade: number): Samples {
  const n = x.length - fade
  const y = x.slice(0, n)
  for (let i = 0; i < fade; i++) {
    const t = (i + 0.5) / fade
    y[i] = (x[i] as number) * Math.sin((t * Math.PI) / 2) + (x[n + i] as number) * Math.cos((t * Math.PI) / 2)
  }
  return y
}

/** One-pole low-pass, in place. */
export function lowpass1(x: Samples, hz: number, sr: number): Samples {
  const k = 1 - Math.exp((-TAU * hz) / sr)
  let y = 0
  for (let i = 0; i < x.length; i++) {
    y += ((x[i] as number) - y) * k
    x[i] = y
  }
  return x
}

/** One-pole high-pass (the input minus its low-pass), in place. */
export function highpass1(x: Samples, hz: number, sr: number): Samples {
  const k = 1 - Math.exp((-TAU * hz) / sr)
  let y = 0
  for (let i = 0; i < x.length; i++) {
    const v = x[i] as number
    y += (v - y) * k
    x[i] = v - y
  }
  return x
}

/** Add `gain ×` a constant-peak band-pass (RBJ) of `x` into `out`. */
function bandpassInto(x: Samples, out: Samples, hz: number, q: number, gain: number, sr: number): void {
  const w = (TAU * hz) / sr
  const alpha = Math.sin(w) / (2 * q)
  const a0 = 1 + alpha
  const b0 = alpha / a0
  const a1 = (-2 * Math.cos(w)) / a0
  const a2 = (1 - alpha) / a0
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0
  for (let i = 0; i < x.length; i++) {
    const v = x[i] as number
    const y = b0 * v - b0 * x2 - a1 * y1 - a2 * y2
    x2 = x1
    x1 = v
    y2 = y1
    y1 = y
    out[i] = (out[i] as number) + gain * y
  }
}

/** A smooth random curve in 0..1 with `points` knots per loop, cosine-interpolated and wrapping at the loop point. */
export function periodicRandom(n: number, points: number, r: Rng): Samples {
  const knots = Array.from({ length: points }, r)
  const x = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const pos = (i / n) * points
    const k = Math.floor(pos)
    const a = knots[k % points] as number
    const b = knots[(k + 1) % points] as number
    x[i] = a + ((b - a) * (1 - Math.cos((pos - k) * Math.PI))) / 2
  }
  return x
}

// ---------------------------------------------------------------------------- beds

/** Wind: stereo pink noise, decorrelated channels, looping. The band-pass and its LFO are nodes. */
export function windLoop(sr: number, seconds: number, r: Rng): [Samples, Samples] {
  const n = Math.round(seconds * sr)
  const fade = Math.round(0.5 * sr)
  return [seamless(pinkNoise(n + fade, r), fade), seamless(pinkNoise(n + fade, r), fade)]
}

/**
 * 松涛, wind in the pines: a pink roar and a needle hiss that swell together like surf. The swells
 * are periodic in the loop length, so the loop has no seam; two voices read it half a loop apart.
 */
export function pineLoop(sr: number, seconds: number, r: Rng): Samples {
  const n = Math.round(seconds * sr)
  const fade = Math.round(0.4 * sr)
  const roar = scaleTo(seamless(lowpass1(pinkNoise(n + fade, r), 1600, sr), fade), 1, 'rms')
  const hiss = scaleTo(seamless(highpass1(whiteNoise(n + fade, r), 4000, sr), fade), 1, 'rms')
  const p1 = r() * TAU
  const p2 = r() * TAU
  const p3 = r() * TAU
  for (let i = 0; i < n; i++) {
    const ph = (TAU * i) / n
    const gust = Math.max(0.08, 0.55 + 0.25 * Math.sin(ph + p1) + 0.14 * Math.sin(2 * ph + p2) + 0.07 * Math.sin(5 * ph + p3))
    roar[i] = (roar[i] as number) * gust + 0.3 * (hiss[i] as number) * gust * gust
  }
  return scaleTo(roar, 1, 'rms')
}

/** The stream: white noise under a fast random babble, with small rising bubbles. The high-pass is a node. */
export function streamLoop(sr: number, seconds: number, r: Rng): Samples {
  const n = Math.round(seconds * sr)
  const fade = Math.round(0.2 * sr)
  const x = seamless(whiteNoise(n + fade, r), fade)
  const babble = periodicRandom(n, Math.round(seconds * 11), r)
  const swell = periodicRandom(n, Math.max(2, Math.round(seconds * 0.7)), r)
  for (let i = 0; i < n; i++) x[i] = (x[i] as number) * (0.25 + 0.75 * (babble[i] as number) ** 1.6) * (0.75 + 0.25 * (swell[i] as number))
  const bubbles = Math.round(seconds * 9)
  for (let k = 0; k < bubbles; k++) {
    const len = Math.round((0.012 + 0.03 * r()) * sr)
    const start = Math.floor(r() * (n - len))
    const f0 = 900 + 1900 * r()
    const f1 = f0 * (1.25 + 0.5 * r())
    const amp = 0.25 + 0.5 * r()
    let ph = 0
    for (let j = 0; j < len; j++) {
      const u = j / len
      ph += (TAU * (f0 + (f1 - f0) * u)) / sr
      x[start + j] = (x[start + j] as number) + amp * Math.sin(ph) * Math.sin(Math.PI * u) * Math.exp(-3 * u)
    }
  }
  return scaleTo(x, 1, 'rms')
}

/** Stone on stone: brown noise roughened by a fast random grit. The 140 Hz band-pass is a node. */
export function grindLoop(sr: number, seconds: number, r: Rng): Samples {
  const n = Math.round(seconds * sr)
  const fade = Math.round(0.25 * sr)
  const x = seamless(brownNoise(n + fade, r), fade)
  const grit = periodicRandom(n, Math.round(seconds * 35), r)
  for (let i = 0; i < n; i++) x[i] = (x[i] as number) * (0.5 + 0.5 * (grit[i] as number))
  return scaleTo(x, 1, 'rms')
}

/** Lantern crackle: sparse pops, some in small clusters. Pops never straddle the loop point. */
export function crackleLoop(sr: number, seconds: number, r: Rng): Samples {
  const n = Math.round(seconds * sr)
  const x = new Float32Array(n)
  const perSecond = 4
  const gap = () => -Math.log(1 - r()) / perSecond
  for (let t = gap(); t < seconds - 0.1; t += gap()) {
    const pops = r() < 0.25 ? 2 + Math.floor(r() * 4) : 1
    let at = t
    for (let k = 0; k < pops; k++) {
      const len = Math.max(8, Math.round((0.0004 + 0.0026 * r()) * sr))
      const amp = 0.15 + 0.85 * r() ** 2
      const start = Math.round(at * sr)
      for (let j = 0; j < len && start + j < n; j++) x[start + j] = (x[start + j] as number) + amp * bipolar(r) * Math.exp((-5 * j) / len)
      at += 0.003 + 0.02 * r()
    }
  }
  return scaleTo(x, 1, 'peak')
}

// ---------------------------------------------------------------------------- one-shots

export const GUQIN = {
  hz: 294,
  /** Decay to −60 dB of the fundamental. The note is audible for about 4 s at its level. */
  t60: 4.5,
  seconds: 4.2,
  slideCents: 20,
  /** The slide down happens over this window, in seconds from the pluck. */
  slide: [2.2, 3.6],
  fadeFrom: 3.6,
} as const

/**
 * The guqin harmonic (泛音): Karplus–Strong at D4 with a soft, low-passed excitation plucked at 1/7
 * of the string, under sine partials on the fundamental and octave. A touched node leaves a nearly
 * pure tone, and the low crest factor that gives is what lets one note at the sheet's peak level be
 * the loudest moment on the site. A fractional delay slides the pitch 20 cents down at the tail. Peak 1.
 */
export function guqinHarmonic(sr: number, r: Rng): Samples {
  const n = Math.round(GUQIN.seconds * sr)
  const period = sr / GUQIN.hz
  const exLen = Math.round(period)
  const ex = new Float32Array(exLen)
  let soft = 0
  for (let i = 0; i < exLen; i++) {
    soft += (bipolar(r) - soft) * 0.15
    ex[i] = soft * 0.5 * (1 - Math.cos((TAU * i) / exLen))
  }
  const pluck = Math.round(exLen / 7)
  for (let i = exLen - 1; i >= pluck; i--) ex[i] = (ex[i] as number) - (ex[i - pluck] as number)

  const size = 1 << Math.ceil(Math.log2(period * 1.1 + 8))
  const mask = size - 1
  const line = new Float32Array(size)
  const perSample = 10 ** (-3 / (GUQIN.t60 * sr))
  // The two-point average in the loop loses a little at f0; put it back so the fundamental keeps t60.
  const loss = Math.cos((Math.PI * GUQIN.hz) / sr)
  const pitch = (t: number) => GUQIN.hz * 2 ** ((-GUQIN.slideCents * smoothstep(GUQIN.slide[0], GUQIN.slide[1], t)) / 1200)

  const string = new Float32Array(n)
  let prevTap = 0
  for (let i = 0; i < n; i++) {
    const d = sr / pitch(i / sr) - 0.5
    const pos = i - d
    const i0 = Math.floor(pos)
    const a = i0 >= 0 ? (line[i0 & mask] as number) : 0
    const b = i0 + 1 >= 0 ? (line[(i0 + 1) & mask] as number) : 0
    const tap = a + (b - a) * (pos - i0)
    const y = (i < exLen ? (ex[i] as number) : 0) + ((perSample ** (d + 0.5)) / loss) * 0.5 * (tap + prevTap)
    prevTap = tap
    line[i & mask] = y
    string[i] = y
  }
  scaleTo(string, 1, 'peak')

  const out = new Float32Array(n)
  let ph = 0
  for (let i = 0; i < n; i++) {
    const t = i / sr
    ph += (TAU * pitch(t)) / sr
    const env = (1 - Math.exp(-t / 0.012)) * perSample ** i
    const octave = (1 - Math.exp(-t / 0.006)) * 10 ** ((-3 * t) / 2.5)
    const tail = 1 - smoothstep(GUQIN.fadeFrom, GUQIN.seconds, t)
    out[i] = (0.18 * (string[i] as number) + 0.9 * env * Math.sin(ph) + 0.16 * octave * Math.sin(2 * ph)) * tail
  }
  return scaleTo(out, 1, 'peak')
}

/**
 * The door creak: a stick-slip pulse train (the hinge catching and letting go) whose rate climbs
 * as the door swings and falls as it slows, ringing a few wooden body modes. 1.2 s, peak 1.
 */
export function doorCreak(sr: number, r: Rng): Samples {
  const seconds = 1.2
  const n = Math.round(seconds * sr)
  const drive = new Float32Array(n)
  const wander = periodicRandom(n, 14, r)
  let phase = 0
  for (let i = 0; i < n; i++) {
    const t = i / sr
    const env = smoothstep(0, 0.06, t) * (1 - smoothstep(0.85, seconds, t))
    const rate = 38 + 110 * Math.sin(Math.PI * Math.min(1, t / 0.95)) ** 1.5 + 40 * ((wander[i] as number) - 0.5)
    phase += rate / sr
    if (phase >= 1) {
      phase -= 1
      drive[i] = env * (0.55 + 0.45 * r())
    }
    drive[i] = (drive[i] as number) + env * 0.015 * bipolar(r)
  }
  const out = new Float32Array(n)
  const modes: readonly (readonly [hz: number, q: number, gain: number])[] = [
    [340, 10, 1],
    [780, 12, 0.7],
    [1530, 14, 0.45],
    [2750, 16, 0.25],
  ]
  for (const [hz, q, gain] of modes) bandpassInto(drive, out, hz, q, gain, sr)
  return scaleTo(out, 1, 'peak')
}

/** A short noise tick: `ms` of band-passed noise with a fast decay (keys, the detent's click, the seal's tick). Peak 1. */
export function tick(sr: number, ms: number, hz: number, q: number, r: Rng): Samples {
  const n = Math.round(((ms * 2) / 1000) * sr)
  const x = new Float32Array(n)
  const decay = (ms / 1000 / 4) * sr
  for (let i = 0; i < n; i++) x[i] = bipolar(r) * Math.exp(-i / decay)
  const out = new Float32Array(n)
  bandpassInto(x, out, hz, q, 1, sr)
  return scaleTo(out, 1, 'peak')
}
