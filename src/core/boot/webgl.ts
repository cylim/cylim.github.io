/**
 * The real WebGL2 gate (design.md §13.2, stack.md §9): the head script only checks that
 * WebGL2RenderingContext exists; this creates a context, optionally with
 * failIfMajorPerformanceCaveat, reads the renderer string for the tier guess, and frees it again.
 */

export interface WebglProbe {
  readonly ok: boolean
  /** UNMASKED_RENDERER_WEBGL where readable, else RENDERER. */
  readonly renderer: string | undefined
}

export function probeWebgl2(opts: { failIfMajorPerformanceCaveat: boolean }): WebglProbe {
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl2', {
      failIfMajorPerformanceCaveat: opts.failIfMajorPerformanceCaveat,
      antialias: false,
      depth: false,
      stencil: false,
      alpha: false,
      powerPreference: 'high-performance',
    })
    if (!gl) return { ok: false, renderer: undefined }
    const info = gl.getExtension('WEBGL_debug_renderer_info')
    const renderer = String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER))
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    return { ok: true, renderer }
  } catch {
    return { ok: false, renderer: undefined }
  }
}
