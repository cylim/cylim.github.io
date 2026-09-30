import type { RootState } from '@react-three/fiber'
import { journey, underFogCover, type Tier } from '../store/journey'
import { motion } from '../../theme/tokens'
import { BENCHMARK, clampDpr, dprRange, guessTier, stepTier, type DprRange } from './quality'
import {
  BUDGET_SLACK_MS,
  FRAME_BUDGET_MS,
  PerfMonitor,
  benchmarkVerdict,
  displayHzFrom,
  frameCapFor,
  median,
  stepDown,
  stepUp,
  tierRank,
  type QualityLevel,
} from './perf'
import { isThrottled, setFrameCap } from './frameGovernor'
import { startReveal } from './reveal'
import { pinnedTier, rendererString } from './tierPin'

/**
 * How the stage starts. 'benchmark': the hidden 60-frame test corrects the tier (design.md §13.2).
 * 'skip': tier already decided (pinned, restart after context loss, "Walk the forest anyway").
 * 'e2e': deterministic (e2e, stills), no benchmark, no reveal, no runtime monitor.
 */
export type StartupMode = 'benchmark' | 'skip' | 'e2e'

/** 'develop': ink soaks into paper (§8.1); 'fade': 800 ms opacity (reduced motion); 'instant': e2e. */
export type RevealKind = 'develop' | 'fade' | 'instant'

export interface QualityHooks {
  setDpr: (dpr: number) => void
  /** Startup-only settings (MSAA, bloom levels) follow this tier; changing it remounts the post stack. */
  setPostTier: (tier: Tier) => void
  onReveal: (kind: RevealKind) => void
  /** Median over budget on low: the device should get the album instead. */
  onSlow: () => void
  /** The canvas is visible; frame pacing may begin. */
  onLive: () => void
}

/** Frames skipped before measuring: shader compiles and chunk loads land here. */
const WARMUP_FRAMES = 8
/** At most this many step-downs during the hidden benchmark. */
const MAX_RERUNS = 2
/** Reveal anyway if two in-budget frames in a row never come. */
const AWAIT_GIVE_UP_MS = 3000
/** Frame times above this are hitches or tab switches, not GPU load. */
const HITCH_MS = 250
/**
 * A too-slow verdict on low is measured once more before the album: on a cold first visit, chunk
 * parsing and texture uploads can starve a single run on a device that is fine a second later.
 */
const SLOW_CONFIRMS = 1
/**
 * A run that has not gathered its frames by now is decided on every frame it saw, hitches included,
 * so a device that only ever hitches still reaches a verdict instead of staying hidden.
 */
const MEASURE_GIVE_UP_MS = 3000
/** §13.3 low-tier frame cap decision window. */
const CAP_WINDOW_MS = 5000

type Phase =
  | { kind: 'warmup'; frames: number }
  /** `samples` leaves hitches out; `frames` keeps them for a run that gives up. */
  | { kind: 'measure'; since: number; samples: number[]; frames: number[] }
  | { kind: 'await'; since: number; streak: number }
  | { kind: 'live' }
  | { kind: 'done' }

/**
 * The hidden benchmark, the reveal, the runtime performance monitor, the tier queue and the frame
 * cap (design.md §13.2–13.3), as one per-mount state machine driven by `frame()`. Runtime changes
 * touch only DPR (through Stage) and the store's `tier`, which env and sections map onto uniforms
 * and mesh.count.
 */
export class QualityRuntime {
  private phase: Phase = { kind: 'warmup', frames: 0 }
  private prev = -1
  private reruns = 0
  private slowConfirms = 0
  /** The one-time benchmark setup (renderer string, stage 'benchmark') ran. */
  private started = false
  /** A pinned tier (?tier=, a saved Quality choice) is never corrected, by the benchmark or at runtime. */
  private pinned = pinnedTier() !== null
  private readonly monitor = new PerfMonitor()
  private ceiling: QualityLevel | null = null
  /** Where the hidden benchmark settled, when this session ran it unpinned. */
  private measured: QualityLevel | null = null
  private renderer: string | undefined
  private pending: { tier: Tier; since: number } | null = null
  private selfTier: Tier = journey.getState().tier
  private dpr: number
  private cap = { start: -1, frames: 0, time: 0, intervals: [] as number[], firstFps: null as number | null, displayHz: 60, decided: false }
  private deviceDpr = 1
  private range: (t: Tier) => DprRange = (t) => dprRange(t, 1, 0)

  constructor(
    private readonly startup: StartupMode,
    dpr: number,
    private hooks: QualityHooks,
  ) {
    this.dpr = dpr
    this.setDevice(window.devicePixelRatio || 1)
  }

  private setDevice(deviceDpr: number): void {
    this.deviceDpr = deviceDpr
    const pixels = screen.width * screen.height * deviceDpr * deviceDpr
    this.range = (t) => dprRange(t, deviceDpr, pixels)
  }

  /**
   * window.devicePixelRatio changed: the window moved to another display, or the browser zoomed
   * (QM-P8). The §13.3 caps are relative to the device, so the ranges are recomputed and the DPR
   * scales with the device, keeping any step the monitor already took, then clamps into the new
   * range. 1x → 2x on high goes from 1 to 2 (sharp on the retina screen); 2x → 1x comes back down.
   */
  devicePixelRatioChanged(deviceDpr: number): void {
    if (!(deviceDpr > 0) || deviceDpr === this.deviceDpr) return
    const scale = deviceDpr / this.deviceDpr
    this.setDevice(deviceDpr)
    const relevel = (l: QualityLevel): QualityLevel => ({ tier: l.tier, dpr: this.range(l.tier).cap })
    if (this.ceiling) this.ceiling = relevel(this.ceiling)
    if (this.measured) this.measured = relevel(this.measured)
    this.monitor.reset()
    const next = clampDpr(this.dpr * scale, this.range(journey.getState().tier))
    if (next !== this.dpr) this.hooks.setDpr(next)
  }

  /**
   * Settings → Quality changed (`cy:quality`): Low or High pins the tier, Auto hands it back to the
   * monitor. The pin also set the ceiling (tierChanged), so Auto must lift it again, to what the
   * benchmark measured or, if this session started pinned and never measured, to the device guess;
   * otherwise the monitor could never climb back above the pinned tier until a reload (issue M3).
   */
  qualityChanged(): void {
    this.pinned = pinnedTier() !== null
    if (!this.pinned) {
      const tier = this.measured?.tier ?? this.deviceGuess()
      this.ceiling = this.measured ?? { tier, dpr: this.range(tier).cap }
      this.pending = null
    }
    this.monitor.reset()
  }

  /** The starting tier this device would get with nothing pinned (design.md §13.2, before the benchmark). */
  private deviceGuess(): Tier {
    const nav = navigator as Navigator & { deviceMemory?: number }
    return guessTier({ coarsePointer: matchMedia('(pointer: coarse)').matches, cores: nav.hardwareConcurrency, deviceMemory: nav.deviceMemory, renderer: this.renderer })
  }

  setHooks(hooks: QualityHooks): void {
    this.hooks = hooks
  }

  /** The DPR the Canvas actually has (Stage state). */
  setDpr(dpr: number): void {
    this.dpr = dpr
  }

  /**
   * The store's tier changed. From outside (the Quality setting) it resets the DPR to that tier's
   * start and becomes the new ceiling; my own changes only clamp the DPR into the new range.
   */
  tierChanged(tier: Tier): void {
    const r = this.range(tier)
    if (tier !== this.selfTier) {
      this.selfTier = tier
      this.ceiling = { tier, dpr: r.cap }
      this.pending = null
      this.monitor.reset()
      if (this.dpr !== r.cap) this.hooks.setDpr(r.cap)
    } else {
      const d = clampDpr(this.dpr, r)
      if (d !== this.dpr) this.hooks.setDpr(d)
    }
    if (this.cap.decided) setFrameCap(frameCapFor(tier, this.cap.firstFps, this.cap.displayHz))
  }

  private setTier(next: Tier): void {
    this.selfTier = next
    journey.setState({ tier: next })
  }

  private reveal(kind: RevealKind, now: number): void {
    this.phase = { kind: 'live' }
    this.ceiling ??= { tier: journey.getState().tier, dpr: this.dpr }
    if (this.startup === 'benchmark' && !this.pinned) this.measured = { ...this.ceiling }
    if (kind === 'develop') startReveal(now, motion.canvas.reveal)
    this.hooks.onReveal(kind)
    journey.setState({ stage: 'live' })
    this.hooks.onLive()
  }

  /**
   * `visibilitychange`: a hidden tab may pause frames altogether, so the per-frame check in `frame()`
   * never sees it. Whatever the interrupted run gathered is discarded.
   */
  visibilityChanged(): void {
    if (document.visibilityState === 'hidden' && (this.phase.kind === 'warmup' || this.phase.kind === 'measure')) {
      this.phase = { kind: 'warmup', frames: 0 }
    }
  }

  /** Call once per rendered frame. */
  frame(state: RootState): void {
    // A backstop for dprWatch: not every environment reports a resolution change as an event.
    const ratio = window.devicePixelRatio || 1
    if (ratio !== this.deviceDpr) this.devicePixelRatioChanged(ratio)
    const now = performance.now()
    const dt = this.prev < 0 ? 0 : now - this.prev
    this.prev = now
    const s = journey.getState()
    const phase = this.phase
    // Under frameloop 'demand' the benchmark and the reveal still need a steady run of frames.
    if (state.frameloop === 'demand' && phase.kind !== 'live' && phase.kind !== 'done') state.invalidate()

    // A hidden tab gets throttled or paused frames, which measure the browser, not the GPU (a tab
    // opened in the background used to land on the album). Start over once it is visible again.
    if ((phase.kind === 'warmup' || phase.kind === 'measure') && document.visibilityState === 'hidden') {
      this.phase = { kind: 'warmup', frames: 0 }
      return
    }

    switch (phase.kind) {
      case 'warmup': {
        if (!this.started) {
          this.started = true
          this.renderer = rendererString(state.gl.getContext())
          if (this.startup === 'e2e') return this.reveal('instant', now)
          if (this.startup === 'benchmark') {
            journey.setState({ stage: 'benchmark' })
            if (!this.pinned) this.refineFromRenderer(s.tier)
          }
        }
        phase.frames++
        if (phase.frames >= WARMUP_FRAMES) {
          this.phase = this.startup === 'benchmark' ? { kind: 'measure', since: now, samples: [], frames: [] } : { kind: 'await', since: now, streak: 0 }
        }
        return
      }

      case 'measure': {
        if (dt <= 0) return
        phase.frames.push(dt)
        // Same rule as the runtime monitor: a hitch is a stall elsewhere, not a frame's cost.
        if (dt <= HITCH_MS) phase.samples.push(dt)
        const full = phase.samples.length >= BENCHMARK.frames
        if (!full && now - phase.since <= MEASURE_GIVE_UP_MS) return
        const samples = full ? phase.samples : phase.frames
        const medianMs = median(samples)
        const verdict = this.pinned ? 'keep' : benchmarkVerdict(s.tier, medianMs)
        const run = recordBenchmark({ tier: s.tier, dpr: this.dpr, medianMs, verdict, gaveUp: !full, samples })
        if (verdict === 'static' && this.slowConfirms < SLOW_CONFIRMS) {
          this.slowConfirms++
          this.phase = { kind: 'warmup', frames: 0 }
          return
        }
        if (verdict === 'static') {
          console.warn('The forest benchmark ran slowly, so the still version is showing', run)
          this.phase = { kind: 'done' }
          return this.hooks.onSlow()
        }
        if (verdict === 'down' && this.reruns < MAX_RERUNS) {
          const next = stepTier(s.tier, -1)
          this.reruns++
          this.setTier(next)
          this.hooks.setPostTier(next)
          this.hooks.setDpr(this.range(next).cap)
          this.phase = { kind: 'warmup', frames: 0 }
          return
        }
        this.phase = { kind: 'await', since: now, streak: 0 }
        return
      }

      case 'await': {
        const budget = FRAME_BUDGET_MS[s.tier] + BUDGET_SLACK_MS
        phase.streak = dt > 0 && dt <= budget ? phase.streak + 1 : 0
        if (phase.streak >= 2 || now - phase.since > AWAIT_GIVE_UP_MS) this.reveal(s.reducedMotion ? 'fade' : 'develop', now)
        return
      }

      case 'live':
        if (this.startup !== 'e2e') this.live(now, dt)
        return

      case 'done':
        return
    }
  }

  /** The boot guess had no renderer string; now that a context exists, a weak GPU can only lower it. */
  private refineFromRenderer(current: Tier): void {
    const refined = this.deviceGuess()
    if (tierRank(refined) >= tierRank(current)) return
    this.setTier(refined)
    this.hooks.setPostTier(refined)
    this.hooks.setDpr(this.range(refined).cap)
  }

  private live(now: number, dt: number): void {
    if (dt <= 0 || dt > HITCH_MS || isThrottled()) {
      this.monitor.reset()
      return
    }
    const s = journey.getState()

    const cap = this.cap
    if (!cap.decided) {
      if (cap.start < 0) cap.start = now
      cap.frames++
      cap.time += dt
      cap.intervals.push(dt)
      if (now - cap.start >= CAP_WINDOW_MS) {
        cap.firstFps = cap.time > 0 ? (cap.frames * 1000) / cap.time : null
        cap.displayHz = displayHzFrom(cap.intervals)
        cap.decided = true
        const fps = frameCapFor(s.tier, cap.firstFps, cap.displayHz)
        setFrameCap(fps)
        this.monitor.setTargetFps(fps ?? 60)
      }
    }

    // Tier changes wait for fog cover or 10 s (§11.1); DPR steps apply at once.
    if (this.pending && (underFogCover(s) || now - this.pending.since > motion.tierQueueMaxWait)) {
      this.setTier(this.pending.tier)
      this.pending = null
      this.monitor.reset()
    }

    if (this.pinned || !this.ceiling) return
    const signal = this.monitor.sample(now)
    if (!signal) return
    const level: QualityLevel = { tier: this.pending?.tier ?? s.tier, dpr: this.dpr }
    const next = signal === 'decline' ? stepDown(level, this.range) : stepUp(level, this.ceiling, this.range)
    if (!next) return
    if (next.dpr !== level.dpr) this.hooks.setDpr(next.dpr)
    if (next.tier !== level.tier) this.pending = { tier: next.tier, since: now }
    this.monitor.reset()
  }
}

interface BenchmarkRun {
  tier: Tier
  dpr: number
  medianMs: number
  verdict: string
  /** Decided at MEASURE_GIVE_UP_MS on every frame, hitches included. */
  gaveUp: boolean
  samples: readonly number[]
}

/**
 * Each benchmark run leaves a `cy.benchmark` performance mark, so a visitor who got the album can
 * show why: `performance.getEntriesByName('cy.benchmark').map((m) => m.detail)` in the console.
 */
function recordBenchmark(run: BenchmarkRun): BenchmarkRun {
  const detail = { ...run, medianMs: Math.round(run.medianMs * 10) / 10, samples: run.samples.map((ms) => Math.round(ms * 10) / 10) }
  try {
    performance.mark('cy.benchmark', { detail })
  } catch {
    // Marks with detail are missing in some older browsers; the log is only a diagnostic.
  }
  return detail
}
