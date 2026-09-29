/**
 * Framing (design.md §6.1 h_fit, §6.4 text zones and portrait). Pure maths with no three import,
 * so it is unit-tested and the rig only applies the numbers.
 *
 * - FOV: landscape follows the beat table. Portrait derives the vFOV from a 46° horizontal FOV,
 *   clamped to 55–68°; the cabin interior uses 62° and E1 58°.
 * - Shift: the principal point moves (camera.setViewOffset) so the subject centres in the part of
 *   the screen the copy doesn't use. The camera itself never moves for text.
 * - h_fit: the plan-view height at which the R4 circle plus 1 m fits the chart viewport.
 */

import {
  BEATS,
  FRAMING,
  PORTRAIT,
  beatAt,
  beatById,
  channelKeys,
  sampleScalar,
  type Beat,
  type BeatId,
  type Key,
  type PortraitOverride,
} from '../world/journey'
import { grove } from '../world/layout'

const DEG = Math.PI / 180

export interface Viewport {
  /** CSS px of the canvas. */
  readonly width: number
  readonly height: number
  /** Fixed header height in CSS px (0 on mobile, where the bar sits at the bottom). */
  readonly header: number
}

/** Portrait overrides of this walk (PORTRAIT is a live binding: a detour can join the grove walk). */
const overrides = (): Partial<Record<BeatId, PortraitOverride>> => PORTRAIT.overrides

/** Vertical FOV (degrees) that gives horizontal FOV `hDeg` at `aspect` (width / height). */
export const vFovFromH = (hDeg: number, aspect: number) => (2 * Math.atan(Math.tan((hDeg * DEG) / 2) / aspect)) / DEG

/** §6.4: portrait vFOV from a 46° horizontal FOV, clamped to 55–68°. */
export function portraitBaseFov(aspect: number): number {
  const [lo, hi] = PORTRAIT.vFovClamp
  return Math.min(hi, Math.max(lo, vFovFromH(PORTRAIT.hFovDeg, aspect)))
}

/**
 * vFOV keys. Landscape: the beat table. Portrait: every key takes the base FOV, or the interior
 * value where its beat is inside the hall, or the beat's override (E1 58°, held across its hold).
 * Keys keep their jvh, so the C4 dolly and the moon-gate cut still happen where they should.
 */
export function fovKeys(portrait: boolean, aspect: number): Key<number>[] {
  const keys = channelKeys('fov')
  if (!portrait) return [...keys]
  const base = portraitBaseFov(aspect)
  const valueAt = (at: number) => {
    const b = beatAt(at)
    return overrides()[b.id]?.fov ?? (b.medium === 'night' ? PORTRAIT.interiorVFov : base)
  }
  const out: Key<number>[] = keys.map((k) => ({ ...k, v: valueAt(k.at) }))
  for (const b of BEATS) {
    const fov = overrides()[b.id]?.fov
    if (fov === undefined) continue
    const [a, z] = b.hold ?? b.jvh
    out.push({ at: a, v: fov }, { at: z, v: fov })
  }
  return out.toSorted((a, b) => a.at - b.at)
}

/** Keys for a per-beat value: across the hold if the beat has one, else at the beat's middle. `null` = no key. */
function beatKeys(value: (b: Beat) => number | null): Key<number>[] {
  const out: Key<number>[] = []
  for (const b of BEATS) {
    const v = value(b)
    if (v === null) continue
    if (b.hold) out.push({ at: b.hold[0], v }, { at: b.hold[1], v })
    else out.push({ at: (b.jvh[0] + b.jvh[1]) / 2, v })
  }
  return out
}

/** The G3 chart viewport: where the plan view must fit, and its centre as a shift from the screen centre. */
export interface PlanViewport {
  readonly width: number
  readonly height: number
  readonly shiftX: number
  readonly shiftY: number
}

export function planViewport(vp: Viewport, portrait: boolean): PlanViewport {
  const { width: W, height: H } = vp
  if (portrait) {
    return { width: W, height: H * FRAMING.planPortraitHeight, shiftX: 0, shiftY: FRAMING.planPortraitCentreY - 0.5 }
  }
  const w = W * (1 - FRAMING.chartPanelFraction)
  const h = H - vp.header
  return { width: w, height: h, shiftX: w / 2 / W - 0.5, shiftY: (vp.header + h / 2) / H - 0.5 }
}

/**
 * Horizontal principal-point shift keys (fraction of the width, + = subject moves right).
 * Beats with copy shift away from it; holds without copy centre; everything else interpolates.
 */
export function shiftXKeys(vp: Viewport, portrait: boolean): Key<number>[] {
  if (portrait) return [{ at: 0, v: 0 }]
  return beatKeys((b) =>
    b.id === 'G3' ? planViewport(vp, false).shiftX : b.zone ? FRAMING.zoneShiftX[b.zone] : b.hold ? 0 : null,
  )
}

/** Vertical shift keys (fraction of the height, + = subject moves down). Portrait lifts the subject into the top 55%. */
export function shiftYKeys(vp: Viewport, portrait: boolean): Key<number>[] {
  if (!portrait) return beatKeys((b) => (b.id === 'G3' ? planViewport(vp, false).shiftY : b.zone || b.hold ? 0 : null))
  const sy = PORTRAIT.subjectY
  return beatKeys((b) => {
    const y = sy[b.id] ?? (b.zone || b.hold ? sy.default : null)
    return y === null ? null : y - 0.5
  })
}

/**
 * h_fit (§6.1): camera height over the grove so the R4 circle plus 1 m margin fits the chart
 * viewport, looking straight down with vertical FOV `fovDeg`. About 34 m at 16:9 with no header.
 */
export function hFit(vp: Viewport, portrait: boolean, fovDeg: number): number {
  const view = planViewport(vp, portrait)
  const fitPx = Math.max(1, Math.min(view.width, view.height))
  const distance = (grove.planFitRadius * vp.height) / (fitPx * Math.tan((fovDeg * DEG) / 2))
  return distance + grove.rings.mountains.topY
}

/** The vFOV the plan view uses for this variant (G3's value). */
export function planFov(portrait: boolean, aspect: number): number {
  const [a] = beatById('G3').hold ?? beatById('G3').jvh
  return sampleScalar(fovKeys(portrait, aspect), a)
}

/** Everything the rig needs from a viewport, rebuilt only when the viewport changes. */
export interface Framing {
  readonly viewport: Viewport
  readonly portrait: boolean
  readonly fov: readonly Key<number>[]
  readonly shiftX: readonly Key<number>[]
  readonly shiftY: readonly Key<number>[]
  readonly hFit: number
}

export function buildFraming(vp: Viewport): Framing {
  const aspect = vp.width / Math.max(1, vp.height)
  const portrait = aspect < 1
  return {
    viewport: vp,
    portrait,
    fov: fovKeys(portrait, aspect),
    shiftX: shiftXKeys(vp, portrait),
    shiftY: shiftYKeys(vp, portrait),
    hFit: hFit(vp, portrait, planFov(portrait, aspect)),
  }
}

/** Arguments for PerspectiveCamera: `fov`, `aspect`, and `setViewOffset(...view)` or clearViewOffset() when null. */
export interface Projection {
  readonly fov: number
  readonly aspect: number
  readonly view: readonly [fullWidth: number, fullHeight: number, x: number, y: number, width: number, height: number] | null
}

/**
 * Off-centre projection for a screen of W × H px with the principal point moved by (sx, sy)
 * fractions. The camera renders a W × H window of a larger virtual image whose centre is the
 * principal point. The vertical FOV of the window stays `fovDeg`, so the beat table's FOVs mean
 * what the viewer sees whatever the shift.
 */
export function projection(W: number, H: number, fovDeg: number, sx: number, sy: number): Projection {
  const ax = Math.abs(sx)
  const ay = Math.abs(sy)
  if (ax < 1e-5 && ay < 1e-5) return { fov: fovDeg, aspect: W / H, view: null }
  const fullW = W * (1 + 2 * ax)
  const fullH = H * (1 + 2 * ay)
  const fullFov = (2 * Math.atan(Math.tan((fovDeg * DEG) / 2) * (fullH / H))) / DEG
  return { fov: fullFov, aspect: fullW / fullH, view: [fullW, fullH, W * (ax - sx), H * (ay - sy), W, H] }
}
