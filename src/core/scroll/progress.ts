/**
 * Pure scroll and keyframe mappings (stack.md §3, design.md §0, §6.2, §6.3). No DOM, no three.
 *
 * Two maps live here:
 * - The scroll map: document scrollY ⇄ journey position (jvh). Knots come from measured DOM
 *   positions (the section tops), so the mapping follows whatever the viewport does to the layout,
 *   and a jump to an arrival lands on it exactly.
 * - The key track: jvh → spline parameter for one camera channel. Piecewise-linear between keys,
 *   flat between equal consecutive keys, which is what makes a hold hold (§6.3).
 */

import type { Key } from '../world/journey'

export interface Knot {
  readonly x: number
  readonly y: number
}

/** Linear interpolation through knots sorted by strictly increasing x; clamped at both ends. */
export function piecewise(knots: readonly Knot[], x: number): number {
  const first = knots[0]
  const last = knots[knots.length - 1]
  if (!first || !last) return 0
  if (x <= first.x) return first.y
  if (x >= last.x) return last.y
  let lo = 0
  let hi = knots.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if ((knots[mid] as Knot).x <= x) lo = mid
    else hi = mid
  }
  const a = knots[lo] as Knot
  const b = knots[hi] as Knot
  return a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x)
}

const swap = (knots: readonly Knot[]): Knot[] => knots.map((k) => ({ x: k.y, y: k.x }))

// ---------------------------------------------------------------------------- scroll map

/** A measured DOM position: the element top (document px) where journey position `jvh` begins. */
export interface ScrollAnchor {
  readonly y: number
  readonly jvh: number
}

export interface ScrollMap {
  /** x = scrollY in CSS px, y = jvh. Strictly increasing in both. */
  readonly knots: readonly Knot[]
  /** The same knots swapped: x = jvh, y = scrollY. */
  readonly inverse: readonly Knot[]
  readonly maxScroll: number
  /** jvh values a scroll position snaps onto when it is within half a pixel of them (the arrivals). */
  readonly magnets: readonly { readonly jvh: number; readonly tolerance: number }[]
}

/**
 * Build the scroll map from measured anchors. The top of the document is jvh 0 and the end of the
 * scroll range is `end` (J). Anchors that are out of order, past the scroll range or zero-height
 * (display: none) are dropped, so a partial or odd layout still yields a monotonic map.
 */
export function buildScrollMap(
  anchors: readonly ScrollAnchor[],
  maxScroll: number,
  end: number,
  magnets: readonly number[] = [],
): ScrollMap {
  const max = Math.max(1, maxScroll)
  const sorted = anchors.toSorted((a, b) => a.jvh - b.jvh || a.y - b.y)
  const knots: Knot[] = [{ x: 0, y: 0 }]
  for (const a of sorted) {
    const prev = knots[knots.length - 1] as Knot
    if (!Number.isFinite(a.y) || a.jvh <= prev.y || a.y <= prev.x || a.y >= max || a.jvh >= end) continue
    knots.push({ x: a.y, y: a.jvh })
  }
  knots.push({ x: max, y: end })
  const inverse = swap(knots)
  // Half a CSS pixel, in jvh, at each magnet.
  const tolerance = (jvh: number) => {
    const pxPerJvh = piecewise(inverse, jvh + 0.5) - piecewise(inverse, jvh - 0.5)
    return pxPerJvh > 0 ? 0.5 / pxPerJvh : 0
  }
  return { knots, inverse, maxScroll: max, magnets: magnets.map((jvh) => ({ jvh, tolerance: tolerance(jvh) })) }
}

/** The design.md §0 formula, used before the DOM has been measured: u = scrollY / maxScroll. */
export const linearScrollMap = (maxScroll: number, end: number, magnets: readonly number[] = []): ScrollMap =>
  buildScrollMap([], maxScroll, end, magnets)

/**
 * Journey position for a scroll offset. Browsers round scroll offsets, so a jump to an arrival can
 * come back a fraction of a pixel off; within half a pixel the result snaps to the magnet, which
 * makes u exactly 0.345 at the #cabin arrival.
 */
export function jvhAtScroll(map: ScrollMap, scrollY: number): number {
  const jvh = piecewise(map.knots, scrollY)
  for (const m of map.magnets) {
    if (Math.abs(jvh - m.jvh) <= m.tolerance) return m.jvh
  }
  return jvh
}

/** Scroll offset (CSS px) where a journey position sits. */
export const scrollAtJvh = (map: ScrollMap, jvh: number): number => piecewise(map.inverse, jvh)

/**
 * After a re-measure: where to scroll so the visitor stays at `jvh`, or null to leave the scroll
 * alone. Sections are svh multiples, so a resize or a rotation moves every section top and the same
 * scrollY would land in another beat or section (QM-P2). Only moved anchors count: a mobile URL bar
 * sliding in or out changes the scroll range but not the (svh) section tops, and scrolling under
 * the visitor's thumb for it would fight their fling.
 */
export function reanchorScrollY(prev: ScrollMap, next: ScrollMap, jvh: number, scrollY: number): number | null {
  const a = prev.knots
  const b = next.knots
  // Every knot but the last is a measured section top; the last is the end of the scroll range.
  const moved = a.length !== b.length || a.some((k, i) => i < a.length - 1 && (k.y !== b[i]?.y || Math.abs(k.x - (b[i]?.x ?? 0)) > 0.5))
  if (!moved) return null
  const y = scrollAtJvh(next, jvh)
  return Math.abs(y - scrollY) > 0.5 ? y : null
}

// ---------------------------------------------------------------------------- key track

/**
 * One camera channel prepared for a spline: the distinct points in order, and for every key the
 * index of its point. Equal consecutive keys share a point, so the parameter stays flat between
 * them (a stationary hold) and the spline never sees a zero-length segment.
 */
export interface KeyTrack<T> {
  readonly points: readonly T[]
  /** x = key jvh, y = point index. Non-decreasing in y; equal y across a hold. */
  readonly knots: readonly Knot[]
}

export function keyTrack<T>(keys: readonly Key<T>[], same: (a: T, b: T) => boolean): KeyTrack<T> {
  const points: T[] = []
  const knots: Knot[] = []
  for (const k of keys) {
    const last = points[points.length - 1]
    if (last === undefined || !same(last, k.v)) points.push(k.v)
    const prev = knots[knots.length - 1]
    // Two keys at the same jvh: the later one wins (only a cut does this, and cuts split tracks).
    if (prev && prev.x === k.at) knots.pop()
    knots.push({ x: k.at, y: points.length - 1 })
  }
  return { points, knots }
}

/**
 * Continuous parameter in point-index units at `jvh`: integer at every key, linear between keys,
 * flat across equal keys, clamped before the first and after the last key.
 */
export const trackParam = <T>(track: KeyTrack<T>, jvh: number): number => piecewise(track.knots, jvh)

export const sameVec3 = (a: readonly number[], b: readonly number[]) =>
  a.length === b.length && a.every((v, i) => Math.abs(v - (b[i] as number)) < 1e-9)
