import type { RenderMode, Tier } from '../store/journey'
import { BEAT_IDS, type BeatId } from '../world/beats'

/** URL switches (stack.md §5, §12; design.md §14.1). All optional. */
export interface BootParams {
  /** ?e2e=1: freeze clocks, 50 ms dives, no Lenis, expose window.__cy. */
  e2e: boolean
  /** ?tier=low|medium|high overrides every heuristic. */
  tier: Tier | null
  /** ?now=<ISO 8601>: fixed "now" for charts and the colophon, epoch ms. */
  now: number | null
  /** ?mode=static|immersive overrides the head-script decision. */
  mode: RenderMode | null
  /**
   * ?still=<beat>: render one beat for scripts/shots.mjs (album stills, og.png). Implies immersive,
   * frozen clocks and no damping; the content layer is hidden and `<html data-still>` is set.
   */
  still: BeatId | null
}

const TIERS = ['low', 'medium', 'high'] as const
const MODES = ['static', 'immersive'] as const

export function parseBootParams(search: string): BootParams {
  const q = new URLSearchParams(search)
  const tier = q.get('tier')
  const mode = q.get('mode')
  const nowRaw = q.get('now')
  const still = q.get('still')
  const now = nowRaw ? Date.parse(nowRaw) : NaN
  return {
    e2e: q.get('e2e') === '1',
    tier: (TIERS as readonly string[]).includes(tier ?? '') ? (tier as Tier) : null,
    now: Number.isFinite(now) ? now : null,
    mode: (MODES as readonly string[]).includes(mode ?? '') ? (mode as RenderMode) : null,
    still: still !== null && (BEAT_IDS as readonly string[]).includes(still) ? (still as BeatId) : null,
  }
}
