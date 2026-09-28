/**
 * The Web Audio graphs for each cue (design.md §12). Beds are built once and loop while the context
 * runs; the engine sets their levels from the mix. One-shots build, play and disconnect themselves.
 * Every builder takes a BaseAudioContext, so calibrate.ts renders exactly these graphs offline.
 *
 * TRIM makes each graph's output match cues.ts: a bed at level 1 comes out at 0 LUFS, a one-shot
 * at its LEVEL comes out with that sample peak. Measured with calibrate.ts at 48 kHz; re-measure
 * after changing a graph or its buffer.
 */

import { CUTOFF, LEVEL, dbToGain } from './cues'
import type { Rng, Samples } from './dsp'
import type { SampleSet } from './samples'

// dB, from calibrate.ts: each cue's target minus its reading at 0 dB trim.
const TRIM_DB = {
  wind: 4.9,
  pine: 0.7,
  stream: -5.4,
  hum: 2.3,
  crackle: 9.3,
  grind: 4.7,
  creak: 0,
  ignition: -9.4,
  keys: 0.1,
  whoosh: 0,
  guqin: 0,
  detent: 0,
  chime: 0,
  seal: 0.3,
}
const TRIM = Object.fromEntries(Object.entries(TRIM_DB).map(([k, db]) => [k, dbToGain(db)])) as Record<keyof typeof TRIM_DB, number>

export interface Buffers {
  wind: AudioBuffer
  pine: AudioBuffer
  stream: AudioBuffer
  grind: AudioBuffer
  crackle: AudioBuffer
  noise: AudioBuffer
  guqin: AudioBuffer
  creak: AudioBuffer
  keys: readonly AudioBuffer[]
  click: AudioBuffer
}

function toBuffer(ctx: BaseAudioContext, channels: readonly Samples[], sampleRate: number): AudioBuffer {
  const first = channels[0]
  if (!first) throw new Error('toBuffer needs a channel')
  const b = ctx.createBuffer(channels.length, first.length, sampleRate)
  channels.forEach((c, i) => b.copyToChannel(c, i))
  return b
}

/** Wrap a rendered sample set (samples.ts) in AudioBuffers for `ctx`. */
export function makeBuffers(ctx: BaseAudioContext, s: SampleSet): Buffers {
  const one = (x: Samples, rate = s.sampleRate) => toBuffer(ctx, [x], rate)
  return {
    wind: toBuffer(ctx, s.wind, s.halfRate),
    pine: one(s.pine),
    stream: one(s.stream),
    grind: one(s.grind, s.halfRate),
    crackle: one(s.crackle),
    noise: one(s.noise),
    guqin: one(s.guqin),
    creak: one(s.creak),
    keys: s.keys.map((k) => one(k)),
    click: one(s.click),
  }
}

// ---------------------------------------------------------------------------- helpers

const gainNode = (ctx: BaseAudioContext, value: number): GainNode => {
  const g = ctx.createGain()
  g.gain.value = value
  return g
}

function filter(ctx: BaseAudioContext, type: BiquadFilterType, hz: number, q: number): BiquadFilterNode {
  const f = ctx.createBiquadFilter()
  f.type = type
  f.frequency.value = hz
  f.Q.value = q
  return f
}

function loop(ctx: BaseAudioContext, buffer: AudioBuffer, rate = 1, offset = 0): AudioBufferSourceNode {
  const s = ctx.createBufferSource()
  s.buffer = buffer
  s.loop = true
  s.playbackRate.value = rate
  s.start(0, offset % buffer.duration)
  return s
}

function lfo(ctx: BaseAudioContext, hz: number, depth: number, target: AudioParam): OscillatorNode {
  const o = ctx.createOscillator()
  o.frequency.value = hz
  o.connect(gainNode(ctx, depth)).connect(target)
  o.start()
  return o
}

const stopAll = (...nodes: AudioScheduledSourceNode[]) => () => {
  for (const n of nodes) {
    n.stop()
    n.disconnect()
  }
}

/** Disconnect a one-shot's nodes once its last source ends. */
function release(last: AudioScheduledSourceNode, nodes: readonly AudioNode[]): void {
  last.addEventListener(
    'ended',
    () => {
      for (const n of nodes) n.disconnect()
    },
    { once: true },
  )
}

// ---------------------------------------------------------------------------- beds

export interface Bed {
  /** Output gain, linear; the engine sets it from the mix. */
  readonly level: AudioParam
  readonly stop: () => void
}

export interface Beds {
  wind: Bed
  pine: Bed
  /** `pan` offsets both stream voices, −1..1. */
  stream: Bed & { readonly pan: AudioParam }
  /** `cutoff` is the hum low-pass detune in cents above CUTOFF.humClosed. */
  hum: Bed & { readonly cutoff: AudioParam }
  crackle: Bed
  grind: Bed
}

function levelNode(ctx: BaseAudioContext, trim: number, out: AudioNode): GainNode {
  const level = gainNode(ctx, 0)
  level.connect(gainNode(ctx, trim)).connect(out)
  return level
}

/** Wind: pink noise, band-pass 350 Hz Q 0.6 with a 0.07 Hz LFO on the cutoff, slowly panning. */
function windBed(ctx: BaseAudioContext, b: Buffers, out: AudioNode): Bed {
  const src = loop(ctx, b.wind)
  const bp = filter(ctx, 'bandpass', 350, 0.6)
  const pan = ctx.createStereoPanner()
  const level = levelNode(ctx, TRIM.wind, out)
  src.connect(bp).connect(pan).connect(level)
  const sweep = lfo(ctx, 0.07, 140, bp.frequency)
  const drift = lfo(ctx, 0.023, 0.6, pan.pan)
  return { level: level.gain, stop: stopAll(src, sweep, drift) }
}

/** 松涛: two reads of the pine loop, half a loop apart and slightly detuned, spread left and right. */
function pineBed(ctx: BaseAudioContext, b: Buffers, out: AudioNode): Bed {
  const level = levelNode(ctx, TRIM.pine, out)
  const shape = filter(ctx, 'highpass', 150, 0)
  shape.connect(filter(ctx, 'lowpass', 6000, 0)).connect(level)
  const voices = [
    [1, 0, -0.6],
    [0.985, b.pine.duration / 2, 0.6],
  ].map(([rate, offset, side]) => {
    const src = loop(ctx, b.pine, rate, offset)
    const pan = ctx.createStereoPanner()
    pan.pan.value = side as number
    src.connect(pan).connect(shape)
    return src
  })
  return { level: level.gain, stop: stopAll(...voices) }
}

/** The stream: white noise with a random babble, high-pass 1.2 kHz, two voices spread about a movable centre. */
function streamBed(ctx: BaseAudioContext, b: Buffers, out: AudioNode): Beds['stream'] {
  const level = levelNode(ctx, TRIM.stream, out)
  const hp = filter(ctx, 'highpass', 1200, 0)
  hp.connect(level)
  const centre = ctx.createConstantSource()
  centre.offset.value = 0
  centre.start()
  const voices = [
    [1, 0, -0.45],
    [1.09, 2.3, 0.45],
  ].map(([rate, offset, side]) => {
    const src = loop(ctx, b.stream, rate, offset)
    const pan = ctx.createStereoPanner()
    pan.pan.value = side as number
    centre.connect(pan.pan)
    src.connect(pan).connect(hp)
    return src
  })
  return { level: level.gain, pan: centre.offset, stop: stopAll(centre, ...voices) }
}

/** The cabin hum: 55 and 110 Hz sines and a faint 3.2 kHz whine, through a low-pass the door opens. */
function humBed(ctx: BaseAudioContext, b: Buffers, out: AudioNode): Beds['hum'] {
  const level = levelNode(ctx, TRIM.hum, out)
  const lp = filter(ctx, 'lowpass', CUTOFF.humClosed, 0)
  lp.connect(level)
  const tones = [
    [55, 1],
    [110, 0.5],
  ].map(([hz, g]) => {
    const o = ctx.createOscillator()
    o.frequency.value = hz as number
    o.connect(gainNode(ctx, g as number)).connect(lp)
    o.start()
    return o
  })
  const whine = loop(ctx, b.noise)
  const whineLevel = gainNode(ctx, 0.35)
  whine.connect(filter(ctx, 'bandpass', 3200, 5)).connect(whineLevel).connect(lp)
  // The whine breathes a little, so a long read in the hall isn't one frozen tone.
  const breath = lfo(ctx, 0.05, 0.12, whineLevel.gain)
  return { level: level.gain, cutoff: lp.detune, stop: stopAll(whine, breath, ...tones) }
}

/** Lantern crackle: the sparse pop loop through a 3 kHz band-pass. */
function crackleBed(ctx: BaseAudioContext, b: Buffers, out: AudioNode): Bed {
  const level = levelNode(ctx, TRIM.crackle, out)
  const src = loop(ctx, b.crackle)
  src.connect(filter(ctx, 'bandpass', 3000, 1.4)).connect(level)
  return { level: level.gain, stop: stopAll(src) }
}

/** Ring grind: rough brown noise, band-pass 140 Hz Q 1.2. The engine drives the level from ring speed. */
function grindBed(ctx: BaseAudioContext, b: Buffers, out: AudioNode): Bed {
  const level = levelNode(ctx, TRIM.grind, out)
  const src = loop(ctx, b.grind)
  src.connect(filter(ctx, 'bandpass', 140, 1.2)).connect(level)
  return { level: level.gain, stop: stopAll(src) }
}

export function createBeds(ctx: BaseAudioContext, b: Buffers, out: AudioNode): Beds {
  return {
    wind: windBed(ctx, b, out),
    pine: pineBed(ctx, b, out),
    stream: streamBed(ctx, b, out),
    hum: humBed(ctx, b, out),
    crackle: crackleBed(ctx, b, out),
    grind: grindBed(ctx, b, out),
  }
}

// ---------------------------------------------------------------------------- one-shots

function playBuffer(ctx: BaseAudioContext, buffer: AudioBuffer, out: AudioNode, when: number, gain: number, rate = 1): void {
  const src = ctx.createBufferSource()
  src.buffer = buffer
  src.playbackRate.value = rate
  const g = gainNode(ctx, gain)
  src.connect(g).connect(out)
  src.start(when)
  release(src, [src, g])
}

/** Door creak, 1.2 s. */
export const playCreak = (ctx: BaseAudioContext, b: Buffers, out: AudioNode, when: number) =>
  playBuffer(ctx, b.creak, out, when, dbToGain(LEVEL.creak) * TRIM.creak)

/** The guqin harmonic: one Karplus–Strong note, the loudest moment on the site. */
export const playGuqin = (ctx: BaseAudioContext, b: Buffers, out: AudioNode, when: number) =>
  playBuffer(ctx, b.guqin, out, when, dbToGain(LEVEL.guqin) * TRIM.guqin)

/** A terminal key: a 6 ms band-passed noise tick, ±8% in pitch. */
export function playKey(ctx: BaseAudioContext, b: Buffers, out: AudioNode, when: number, r: Rng): void {
  const buffer = b.keys[Math.floor(r() * b.keys.length)] ?? b.click
  playBuffer(ctx, buffer, out, when, dbToGain(LEVEL.keys) * TRIM.keys, 1 + (r() * 2 - 1) * 0.08)
}

/** Ignition: A2, E3 and B3 swelling over 1.5 s, then settling away. */
export function playIgnition(ctx: BaseAudioContext, out: AudioNode, when: number): void {
  const env = gainNode(ctx, 0)
  env.connect(out)
  const peakGain = dbToGain(LEVEL.ignition) * TRIM.ignition
  const swell = Float32Array.from({ length: 32 }, (_, i) => peakGain * Math.sin(((i / 31) * Math.PI) / 2) ** 2)
  env.gain.setValueCurveAtTime(swell, when, 1.5)
  env.gain.setTargetAtTime(0, when + 1.9, 0.6)
  const end = when + 6
  const tones = [110, 164.81, 246.94].map((hz) => {
    const o = ctx.createOscillator()
    o.frequency.value = hz
    o.connect(env)
    o.start(when)
    o.stop(end)
    return o
  })
  release(tones[tones.length - 1] as OscillatorNode, [...tones, env])
}

/** The fog-dive and moon-gate whoosh: noise through a band-pass sweeping up into the paper and back down. */
export function playWhoosh(ctx: BaseAudioContext, b: Buffers, out: AudioNode, when: number, inS: number, outS: number): void {
  const src = ctx.createBufferSource()
  src.buffer = b.wind
  const bp = filter(ctx, 'bandpass', 250, 0.9)
  bp.frequency.setValueAtTime(250, when)
  bp.frequency.exponentialRampToValueAtTime(2200, when + inS)
  bp.frequency.exponentialRampToValueAtTime(350, when + inS + outS)
  const env = gainNode(ctx, 0)
  const peakGain = dbToGain(LEVEL.whoosh) * TRIM.whoosh
  env.gain.setValueCurveAtTime(Float32Array.from({ length: 24 }, (_, i) => peakGain * (i / 23) ** 2), when, inS)
  env.gain.setTargetAtTime(0, when + inS + 0.001, outS / 3)
  src.connect(bp).connect(env).connect(out)
  src.start(when)
  src.stop(when + inS + outS * 1.6)
  release(src, [src, bp, env])
}

/** A detent: a 1.1 kHz woodblock tok with a 40 ms decay, plus a click. */
export function playDetent(ctx: BaseAudioContext, b: Buffers, out: AudioNode, when: number): void {
  const peakGain = dbToGain(LEVEL.detent) * TRIM.detent
  const o = ctx.createOscillator()
  o.frequency.setValueAtTime(1300, when)
  o.frequency.exponentialRampToValueAtTime(1100, when + 0.006)
  const env = gainNode(ctx, 0)
  env.gain.setValueAtTime(peakGain, when)
  env.gain.setTargetAtTime(0, when, 0.01)
  o.connect(env).connect(out)
  o.start(when)
  o.stop(when + 0.12)
  playBuffer(ctx, b.click, out, when, peakGain * 0.5)
  release(o, [o, env])
}

/** The hour chime: an FM bell at 523 Hz with a 5 s decay; the brightness fades faster than the tone. */
export function playChime(ctx: BaseAudioContext, out: AudioNode, when: number): void {
  const hz = 523.25
  const carrier = ctx.createOscillator()
  carrier.frequency.value = hz
  const mod = ctx.createOscillator()
  mod.frequency.value = hz * 1.4
  const depth = gainNode(ctx, 0)
  depth.gain.setValueAtTime(hz * 3, when)
  depth.gain.setTargetAtTime(hz * 0.4, when, 1.2)
  mod.connect(depth).connect(carrier.frequency)
  const env = gainNode(ctx, 0)
  env.gain.setValueAtTime(0, when)
  env.gain.linearRampToValueAtTime(dbToGain(LEVEL.chime) * TRIM.chime, when + 0.004)
  env.gain.setTargetAtTime(0, when + 0.004, 5 / 6.9)
  carrier.connect(env).connect(out)
  const end = when + 6
  for (const o of [carrier, mod]) {
    o.start(when)
    o.stop(end)
  }
  release(carrier, [carrier, mod, depth, env])
}

/** The seal: a sine sweeping 95 → 55 Hz over 90 ms, with a paper tick on top. */
export function playSeal(ctx: BaseAudioContext, b: Buffers, out: AudioNode, when: number): void {
  const peakGain = dbToGain(LEVEL.seal) * TRIM.seal
  const o = ctx.createOscillator()
  o.frequency.setValueAtTime(95, when)
  o.frequency.exponentialRampToValueAtTime(55, when + 0.09)
  const env = gainNode(ctx, 0)
  env.gain.setValueAtTime(0, when)
  env.gain.linearRampToValueAtTime(peakGain, when + 0.003)
  env.gain.setTargetAtTime(0, when + 0.003, 0.07)
  o.connect(env).connect(out)
  o.start(when)
  o.stop(when + 0.6)
  playBuffer(ctx, b.click, out, when, peakGain * 0.35)
  release(o, [o, env])
}
