/**
 * Render mode and starting tier (design.md §13.2, §14.1; stack.md §2, §5). The inline head script
 * makes the same call before first paint from what it can see cheaply; boot confirms it with a
 * real WebGL2 context and the renderer string, and records why the album is showing.
 */

import type { RenderMode, StaticReason, Tier } from '../store/journey'
import { guessTier, type DeviceHints } from '../render/guessTier'
import type { BootParams } from './params'
import type { Prefs } from './prefs'
import type { WebglProbe } from './webgl'

export interface BootEnvironment {
  /** 'WebGL2RenderingContext' in window. */
  readonly hasWebgl2: boolean
  readonly reducedMotion: boolean
  readonly saveData: boolean
  readonly deviceMemory: number | undefined
  readonly cores: number | undefined
  readonly coarsePointer: boolean
  /** Creates a context; only called when the answer matters. */
  readonly probe: (opts: { failIfMajorPerformanceCaveat: boolean }) => WebglProbe
}

export interface BootDecision {
  readonly mode: RenderMode
  readonly staticReason: StaticReason | null
  readonly tier: Tier
}

export function decideBoot(params: BootParams, prefs: Prefs, env: BootEnvironment): BootDecision {
  const hints = (renderer: string | undefined): DeviceHints => ({
    coarsePointer: env.coarsePointer,
    cores: env.cores,
    deviceMemory: env.deviceMemory,
    renderer,
  })
  const tierFor = (renderer: string | undefined): Tier =>
    params.tier ?? (prefs.quality && prefs.quality !== 'auto' ? prefs.quality : guessTier(hints(renderer)))
  const album = (staticReason: StaticReason): BootDecision => ({ mode: 'static', staticReason, tier: tierFor(undefined) })

  // ?mode=immersive and ?still= ask for the walk outright and skip the soft gates. Tests and the
  // stills generator run on SwiftShader, which fails failIfMajorPerformanceCaveat, so those and any
  // pinned tier only need a WebGL2 context.
  const forced = params.still !== null || params.mode === 'immersive'
  const lenient = forced || params.e2e || params.tier !== null
  if (params.mode === 'static' && params.still === null) return album('param')
  if (!env.hasWebgl2) return album('nowebgl')
  // Same rules and order as index.html's head script (mode.test.ts runs both against one matrix).
  // "Walk the forest" saves mode = immersive, which opts back in past every soft gate (design.md
  // §14.1: offer the walk whenever WebGL is available), so the banner's button is never a dead end.
  if (!forced) {
    if (prefs.mode === 'static') return album('pref')
    if (prefs.mode !== 'immersive') {
      if (env.saveData) return album('saveData')
      if (env.deviceMemory !== undefined && env.deviceMemory <= 2) return album('memory')
      if (env.reducedMotion) return album('reduced')
    }
  }
  const probe = env.probe({ failIfMajorPerformanceCaveat: !lenient })
  if (!probe.ok) return album('nowebgl')
  return { mode: 'immersive', staticReason: null, tier: tierFor(probe.renderer) }
}
