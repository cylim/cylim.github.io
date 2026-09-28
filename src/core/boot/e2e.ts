import { isSettled, journey, type JourneyState } from '../store/journey'
import { jumpTo, scrollToJvh } from '../scroll'
import type { SectionId } from '../sections/ids'

/** One whole frame's renderer counters (three's WebGLRenderer.info), for the design §13.4 budgets. */
export interface RenderStats {
  readonly calls: number
  readonly triangles: number
  readonly points: number
  readonly lines: number
  /** Compiled programs alive. */
  readonly programs: number
  readonly geometries: number
  readonly textures: number
}

/** window.__cy, exposed only with ?e2e=1 or ?still= (stack.md §12). */
export interface CyE2EHandle {
  /** No dive running, and in immersive mode the stage is live with every visible section ready. */
  readonly settled: boolean
  readonly state: () => JourneyState
  /** Fog-dive to a section as a nav click would (pushes history). Resolves when the dive settles. */
  readonly jump: (id: SectionId) => Promise<void>
  /**
   * Jump the page to a journey position through the measured scroll map. Resolves with the store
   * already at the new position, so `settled` read right after refers to it (QM-10).
   */
  readonly scrollToJvh: (jvh: number) => Promise<boolean>
  /** The last rendered frame's counters; set by the stage (core/render/RenderStats) once it mounts. */
  renderStats?: () => RenderStats
}

declare global {
  interface Window {
    __cy?: CyE2EHandle
  }
}

export function exposeE2E(): void {
  window.__cy = {
    get settled() {
      return isSettled()
    },
    state: journey.getState,
    jump: (id) => jumpTo(id),
    scrollToJvh: (jvh) => scrollToJvh(jvh),
  }
}
