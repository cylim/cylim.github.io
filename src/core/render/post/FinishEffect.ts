import { BlendFunction, Effect } from 'postprocessing'
import { Color, Uniform, Vector2, type Texture, type WebGLRenderer, type WebGLRenderTarget } from 'three'
import noiseGlsl from '../glsl/noise.glsl'
import colorGlsl from '../glsl/color.glsl'
import dissolveGlsl from '../glsl/dissolve.glsl'
import finishFrag from './finish.frag.glsl'
import { color } from '../../../theme/tokens'
import { GRAIN_SIZE } from '../textures/paperGrain'
import { POST } from './postFx'

function makeUniforms(grain: Texture) {
  return {
    uGrain: new Uniform(grain),
    uGrainScale: new Uniform(1 / GRAIN_SIZE),
    uGrainOffset: new Uniform(new Vector2()),
    uGrainAmt: new Uniform<number>(POST.finishGrain),
    uDive: new Uniform(0),
    uDither: new Uniform<number>(POST.dither),
    uTime: new Uniform(0),
    uPaper: new Uniform(new Color(color.paper)),
    uPaperLight: new Uniform(new Color(color.paperLight)),
  }
}

export type FinishUniforms = ReturnType<typeof makeUniforms>

/** Last effect of the cabin group, after Bloom and AgX tone mapping (design.md §7.4). */
export class FinishEffect extends Effect {
  readonly u: FinishUniforms

  constructor(grain: Texture) {
    const u = makeUniforms(grain)
    super('FinishEffect', `${noiseGlsl}\n${colorGlsl}\n${dissolveGlsl}\n${finishFrag}`, {
      blendFunction: BlendFunction.SRC,
      uniforms: new Map<string, Uniform>(Object.entries(u)),
    })
    this.u = u
  }

  override update(renderer: WebGLRenderer, _inputBuffer: WebGLRenderTarget, _deltaTime?: number): void {
    this.u.uGrainScale.value = 1 / (GRAIN_SIZE * renderer.getPixelRatio())
  }
}
