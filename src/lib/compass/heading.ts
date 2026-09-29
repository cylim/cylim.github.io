/**
 * Device heading for the grove's compass mode (stack.md §8, design.md §9.9). Pure and tested.
 * Headings are degrees clockwise from magnetic north, 0 ≤ h < 360. No declination correction:
 * a luopan reads a magnetic needle too, and declination in Penang is under 1°.
 */

import { MOUNTAINS, RING } from '../qimen/constants'
import type { OuterPalaceNo } from '../qimen/types'

const RAD = Math.PI / 180

export const wrap360 = (deg: number): number => ((deg % 360) + 360) % 360

/** Signed shortest turn from `from` to `to`, in (−180, 180]. */
export function angleDelta(from: number, to: number): number {
  const d = wrap360(to - from)
  return d > 180 ? d - 360 : d
}

/**
 * Tilt-compensated heading from W3C DeviceOrientation Euler angles (Z-X'-Y'', alpha
 * anticlockwise from north on an absolute event).
 *
 * The W3C example that stack.md §8 sketches returns where the back of the device points. That is
 * 0/0 when the phone lies flat, which is how the luopan is held. This projects both the top
 * edge (y) and the back (−z) onto the horizontal plane and sums them: flat, the top edge
 * decides; upright, the back does; in between they agree whenever the phone is not rolled.
 */
export function headingFromEuler(alpha: number, beta: number, gamma: number): number {
  const sa = Math.sin(alpha * RAD)
  const ca = Math.cos(alpha * RAD)
  const sb = Math.sin(beta * RAD)
  const cb = Math.cos(beta * RAD)
  const sg = Math.sin(gamma * RAD)
  const cg = Math.cos(gamma * RAD)
  // Earth frame x = east, y = north.
  const topE = -sa * cb
  const topN = ca * cb
  const backE = -ca * sg - sa * sb * cg
  const backN = -sa * sg + ca * sb * cg
  return wrap360(Math.atan2(topE + backE, topN + backN) / RAD)
}

/** Correct a device heading for screen rotation, so it is the heading of the screen's top edge. */
export const withScreen = (heading: number, screenAngle: number): number => wrap360(heading + screenAngle)

/** The fields of a DeviceOrientationEvent this reads, plus Safari's `webkitCompassHeading`. */
export interface OrientationReading {
  readonly alpha: number | null
  readonly beta: number | null
  readonly gamma: number | null
  readonly absolute: boolean
  readonly webkitCompassHeading?: number | null
}

/** Heading of the screen's top edge, or null when the event carries no usable absolute heading. */
export function headingFromEvent(e: OrientationReading, screenAngle = 0): number | null {
  const w = e.webkitCompassHeading
  if (typeof w === 'number' && Number.isFinite(w) && w >= 0) return withScreen(w, screenAngle)
  if (e.absolute && e.alpha != null && Number.isFinite(e.alpha)) {
    return withScreen(headingFromEuler(e.alpha, e.beta ?? 0, e.gamma ?? 0), screenAngle)
  }
  return null
}

/** The 二十四山 mountain a heading falls in (15° each, 子 centred on 0°). */
export function mountainAt(heading: number): { index: number; zh: string; centre: number } {
  const index = Math.round(wrap360(heading) / 15) % 24
  return { index, zh: MOUNTAINS[index] as string, centre: index * 15 }
}

/** The outer palace a heading falls in (45° each, 坎1 centred on 0°). */
export const palaceAt = (heading: number): OuterPalaceNo => RING[Math.round(wrap360(heading) / 45) % 8] as OuterPalaceNo

/**
 * Watches for an unsettled magnetometer (design.md §9.9): true once `repeats` readings each
 * jump more than `thresholdDeg` from the previous one within `windowMs`.
 */
export function createJumpWatch({ thresholdDeg = 30, repeats = 3, windowMs = 4000 } = {}): (heading: number, timeMs: number) => boolean {
  let last: number | null = null
  let jumps: number[] = []
  return (heading, timeMs) => {
    if (last != null && Math.abs(angleDelta(last, heading)) > thresholdDeg) jumps.push(timeMs)
    last = heading
    jumps = jumps.filter((t) => timeMs - t <= windowMs)
    return jumps.length >= repeats
  }
}
