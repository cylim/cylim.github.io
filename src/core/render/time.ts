import { journey, type JourneyState } from '../store/journey'

/**
 * The shader clock every stage module should use: R3F's elapsed time, or the frozen e2e time
 * (`?e2e=1` freezes `clock`, so screenshots are deterministic). Pass `state.clock.elapsedTime`.
 */
export function shaderTime(elapsed: number, s: Pick<JourneyState, 'clock'> = journey.getState()): number {
  return s.clock.frozen ? s.clock.time : elapsed
}

/**
 * Time for autonomous motion (mist drift, sway, flicker, boil): stands still under reduced
 * motion (design.md §14.1) as well as in e2e.
 */
export function motionTime(elapsed: number, s: Pick<JourneyState, 'clock' | 'reducedMotion'> = journey.getState()): number {
  return s.reducedMotion ? 0 : shaderTime(elapsed, s)
}
