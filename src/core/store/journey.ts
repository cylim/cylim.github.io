/**
 * The journey store: the one bus between the DOM layer, the scroll driver, the camera rig,
 * the post stack and the section scenes (stack.md §3, extended for design.md).
 *
 * Rules
 * - Per-frame consumers (useFrame, rAF loops) call `journey.getState()` and never subscribe.
 * - React subscribes only to coarse fields (active, post, tier, mode, insideCabin, ...) via
 *   `useJourney(selector)`. Never select `u`, `jvh`, `dive.amount` or `lagFog` in React.
 * - Nested objects are replaced, never mutated:
 *   `journey.setState((s) => ({ dive: { ...s.dive, amount } }))`.
 * - Each field lists its writer. Only the writer sets it; everyone else reads.
 *
 * Owner: core-journey. Adding fields is fine; renaming or changing meaning needs a heads-up
 * in docs/plan/contracts.md.
 */

import { createStore } from 'zustand/vanilla'
import { useStore } from 'zustand'
import { SECTION_IDS, type SectionId } from '../sections/ids'
import { FOG_COVER, PRELOAD_U, SCENE_SPANS, jvhToU } from '../world/beats'
import type { PalaceNo } from '../../lib/qimen/types'
import type { SocialId } from '../../content/socials'
import type { AlbumReason } from '../../content/ui'

export type { SectionId }

export type Tier = 'low' | 'medium' | 'high'
export type RenderMode = 'static' | 'immersive'
export type PostGroup = 'ink' | 'cabin'
export type DivePhase = 'idle' | 'in' | 'hold' | 'out'

/**
 * Stage lifecycle. 'none' in static mode or before the idle import; 'loading' while the stage
 * chunk downloads; 'benchmark' while the hidden 60-frame test runs at opacity 0; 'live' once the
 * canvas has faded in; 'lost' after webglcontextlost (the current still replaces the canvas).
 */
export type StagePhase = 'none' | 'loading' | 'benchmark' | 'live' | 'lost'

/**
 * Why the album is showing (design.md §14.1 banner copy), in content/ui.ts's vocabulary. null in
 * immersive mode. Boot mirrors it on `<html data-static-reason>`.
 */
export type StaticReason = AlbumReason

export type CompassStatus = 'off' | 'requesting' | 'active' | 'denied' | 'unsupported' | 'no-data'

/**
 * A fog-dive (design.md §11.1). phase: 'in' (0 → 1, the camera dollies forward), 'hold' (full paper:
 * the scroll has jumped and the target section is mounting), 'out' (1 → 0, the camera glides from
 * the emerge pose onto the arrival), 'idle'.
 */
export interface DiveState {
  phase: DivePhase
  /** 0 = clear, 1 = full paper, already eased. The ink pass reads it as uDive; core/scroll mirrors it on #veil when no stage is live. */
  amount: number
  /** Target of the running dive, or null. */
  to: SectionId | null
  /** The hold is waiting for the target section to become ready. The title card shows "Grinding ink…" once this has been true for 400 ms. */
  waiting: boolean
}

/** A rectangle in CSS pixels, viewport coordinates. */
export interface ScreenRect {
  x: number
  y: number
  width: number
  height: number
}

/** A projected world point in CSS pixels, viewport coordinates. */
export interface ScreenPoint {
  x: number
  y: number
  visible: boolean
}

/**
 * One line of the cabin terminal log. The DOM terminal appends; the 3D pane mirrors.
 * 'qimen' lines render the chart as a 3 × 3 grid for `chartAtMs` (same engine as the grove).
 */
export interface TerminalLine {
  id: number
  kind: 'input' | 'output' | 'hint' | 'link' | 'qimen'
  text: string
  href?: string
  chartAtMs?: number
}

export interface JourneyState {
  // ---------------------------------------------------------------- scroll and camera
  /** Camera path parameter 0..1 (u = jvh / 1000). Writer: ScrollDriver (frozen while a dive runs). */
  u: number
  /** Same position in journey vh, 0..1000. Writer: ScrollDriver, alongside u. */
  jvh: number
  /** Section under the scroll position; drives nav aria-current and chrome. Writer: ScrollDriver / diveTo. */
  active: SectionId
  /** Next frame: place the camera without damping, then the rig clears it. Writer: diveTo; reader-and-clearer: CameraRig. */
  snap: boolean
  /** Fog-dive state. Writer: dive.ts (tweenDive / diveTo). */
  dive: DiveState
  /**
   * Catch-up fog 0..1 while the camera lags its scroll target (End key, scrollbar drag, a hard fling).
   * 0 = none, 1 = the view should be fully in paper. Engages above 25 m of lag and clears under 5 m
   * (design.md §6.3). Added to uLocalFogBoost by the render pipeline. Writer: CameraRig.
   */
  lagFog: number
  /** Fog density of the current beat before the tier multiplier (beat table fog channel). Inside the hall it is the night fade density. Writer: CameraRig. */
  fogBase: number
  /**
   * Scroll-driven paper 0..1 from the beat table: the moon-gate whiteout (rises 562–571, clears by
   * 578). The ink pass runs it through the same dissolve as a dive: uDive = max(dive.amount, paper).
   * Writer: CameraRig.
   */
  paper: number
  /** True when the viewport is portrait (aspect < 1): portrait overrides and zone B apply. Writer: boot resize listener. */
  portrait: boolean

  // ---------------------------------------------------------------- render
  /** Post group the stage is showing. Writer: CameraRig at the door and the moon gate. */
  post: PostGroup
  /** 0 = ink, 1 = cabin; crossfades over 400 ms at the door plane. Writer: CameraRig. */
  postBlend: number
  /** Camera is past the door plane and inside the hall. Chrome swaps to night. Writer: CameraRig. */
  insideCabin: boolean
  /** Quality tier. Writer: boot (initial guess, ?tier=), QualityController (runtime). */
  tier: Tier
  /** prefers-reduced-motion, or the saved preference. Autonomous motion off when true. Writer: boot. */
  reducedMotion: boolean
  /** 'static' = album, three never loads; 'immersive' = the 3D walk. Mirrors <html data-mode>. Writer: boot. */
  mode: RenderMode
  /** Why the album is showing, for the banner; null in immersive mode. Writers: boot (also sets html[data-static-reason]); core/render may set 'slow' after the benchmark. */
  staticReason: StaticReason | null
  /** Stage lifecycle. Writer: core/render (mountStage, benchmark, context-loss handler). */
  stage: StagePhase
  /** Per section: true once its chunk is loaded and prewarmed; false while a visible section waits. Writer: SectionHost / prewarm. */
  ready: Partial<Record<SectionId, boolean>>

  // ---------------------------------------------------------------- time
  /** ?e2e=1: deterministic rendering, 50 ms dives, no Lenis, window.__cy exposed. Writer: boot. */
  e2e: boolean
  /** Shader and animation clock. When frozen, every consumer uses `time` instead of the real clock. Writer: boot (e2e). */
  clock: { frozen: boolean; time: number }
  /** ?now= override for "live" charts and the colophon, epoch ms; null = Date.now(). Writer: boot. */
  nowOverride: number | null

  // ---------------------------------------------------------------- audio
  /** Sound toggle; off by default, persisted in cy.prefs. Writer: DOM sound button. Reader: src/audio. */
  soundOn: boolean

  // ---------------------------------------------------------------- cabin
  /** Ignition (I0) has played this visit; later crossings replay the short version. Writer: cabin scene. */
  ignitionPlayed: boolean
  /** Index 0..3 of the scroll hovered in 3D or whose DOM card has focus; null for none. Writers: cabin scene (hover), DOM cards (focus). */
  cabinFocus: number | null
  /** Terminal log shared by the DOM terminal (writer) and the 3D pane mirror (reader). Capped at 200 lines. */
  terminal: { lines: readonly TerminalLine[] }
  /** Projected rectangle of the 3D terminal pane during the I3 hold, or null. Writer: cabin scene. Reader: DOM terminal (positions itself over it). */
  pane: ScreenRect | null

  // ---------------------------------------------------------------- grove
  /** Chart instant: null = live (follows nowOverride ?? Date.now()); a number = the visitor picked a moment. Writer: DOM chart controls. */
  chartInstantMs: number | null
  /** Selected palace (3D click or DOM focus), or null. Writers: grove scene, DOM chart. */
  selectedPalace: PalaceNo | null
  /** Show English labels under 3D glyphs. Default on for touch, off for desktop. Writer: DOM chart controls. */
  showEnglish: boolean
  /** Manual dial rotation in degrees (drag or the "Rotate luopan" range input). Writers: grove scene, DOM range input. */
  dialDeg: number
  /** Device-compass mode. heading is degrees clockwise from magnetic north. Writer: DOM compass button (lib/compass). */
  compass: { status: CompassStatus; heading: number | null }
  /** The casting animation has played this session (design.md §9.5). Writer: grove scene. */
  groveCastPlayed: boolean
  /** Fastest ring's angular speed in slots per second while the plates turn, 0 at rest; drives the grind and detent cues. Writer: grove scene (only on change). Reader: audio. */
  ringSpeed: number

  // ---------------------------------------------------------------- contact and finale
  /** Social row hovered or focused (DOM) or its signpost board hovered (3D). Writers: DOM contact rows, contact scene. */
  contactHover: SocialId | null
  /** Finale once-per-visit events. Writer: contact scene. Reader: DOM (colophon, pins, seal). */
  finale: { mountOpen: boolean; sealStamped: boolean; colophonShown: boolean }
  /** Projected E3 map pins; the DOM pins position themselves here. Writer: contact scene. */
  pins: Partial<Record<'threshold' | 'cabin' | 'grove', ScreenPoint>>

  // ---------------------------------------------------------------- glosses
  /** A 3D glyph under the pointer asks the DOM tooltip to open at a screen point. Writer: grove/cabin/contact scenes. Reader: DOM Gloss. */
  gloss: { zh: string; x: number; y: number } | null
}

export function initialJourneyState(): JourneyState {
  return {
    u: 0,
    jvh: 0,
    active: 'threshold',
    snap: true,
    dive: { phase: 'idle', amount: 0, to: null, waiting: false },
    lagFog: 0,
    fogBase: 0.04,
    paper: 0,
    portrait: false,

    post: 'ink',
    postBlend: 0,
    insideCabin: false,
    tier: 'medium',
    reducedMotion: false,
    mode: 'static',
    staticReason: null,
    stage: 'none',
    ready: {},

    e2e: false,
    clock: { frozen: false, time: 0 },
    nowOverride: null,

    soundOn: false,

    ignitionPlayed: false,
    cabinFocus: null,
    terminal: { lines: [] },
    pane: null,

    chartInstantMs: null,
    selectedPalace: null,
    showEnglish: false,
    dialDeg: 0,
    compass: { status: 'off', heading: null },
    groveCastPlayed: false,
    ringSpeed: 0,

    contactHover: null,
    finale: { mountOpen: false, sealStamped: false, colophonShown: false },
    pins: {},

    gloss: null,
  }
}

export const journey = createStore<JourneyState>()(() => initialJourneyState())

/** React hook for coarse fields only. Per-frame code uses `journey.getState()`. */
export const useJourney = <T,>(selector: (s: JourneyState) => T): T => useStore(journey, selector)

/** "Now" for anything time-based that must honour ?now= (charts, colophon). */
export const nowMs = (s: Pick<JourneyState, 'nowOverride'> = journey.getState()) => s.nowOverride ?? Date.now()

/** The instant the chart shows: the picked moment, else now. */
export const chartInstant = (s: Pick<JourneyState, 'chartInstantMs' | 'nowOverride'> = journey.getState()) =>
  s.chartInstantMs ?? nowMs(s)

/** Sections the stage shows at this position: within RIG.preloadU of their span (SectionHost's rule). */
export function visibleSections(u: number): SectionId[] {
  return SECTION_IDS.filter((id) => {
    const [a, b] = SCENE_SPANS[id]
    const d = u < jvhToU(a) ? jvhToU(a) - u : u >= jvhToU(b) ? u - jvhToU(b) : 0
    return d < PRELOAD_U
  })
}

/**
 * e2e "settled": no dive running, and in immersive mode the stage is live with every visible
 * section ready. A lost context counts as settled (the still shows).
 */
export function isSettled(s: JourneyState = journey.getState()): boolean {
  if (s.dive.phase !== 'idle') return false
  if (s.mode === 'static' || s.stage === 'lost') return true
  return s.stage === 'live' && visibleSections(s.u).every((id) => s.ready[id] === true)
}

/**
 * Fog is thick enough to hide a change (density above FOG_COVER, 0.12): a dive, the moon-gate
 * paper, catch-up fog or the mist wall. Tier changes and low-tier mounts wait for this (§11.1, §11.3).
 */
export function underFogCover(s: Pick<JourneyState, 'dive' | 'paper' | 'lagFog' | 'fogBase' | 'insideCabin'> = journey.getState()): boolean {
  return s.dive.amount >= 0.5 || s.paper >= 0.5 || s.lagFog >= 0.5 || (!s.insideCabin && s.fogBase > FOG_COVER)
}
