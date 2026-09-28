import {
  AddEquation,
  CustomBlending,
  OneFactor,
  OneMinusSrcAlphaFactor,
  SrcAlphaFactor,
  ZeroFactor,
  type Material,
} from 'three'

/**
 * The interior alpha flag (design.md §7.3.1).
 *
 * The ink pass fogs everything by depth. The hall seen through the open cabin door sits 15 to
 * 45 m away, so without a flag the outdoor fog would erase it to paper. The contract:
 *
 * - The clear alpha is 1 and every ink-world material writes alpha 1 (three's default for
 *   opaque materials). Those pixels get fog, ramp, contours, grain and vignette.
 * - Every interior material leaves alpha 0 in the colour buffer. InkEffect skips fog, ramp,
 *   edges, grain and vignette wherever `inputColor.a < 0.5`; glints, the dive dissolve and
 *   dither still apply.
 * - The flag lives only between the render pass and the first post pass. InkEffect and
 *   FinishEffect both write alpha 1, because three always creates an alpha canvas (Canvas
 *   `gl.alpha: false` is only emulated by the clear) and alpha 0 would composite over the page.
 *
 * How to comply:
 * - Custom ShaderMaterial, opaque: write `gl_FragColor.a = 0.0` and leave `blending` at the
 *   default with `transparent: false` (three then disables blending, so the 0 is stored as is).
 * - Built-in materials (MeshBasicMaterial, LineBasicMaterial, …): three forces alpha to 1 on
 *   opaque materials, so call `markInterior(material, 'opaque')`: it keeps the colour and
 *   blends the stored alpha to 0.
 * - Additive glow (traces, halos, dust): `markInterior(material, 'additive')` adds colour and
 *   leaves the stored alpha untouched (`blendSrcAlpha = Zero`, `blendDstAlpha = One`).
 * - Alpha-blended surfaces (scroll silk, interior text): `markInterior(material, 'blend')`,
 *   same alpha rule, colour blended by source alpha.
 *
 * Draw the night shell (design.md §8.4) as interior too, so the door never shows paper where
 * the hall has no geometry. Changing blending on a live material is a state change, not a
 * recompile, but set it once when the material is created.
 */
export type InteriorMode = 'opaque' | 'additive' | 'blend'

export function markInterior<M extends Material>(material: M, mode: InteriorMode = 'opaque'): M {
  material.blending = CustomBlending
  material.blendEquation = AddEquation
  material.blendEquationAlpha = AddEquation
  if (mode === 'opaque') {
    material.blendSrc = OneFactor
    material.blendDst = ZeroFactor
    material.blendSrcAlpha = ZeroFactor
    material.blendDstAlpha = ZeroFactor
    material.transparent = false
  } else {
    material.blendSrc = mode === 'additive' ? OneFactor : SrcAlphaFactor
    material.blendDst = mode === 'additive' ? OneFactor : OneMinusSrcAlphaFactor
    material.blendSrcAlpha = ZeroFactor
    material.blendDstAlpha = OneFactor
    material.transparent = true
  }
  material.needsUpdate = true
  return material
}
