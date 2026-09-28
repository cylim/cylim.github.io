/**
 * Touch zoom on the plan view (design.md §9.7): which palace the G3 plan view is zoomed onto.
 *
 * - A touch tap on a palace in the plan view selects it and zooms onto it; the DOM "Palace details"
 *   fill from `selectedPalace` as for any selection.
 * - While zoomed, a tap on that palace's slab does nothing (reading it, or a long-press for a glyph),
 *   and a tap anywhere else on the canvas (another palace, the rings, the floor, the ground) returns
 *   to the whole chart and clears the selection.
 * - The zoom follows the selection: clearing it (the DOM's Back, or a second tap) returns, and
 *   picking another palace in the DOM grid moves the zoom there.
 * - Leaving the plan view, or a fog-dive, lets go of the zoom and keeps the selection.
 * - A mouse or pen click never zooms: it toggles the selection as before.
 *
 * The rig does the zooming (core/camera/planZoom.ts); GroveChart publishes the zoomed palace's world
 * position every frame, since the dial may be turning under it.
 */

import type { PalaceNo } from '../../../lib/qimen/types'

export interface ZoomState {
  /** Palace the plan view is zoomed onto, or null. */
  readonly zoom: PalaceNo | null
  readonly selected: PalaceNo | null
}

export interface Tap {
  /** Palace under the tap (its slab, or its bearing on the rings), or null for a tap that missed the chart. */
  readonly palace: PalaceNo | null
  /** The tap landed on the palace's slab itself, not on the rings along its bearing. */
  readonly slab: boolean
  readonly touch: boolean
  /** The camera is in the G3 plan view. */
  readonly planView: boolean
}

/** The state after a tap on the canvas (a click that wasn't a drag and didn't land on DOM). */
export function afterTap(s: ZoomState, tap: Tap): ZoomState {
  if (s.zoom !== null) return tap.slab && tap.palace === s.zoom ? s : { zoom: null, selected: null }
  if (tap.palace === null) return s
  if (tap.touch && tap.planView) return { zoom: tap.palace, selected: tap.palace }
  return { zoom: null, selected: s.selected === tap.palace ? null : tap.palace }
}

/** The zoom after the selection changed from outside (the DOM grid, Back, "Read the chart"). */
export function zoomForSelection(zoom: PalaceNo | null, selected: PalaceNo | null): PalaceNo | null {
  return zoom === null ? null : selected
}
