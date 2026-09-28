/**
 * The camera rig's per-frame logic (design.md §6.3, §6.4, §11.1). CameraRig.tsx calls `update`
 * from useFrame at priority −1, before any scene reads the camera.
 *
 * Targets come from the beat table at the scroll position (store.jvh). The camera follows them
 * with maath damping: position 0.35 s (0.25 s on low tier), look-at 0.25 s so the eyes turn a
 * little before the body, FOV, roll, up and the text-zone shift 0.35 s. On top of that:
 * - breath on holds (2 cm at 0.1 Hz, 0.15° yaw at 0.07 Hz) and desktop pointer parallax on
 *   exterior holds, both off with reduced motion and in e2e;
 * - the 1.5° lean through F1–F3 (the roll channel);
 * - portrait overrides and vFOV, and camera.setViewOffset for text zones and the plan view;
 * - fog-dives: a 2.5 m dolly going in, a snap to the emerge pose under full paper, a slower glide out;
 * - catch-up: lag above 25 m raises `lagFog` until it is under 5 m; a jump across the moon-gate
 *   cut outside its paper teleports under a flash of it;
 * - the door plane: `insideCabin`, the post group and its 400 ms crossfade;
 * - the mist wall waits: past the reveal, fog holds at the wall's peak until the grove is ready;
 * - the touch zoom on the G3 plan view (planZoom.ts): a narrower FOV and a moved principal point
 *   onto the palace the grove publishes, eased in and out, instant with reduced motion;
 * - compass mode (§9.9): `compassAction` glides the scroll into the plan view when it switches on
 *   and switches it off when the walk leaves the grove (CameraRig.tsx applies it).
 */

import { PerspectiveCamera, Vector2, Vector3 } from 'three'
import { damp, damp3 } from 'maath/easing'
import { journey, type JourneyState, type PostGroup } from '../store/journey'
import {
  BEATS,
  EMERGE,
  MARKS,
  RIG,
  SECTION_SPANS,
  beatAt,
  beatById,
  channelKeys,
  inHold,
  sampleScalar,
  type BeatId,
  type EmergePose,
} from '../world/journey'
import { cabin, hall, pathZone } from '../world/layout'
import { motion } from '../../theme/tokens'
import { buildCameraPath, sampleUnit, type CameraPath } from './path'
import { buildFraming, planViewport, projection, type Framing, type Viewport } from './framing'
import { planFocus, zoomLens, zoomToFill, type Lens, type PlanFocus } from './planZoom'

const DEG = Math.PI / 180
const TAU = Math.PI * 2

const KEYS = {
  fog: channelKeys('fog'),
  roll: channelKeys('roll'),
  up: channelKeys('up'),
  paper: channelKeys('paper'),
}

const PARALLAX_BEATS: ReadonlySet<BeatId> = new Set(RIG.parallaxBeats)

/** The hall interior begins where the camera crosses the door on the C4 dolly. */
const INTERIOR_FROM = BEATS.find((b) => b.id === 'C4')?.jvh[0] ?? 308

/** Seconds for the mist-wall hold to close in and to lift once the grove is ready. */
const MIST_HOLD = { rise: 0.2, fall: 0.6 }

/**
 * Design §8.5 P2: "if the grove isn't ready, the fog holds at peak while the DOM keeps scrolling".
 * 1 while the camera is past the reveal and the grove (chunk, glyphs or prewarm) is not ready.
 */
export function mistHoldTarget(jvh: number, groveReady: boolean): number {
  return !groveReady && jvh >= MARKS.reveal[0] && jvh < SECTION_SPANS.grove.jvh[1] ? 1 : 0
}

/** The G3 read hold: the plan view the touch zoom and compass mode work in. */
const G3 = beatById('G3')
const G3_HOLD = G3.hold ?? G3.jvh

/** What compass mode asks of the walk when the store changes (design.md §9.9). */
export interface CompassAction {
  /** Glide the scroll here (the G3 read hold) so the camera is over the dial. */
  readonly glideTo: number | null
  /** Switch compass mode off: the walk has left the grove. */
  readonly off: boolean
}

type CompassFields = Pick<JourneyState, 'jvh' | 'active' | 'mode' | 'compass' | 'dive'>

/**
 * Design §9.9: "The camera goes to the plan view", and "compass mode switches off when the visitor
 * leaves #grove". Switching compass mode on anywhere in the grove outside the G3 hold glides into the
 * hold, `RIG.compass.holdMargin` inside its nearer edge. Only the immersive walk has a camera.
 */
export function compassAction(s: CompassFields, prev: CompassFields): CompassAction {
  const none = { glideTo: null, off: false }
  if (s.mode !== 'immersive' || s.compass.status !== 'active') return none
  if (s.active !== 'grove') return { glideTo: null, off: true }
  if (prev.compass.status === 'active' || s.dive.phase !== 'idle') return none
  const [g0, g1] = SECTION_SPANS.grove.jvh
  const [a, z] = G3_HOLD
  if (s.jvh < g0 || s.jvh >= g1 || (s.jvh >= a && s.jvh <= z)) return none
  const m = RIG.compass.holdMargin
  return { glideTo: Math.min(Math.max(s.jvh, a + m), z - m), off: false }
}

/** Frame inputs the rig needs from R3F, kept narrow so the rig is easy to drive from a test or a still. */
export interface RigFrame {
  readonly camera: PerspectiveCamera
  readonly width: number
  readonly height: number
  /** Seconds since the last frame. */
  readonly delta: number
  /** Seconds, for breath. Ignored when the store clock is frozen. */
  readonly elapsed: number
  /** Normalised pointer, −1..1 (R3F state.pointer). */
  readonly pointer: Vector2
}

/** The damped camera state. maath keeps spring velocity on the animated objects, so a snap replaces them. */
function dampedState(pos: Vector3, look: Vector3, up: Vector3, lens: { fov: number; roll: number; sx: number; sy: number }) {
  return { pos: pos.clone(), look: look.clone(), up: up.clone(), lens: { ...lens } }
}

export class Rig {
  // Damped camera state, before breath and parallax.
  private d = dampedState(new Vector3(), new Vector3(0, 0, -1), new Vector3(0, 1, 0), { fov: 40, roll: 0, sx: 0, sy: 0 })
  private readonly sway = { breath: 0, yaw: 0, pitch: 0 }
  private readonly fog = { lag: 0, hold: 0 }
  /** Touch zoom progress 0..1 and the focus it zooms onto (kept while zooming back out). */
  private readonly zoom = { t: 0 }
  private zoomFocus: PlanFocus | null = null

  // Targets, reused every frame.
  private readonly tPos = new Vector3()
  private readonly tLook = new Vector3()
  private readonly tUp = new Vector3()
  private readonly tmp = new Vector3()

  private path: CameraPath | null = null
  private framing: Framing | null = null
  private header = 0
  private lastJvh = Number.NaN
  private lagging = false
  private postBlend = 0
  private primed = false
  private readonly applied = { fov: 0, aspect: 0, view: '' }

  /** Fixed header height in CSS px (desktop chrome, 0 on mobile), used by the plan-view fit. */
  setHeader(px: number): void {
    this.header = px
  }

  private ensureFraming(width: number, height: number): { path: CameraPath; framing: Framing } {
    const f = this.framing
    const v: Viewport = { width, height, header: this.header }
    if (!f || f.viewport.width !== v.width || f.viewport.height !== v.height || f.viewport.header !== v.header) {
      this.framing = buildFraming(v)
    }
    const framing = this.framing as Framing
    const p = this.path
    if (!p || p.variant.portrait !== framing.portrait || Math.abs(p.variant.hFit - framing.hFit) > 0.01) {
      this.path = buildCameraPath({ portrait: framing.portrait, hFit: framing.hFit })
    }
    return { path: this.path as CameraPath, framing }
  }

  /** Where the camera sits on the path at `jvh`, into the target vectors. */
  private sampleTargets(path: CameraPath, jvh: number): void {
    path.pos.sample(jvh, this.tPos)
    path.look.sample(jvh, this.tLook)
    sampleUnit(KEYS.up, jvh, this.tUp)
  }

  /** The emerge pose for a dive (§6.2) into the target vectors. */
  private sampleEmerge(path: CameraPath, e: EmergePose, arrival: number): void {
    this.sampleTargets(path, e.atJvh ?? arrival)
    if (e.pos) this.tPos.set(...e.pos)
    if (e.look) this.tLook.set(...e.look)
    if (e.back) {
      this.tmp.subVectors(this.tPos, this.tLook).normalize().multiplyScalar(e.back)
      this.tPos.add(this.tmp)
      this.tLook.add(this.tmp)
    }
  }

  /** Advance one frame. Returns true while anything is still moving (frameloop="demand" keeps asking for frames). */
  update(frame: RigFrame): boolean {
    const s = journey.getState()
    const { camera } = frame
    const dt = Math.min(Math.max(frame.delta, 0), RIG.maxDelta)
    const { path, framing } = this.ensureFraming(frame.width, frame.height)
    const jvh = s.jvh
    const diving = s.dive.phase !== 'idle'

    // ------------------------------------------------------------ targets
    const emerging = s.dive.phase === 'hold' && s.dive.to !== null
    if (emerging) this.sampleEmerge(path, EMERGE[s.dive.to ?? 'threshold'], jvh)
    else this.sampleTargets(path, jvh)
    if (s.dive.phase === 'in' && !s.reducedMotion) {
      // Dolly forward into the mist; the look target moves with it so the view doesn't turn.
      this.tmp.subVectors(this.tLook, this.tPos).normalize().multiplyScalar(RIG.diveDolly * s.dive.amount)
      this.tPos.add(this.tmp)
      this.tLook.add(this.tmp)
    }
    const fovTarget = sampleScalar(framing.fov, jvh)
    const rollTarget = sampleScalar(KEYS.roll, jvh)
    const sxTarget = sampleScalar(framing.shiftX, jvh)
    const syTarget = sampleScalar(framing.shiftY, jvh)

    // ------------------------------------------------------------ follow
    const crossedCut = Number.isFinite(this.lastJvh) && path.pos.cuts.some((c) => (this.lastJvh < c) !== (jvh < c))
    this.lastJvh = jvh
    const snap = !this.primed || s.snap || crossedCut || s.e2e
    let moving = false
    const st = this.d
    if (snap) {
      this.d = dampedState(this.tPos, this.tLook, this.tUp, { fov: fovTarget, roll: rollTarget, sx: sxTarget, sy: syTarget })
      this.primed = true
    } else {
      const t = RIG.damping
      const posTime = s.dive.phase === 'out' ? t.emerge : s.tier === 'low' ? t.positionLowTier : t.position
      moving = damp3(st.pos, this.tPos, posTime, dt) || moving
      moving = damp3(st.look, this.tLook, t.look, dt) || moving
      moving = damp3(st.up, this.tUp, t.look, dt) || moving
      st.up.normalize()
      moving = damp(st.lens, 'fov', fovTarget, t.fov, dt) || moving
      moving = damp(st.lens, 'roll', rollTarget, t.roll, dt) || moving
      moving = damp(st.lens, 'sx', sxTarget, t.shift, dt) || moving
      moving = damp(st.lens, 'sy', syTarget, t.shift, dt) || moving
    }
    const { pos, look, up, lens } = this.d

    // ------------------------------------------------------------ breath and parallax
    const still = s.reducedMotion || s.e2e || s.clock.frozen
    const time = s.clock.frozen ? s.clock.time : frame.elapsed
    const holding = !diving && inHold(jvh)
    const b = RIG.breath
    moving = damp(this.sway, 'breath', holding && !still ? 1 : 0, b.fade, dt) || moving
    const beat = beatAt(jvh)
    const parallaxOn = holding && !still && finePointer() && PARALLAX_BEATS.has(beat.id)
    const px = RIG.parallax
    moving = damp(this.sway, 'yaw', parallaxOn ? -frame.pointer.x * px.yawDeg * DEG : 0, px.smoothTime, dt) || moving
    moving = damp(this.sway, 'pitch', parallaxOn ? frame.pointer.y * px.pitchDeg * DEG : 0, px.smoothTime, dt) || moving
    const w = this.sway.breath
    const breathY = w * b.amplitude * Math.sin(TAU * b.hz * time)
    const breathYaw = w * b.yawDeg * DEG * Math.sin(TAU * b.yawHz * time)
    if (w > 0) moving = true

    // ------------------------------------------------------------ place the camera
    camera.position.copy(pos)
    camera.position.y += breathY
    // lookAt degenerates when up is parallel to the view (straight down with up still +Y).
    this.tmp.subVectors(look, pos).normalize()
    if (Math.abs(this.tmp.dot(up)) > 0.9999) camera.up.set(0, 0, -1)
    else camera.up.copy(up)
    camera.lookAt(look)
    camera.rotateY(this.sway.yaw + breathYaw)
    camera.rotateX(this.sway.pitch)
    // Positive roll leans right as the viewer sees it: clockwise about the view axis.
    camera.rotateZ(-lens.roll * DEG)

    // ------------------------------------------------------------ touch zoom (G3 plan view)
    const focus = planFocus()
    const zoomTarget = focus && !diving && jvh >= G3.jvh[0] && jvh < G3.jvh[1] ? 1 : 0
    if (focus) this.zoomFocus = focus
    if (snap || s.reducedMotion) this.zoom.t = zoomTarget
    else if (this.zoom.t !== zoomTarget) {
      damp(this.zoom, 't', zoomTarget, RIG.planZoom.smoothTime, dt)
      if (Math.abs(this.zoom.t - zoomTarget) < 1e-3) this.zoom.t = zoomTarget
      moving = true
    }
    if (this.zoom.t === 0 && !focus) this.zoomFocus = null
    this.applyProjection(camera, frame.width, frame.height, this.zoomed(camera, framing, lens))

    // ------------------------------------------------------------ catch-up fog
    const lag = pos.distanceTo(this.tPos)
    const c = RIG.catchUp
    if (diving || snap) this.lagging = false
    else if (lag > c.startLag) this.lagging = true
    else if (lag < c.clearLag) this.lagging = false
    const lagTarget = this.lagging ? Math.min(1, (lag - c.clearLag) / (c.startLag - c.clearLag)) : 0
    const paper = sampleScalar(KEYS.paper, jvh)
    if (s.e2e) this.fog.lag = 0
    else if (crossedCut && !s.snap && !diving && paper < 0.5) {
      // A jump across the moon-gate cut that didn't land in its paper (End key, scrollbar drag):
      // the camera teleports, so cover it with a flash of catch-up fog that clears as usual.
      this.fog.lag = 1
      moving = true
    } else if (snap) this.fog.lag = lagTarget
    else moving = damp(this.fog, 'lag', lagTarget, lagTarget > this.fog.lag ? c.rise : c.fall, dt) || moving

    const holdTarget = mistHoldTarget(jvh, s.ready.grove === true)
    if (s.e2e || snap) this.fog.hold = holdTarget
    else if (this.fog.hold !== holdTarget) {
      damp(this.fog, 'hold', holdTarget, holdTarget > this.fog.hold ? MIST_HOLD.rise : MIST_HOLD.fall, dt)
      if (Math.abs(this.fog.hold - holdTarget) < 1e-3) this.fog.hold = holdTarget
      moving = true
    }
    const beatFog = sampleScalar(KEYS.fog, jvh)
    const fogBase = beatFog + Math.max(0, pathZone.mistWall.fogPeak - beatFog) * this.fog.hold

    // ------------------------------------------------------------ the door plane and post
    const inside =
      jvh >= INTERIOR_FROM &&
      jvh < MARKS.stageSwap &&
      pos.z < cabin.door.planeZ &&
      pos.z > hall.floor.zSouth - 2
    const post: PostGroup = inside ? 'cabin' : 'ink'
    const blendTarget = inside ? 1 : 0
    if (s.e2e || snap) this.postBlend = blendTarget
    else if (this.postBlend !== blendTarget) {
      const step = (dt * 1000) / motion.doorPostBlend
      this.postBlend = blendTarget > this.postBlend ? Math.min(1, this.postBlend + step) : Math.max(0, this.postBlend - step)
      moving = true
    }

    this.write(s, {
      fogBase,
      paper,
      lagFog: this.fog.lag < 1e-3 ? 0 : this.fog.lag,
      insideCabin: inside,
      post,
      postBlend: this.postBlend,
    })
    return moving
  }

  /** The lens with the touch zoom applied: the focus slides to the chart viewport's centre as it grows to fill it. */
  private zoomed(camera: PerspectiveCamera, framing: Framing, lens: Lens): Lens {
    const f = this.zoomFocus
    if (!f || this.zoom.t <= 0) return lens
    camera.updateMatrixWorld()
    const p = this.tmp.set(f.x, f.y, f.z).applyMatrix4(camera.matrixWorldInverse)
    const depth = -p.z
    if (depth < RIG.near) return lens
    const vp = framing.viewport
    const view = planViewport(vp, framing.portrait)
    const fill = RIG.planZoom.fill * Math.min(view.width, view.height)
    const zoom = Math.min(RIG.planZoom.max, Math.max(1, zoomToFill(vp.height, lens.fov, depth, f.size, fill)))
    const centre = { x: vp.width * (0.5 + view.shiftX), y: vp.height * (0.5 + view.shiftY) }
    return zoomLens(vp.width, vp.height, lens, { x: p.x / depth, y: p.y / depth }, zoom, centre, this.zoom.t)
  }

  private applyProjection(camera: PerspectiveCamera, width: number, height: number, lens: Lens): void {
    const p = projection(width, height, lens.fov, lens.sx, lens.sy)
    const viewKey = p.view ? p.view.map((v) => v.toFixed(2)).join(',') : ''
    const a = this.applied
    // R3F resets aspect on resize, so compare against the camera, not only against what we last set.
    if (Math.abs(a.fov - p.fov) < 1e-4 && Math.abs(camera.aspect - p.aspect) < 1e-6 && a.view === viewKey && camera.fov === a.fov) return
    camera.fov = p.fov
    camera.aspect = p.aspect
    if (p.view) camera.setViewOffset(...p.view)
    else camera.clearViewOffset()
    if (camera.near !== RIG.near || camera.far !== RIG.far) {
      camera.near = RIG.near
      camera.far = RIG.far
    }
    camera.updateProjectionMatrix()
    a.fov = p.fov
    a.aspect = p.aspect
    a.view = viewKey
  }

  private write(
    s: JourneyState,
    next: Pick<JourneyState, 'fogBase' | 'paper' | 'lagFog' | 'insideCabin' | 'post' | 'postBlend'>,
  ): void {
    const patch: Partial<JourneyState> = {}
    if (Math.abs(s.fogBase - next.fogBase) > 1e-6) patch.fogBase = next.fogBase
    if (Math.abs(s.paper - next.paper) > 1e-4) patch.paper = next.paper
    if (Math.abs(s.lagFog - next.lagFog) > 1e-4 || (next.lagFog === 0 && s.lagFog !== 0)) patch.lagFog = next.lagFog
    if (s.insideCabin !== next.insideCabin) patch.insideCabin = next.insideCabin
    if (s.post !== next.post) patch.post = next.post
    if (Math.abs(s.postBlend - next.postBlend) > 1e-4 || (next.postBlend !== s.postBlend && (next.postBlend === 0 || next.postBlend === 1)))
      patch.postBlend = next.postBlend
    if (s.snap) patch.snap = false
    if (Object.keys(patch).length > 0) journey.setState(patch)
  }
}

let fine: MediaQueryList | null = null
/** Desktop pointer: parallax is off on touch (§6.3). */
function finePointer(): boolean {
  fine ??= typeof matchMedia === 'function' ? matchMedia('(hover: hover) and (pointer: fine)') : null
  return fine?.matches ?? false
}
