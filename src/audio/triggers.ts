/**
 * When one-shot cues fire (design.md §12, §6.3): scroll marks that play once going forward and
 * never reversed, store edges (dive, ignition, seal), the ring detents with their rate cap, and
 * the rate gates for keys and the hour chime. Pure; index.ts feeds it store updates.
 */

import type { JourneyState } from '../core/store/journey'
import { GROVE_ON, MARKS, SCENE_SPANS } from '../core/world/beats'
import { DETENT_MAX_PER_SECOND } from './cues'

export type TriggerState = Pick<JourneyState, 'jvh' | 'dive' | 'insideCabin' | 'ignitionPlayed' | 'finale'>

export type Cue = 'creak' | 'gate' | 'guqin' | 'reveal' | 'whoosh' | 'ignition' | 'seal'

export interface ForwardCue {
  readonly cue: Cue
  /** Fires when a walk crosses this jvh going forward. */
  readonly at: number
  /** Having fired (or been passed by a jump), it can fire again once the walk is back before this. */
  readonly rearm: number
}

export const FORWARD_CUES: readonly ForwardCue[] = [
  { cue: 'creak', at: MARKS.doorCreak, rearm: MARKS.doorPortalOn },
  { cue: 'gate', at: MARKS.moonGate[0], rearm: MARKS.moonGate[0] - 10 },
  { cue: 'guqin', at: MARKS.guqin, rearm: MARKS.mistWall[0] },
  { cue: 'reveal', at: MARKS.reveal[0], rearm: MARKS.guqin },
]

/**
 * A scroll step longer than this in one store update is a jump (End key, a scrollbar drag, a dive's
 * swap), not a walk: the camera hides it in catch-up fog, and marks it passes stay silent.
 */
export const MAX_WALK_STEP = 60

export interface Triggers {
  /** The cues a store update fires, in play order. */
  step(prev: TriggerState, next: TriggerState): Cue[]
}

export function createTriggers(initial: Pick<TriggerState, 'jvh'>): Triggers {
  // A mark behind the listener when sound starts stays quiet until they go back before it.
  const armed = new Map(FORWARD_CUES.map((c) => [c.cue, initial.jvh < c.at]))
  let ignited = false
  return {
    step(prev, next) {
      const out: Cue[] = []
      if (prev.dive.phase !== 'in' && next.dive.phase === 'in') out.push('whoosh')
      const walking = prev.dive.phase === 'idle' && next.dive.phase === 'idle' && next.jvh - prev.jvh <= MAX_WALK_STEP
      for (const c of FORWARD_CUES) {
        if (next.jvh < c.rearm) armed.set(c.cue, true)
        else if (armed.get(c.cue) && prev.jvh < c.at && next.jvh >= c.at) {
          armed.set(c.cue, false)
          if (walking) out.push(c.cue)
        }
      }
      // The cabin runs its full ignition from the first door crossing and only records
      // `ignitionPlayed` when the run ends, so the swell starts on the crossing itself.
      if (!ignited && !prev.insideCabin && next.insideCabin && !next.ignitionPlayed) {
        ignited = true
        out.push('ignition')
      }
      if (!prev.finale.sealStamped && next.finale.sealStamped) out.push('seal')
      return out
    },
  }
}

/** True at most `perSecond` times a second; extra calls are dropped, never queued. */
export function createRateGate(perSecond: number): (tSeconds: number) => boolean {
  let last = -Infinity
  return (t) => {
    if (t - last < 1 / perSecond) return false
    last = t
    return true
  }
}

export interface Detents {
  /**
   * Advance the fastest ring by `dt` seconds at `speed` slots (45°) per second. True when a detent
   * should click now. A stop just short of a slot clicks as the ring settles into it.
   */
  step(speed: number, tSeconds: number, dt: number): boolean
}

export function createDetents(maxPerSecond = DETENT_MAX_PER_SECOND): Detents {
  const gate = createRateGate(maxPerSecond)
  let travel = 0
  let turning = false
  return {
    step(speed, t, dt) {
      if (speed > 0) {
        const before = Math.floor(travel)
        travel += speed * Math.max(0, dt)
        turning = true
        return Math.floor(travel) > before && gate(t)
      }
      if (!turning) return false
      turning = false
      const settles = travel % 1 >= 0.5
      travel = 0
      return settles && gate(t)
    },
  }
}

/**
 * The hour chime plays only when the grove is on screen: from the reveal to the end of the grove, not
 * mid-dive. Never while the grove is paused (content/features.ts): there is no chart to chime for.
 */
export const groveOnScreen = (s: Pick<JourneyState, 'jvh' | 'dive'>): boolean =>
  GROVE_ON && s.dive.phase === 'idle' && s.jvh >= MARKS.reveal[0] && s.jvh < SCENE_SPANS.grove[1]
