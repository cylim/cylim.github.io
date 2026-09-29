import { configureTextBuilder, preloadFont } from 'troika-three-text'
import { MeshBasicMaterial, type ColorRepresentation } from 'three'
import { fontFiles } from '../../theme/tokens'
import { markInterior } from '../render/post/interior'

/**
 * 3D text setup (stack.md §7, design.md §3). Importing this module configures troika once, with
 * the self-hosted subset fonts from public/fonts (tooling writes them; names in tokens.fontFiles).
 * Cabin and grove text components import it before creating any Text.
 *
 * troika parses woff, ttf and otf but not woff2, so 3D text uses the `.woff` twin of each face.
 */
export const TEXT_FONTS = {
  display: fontFiles.display600.woff,
  body: fontFiles.body400.woff,
  bodySemibold: fontFiles.body600.woff,
  cjk: fontFiles.cjk.woff,
  cjkDisplay: fontFiles.cjkDisplay.woff,
  mono: fontFiles.mono.woff,
} as const

export type TextFont = keyof typeof TEXT_FONTS

/** SDF sizes: 64 for labels; 128 for the few large hero glyphs, whose thin strokes (螣, 蓬) break up at 64. */
export const SDF_GLYPH_SIZE = { label: 64, hero: 128 } as const

let configured = false

/** Idempotent. Runs on import; exported for tests and for code that wants to be explicit. */
export function configureText(): void {
  if (configured) return
  configured = true
  // unicodeFontsURL stays troika's default as a safety net; the CI glyph check keeps it from firing.
  configureTextBuilder({ defaultFontURL: TEXT_FONTS.body, sdfGlyphSize: SDF_GLYPH_SIZE.label })
}

configureText()

/**
 * Build the SDF atlas for `characters` ahead of time, e.g. during a fog-dive (design.md §11.1),
 * so labels never pop in. Resolves when the glyphs are ready.
 */
export function preloadText(font: TextFont, characters: string, sdfGlyphSize: number = SDF_GLYPH_SIZE.label): Promise<void> {
  return new Promise((resolve) => preloadFont({ font: TEXT_FONTS[font], characters, sdfGlyphSize }, () => resolve()))
}

export interface TextMaterialOptions {
  opacity?: number
}

/**
 * Base material for troika text in the ink world. Glyph quads must not write depth: the ink
 * pass draws contours on depth discontinuities and would outline every quad as a rectangle
 * (stack.md §5 gotcha). The ink pass fogs text by the depth behind it, so set text on a
 * surface (signpost, platform, scroll), never floating against the sky, or the fog erases it.
 * Pass it as the Text's `material`; troika derives its SDF shader from it.
 */
export function textMaterial(color: ColorRepresentation, { opacity = 1 }: TextMaterialOptions = {}): MeshBasicMaterial {
  return new MeshBasicMaterial({ color, opacity, transparent: true, depthWrite: false })
}

/**
 * Text inside the cabin: as `textMaterial`, plus the interior alpha flag (render/post/interior.ts),
 * so the outdoor ink pass never fogs it while the door crossfade runs.
 */
export function interiorTextMaterial(color: ColorRepresentation, options: TextMaterialOptions = {}): MeshBasicMaterial {
  return markInterior(textMaterial(color, options), 'blend')
}
