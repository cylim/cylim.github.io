import { BlendFunction, Effect, EffectAttribute } from 'postprocessing'
import {
  Color,
  Matrix4,
  PerspectiveCamera,
  Uniform,
  Vector2,
  Vector3,
  Vector4,
  type Camera,
  type Texture,
  type WebGLRenderer,
  type WebGLRenderTarget,
} from 'three'
import noiseGlsl from '../glsl/noise.glsl'
import colorGlsl from '../glsl/color.glsl'
import inkFogGlsl from '../glsl/inkFog.glsl'
import dissolveGlsl from '../glsl/dissolve.glsl'
import inkFrag from './ink.frag.glsl'
import { color, inkRamp } from '../../../theme/tokens'
import { exit } from '../../world/layout'
import { GRAIN_SIZE } from '../textures/paperGrain'
import { glintFrame, glintSlots, type GlintSlot } from './glints'
import { POST } from './postFx'

const FOG_UNIFORMS = 'uniform vec4 uFog;\nuniform float uFogBoost;\nuniform vec3 uDrift;\nuniform vec2 uAerial;\n'

/** sRGB luma of a hex colour, on encoded values (what the ramp stops are placed on). */
export function srgbLumaOfHex(hex: string): number {
  const n = Number.parseInt(hex.replace('#', ''), 16)
  return (0.2126 * ((n >> 16) & 0xff) + 0.7152 * ((n >> 8) & 0xff) + 0.0722 * (n & 0xff)) / 255
}

/** Stops and band edges for the uFlatten hard-step ramp: the four inner stops and their midpoints. */
export function rampBands(stops: readonly (readonly [number, string])[] = inkRamp) {
  const at = stops.map((s) => s[0]).toSorted((a, b) => a - b)
  const s = (i: number) => at[i] ?? 1
  const mid = (i: number) => (s(i) + s(i + 1)) / 2
  return {
    stops: new Vector4(s(1), s(2), s(3), s(4)),
    edges: new Vector4(mid(0), mid(1), mid(2), mid(3)),
    paper: mid(4),
  }
}

const v4 = (a: readonly number[], fill: number) => new Vector4(a[0] ?? fill, a[1] ?? fill, a[2] ?? fill, a[3] ?? fill)

/** The four finale belts as vec4s (centre z, half width, top), from layout.exit.mistBelts. */
function beltUniforms() {
  const { z, halfWidth, top } = exit.mistBelts
  // A missing belt sits far outside the world with no width, so it never shows.
  return { z: v4(z, 1e5), w: v4(halfWidth, 1e-3), top: v4(top, 0) }
}

const glintUniforms = (i: GlintSlot) => ({
  at: new Uniform(new Vector4(0, 0, 0, 0)),
  size: new Uniform(new Vector3(1, 5, 0.35)),
  core: new Uniform(glintSlots[i].coreColor),
  halo: new Uniform(glintSlots[i].haloColor),
})

function makeUniforms(grain: Texture, ramp: Texture) {
  const paper = new Color(color.paper)
  const shade = new Color(color.paperShade)
  const bands = rampBands()
  const g0 = glintUniforms(0)
  const g1 = glintUniforms(1)
  const belts = beltUniforms()
  return {
    uGrain: new Uniform(grain),
    uRamp: new Uniform(ramp),
    uPaper: new Uniform(paper),
    uPaperLight: new Uniform(new Color(color.paperLight)),
    uShadeRatio: new Uniform(new Vector3(shade.r / paper.r, shade.g / paper.g, shade.b / paper.b)),
    uInk: new Uniform(new Color(color.inkJiao)),
    uProjInv: new Uniform(new Matrix4()),
    uCamWorld: new Uniform(new Matrix4()),
    uPaperLuma: new Uniform(srgbLumaOfHex(color.paper)),
    uFog: new Uniform(new Vector4(0.04, 0.16, 0, 0.35)),
    uFogBoost: new Uniform(0),
    uDrift: new Uniform(new Vector3()),
    uAerial: new Uniform(new Vector2(POST.aerial, 0)),
    uInkMix: new Uniform(1),
    uEdges: new Uniform(1),
    uWobble: new Uniform(0),
    uBoil: new Uniform(0),
    uBleed: new Uniform<number>(POST.bleed),
    uGrainAmp: new Uniform(new Vector3(...POST.grain)),
    uGrainScale: new Uniform(1 / GRAIN_SIZE),
    uPixelRatio: new Uniform(1),
    uVignette: new Uniform<number>(POST.vignette),
    uDive: new Uniform(0),
    uFlatten: new Uniform(0),
    uBands: new Uniform<number>(POST.bands),
    uEdge: new Uniform(new Vector3(POST.edge.strength, POST.edge.from, POST.edge.to)),
    uEdgeFalloff: new Uniform(new Vector4(POST.edgeFalloff.near, POST.edgeFalloff.farAt, POST.edgeFalloff.far, POST.edgeFalloff.breaks)),
    uFinale: new Uniform(0),
    uFinaleMist: new Uniform(new Vector4(POST.finaleMist.aerial, POST.finaleMist.rate, POST.finaleMist.belt, POST.finaleMist.start)),
    uBeltZ: new Uniform(belts.z),
    uBeltW: new Uniform(belts.w),
    uBeltTop: new Uniform(belts.top),
    uLedge: new Uniform(new Vector2(exit.ledgeZ, exit.beyondLedgeY)),
    uFogTint: new Uniform(0),
    uUnder: new Uniform(new Vector4(0, POST.understorey.amount, POST.understorey.from, POST.understorey.to)),
    uFogTintDist: new Uniform(new Vector2(...POST.fogTintDistance)),
    uReveal: new Uniform(0),
    uTime: new Uniform(0),
    uBandStops: new Uniform(bands.stops),
    uBandEdges: new Uniform(bands.edges),
    uBandPaper: new Uniform(bands.paper),
    uGlint0: g0.at,
    uGlint0Size: g0.size,
    uGlint0Core: g0.core,
    uGlint0Halo: g0.halo,
    uGlint1: g1.at,
    uGlint1Size: g1.size,
    uGlint1Core: g1.core,
    uGlint1Halo: g1.halo,
  }
}

export type InkUniforms = ReturnType<typeof makeUniforms>

/**
 * The outdoor ink pass (stack.md §5, design.md §7). One postprocessing Effect with depth:
 * fog to paper, ink ramp, contours, bleed, grain, vignette, glints, the develop reveal and the
 * fog-dive dissolve. Pixels with alpha < 0.5 are interior and skip the painting (see interior.ts).
 *
 * PostStack writes the per-frame uniforms (`u.*.value`) from the journey store and `postFx`;
 * `update()` only copies camera matrices and projects the glints, because those must be read
 * after the render pass has updated the camera.
 */
export class InkEffect extends Effect {
  readonly u: InkUniforms
  /** Scroll position and lantern flicker for the glint rules; PostStack sets them each frame. */
  jvh = 0
  flicker = 1
  /** Outdoor fog density before the tier multiplier; the lantern glint goes out in the mist wall. */
  fog = 0
  private readonly camera: Camera
  private readonly camPos = new Vector3()
  private readonly tmp = new Vector3()

  constructor(camera: Camera, grain: Texture, ramp: Texture) {
    const u = makeUniforms(grain, ramp)
    super('InkEffect', `${FOG_UNIFORMS}${noiseGlsl}\n${colorGlsl}\n${inkFogGlsl}\n${dissolveGlsl}\n${inkFrag}`, {
      attributes: EffectAttribute.DEPTH,
      blendFunction: BlendFunction.SRC,
      uniforms: new Map<string, Uniform>(Object.entries(u)),
    })
    this.u = u
    this.camera = camera
  }

  override update(renderer: WebGLRenderer, _inputBuffer: WebGLRenderTarget, _deltaTime?: number): void {
    const cam = this.camera
    this.u.uProjInv.value.copy(cam.projectionMatrixInverse)
    this.u.uCamWorld.value.copy(cam.matrixWorld)
    const pr = renderer.getPixelRatio()
    this.u.uPixelRatio.value = pr
    this.u.uGrainScale.value = 1 / (GRAIN_SIZE * pr)
    this.camPos.setFromMatrixPosition(cam.matrixWorld)
    this.projectGlint(0, this.u.uGlint0.value, this.u.uGlint0Size.value, pr)
    this.projectGlint(1, this.u.uGlint1.value, this.u.uGlint1Size.value, pr)
  }

  private projectGlint(slot: GlintSlot, at: Vector4, size: Vector3, pr: number): void {
    const g = glintSlots[slot]
    const f = glintFrame(slot, g, this.camPos.distanceTo(g.pos), this.jvh, this.flicker, this.fog)
    at.w = 0
    if (f.alpha <= 0.001) return
    const v = this.tmp.copy(g.pos).applyMatrix4(this.camera.matrixWorldInverse)
    const viewDepth = -v.z
    const near = this.camera instanceof PerspectiveCamera ? this.camera.near : 0.1
    if (viewDepth <= near) return
    v.applyMatrix4(this.camera.projectionMatrix)
    const x = v.x * 0.5 + 0.5
    const y = v.y * 0.5 + 0.5
    if (x < -0.02 || x > 1.02 || y < -0.02 || y > 1.02) return
    at.set(x, y, viewDepth, Math.min(f.alpha, 1))
    size.set(f.core * 0.5 * pr, g.halo * pr, g.haloAlpha)
  }
}
