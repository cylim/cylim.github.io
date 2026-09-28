import type { RootState } from '@react-three/fiber'
import { BlendFunction, BloomEffect, ToneMappingEffect, ToneMappingMode, type EffectComposer } from 'postprocessing'
import type { Camera } from 'three'
import { journey, type Tier } from '../../store/journey'
import { TIERS } from '../quality'
import { hurryReveal, isRevealing, revealThreshold } from '../reveal'
import { motionTime, shaderTime } from '../time'
import { getPaperGrain } from '../textures/paperGrain'
import { makeInkRamp } from '../textures/inkRamp'
import { motion } from '../../../theme/tokens'
import { FinishEffect } from './FinishEffect'
import { InkEffect } from './InkEffect'
import { lanternFlicker } from './glints'
import { POST, autoFlatten, finaleMistWeight, fogBreath, forestDepth, forestFogTint, postFx, understoreyMist } from './postFx'

let ramp: ReturnType<typeof makeInkRamp> | null = null
const inkRampTexture = () => (ramp ??= makeInkRamp())

/**
 * The effects of both post groups and their per-frame inputs. One instance per PostStack mount;
 * `frame()` copies the journey store and `postFx` into uniforms before the composer renders.
 */
export class PostRig {
  readonly ink: InkEffect
  /** Null on low tier: the cabin fakes its glow with additive halo sprites (design.md §7.4). */
  readonly bloom: BloomEffect | null
  /** NORMAL blending, so AgX fades in with postBlend instead of snapping on at the door. */
  readonly tone = new ToneMappingEffect({ mode: ToneMappingMode.AGX, blendFunction: BlendFunction.NORMAL })
  readonly finish = new FinishEffect(getPaperGrain())
  private lastJvh = -1
  private scissored = false

  constructor(camera: Camera, tier: Tier) {
    this.ink = new InkEffect(camera, getPaperGrain(), inkRampTexture())
    const levels = TIERS[tier].bloomLevels
    this.bloom =
      levels > 0
        ? new BloomEffect({
            mipmapBlur: true,
            luminanceThreshold: POST.bloom.threshold,
            luminanceSmoothing: POST.bloom.smoothing,
            intensity: 0,
            radius: POST.bloom.radius,
            levels,
          })
        : null
  }

  frame(state: RootState): void {
    const s = journey.getState()
    const t = shaderTime(state.clock.elapsedTime, s)
    const mt = motionTime(state.clock.elapsedTime, s)
    const cfg = TIERS[s.tier]
    const now = performance.now()

    if (isRevealing() && this.lastJvh >= 0 && s.jvh !== this.lastJvh) hurryReveal(now, motion.canvas.revealSkip)
    this.lastJvh = s.jvh

    // The moon gate whiteout runs through the same dissolve as a fog-dive (design.md §11.2).
    const dive = Math.max(s.dive.amount, s.paper)

    const u = this.ink.u
    const density = s.fogBase * cfg.fogMultiplier * fogBreath(s.jvh, mt, s.fogBase)
    u.uFog.value.set(density, postFx.fogHeightFalloff, postFx.fogFloor, postFx.fogNoise)
    u.uAerial.value.set(postFx.aerial, density * POST.aerialRate * (1 + POST.forestAerial * forestDepth(s.jvh)))
    // lagFog is 0..1 "how much paper"; as a density it reaches solid paper a few metres out at 1.
    u.uFogBoost.value = s.lagFog * POST.lagFog + postFx.fogBoost + dive * POST.diveFog
    u.uDrift.value.set(postFx.wind[0] * mt, postFx.wind[1] * mt, postFx.wind[2] * mt)
    u.uInkMix.value = 1 - s.postBlend
    u.uEdges.value = cfg.inkEdges ? 1 : 0
    u.uWobble.value = cfg.inkBoil ? 1 : 0
    u.uBoil.value = Math.floor(mt * 8)
    u.uDive.value = dive
    u.uFlatten.value = postFx.flatten ?? autoFlatten(s.jvh)
    u.uFinale.value = finaleMistWeight(s.jvh)
    u.uFogTint.value = forestFogTint(s.jvh)
    u.uUnder.value.x = understoreyMist(s.jvh)
    u.uReveal.value = revealThreshold(now)
    u.uTime.value = t
    this.ink.jvh = s.jvh
    this.ink.fog = s.fogBase + postFx.fogBoost
    this.ink.flicker = s.reducedMotion ? 1 : lanternFlicker(t)

    const f = this.finish.u
    f.uDive.value = dive
    f.uTime.value = t
    f.uGrainAmt.value = POST.finishGrain * s.postBlend
    // Film grain re-rolls at 24 fps; under reduced motion it holds still.
    const step = Math.floor(mt * 24)
    f.uGrainOffset.value.set(((step * 0.618034) % 1) * 7, ((step * 0.414214) % 1) * 7)

    this.tone.blendMode.opacity.value = s.postBlend
    if (this.bloom) this.bloom.intensity = cfg.bloomLevels > 0 ? POST.bloom.intensity * s.postBlend : 0
  }

  /**
   * postFx.scissor (design.md §8.7 E2): while the finale's mount panels cover all but the album
   * window, the scene pass, the ink pass and the final blit touch only the window's pixels. The
   * composer's buffers reset their scissor when they resize, so an active rect is re-applied every
   * frame; switching it off happens once.
   */
  scissor(state: RootState, composer: EffectComposer | null): void {
    const r = postFx.scissor
    const { gl, size } = state
    const buffers = composer ? [composer.inputBuffer, composer.outputBuffer] : []
    if (!r) {
      if (!this.scissored) return
      this.scissored = false
      gl.setScissorTest(false)
      for (const b of buffers) b.scissorTest = false
      return
    }
    this.scissored = true
    const x = Math.max(0, Math.floor(r.x))
    const top = Math.max(0, Math.floor(r.y))
    const w = Math.max(0, Math.min(size.width, Math.ceil(r.x + r.w)) - x)
    const h = Math.max(0, Math.min(size.height, Math.ceil(r.y + r.h)) - top)
    // CSS rects run top-down; GL scissors run bottom-up.
    const y = size.height - top - h
    gl.setScissor(x, y, w, h)
    gl.setScissorTest(true)
    for (const b of buffers) {
      const k = b.width / Math.max(size.width, 1)
      b.scissor.set(Math.floor(x * k), Math.floor(y * k), Math.ceil(w * k), Math.ceil(h * k))
      b.scissorTest = true
    }
  }

  dispose(): void {
    this.ink.dispose()
    this.bloom?.dispose()
    this.tone.dispose()
    this.finish.dispose()
  }
}
