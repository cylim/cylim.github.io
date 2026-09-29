// Types for fonts.config.mjs.

export interface FaceConfig {
  /** Key in src/theme/tokens.ts `fontFiles`. */
  key: 'display600' | 'body400' | 'body600' | 'mono' | 'cjk' | 'cjkDisplay'
  /** Output base name under public/fonts/. */
  out: string
  src: string
  family: string
  weight: number
  group: 'latin' | 'mono' | 'cjk'
  text: string | null
  extras: boolean
  features: string[]
  glyphList?: boolean
  licence: string
  upstream: string
}

export declare const FONTS_SRC: string
export declare const FONTS_OUT: string
export declare const PINYIN: string
export declare const LATIN: string
export declare const DISPLAY_LATIN: string
export declare const MONO: string
export declare const FACES: FaceConfig[]
export declare const FONT_BUDGET: { latinWoff2Total: number; cjkWoff: number }
export { CHART_GLYPHS, CJK_ASCII, CJK_PUNCT, DISPLAY_GLYPHS } from './collect-cjk.mjs'
