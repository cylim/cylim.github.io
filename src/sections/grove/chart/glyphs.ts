import { SDF_GLYPH_SIZE, preloadText } from '../../../core/text/configure'
import { QIMEN_GLYPHS } from '../../../lib/qimen/labels'

/** Digits for the palace names (离9) and the middle dot of 芮·禽 and the band, from WenKai's ASCII set. */
const CJK_EXTRA = '0123456789·'
/** Thin-stroke glyphs that break up at 64 px (core/text SDF_GLYPH_SIZE.hero). */
export const THIN_GLYPHS = '螣蓬'
/** English labels (Show English) are plain Latin in Source Serif 4. */
const LATIN = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz -'

let ready: Promise<void> | null = null
/** A font that never loads must not hold the grove (and the fog-dive) forever; troika falls back. */
const GIVE_UP_MS = 8000

/**
 * Builds every SDF the chart can show before the scene mounts, so the grove suspends (and the
 * fog-dive holds) until the glyphs exist and nothing pops in (design.md §11.1, wave1-status §8.4).
 */
export function chartGlyphsReady(): Promise<void> {
  ready ??= Promise.race([
    Promise.all([
      preloadText('cjk', QIMEN_GLYPHS + CJK_EXTRA),
      preloadText('cjk', THIN_GLYPHS, SDF_GLYPH_SIZE.hero),
      preloadText('body', LATIN),
    ]).then(() => undefined),
    new Promise<void>((resolve) => setTimeout(resolve, GIVE_UP_MS)),
  ])
  return ready
}
