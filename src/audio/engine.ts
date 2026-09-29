/**
 * The sound engine (design.md §12): the master chain, the beds and the one-shots on any
 * BaseAudioContext. It knows nothing of the store or the page; index.ts wires those, and
 * calibrate.ts drives the same engine on an OfflineAudioContext.
 *
 *   beds ─ duck ─ quiet ─┐
 *                        ├─ master low-pass ─┐
 *   one-shots ───────────┘                   ├─ trim ─ limiter ─ fade ─ fade ─ out
 *   whoosh, guqin ───────────────────────────┘
 *
 * The whoosh and the guqin skip the low-pass: they are the sounds that ring clear through the
 * paper and the mist wall while everything else is muffled.
 */

import { CUTOFF, LEVEL, MASTER_DB, SEED, SILENCE_AFTER_SEAL, dbToGain } from './cues'
import { seeded, type Rng } from './dsp'
import { mixAt, type MixState } from './mix'
import { renderSamples, type SampleSet } from './samples'
import type { Cue } from './triggers'
import {
  createBeds,
  makeBuffers,
  playChime,
  playCreak,
  playDetent,
  playGuqin,
  playIgnition,
  playKey,
  playSeal,
  playWhoosh,
  type Beds,
  type Buffers,
} from './voices'

/** Smoothing time constants, seconds. */
const TAU = { bed: 0.25, fast: 0.03, cutoff: 0.3, open: 0.3 }

const cents = (hz: number, baseHz: number) => 1200 * Math.log2(hz / baseHz)

/** A soft ceiling: linear to `knee`, then a tanh shoulder that never passes `ceiling`. */
function limiterCurve(ceiling: number, knee: number): Float32Array<ArrayBuffer> {
  const n = 8193
  const curve = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1
    const a = Math.abs(x)
    const y = a <= knee ? a : knee + (ceiling - knee) * Math.tanh((a - knee) / (ceiling - knee))
    curve[i] = Math.sign(x) * y
  }
  return curve
}

export class Engine {
  readonly ctx: BaseAudioContext
  private readonly lp: BiquadFilterNode
  private readonly duck: GainNode
  private readonly quiet: GainNode
  private readonly sfx: GainNode
  private readonly clear: GainNode
  // Two gains in series ramping together give a squared curve: a gentler fade than one linear ramp.
  private readonly fadeA: GainNode
  private readonly fadeB: GainNode
  private readonly rand: Rng
  readonly seed: number
  private buffers: Buffers | null = null
  private beds: Beds | null = null
  private readonly sent = new Map<AudioParam, number>()
  private revealUntil = 0
  private silent = false

  constructor(ctx: BaseAudioContext, seed = SEED, out: AudioNode = ctx.destination) {
    this.ctx = ctx
    this.seed = seed
    this.rand = seeded(seed ^ 0x9e3779b9)
    this.fadeA = ctx.createGain()
    this.fadeB = ctx.createGain()
    this.fadeA.gain.value = 0
    this.fadeB.gain.value = 0
    const limiter = ctx.createWaveShaper()
    limiter.curve = limiterCurve(dbToGain(LEVEL.ceiling), dbToGain(LEVEL.ceiling - 3))
    limiter.connect(this.fadeA).connect(this.fadeB).connect(out)
    const trim = ctx.createGain()
    trim.gain.value = dbToGain(MASTER_DB)
    trim.connect(limiter)
    this.lp = ctx.createBiquadFilter()
    this.lp.type = 'lowpass'
    this.lp.frequency.value = CUTOFF.open
    this.lp.Q.value = 0
    this.lp.connect(trim)
    this.quiet = ctx.createGain()
    this.quiet.connect(this.lp)
    this.duck = ctx.createGain()
    this.duck.connect(this.quiet)
    this.sfx = ctx.createGain()
    this.sfx.connect(this.lp)
    this.clear = ctx.createGain()
    this.clear.connect(trim)
  }

  get built(): boolean {
    return this.beds !== null
  }

  /**
   * Take the rendered samples and start the beds (silent until `apply`). The page passes a loader
   * that renders them in a worker; by default they render here, which offline renders want.
   */
  async build(load: () => SampleSet | Promise<SampleSet> = () => renderSamples(this.ctx.sampleRate, this.seed)): Promise<void> {
    if (this.buffers) return
    const buffers = makeBuffers(this.ctx, await load())
    this.buffers = buffers
    this.beds = createBeds(this.ctx, buffers, this.duck)
  }

  /** Fade the whole output to `to` (0..1) over `seconds`, from wherever it is now. */
  fade(to: number, seconds: number): void {
    const now = this.ctx.currentTime
    const each = Math.sqrt(Math.min(1, Math.max(0, to)))
    for (const g of [this.fadeA.gain, this.fadeB.gain]) {
      const from = g.value
      g.cancelScheduledValues(now)
      g.setValueAtTime(from, now)
      g.linearRampToValueAtTime(each, now + Math.max(0.005, seconds * Math.abs(each - from)))
    }
  }

  /** Follow a journey state. `snap` jumps straight to it (the first apply). */
  apply(s: MixState, snap = false): void {
    const beds = this.beds
    if (!beds) return
    const m = mixAt(s)
    const now = this.ctx.currentTime
    const bed = snap ? 0.001 : TAU.bed
    this.to(beds.wind.level, m.wind, bed)
    this.to(beds.pine.level, m.pine, bed)
    this.to(beds.stream.level, m.stream, bed)
    this.to(beds.stream.pan, m.streamPan, bed, 0.02)
    this.to(beds.hum.level, m.hum, bed)
    this.to(beds.hum.cutoff, cents(m.humCutoff, CUTOFF.humClosed), snap ? 0.001 : TAU.open, 10)
    this.to(beds.crackle.level, m.crackle, bed)
    this.to(beds.grind.level, m.grind, snap ? 0.001 : TAU.fast)
    this.to(this.duck.gain, m.duck, snap ? 0.001 : TAU.fast)
    // The reveal's timed ramp owns the cutoff until it lands, unless a dive, the paper or a step
    // back into the mist takes over.
    const revealing = now < this.revealUntil
    if (!revealing || m.diving || m.cutoff < CUTOFF.reveal) {
      if (revealing) {
        this.revealUntil = 0
        this.hold(this.lp.detune)
      }
      this.to(this.lp.detune, cents(m.cutoff, CUTOFF.open), snap ? 0.001 : m.diving ? TAU.fast : TAU.cutoff, 5)
    }
    if (m.silence !== this.silent) {
      this.silent = m.silence
      const g = this.quiet.gain
      g.cancelScheduledValues(now)
      g.setTargetAtTime(m.silence ? 0 : 1, m.silence ? now + SILENCE_AFTER_SEAL.delay : now, SILENCE_AFTER_SEAL.tau)
    }
  }

  /** Play a one-shot cue now. */
  play(cue: Cue): void {
    const b = this.buffers
    if (!b) return
    const when = this.ctx.currentTime + 0.01
    switch (cue) {
      case 'creak':
        return playCreak(this.ctx, b, this.sfx, when)
      case 'ignition':
        return playIgnition(this.ctx, this.sfx, when)
      case 'whoosh':
        return playWhoosh(this.ctx, b, this.clear, when, 0.45, 0.8)
      case 'gate':
        return playWhoosh(this.ctx, b, this.clear, when, 0.9, 1.2)
      case 'guqin':
        return playGuqin(this.ctx, b, this.clear, when)
      case 'reveal':
        return this.reveal()
      case 'seal':
        return playSeal(this.ctx, b, this.sfx, when)
    }
  }

  key(): void {
    if (this.buffers) playKey(this.ctx, this.buffers, this.sfx, this.ctx.currentTime, this.rand)
  }

  detent(): void {
    if (this.buffers) playDetent(this.ctx, this.buffers, this.sfx, this.ctx.currentTime + 0.005)
  }

  chime(): void {
    playChime(this.ctx, this.sfx, this.ctx.currentTime + 0.01)
  }

  /** The mist parts: the master low-pass opens to the reveal cutoff over 2 s, even in log frequency. */
  private reveal(): void {
    const now = this.ctx.currentTime
    const p = this.lp.detune
    const target = cents(CUTOFF.reveal, CUTOFF.open)
    this.hold(p)
    p.linearRampToValueAtTime(target, now + CUTOFF.revealSeconds)
    this.sent.set(p, target)
    this.revealUntil = now + CUTOFF.revealSeconds
  }

  /** Drop a param's pending automation and pin it where it is now. */
  private hold(p: AudioParam): void {
    const now = this.ctx.currentTime
    const v = p.value
    p.cancelScheduledValues(now)
    p.setValueAtTime(v, now)
    this.sent.delete(p)
  }

  /** Glide a param toward `value`, skipping changes too small to hear so a scroll doesn't flood the automation timeline. */
  private to(param: AudioParam, value: number, tau: number, epsilon?: number): void {
    const last = this.sent.get(param)
    const eps = epsilon ?? Math.max(1e-5, Math.abs(last ?? 0) * 0.02)
    if (last !== undefined && Math.abs(last - value) <= eps) return
    this.sent.set(param, value)
    param.setTargetAtTime(value, this.ctx.currentTime, tau)
  }

  dispose(): void {
    const beds = this.beds
    if (beds) for (const bed of Object.values(beds)) bed.stop()
    this.beds = null
    this.buffers = null
    this.fadeB.disconnect()
  }
}
