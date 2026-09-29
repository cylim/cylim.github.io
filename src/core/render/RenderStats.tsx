import { useFrame, useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import type { WebGLRenderer } from 'three'
import type { RenderStats as Stats } from '../boot/e2e'

function accumulate(gl: WebGLRenderer, on: boolean): void {
  gl.info.autoReset = !on
}

function reset(gl: WebGLRenderer): void {
  gl.info.reset()
}

function read(gl: WebGLRenderer): Stats {
  const { render, memory, programs } = gl.info
  return {
    calls: render.calls,
    triangles: render.triangles,
    points: render.points,
    lines: render.lines,
    programs: programs?.length ?? 0,
    geometries: memory.geometries,
    textures: memory.textures,
  }
}

/**
 * e2e only (mounted by Stage under ?e2e=1): publishes the renderer counters as
 * `window.__cy.renderStats()`, for the design §13.4 budgets (draw calls, triangles). The composer
 * renders several times a frame, so the counters accumulate across the frame (autoReset off) and
 * are reset as the next frame starts: this useFrame runs first, at the lowest priority. A read
 * between frames therefore sees the whole of the last frame, even after the governor stops the loop.
 */
export function RenderStats() {
  const gl = useThree((s) => s.gl)
  useEffect(() => {
    accumulate(gl, true)
    const handle = window.__cy
    if (handle) handle.renderStats = () => read(gl)
    return () => {
      accumulate(gl, false)
      if (handle) handle.renderStats = undefined
    }
  }, [gl])
  useFrame(() => reset(gl), -1000)
  return null
}
