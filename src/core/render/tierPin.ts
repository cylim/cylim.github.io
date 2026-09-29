import { parseBootParams } from '../boot/params'
import { readPrefs } from '../boot/prefs'
import type { Tier } from '../store/journey'

/**
 * A tier the visitor or a test chose on purpose: `?tier=` (stack.md §5: overrides everything) or
 * a saved Quality setting other than Auto. A pinned tier skips the benchmark correction, the
 * renderer-string refinement and the runtime monitor; DPR steps still follow the tier's floor.
 */
export function pinnedTier(): Tier | null {
  const fromUrl = parseBootParams(location.search).tier
  if (fromUrl) return fromUrl
  const q = readPrefs().quality
  return q && q !== 'auto' ? q : null
}

/** UNMASKED_RENDERER_WEBGL when readable, else RENDERER. */
export function rendererString(gl: WebGLRenderingContext | WebGL2RenderingContext): string | undefined {
  try {
    const ext = gl.getExtension('WEBGL_debug_renderer_info')
    const v: unknown = gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER)
    return typeof v === 'string' ? v : undefined
  } catch {
    return undefined
  }
}
