/**
 * The door as a function of the walk (design.md §6.1 C2, §8.3, §11.2). Pure, so the timings are testable.
 */

import { MARKS } from '../../../core/world/journey'
import { cabin, type Vec3 } from '../../../core/world/layout'

const DEG = Math.PI / 180
const { door } = cabin

export const DOOR_MAX_ANGLE = door.swingMaxDeg * DEG

/** Door leaf in the closed position, world metres. The leaf stops 2 cm above the sill: the cyan bar under the door. */
export const DOOR_LEAF = {
  /** Hinge axis on the east (−X) jamb, just inside the wall plane. */
  hinge: [door.centre[0] - door.width / 2, door.centre[1] + 0.02, door.planeZ - 0.025] as Vec3,
  width: door.width - 0.012,
  height: door.height - 0.03,
  thickness: 0.04,
} as const

const clamp01 = (t: number) => Math.min(1, Math.max(0, t))
const smooth = (t: number) => t * t * (3 - 2 * t)

/** Opening angle in radians, 0 closed to 95° open, scrubbed by scroll over MARKS.doorSwing with eased ends. */
export function doorAngle(jvh: number): number {
  const [a, b] = MARKS.doorSwing
  return DOOR_MAX_ANGLE * smooth(clamp01((jvh - a) / (b - a)))
}

/**
 * Width of the gap between the leaf's free edge and the west jamb, as a share of the doorway: the
 * chord 2·sin(angle / 2). The room behind is lit all over, so light leaves through the whole gap,
 * not just the part that faces straight out.
 */
export const doorClear = (angle: number) => clamp01(2 * Math.sin(angle / 2))

/** Strength of the spill term on the frame, steps and ferns: follows how much light the gap lets out. */
export const spillAmount = (angle: number) => smooth(clamp01(doorClear(angle) / 0.85))

/**
 * Brightness of the floor decal. Light through a crack is as bright as through the open door, only
 * narrower (the shader takes the width from doorClear), so this saturates within the first 25°.
 */
export const floorSpill = (angle: number) => smooth(clamp01(angle / (25 * DEG)))

/** The door opening writes the portal stencil from MARKS.doorPortalOn until the moon-gate swap. */
export const portalOn = (jvh: number) => jvh >= MARKS.doorPortalOn && jvh < MARKS.stageSwap

/**
 * Within this distance in front of the door plane the doorway fills the screen, and the near plane
 * would soon clip the door-sized mask, so the mask covers the whole screen instead.
 */
export const MASK_FULL_DISTANCE = 0.4

/**
 * True when the portal mask should cover the whole screen: the camera is inside, or about to pass
 * through the opening. Inside, the full-screen stencil also covers the frame or two before React
 * swaps the interior to its no-stencil twins and hides the forest.
 */
export function maskFullScreen(camera: { readonly x: number; readonly y: number; readonly z: number }, inside: boolean): boolean {
  if (inside) return true
  const { x, y, z } = camera
  const halfW = door.width / 2
  return (
    z <= door.planeZ + MASK_FULL_DISTANCE &&
    z > door.planeZ - MASK_FULL_DISTANCE &&
    Math.abs(x - door.centre[0]) < halfW &&
    y > door.centre[1] &&
    y < door.centre[1] + door.height
  )
}

/** Door and lattice hover and click only count while the closed or opening door is ahead of the camera. */
export const doorInteractive = (jvh: number, inside: boolean) => !inside && jvh < MARKS.doorClickTarget - 2
