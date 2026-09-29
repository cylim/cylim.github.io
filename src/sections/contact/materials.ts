import {
  Color,
  CustomBlending,
  DoubleSide,
  OneFactor,
  OneMinusSrcAlphaFactor,
  ShaderMaterial,
  SrcAlphaFactor,
  Vector2,
  Vector3,
  Vector4,
  ZeroFactor,
  type IUniform,
  type Texture,
} from 'three'
import { PAINTER_LIGHT } from '../../core/world/layout'
import { alpha, color } from '../../theme/tokens'
import carvedFrag from './glsl/carved.frag.glsl'
import flameFrag from './glsl/flame.frag.glsl'
import flameVert from './glsl/flame.vert.glsl'
import noiseGlsl from './glsl/noise.glsl'
import poolFrag from './glsl/pool.frag.glsl'
import uvVert from './glsl/uv.vert.glsl'

/**
 * The contact scene's own shaders, alpha-blended over the ink world and never writing depth, so the
 * ink pass fogs them by the stone or ground behind them. Built imperatively so the uniform objects
 * stay ours to write each frame.
 *
 * The stored alpha matters: the ink pass reads alpha < 0.5 as "leave this pixel alone" (the cabin
 * interior flag, core/render/post/interior.ts). The pool and the board carving keep it at 1 (alpha takes
 * Zero·src + One·dst). The flame clears it where its body is solid (One−srcAlpha·dst): seen through
 * the chamber's openings there is nothing near behind it, and the fog would erase it to paper.
 */
function blended<U extends Record<string, IUniform>>(
  name: string,
  vertexShader: string,
  fragmentShader: string,
  uniforms: U,
  clearsAlpha = false,
) {
  return new ShaderMaterial({
    name,
    vertexShader,
    fragmentShader,
    uniforms,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    blending: CustomBlending,
    blendSrc: SrcAlphaFactor,
    blendDst: OneMinusSrcAlphaFactor,
    blendSrcAlpha: ZeroFactor,
    blendDstAlpha: clearsAlpha ? OneMinusSrcAlphaFactor : OneFactor,
  }) as ShaderMaterial & { uniforms: U }
}

export function createFlameMaterial(centre: readonly [number, number, number], size: readonly [number, number]) {
  return blended('lantern-flame', flameVert, `${noiseGlsl}\n${flameFrag}`, {
    uCentre: { value: new Vector3(...centre) },
    uSize: { value: new Vector2(...size) },
    uLean: { value: new Vector3() },
    uCore: { value: new Color(color.lanternCore) },
    uFlame: { value: new Color(color.lanternFlame) },
    uLevel: { value: 1 },
    uAlpha: { value: 1 },
    uTime: { value: 0 },
  }, true)
}
export type FlameMaterial = ReturnType<typeof createFlameMaterial>

export function createPoolMaterial() {
  const opacity: number = alpha.lanternPool
  return blended('lantern-pool', uvVert, `${noiseGlsl}\n${poolFrag}`, {
    uColor: { value: new Color(color.lanternHalo) },
    uOpacity: { value: opacity },
  })
}
export type PoolMaterial = ReturnType<typeof createPoolMaterial>

type Vec4 = readonly [number, number, number, number]

export function createCarvedMaterial(map: Texture, texel: readonly [number, number], rowV0: Vec4, rowV1: Vec4) {
  const mat = blended('signpost-carving', uvVert, carvedFrag, {
    uMap: { value: map },
    uTexel: { value: new Vector2(...texel) },
    uLight: { value: new Vector3(...PAINTER_LIGHT).normalize() },
    uInk: { value: new Color(color.inkJiao) },
    uLit: { value: new Color(color.paperLight) },
    uWarm: { value: new Color(color.lanternHalo) },
    uGrain: { value: 0.4 },
    uRowV0: { value: new Vector4(...rowV0) },
    uRowV1: { value: new Vector4(...rowV1) },
    uGlow: { value: new Vector4() },
  })
  // The face overlay sits a few millimetres proud of the boards; pull it forward in depth as well.
  mat.polygonOffset = true
  mat.polygonOffsetFactor = -2
  mat.polygonOffsetUnits = -2
  return mat
}
export type CarvedMaterial = ReturnType<typeof createCarvedMaterial>
