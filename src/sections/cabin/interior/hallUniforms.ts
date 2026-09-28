import { Color, Vector3, Vector4, type IUniform } from 'three'
import { hall } from '../../../core/world/layout'
import { color } from '../../../theme/tokens'
import { agxInverse } from './tone'

/** uIgnite once ignition has finished: every arrival time is far in the past. */
export const IGNITE_DONE = 99
/** uIgnite before the first crossing: nothing has lit yet. */
export const IGNITE_NONE = -1
/** Length of the full ignition in seconds (design.md §8.4 I0); the replay runs the same front faster. */
export const IGNITE_FULL_S = 2.5
export const IGNITE_REPLAY_S = 0.8

/** night as the ink group shows it (no grade) and as the cabin group shows it (through AgX). */
export const NIGHT_RAW = new Color(color.night)
export const NIGHT_GRADED = agxInverse(color.night)

export interface HallUniforms {
  uMotionTime: IUniform<number>
  uNight: IUniform<Color>
  uFogDensity: IUniform<number>
  uIgnite: IUniform<number>
  uIgniteOrigin: IUniform<Vector3>
  uPulseOn: IUniform<number>
  uFocus: IUniform<Vector4>
  uScrollAnchor: IUniform<Vector3[]>
  uCyan: IUniform<Color>
  uGhost: IUniform<Color>
  uBright: IUniform<Color>
}

/**
 * One set of uniform objects shared by every hall material (spread into each material's
 * `uniforms`, which copies the references), so the per-frame driver writes each value once.
 */
export const hallUniforms: HallUniforms = {
  uMotionTime: { value: 0 },
  uNight: { value: NIGHT_RAW.clone() },
  uFogDensity: { value: hall.nightFogDensity },
  uIgnite: { value: IGNITE_NONE },
  uIgniteOrigin: { value: new Vector3(hall.centreLineX, hall.floor.y, hall.floor.zNorth - 0.5) },
  uPulseOn: { value: 1 },
  uFocus: { value: new Vector4() },
  // Where each scroll's traces gather: the floor under the scroll, a step toward the centre line.
  uScrollAnchor: {
    value: hall.scrolls.map((s) => new Vector3(s.centre[0] + Math.sign(hall.centreLineX - s.centre[0]) * 0.6, hall.floor.y, s.centre[2])),
  },
  uCyan: { value: new Color(color.cyanLine) },
  uGhost: { value: agxInverse(color.cyanGhost) },
  uBright: { value: new Color(color.cyanBright) },
}
