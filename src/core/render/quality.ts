/**
 * Quality tiers (design.md §13, stack.md §5). The table every module reads for tier-dependent
 * counts. Runtime tier changes may only touch uniforms, EffectGroup.enabled, mesh.count and DPR:
 * never defines, multisampling, scene.fog or material swaps (those recompile shaders).
 * Owner: core-render.
 */

import type { Tier } from '../store/journey'

export interface TierSettings {
  /** Starting DPR cap. High uses min(devicePixelRatio, 2), or 1.75 above 8 MP. */
  readonly dprCap: number
  /** PerformanceMonitor steps DPR down by 0.25 to this floor before dropping a tier. */
  readonly dprFloor: number
  /** Multiplies every beat's fog density. When the GPU has less, the forest gets foggier. */
  readonly fogMultiplier: number
  /** Instanced pine count (mesh.count). */
  readonly pines: number
  readonly mistPlanes: number
  /** Ridge-ring layers per direction. */
  readonly ridgeLayers: number
  /** Sobel ink contours (uEdges). */
  readonly inkEdges: boolean
  /** Dry-brush breaks and the 8 fps "boil" (uWobble). */
  readonly inkBoil: boolean
  /** 皴 texture strokes: hero rocks and grove stones only, all stone, or all stone plus hemp strokes on earth. */
  readonly cunStrokes: 'hero' | 'stone' | 'all'
  /** Cabin bloom mip levels; 0 = off (additive halo sprites fake the glow). Startup only. */
  readonly bloomLevels: number
  /** EffectComposer MSAA samples. Startup only. */
  readonly msaa: number
  /** Simplified hall behind the door: no dust, static traces, scroll textures load once inside. */
  readonly simplifiedHall: boolean
  readonly tracePulses: boolean
  readonly dust: number
  readonly streamRipples: boolean
  readonly bamboo: boolean
  /** Drag the hour marker on R4; otherwise the DOM range input only. */
  readonly hourMarkerDrag: boolean
  /** Scroll image core size in px. */
  readonly scrollTexture: number
  /** Sections behind the camera: unmounted (and disposed) or kept hidden in <Activity>. */
  readonly farSections: 'unmount' | 'hidden'
  /** 'adaptive' = 30 fps if the first 5 s average under 50 fps, else 60. */
  readonly frameCap: 'adaptive' | 60 | 'display'
}

export const TIERS: Readonly<Record<Tier, TierSettings>> = {
  low: {
    dprCap: 1,
    dprFloor: 0.75,
    fogMultiplier: 1.3,
    pines: 300,
    mistPlanes: 2,
    ridgeLayers: 1,
    inkEdges: false,
    inkBoil: false,
    cunStrokes: 'hero',
    bloomLevels: 0,
    msaa: 0,
    simplifiedHall: true,
    tracePulses: false,
    dust: 0,
    streamRipples: false,
    bamboo: false,
    hourMarkerDrag: false,
    scrollTexture: 384,
    farSections: 'unmount',
    frameCap: 'adaptive',
  },
  medium: {
    dprCap: 1.5,
    dprFloor: 1,
    fogMultiplier: 1.1,
    pines: 700,
    mistPlanes: 3,
    ridgeLayers: 2,
    inkEdges: true,
    inkBoil: false,
    cunStrokes: 'stone',
    bloomLevels: 4,
    msaa: 0,
    simplifiedHall: false,
    tracePulses: true,
    dust: 300,
    streamRipples: true,
    bamboo: true,
    hourMarkerDrag: true,
    scrollTexture: 512,
    farSections: 'hidden',
    frameCap: 60,
  },
  high: {
    dprCap: 2,
    dprFloor: 1.25,
    fogMultiplier: 1,
    pines: 1500,
    mistPlanes: 4,
    ridgeLayers: 3,
    inkEdges: true,
    inkBoil: true,
    cunStrokes: 'all',
    bloomLevels: 6,
    msaa: 4,
    simplifiedHall: false,
    tracePulses: true,
    dust: 800,
    streamRipples: true,
    bamboo: true,
    hourMarkerDrag: true,
    scrollTexture: 512,
    farSections: 'hidden',
    frameCap: 'display',
  },
}

const ORDER: readonly Tier[] = ['low', 'medium', 'high']

export function stepTier(t: Tier, dir: 1 | -1): Tier {
  const i = Math.min(Math.max(ORDER.indexOf(t) + dir, 0), ORDER.length - 1)
  return ORDER[i] ?? t
}

export interface DprRange {
  cap: number
  floor: number
}

/** §13.3 DPR start (cap) and floor for a tier on this screen; the floor never exceeds the cap. */
export function dprRange(tier: Tier, devicePixelRatio: number, screenPixels: number): DprRange {
  const t = TIERS[tier]
  const tierCap = tier === 'high' && screenPixels > 8e6 ? 1.75 : t.dprCap
  const cap = Math.min(devicePixelRatio, tierCap)
  return { cap, floor: Math.min(t.dprFloor, cap) }
}

export const clampDpr = (dpr: number, r: DprRange) => Math.min(Math.max(dpr, r.floor), r.cap)

/** Starting DPR for a tier on this screen. */
export function startDpr(tier: Tier, devicePixelRatio: number, screenPixels: number): number {
  return dprRange(tier, devicePixelRatio, screenPixels).cap
}

export { guessTier, type DeviceHints } from './guessTier'

/** Hidden benchmark (design.md §13.2): median frame time over 60 frames at opacity 0. */
export const BENCHMARK = {
  frames: 60,
  /** Median above this on low → album with the slow-device toast. */
  lowToStaticMs: 22,
  mediumToLowMs: 18,
  highToMediumMs: 12,
} as const

/** drei PerformanceMonitor policy (design.md §13.3). */
export const PERF_MONITOR = {
  declineFps: 45,
  declineAfterMs: 2000,
  inclineFps: 58,
  inclineAfterMs: 4000,
  dprStep: 0.25,
  flipflops: 3,
} as const
