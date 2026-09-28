/**
 * The chart's clockwork (design.md §9.5 casting, §9.6 recasting), as pure functions of time.
 * The scene feeds it seconds and reads a frame back; nothing here knows about three or the store.
 *
 * Every animated value is a Channel: a chain of tweens where a later tween takes over from whatever
 * the value is when it starts, so retargeting mid-turn never jumps. Ring angles are in 45° slots and
 * unwrapped, so a ring always takes the shortest way round from where it is.
 */

import { PALACE_NUMBERS, deitySlot, turnBetween } from '../../../lib/qimen'
import type { Dun } from '../../../lib/qimen/types'
import { easing } from '../../../theme/tokens'
import { RING_IDS, type ChartModel, type RingId } from './model'

type Ease = (t: number) => number
const linear: Ease = (t) => t

interface Segment {
  t0: number
  dur: number
  v0: number
  v1: number
  ease: Ease
}

export class Channel {
  private segs: Segment[] = []
  constructor(private base: number) {}

  value(t: number): number {
    let v = this.base
    for (const s of this.segs) {
      if (t < s.t0) break
      v = s.dur <= 0 || t >= s.t0 + s.dur ? s.v1 : s.v0 + (s.v1 - s.v0) * s.ease((t - s.t0) / s.dur)
    }
    return v
  }

  /** Tween from the value at `t0` to `v1`. Anything scheduled at or after `t0` is dropped. */
  to(v1: number, t0: number, dur: number, ease: Ease = easing.inOutCubic): this {
    const v0 = this.value(t0)
    this.segs = this.segs.filter((s) => s.t0 < t0)
    this.segs.push({ t0, dur, v0, v1, ease })
    return this
  }

  set(v: number): this {
    this.segs = []
    this.base = v
    return this
  }

  /** Where the channel ends up once every scheduled tween has run. */
  get target(): number {
    return this.segs.at(-1)?.v1 ?? this.base
  }

  get end(): number {
    return this.segs.reduce((e, s) => Math.max(e, s.t0 + s.dur), -Infinity)
  }

  /** Forget tweens that finished before `t` (time only moves forward). */
  compact(t: number): void {
    while (this.segs[0] && this.segs[0].t0 + this.segs[0].dur <= t && (this.segs[1]?.t0 ?? -Infinity) <= t) {
      this.base = this.segs[0].v1
      this.segs.shift()
    }
  }
}

/** Seconds (design.md §9.5 and §9.6). */
export const CAST = {
  /** The brush reaches one palace every 140 ms; each earth stem inks as it arrives. */
  perPalace: 0.14,
  inkDur: 0.2,
  brushFade: { at: 1.4, dur: 0.8 },
  turn: { at: 1.5, dur: 1.2, stagger: { heaven: 0, human: 0.25, spirit: 0.5 } },
  settle: { at: 3.2, dur: 0.6, stagger: 0.12 },
  marks: { at: 4.1, dur: 0.22 },
  arcDraw: 0.5,
  band: { at: 4.6, dur: 0.6 },
  /** The 值符 arc fades to 40% three seconds after it is drawn. */
  arcFade: { after: 3, dur: 0.8, to: 0.4 },
  /** Scrolled past mid-cast: complete in 300 ms. */
  finish: 0.3,
} as const

export const RECAST = {
  lift: 0.15,
  turn: 0.45,
  settle: 0.25,
  /** 局 change: the earth stems wash out and re-ink before the rings move. */
  wash: 0.6,
  /** Faster than 3 steps a second: glyphs stay lifted, rings follow, settle 300 ms after the last step. */
  fastUnder: 1 / 3,
  follow: 0.3,
  marks: 0.22,
  arcDraw: 0.3,
} as const

const LIFT_ORDER: Record<RingId, number> = { heaven: 0, human: 1, spirit: 2 }

export interface MotionFrame {
  /** Ring angle in slots, unwrapped: slot k of the ring sits at bearing (k + angle) × 45°. */
  angle: Record<RingId, number>
  /** Deity k sits at spirit angle + rel[k] slots (deitySlot: clockwise in the yang dun, anticlockwise in the yin). */
  deityRel: number[]
  /** 0 = the lit glyphs ride their ring slot, 1 = settled in their palace. */
  fly: Record<RingId, number>
  /** The deity carvings lift while a dun change reorders them. */
  spiritLift: number
  /** Earth stem fill per palace, index 1..9: 0 = bare carving, 1 = paper-white. */
  ink: number[]
  /** Luo Shu brush progress 0..1 along the path, and its opacity. */
  brush: number
  brushAlpha: number
  /** 值符 plates and the 值使 ring, 0..1 (the stamp). */
  marks: number
  /** 值符 arc: drawn length 0..1 and opacity. */
  arc: number
  arcAlpha: number
  /** Inscription fields printed, 0..4 (three on line one, then the pillars). */
  band: number
  /** The chart whose riders, marks and hour marker show now, and the one whose earth stems show. */
  model: ChartModel
  earthModel: ChartModel
}

/** Deity k's slot relative to the 值符 deity's, from the engine's own rule (0..7). */
const relFor = (dun: Dun, k: number) => deitySlot(0, dun, k)

export class ChartMotion {
  readonly angle: Record<RingId, Channel> = { heaven: new Channel(0), human: new Channel(0), spirit: new Channel(0) }
  readonly deityRel: Channel[]
  readonly fly: Record<RingId, Channel> = { heaven: new Channel(0), human: new Channel(0), spirit: new Channel(0) }
  readonly spiritLift = new Channel(0)
  readonly ink: Channel[] = Array.from({ length: 10 }, () => new Channel(0))
  readonly brush = new Channel(0)
  readonly brushAlpha = new Channel(0)
  readonly marks = new Channel(0)
  readonly arc = new Channel(0)
  readonly arcAlpha = new Channel(0)
  readonly band = new Channel(0)

  private prev: ChartModel
  private cur: ChartModel
  private switchAt = -Infinity
  private earthPrev: ChartModel
  private earthSwitchAt = -Infinity
  private lastRecast = -Infinity
  private castDoneAt = -Infinity

  /** Every channel, for the per-frame busy check and compaction. */
  private readonly all: readonly Channel[]

  constructor(model: ChartModel) {
    this.prev = this.cur = this.earthPrev = model
    this.deityRel = Array.from({ length: 8 }, (_, k) => new Channel(relFor(model.dun, k)))
    this.all = [
      ...RING_IDS.map((r) => this.angle[r]),
      ...RING_IDS.map((r) => this.fly[r]),
      ...this.deityRel,
      ...this.ink,
      this.spiritLift,
      this.brush,
      this.brushAlpha,
      this.marks,
      this.arc,
      this.arcAlpha,
      this.band,
    ]
  }

  get model(): ChartModel {
    return this.cur
  }

  /** Time after which nothing moves (−Infinity when at rest). */
  get end(): number {
    return this.all.reduce((e, c) => Math.max(e, c.end), -Infinity)
  }

  busy(t: number): boolean {
    return t < this.end
  }

  /** True while the casting is still to finish (the "skip to the end" window). */
  casting(t: number): boolean {
    return t < this.castDoneAt
  }

  /** 伏吟, unlit: the board before its first casting (P3, G0). */
  rest(model: ChartModel): void {
    this.prev = this.cur = this.earthPrev = model
    this.switchAt = this.earthSwitchAt = this.castDoneAt = -Infinity
    for (const r of RING_IDS) {
      this.angle[r].set(0)
      this.fly[r].set(0)
    }
    this.deityRel.forEach((c, k) => c.set(relFor(model.dun, k)))
    for (const c of [...this.ink, this.spiritLift, this.brush, this.brushAlpha, this.marks, this.arc, this.arcAlpha, this.band]) c.set(0)
  }

  /** The final state of `model` at once: reduced motion, e2e, a chart seen off screen. */
  snap(model: ChartModel): void {
    this.prev = this.cur = this.earthPrev = model
    this.switchAt = this.earthSwitchAt = this.castDoneAt = -Infinity
    for (const r of RING_IDS) this.angle[r].set(this.turnedTo(r, model))
    this.deityRel.forEach((c, k) => c.set(c.target + turnBetween(c.target, relFor(model.dun, k))))
    for (const r of RING_IDS) this.fly[r].set(1)
    for (const c of this.ink) c.set(1)
    this.spiritLift.set(0)
    this.brush.set(1)
    this.brushAlpha.set(0)
    this.marks.set(1)
    this.arc.set(1)
    this.arcAlpha.set(CAST.arcFade.to)
    this.band.set(4)
  }

  /** The casting (§9.5), from 伏吟 with 值符 at 坎1, starting at `t`. */
  cast(model: ChartModel, t: number): void {
    this.rest(model)
    const o = model.offsets
    model.luoShuPath.forEach((p, i) => this.ink[p]?.to(1, t + i * CAST.perPalace, CAST.inkDur, linear))
    this.brushAlpha.set(1).to(0, t + CAST.brushFade.at, CAST.brushFade.dur, linear)
    this.brush.to(1, t, (model.luoShuPath.length - 1) * CAST.perPalace, linear)
    const targets: Record<RingId, number> = { heaven: o.heaven, human: o.human, spirit: turnBetween(0, o.spirit) }
    for (const r of RING_IDS) {
      this.angle[r].to(targets[r], t + CAST.turn.at + CAST.turn.stagger[r], CAST.turn.dur)
      this.fly[r].to(1, t + CAST.settle.at + LIFT_ORDER[r] * CAST.settle.stagger, CAST.settle.dur)
    }
    this.marks.to(1, t + CAST.marks.at, CAST.marks.dur, easing.outCubic)
    const arcAt = t + CAST.marks.at + CAST.marks.dur
    this.arc.to(1, arcAt, CAST.arcDraw, easing.outCubic)
    this.arcAlpha.to(1, arcAt, 0.05, linear).to(CAST.arcFade.to, arcAt + CAST.arcDraw + CAST.arcFade.after, CAST.arcFade.dur, linear)
    this.band.to(4, t + CAST.band.at, CAST.band.dur, linear)
    this.castDoneAt = t + CAST.band.at + CAST.band.dur
  }

  /** Scrolled past mid-cast: everything reaches its end state within 300 ms. */
  finish(t: number): void {
    if (!this.casting(t)) return
    const d = CAST.finish
    for (const c of [...RING_IDS.map((r) => this.angle[r]), ...this.deityRel]) c.to(c.target, t, d)
    for (const r of RING_IDS) this.fly[r].to(1, t, d)
    for (const p of PALACE_NUMBERS) this.ink[p]?.to(1, t, d, linear)
    this.brushAlpha.to(0, t, d, linear)
    this.marks.to(1, t, d)
    this.arc.to(1, t, d)
    this.arcAlpha.to(CAST.arcFade.to, t, d, linear)
    this.band.to(4, t, d, linear)
    this.castDoneAt = t + d
  }

  /** A new chart while the board is lit (§9.6): lift, turn, settle; wash the earth stems first if the 局 changed. */
  recast(next: ChartModel, t: number): void {
    const from = this.cur
    if (from === next) return
    const fast = t - this.lastRecast < RECAST.fastUnder
    this.lastRecast = t
    const plateChange = next.plateKey !== from.plateKey
    const dunChange = next.dun !== from.dun
    const flying = Math.max(...RING_IDS.map((r) => this.fly[r].value(t)))
    const lift = RECAST.lift * flying

    this.prev = this.shownModel(t)
    this.cur = next
    this.switchAt = t + lift
    this.castDoneAt = -Infinity

    this.marks.to(0, t, 0.12, linear)
    this.arcAlpha.to(0, t, 0.15, linear)
    this.arc.to(0, t + 0.15, 0)
    for (const r of RING_IDS) this.fly[r].to(0, t, lift)

    if (plateChange) {
      this.earthPrev = this.shownEarth(t)
      const half = (fast ? RECAST.follow : RECAST.wash) / 2
      this.earthSwitchAt = t + half
      for (const p of PALACE_NUMBERS) this.ink[p]?.to(0, t, half, linear).to(1, t + half, half, linear)
    }

    const turnAt = fast ? t : t + Math.max(lift, plateChange ? RECAST.wash : 0)
    const turnDur = fast ? RECAST.follow : RECAST.turn
    const turnEase = fast ? easing.outCubic : easing.inOutCubic
    for (const r of RING_IDS) this.angle[r].to(this.turnedTo(r, next), turnAt, turnDur, turnEase)
    const settleAt = Math.max(turnAt + turnDur, this.switchAt)
    if (dunChange) {
      this.spiritLift.to(1, t, RECAST.lift)
      this.deityRel.forEach((c, k) => c.to(c.target + turnBetween(c.target, relFor(next.dun, k)), turnAt, turnDur, turnEase))
      this.spiritLift.to(0, settleAt, RECAST.settle)
    }
    for (const r of RING_IDS) this.fly[r].to(1, settleAt, RECAST.settle)
    const markAt = settleAt + RECAST.settle
    this.marks.to(1, markAt, RECAST.marks, easing.outCubic)
    this.arc.to(1, markAt, RECAST.arcDraw, easing.outCubic)
    this.arcAlpha.to(1, markAt, 0.05, linear).to(CAST.arcFade.to, markAt + RECAST.arcDraw + CAST.arcFade.after, CAST.arcFade.dur, linear)
    this.band.to(4, t, 0)
  }

  /**
   * A ring's angle is the offset it shows (0 = 伏吟; for the spirit ring, the 值符 deity's slot), so
   * the next angle is the current target plus the shortest turn to the new offset.
   */
  private turnedTo(ring: RingId, model: ChartModel): number {
    const a = this.angle[ring].target
    return a + turnBetween(a, model.offsets[ring])
  }

  private shownModel(t: number): ChartModel {
    return t < this.switchAt ? this.prev : this.cur
  }

  private shownEarth(t: number): ChartModel {
    return t < this.earthSwitchAt ? this.earthPrev : this.cur
  }

  frame(t: number): MotionFrame {
    for (const c of this.all) c.compact(t)
    return {
      angle: { heaven: this.angle.heaven.value(t), human: this.angle.human.value(t), spirit: this.angle.spirit.value(t) },
      deityRel: this.deityRel.map((c) => c.value(t)),
      fly: { heaven: this.fly.heaven.value(t), human: this.fly.human.value(t), spirit: this.fly.spirit.value(t) },
      spiritLift: this.spiritLift.value(t),
      ink: this.ink.map((c) => c.value(t)),
      brush: this.brush.value(t),
      brushAlpha: this.brushAlpha.value(t),
      marks: this.marks.value(t),
      arc: this.arc.value(t),
      arcAlpha: this.arcAlpha.value(t),
      band: this.band.value(t),
      model: this.shownModel(t),
      earthModel: this.shownEarth(t),
    }
  }
}
