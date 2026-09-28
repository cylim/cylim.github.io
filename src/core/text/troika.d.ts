/**
 * Types for troika-three-text 0.52. The package ships d.ts files under dist/types but no `types`
 * entry, so TypeScript cannot find them, and they omit BatchedText anyway. This covers the API
 * the stage uses; extend it here (owner: core-render) rather than casting at call sites.
 */
declare module 'troika-three-text' {
  import type { BufferGeometry, Color, Material, Mesh, Texture } from 'three'

  export interface TextBuilderConfig {
    /** Font used when a Text has no `font`. */
    defaultFontURL?: string | null
    /** Fallback font resolver for glyphs missing from the font; null disables it. */
    unicodeFontsURL?: string | null
    sdfGlyphSize?: number
    sdfExponent?: number
    sdfMargin?: number
    textureWidth?: number
    useWorker?: boolean
  }

  export function configureTextBuilder(config: TextBuilderConfig): void

  export function preloadFont(
    options: { font?: string | null; characters?: string | string[]; sdfGlyphSize?: number; lang?: string },
    callback: () => void,
  ): void

  export class Text extends Mesh<BufferGeometry, Material> {
    text: string
    font: string | null
    fontSize: number
    fontWeight: number | 'normal' | 'bold'
    fontStyle: 'normal' | 'italic'
    lang: string | null
    letterSpacing: number
    lineHeight: number | 'normal'
    maxWidth: number
    overflowWrap: 'normal' | 'break-word'
    textAlign: 'left' | 'right' | 'center' | 'justify'
    textIndent: number
    whiteSpace: 'normal' | 'nowrap'
    anchorX: number | 'left' | 'center' | 'right' | `${number}%`
    anchorY: number | 'top' | 'top-baseline' | 'top-cap' | 'top-ex' | 'middle' | 'bottom-baseline' | 'bottom' | `${number}%`
    direction: 'auto' | 'ltr' | 'rtl'
    color: string | number | Color | null
    fillOpacity: number
    outlineWidth: number | `${number}%`
    outlineColor: string | number | Color
    outlineOpacity: number
    outlineBlur: number | `${number}%`
    strokeWidth: number | `${number}%`
    strokeColor: string | number | Color
    strokeOpacity: number
    curveRadius: number
    depthOffset: number
    clipRect: [number, number, number, number] | null
    sdfGlyphSize: number | null
    gpuAccelerateSDF: boolean
    debugSDF: boolean
    /** Layout from the last sync; null until the first one. caretPositions: start x, end x, bottom, top per char. */
    readonly textRenderInfo: {
      readonly caretPositions?: Float32Array | null
      readonly blockBounds?: number[]
      readonly sdfTexture?: Texture
    } | null
    sync(callback?: () => void): void
    dispose(): void
  }

  /** Renders every Text added to it in one draw call (design.md §18.3: chart labels). */
  export class BatchedText extends Text {
    addText(text: Text): void
    removeText(text: Text): void
  }
}
