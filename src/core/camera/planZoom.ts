/**
 * Touch zoom on the G3 plan view (design.md §9.7): tapping a palace on a touch screen zooms the plan
 * view until the palace fills `RIG.planZoom.fill` of the chart viewport's width, with the palace in
 * the middle of it. The camera never leaves the path: the rig narrows the FOV and moves the principal
 * point (camera.setViewOffset), the same tools it uses for the text zones, so a scroll out of the
 * plan view or a tap outside simply lets go of the zoom.
 *
 * The grove scene decides what is zoomed (it owns the taps and knows where each palace is on the
 * turning dial) and publishes a focus here every frame; the rig reads it. Pure maths below, so the
 * lens is unit-tested without three.
 */

const DEG = Math.PI / 180

/** What the plan view zooms onto: a world point and the size that should fill the chart viewport. */
export interface PlanFocus {
  readonly x: number
  readonly y: number
  readonly z: number
  /** World metres that fill `RIG.planZoom.fill` of the chart viewport (a palace slab is 3 m). */
  readonly size: number
}

let focus: PlanFocus | null = null

/** Grove scene: the palace to zoom onto, or null to let go. Only read in the G3 plan view. */
export function setPlanFocus(next: PlanFocus | null): void {
  focus = next
}

/** The current zoom focus (the rig reads it every frame). */
export function planFocus(): PlanFocus | null {
  return focus
}

/** A lens the rig applies: visible vertical FOV in degrees and the principal-point shift (fractions, see framing.ts). */
export interface Lens {
  readonly fov: number
  readonly sx: number
  readonly sy: number
}

/** Focal length in px for a visible vertical FOV over H px. */
const focalPx = (H: number, fovDeg: number) => H / 2 / Math.tan((fovDeg * DEG) / 2)

/**
 * Zoom factor (focal-length multiplier) at which `size` metres at `depth` metres from the camera span
 * `fillPx` pixels, for a visible vertical FOV `fovDeg` over H px.
 */
export function zoomToFill(H: number, fovDeg: number, depth: number, size: number, fillPx: number): number {
  const px = (size * focalPx(H, fovDeg)) / Math.max(depth, 1e-6)
  return fillPx / Math.max(px, 1e-6)
}

/**
 * The lens `t` of the way (0..1) from `lens` to a view zoomed `zoom`× onto a focus point, with the
 * focus at `centre` (px, top-left origin) at t = 1.
 *
 * `off` is the focus's position on the image plane relative to the camera axis, in focal lengths
 * (camera-space x / depth and y / depth, y up). The focus slides in a straight line across the
 * screen while the zoom grows geometrically (zoom^t), so the palace comes to the middle as it grows
 * instead of swinging out and back. At t = 0 the result is `lens` itself.
 */
export function zoomLens(
  W: number,
  H: number,
  lens: Lens,
  off: { readonly x: number; readonly y: number },
  zoom: number,
  centre: { readonly x: number; readonly y: number },
  t: number,
): Lens {
  if (!(t > 0) || !(zoom > 0)) return lens
  const k = Math.min(1, t)
  const f = focalPx(H, lens.fov)
  // Where the focus is on screen now: the principal point plus its image-plane offset.
  const p0x = W / 2 + lens.sx * W + off.x * f
  const p0y = H / 2 + lens.sy * H - off.y * f
  const px = p0x + (centre.x - p0x) * k
  const py = p0y + (centre.y - p0y) * k
  const fz = f * zoom ** k
  // Put the principal point where the focus lands at this zoom.
  const qx = px - off.x * fz
  const qy = py + off.y * fz
  return { fov: (2 * Math.atan(H / 2 / fz)) / DEG, sx: (qx - W / 2) / W, sy: (qy - H / 2) / H }
}
