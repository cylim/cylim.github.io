import { DoubleSide, FrontSide, ShaderMaterial, Vector2, type IUniform } from 'three'
import cunGlsl from '../glsl/cun.glsl'
import fragGlsl from '../glsl/ink.frag.glsl'
import vertGlsl from '../glsl/ink.vert.glsl'
import lightGlsl from '../glsl/light.glsl'
import noiseGlsl from '../glsl/noise.glsl'
import { NEEDLE_ATLAS, needleAtlasTexture } from '../pines/needleAtlas'
import { worldUniforms } from './uniforms'

/** Tiers that draw a material's 皴 strokes (design §13.3): every tier, medium and up, high only. */
export type CunClass = 'hero' | 'stone' | 'earth'
const CUN_CLASS: Record<CunClass, number> = { hero: 0, stone: 1, earth: 2 }

export interface InkMaterialOptions {
  /** Ink weight 0 (清) to 1 (焦). Instanced meshes multiply it per instance with the `iInk` attribute. Default 0.8. */
  inkWeight?: number
  /** 皴 strokes on the shaded side: 'axe' (斧劈, rock, peak, stele) or 'hemp' (披麻, earth banks). */
  cun?: 'axe' | 'hemp'
  /** Which tiers draw the strokes. Default 'stone'. */
  cunClass?: CunClass
  /** Stroke size in metres. Default 0.35. */
  cunScale?: number
  /** Stroke opacity 0..1. Default 0.7. */
  cunStrength?: number
  /** Vertex sway by the `swayW` attribute (pine pads). Off with reduced motion via uMotion. */
  sway?: boolean
  /** With `needles`: each needle card erodes its silhouette a little differently. */
  ragged?: boolean
  /**
   * Pines from `buildPine`: pads (`rim` ≥ 0) are needle cards drawn from the shared needle atlas
   * and opened toward the camera; wood gets the painted trunk tone and a light 鳞皴.
   */
  needles?: boolean
  /** Hero pines: full 鳞皴 Voronoi bark on wood (`rim` < 0), reading `uv` as (around 0..1, up in metres). */
  bark?: boolean
  /** Render both faces (normals flip on back faces). Default true: most ink props are thin or open. */
  doubleSided?: boolean
  name?: string
}

/** Uniforms each ink material owns (the rest are the shared `worldUniforms`). */
export interface InkMaterialUniforms {
  uInkWeight: IUniform<number>
  uCunClass: IUniform<number>
  uCunScale: IUniform<number>
  uCunStrength: IUniform<number>
}

export type InkMaterial = ShaderMaterial & { uniforms: InkMaterialUniforms & typeof worldUniforms }

/**
 * Shared fragment prelude: the world uniforms (uTime, uMotion, uCunLevel, light, lantern, spill),
 * noise and 皴 strokes. Fragment bodies must not redeclare them.
 */
export function inkPrelude(): string {
  return [lightGlsl, noiseGlsl, cunGlsl].join('\n')
}

/**
 * Values for ink.vert.glsl's optional attributes when a geometry lacks them: no AO, no sway, wood
 * (not a pad), full ink, seed 0. Three binds these with vertexAttrib*, so props need no extra buffers.
 */
export function applyInkAttributeDefaults(mat: ShaderMaterial): void {
  Object.assign(mat.defaultAttributeValues, { ao: [1], swayW: [0], rim: [-1], iInk: [1], iSeed: [0], card: [0, 0, 0, 0], cardSize: [0, 0, 0] })
}

/** The needle atlas uniforms a pine material samples (shared texture, one per page). */
function needleUniforms(): Record<string, IUniform> {
  const tex = needleAtlasTexture()
  return {
    uNeedles: { value: tex },
    uNeedleSize: { value: new Vector2(tex.image.width, tex.image.height) },
    uNeedleGrid: { value: new Vector2(NEEDLE_ATLAS.cols, NEEDLE_ATLAS.rows) },
  }
}

/**
 * Defines every env shader gets. None today (the wave-1 ?envTest preview define is gone); kept so
 * sections that build their own ink-world shaders stay in step if one is ever added.
 */
export function baseDefines(): Record<string, string | number> {
  return {}
}

/**
 * The ink world's surface material (design.md §7.1): an unlit ShaderMaterial with the fixed
 * painter's light, wrapped Lambert, per-object ink weight, baked vertex AO, 皴 strokes on the
 * shaded side, the lantern warm term and the cabin door's cyan spill. Outdoor: writes alpha 1.
 *
 * Create it imperatively (useMemo, or `useInkMaterial`) and pass it with `material={mat}`, so the
 * shared world uniforms stay shared. Never `.clone()` it: cloning deep-copies uniforms.
 * Change the ink weight at runtime through `mat.uniforms.uInkWeight.value`.
 */
export function createInkMaterial(opts: InkMaterialOptions = {}): InkMaterial {
  const defines: Record<string, string | number> = baseDefines()
  if (opts.cun) defines.CUN_MODE = opts.cun === 'axe' ? 0 : 1
  if (opts.sway) defines.INK_SWAY = ''
  if (opts.ragged) defines.INK_RAGGED = ''
  if (opts.needles) defines.INK_NEEDLES = ''
  if (opts.bark) defines.INK_BARK = ''

  const own: InkMaterialUniforms = {
    uInkWeight: { value: opts.inkWeight ?? 0.8 },
    uCunClass: { value: CUN_CLASS[opts.cunClass ?? 'stone'] },
    uCunScale: { value: opts.cunScale ?? 0.35 },
    uCunStrength: { value: opts.cunStrength ?? 0.7 },
  }
  const mat = new ShaderMaterial({
    name: opts.name ?? 'ink',
    vertexShader: vertGlsl,
    fragmentShader: `${inkPrelude()}\n${fragGlsl}`,
    uniforms: { ...worldUniforms, ...own, ...(opts.needles ? needleUniforms() : {}) },
    defines,
    side: opts.doubleSided === false ? FrontSide : DoubleSide,
  })
  applyInkAttributeDefaults(mat)
  return mat as InkMaterial
}
