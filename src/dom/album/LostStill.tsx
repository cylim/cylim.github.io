import { useJourney } from '../../core/store/journey'
import { beatSpanAt, type BeatId } from '../../core/world/beats'
import type { StillId } from '../../content/stills'
import { Still } from './Still'

/**
 * The still that stands in for each stretch of the walk. The path and the grove have none (the album
 * draws the chart live instead), so the painted mist stands in there.
 */
const STILL_FOR: Partial<Record<BeatId, StillId>> = {
  T0: 'T0', T1: 'T0', F1: 'T0', F2: 'T0', F3: 'T0', F4: 'T0',
  C1: 'C3', C2: 'C3', C3: 'C3', C4: 'C3',
  I0: 'I1', I1: 'I1', I2a: 'I1', I2b: 'I1', I2c: 'I1', I2d: 'I1', I3: 'I1', I4: 'I1',
  E0: 'E1', E1: 'E1', E2: 'E1', E3: 'E3',
}

export const stillAt = (jvh: number): StillId | null => STILL_FOR[beatSpanAt(jvh).id] ?? null

/**
 * WebGL context lost (design.md §13.3): the current stretch's still takes the canvas's place until
 * the visitor taps "3D paused. Tap to restart.", and follows the scroll from stretch to stretch.
 * Decorative: the copy is all in the DOM.
 */
export function LostStill() {
  const still = useJourney((s) => (s.stage === 'lost' ? (stillAt(s.jvh) ?? 'mist') : null))
  if (!still) return null
  return (
    <div className="lost-still" aria-hidden="true">
      {still === 'mist' ? <figure className="still" data-failed=""><div className="still-mist" /></figure> : <Still id={still} sizes="100vw" />}
    </div>
  )
}
