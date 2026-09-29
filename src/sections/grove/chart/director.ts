/**
 * The chart's director: which chart shows, when the casting plays, when the plates turn, and what
 * the store and the audio hear about it (design.md §9.5–9.6, §9.9). One per mounted grove.
 *
 * - The chart comes from the store (`chartInstant`), recast when lib/qimen/live.ts's chart clock says
 *   so (the moment changed, a 时辰 turned while live, the page came back), the same clock the DOM
 *   chart follows. A turn wakes the stage (a stopped stage runs no frames).
 * - The casting plays once per session the first time the chart is on screen, never in reverse:
 *   arriving from below, with reduced motion or under e2e it shows its end state.
 * - It publishes `groveCastPlayed`, `ringSpeed` (only on change) and CY_EVENT.recast (core/events.ts).
 */

import { damp, dampAngle } from 'maath/easing'
import { CY_EVENT, emit } from '../../../core/events'
import { holdAwake, motionTime, wake } from '../../../core/render'
import { chartInstant, journey, type JourneyState } from '../../../core/store/journey'
import { MARKS, SECTION_SPANS, beatSpanById } from '../../../core/world/journey'
import { chartOptions } from '../../../content'
import { palaceAt } from '../../../lib/compass'
import { computeChart } from '../../../lib/qimen'
import { createChartClock } from '../../../lib/qimen/live'
import type { QimenChart } from '../../../lib/qimen/types'
import { Board, type BoardView } from './board'
import { DEG } from './layout'
import { buildModel, type ChartModel } from './model'
import { ChartMotion } from './motion'

const G4_START = beatSpanById('G4').jvh[0]
const GROVE_END = SECTION_SPANS.grove.jvh[1]

/** The board is in view: past the mist wall, before the glide to the lantern, not under paper. */
export function chartOnScreen(s: Pick<JourneyState, 'jvh' | 'dive' | 'paper'>): boolean {
  return s.jvh >= MARKS.reveal[0] && s.jvh < GROVE_END && s.dive.amount < 0.5 && s.paper < 0.5
}

/** The grove's chart clock: casting, stepping (hour marker) and the live recast timing, as the DOM chart has it. */
export const chartClock = createChartClock({ store: journey, options: chartOptions, instant: chartInstant })

/** ?groveCast=<seconds> under e2e holds the casting at that moment, for screenshots. */
function frozenCastAt(e2e: boolean): number | null {
  if (!e2e || typeof location === 'undefined') return null
  const raw = new URLSearchParams(location.search).get('groveCast')
  const t = raw === null ? NaN : Number(raw)
  return Number.isFinite(t) ? t : null
}

const now = () => performance.now() / 1000

export class Director {
  readonly board: Board
  private chart: QimenChart
  private model: ChartModel
  private readonly motion: ChartMotion
  private cast: 'waiting' | 'playing' | 'done'
  private freeze: number | null = null
  private castT0 = 0
  private release: (() => void) | null = null
  private lastSpeed = 0
  private prevAngles = { heaven: 0, human: 0, spirit: 0 }
  private prevT = 0
  private dirty = 30

  /** Smoothed view values (maath damps these in place). */
  private readonly smooth = { dial: 0, english: 0, select: 0, needle: 0, needleVel: 0 }
  private selected: JourneyState['selectedPalace'] = null

  constructor() {
    const s = journey.getState()
    // Outside the term table (1930–2100) there is no chart to cast; keep the stones on a fixed hour.
    this.chart = chartClock.castAt(chartInstant(s)) ?? computeChart(Date.UTC(2026, 8, 28, 11), chartOptions)
    this.model = buildModel(this.chart)
    this.board = new Board(this.model)
    this.motion = new ChartMotion(this.model)
    this.cast = s.groveCastPlayed ? 'done' : 'waiting'
    if (this.cast === 'done') this.motion.snap(this.model)
    else this.motion.rest(this.model)
    this.smooth.dial = this.dialTarget(s)
    this.smooth.english = s.showEnglish ? 1 : 0
    this.selected = s.selectedPalace
    this.smooth.select = s.selectedPalace === null ? 0 : 1
  }

  /** Follow the chart clock and the view state in the store. Returns the stop function. */
  start(): () => void {
    const unsub = journey.subscribe((s, prev) => {
      if (s.selectedPalace !== prev.selectedPalace || s.showEnglish !== prev.showEnglish || s.dialDeg !== prev.dialDeg || s.compass !== prev.compass) {
        this.dirty = 30
        wake(600)
      }
    })
    // Catch up first (the grove may have been hidden across a turn), quietly: no chime for that.
    this.recompute(false)
    const stop = chartClock.follow(
      () => this.chart,
      (cause) => {
        if (cause === 'turn') wake(1500)
        this.recompute(cause !== 'moment')
      },
    )
    return () => {
      unsub()
      stop()
      this.hold(false)
    }
  }

  /** Frees the board's GPU side: a real unmount only (GroveChart), never an <Activity> hide. */
  dispose(): void {
    this.hold(false)
    this.board.dispose()
  }

  private dialTarget(s: JourneyState): number {
    // The album SVG turns by 180 − heading (clockwise on screen): at rest south is at the top, so
    // the direction the phone's top points comes to the top. design.md §9.9's "−heading" assumes a
    // north-up rest; this chart rests south-up, so it is 180 − heading here too.
    const deg = s.compass.status === 'active' && s.compass.heading !== null ? 180 - s.compass.heading : s.dialDeg
    return deg * DEG
  }

  private hold(on: boolean): void {
    if (on && !this.release) this.release = holdAwake()
    else if (!on && this.release) {
      this.release()
      this.release = null
    }
  }

  /** Re-read the chart; `live` marks a clock-driven change (the hour chime). */
  private recompute(live: boolean): void {
    const s = journey.getState()
    const next = chartClock.castAt(chartInstant(s))
    if (!next || next.nextChangeUtc === this.chart.nextChangeUtc) return
    this.chart = next
    this.model = buildModel(next)
    this.dirty = 30
    const seen = chartOnScreen(s) && document.visibilityState === 'visible'
    if (this.cast === 'waiting') this.motion.rest(this.model)
    else if (seen && !s.reducedMotion && !s.e2e) {
      this.motion.recast(this.model, now())
      wake(1000)
    } else this.motion.snap(this.model)
    // The hour chime (audio) plays for a live 时辰 change the visitor can see.
    if (live && seen && s.chartInstantMs === null) {
      emit(CY_EVENT.recast, { chartAtMs: Date.parse(next.instantUtc) })
    }
  }

  /** One frame. `elapsed` is R3F's clock (for ambient motion), `dt` the frame delta. */
  frame(elapsed: number, dt: number): void {
    const s = journey.getState()
    const t = now()

    if (this.cast === 'waiting' && s.jvh >= MARKS.castStart && s.jvh < GROVE_END && s.dive.amount < 0.5) {
      journey.setState({ groveCastPlayed: true })
      this.freeze = frozenCastAt(s.e2e)
      const skip = (s.reducedMotion || s.e2e) && this.freeze === null
      if (skip || s.jvh >= G4_START) {
        this.motion.snap(this.model)
        this.cast = 'done'
      } else {
        this.castT0 = this.freeze !== null ? 0 : t
        this.motion.cast(this.model, this.castT0)
        this.cast = 'playing'
      }
      this.dirty = 30
    }
    const clock = this.freeze !== null ? this.castT0 + this.freeze : t
    if (this.cast === 'playing') {
      if (this.freeze === null && s.jvh >= G4_START) this.motion.finish(clock)
      if (!this.motion.casting(clock)) this.cast = 'done'
    }

    const busy = this.motion.busy(clock)
    const reduced = s.reducedMotion
    const step = Math.min(dt, 0.25)
    const sm = this.smooth

    const dialBefore = sm.dial
    const dialGoal = this.dialTarget(s)
    const dialMoving = reduced ? ((sm.dial = dialGoal), false) : dampAngle(sm, 'dial', dialGoal, 0.25, step)
    const englishMoving = reduced ? ((sm.english = s.showEnglish ? 1 : 0), false) : damp(sm, 'english', s.showEnglish ? 1 : 0, 0.2, step)
    // A selection washes its palace; in compass mode so does the palace under the top thread (§9.9).
    const facing = s.compass.status === 'active' && s.compass.heading !== null ? palaceAt(s.compass.heading) : null
    const shown = s.selectedPalace ?? facing
    if (shown !== null) this.selected = shown
    const selectMoving = damp(sm, 'select', shown === null ? 0 : 1, 0.12, step)

    // The needle lags a turning dial and settles back, with a slow ±1° drift (motionTime is 0 under
    // reduced motion and frozen under e2e).
    const turned = Math.atan2(Math.sin(sm.dial - dialBefore), Math.cos(sm.dial - dialBefore))
    let needleMoving = false
    if (reduced) sm.needle = 0
    else {
      sm.needle = Math.max(-0.35, Math.min(0.35, sm.needle + turned))
      sm.needleVel += (-30 * sm.needle - 3.5 * sm.needleVel) * step
      sm.needle += sm.needleVel * step
      needleMoving = Math.abs(sm.needle) > 0.002 || Math.abs(sm.needleVel) > 0.002
    }
    const drift = Math.sin(motionTime(elapsed, s) * 0.45) * DEG

    const animating = busy || dialMoving || englishMoving || selectMoving || needleMoving
    this.hold(animating)
    if (animating) this.dirty = Math.max(this.dirty, 2)
    if (this.dirty > 0 || !this.board.laidOut()) {
      this.dirty = Math.max(0, this.dirty - 1)
      const view: BoardView = { dial: sm.dial, needle: sm.needle + drift, english: sm.english, selected: this.selected, select: sm.select, dimOthers: s.selectedPalace !== null }
      this.board.update(this.motion.frame(clock), view)
    }
    this.publishSpeed(clock, busy)
  }

  /** Fastest ring's angular speed in slots per second, for the grind and detent cues; written only on change. */
  private publishSpeed(t: number, busy: boolean): void {
    const a = this.motion.angle
    const angles = { heaven: a.heaven.value(t), human: a.human.value(t), spirit: a.spirit.value(t) }
    const p = this.prevAngles
    const speed = busy && t > this.prevT ? Math.max(Math.abs(angles.heaven - p.heaven), Math.abs(angles.human - p.human), Math.abs(angles.spirit - p.spirit)) / (t - this.prevT) : 0
    this.prevAngles = angles
    this.prevT = t
    const q = Math.round(speed * 10) / 10
    if (q !== this.lastSpeed) {
      this.lastSpeed = q
      journey.setState({ ringSpeed: q })
    }
  }
}
