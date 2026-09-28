import { Color, Vector3 } from 'three'
import { glints as anchors, type Vec3 } from '../../world/layout'
import { FOG_COVER, MARKS } from '../../world/journey'
import { color } from '../../../theme/tokens'

/**
 * The two screen-space glint slots of the ink pass (design.md §7.3.2). A sprite in the scene
 * would not survive the post fog, which reads the depth behind it and erases it to paper, so
 * glints are composited after fog, with one depth tap for occlusion.
 *
 * Slot 0: the lantern, the only warm light in the ink world, at the flame. Slot 1: the cabin's
 * cyan pinprick, for the finale (E2, E3). Both run an automatic rule unless `auto` is false.
 * Owner: core-render. Writers: the contact scene may tune alpha or switch a slot to manual.
 */

export type GlintSlot = 0 | 1

export interface GlintState {
  /** World position in metres. */
  readonly pos: Vector3
  /** Core diameter in CSS px. Slot 0 in auto mode sizes itself: 4 px near, 3 px from 150 m (§8.1). */
  core: number
  /** Halo radius in CSS px (gaussian falloff). */
  halo: number
  /** Halo opacity at its centre. */
  haloAlpha: number
  /** 0..1. In auto mode it multiplies the rule's fade; in manual mode it is the whole visibility. */
  alpha: number
  /**
   * Slot 0: fades in beyond `glints.lanternMinDistance` (25 m) from the lantern, where the real
   * flame billboard hands over, and flickers 0.92–1.0 at about 1 Hz (steady under reduced motion).
   * It goes out in the mist wall (design §8.5 P2, the moment of doubt) as the fog climbs toward
   * `FOG_COVER`, and returns as the mist parts at P3 (`LANTERN_FOG_FADE`).
   * Slot 1: fades in over the first 15 jvh of E2 (from MARKS.finaleStart).
   */
  auto: boolean
  readonly coreColor: Color
  readonly haloColor: Color
}

export interface GlintPatch {
  pos?: Vec3
  core?: number
  halo?: number
  haloAlpha?: number
  alpha?: number
  auto?: boolean
}

function initial(): [GlintState, GlintState] {
  return [
    {
      pos: new Vector3(...anchors.lantern),
      core: 3,
      halo: 10,
      haloAlpha: 0.35,
      alpha: 1,
      auto: true,
      coreColor: new Color(color.lanternCore),
      haloColor: new Color(color.lanternFlame),
    },
    {
      pos: new Vector3(...anchors.cabin),
      core: 2.5,
      halo: 7,
      haloAlpha: 0.35,
      alpha: 1,
      auto: true,
      coreColor: new Color(color.cyanBright),
      haloColor: new Color(color.cyanLine),
    },
  ]
}

export const glintSlots: readonly [GlintState, GlintState] = initial()

export function setGlint(slot: GlintSlot, patch: GlintPatch): void {
  const g = glintSlots[slot]
  if (patch.pos) g.pos.set(...patch.pos)
  if (patch.core !== undefined) g.core = patch.core
  if (patch.halo !== undefined) g.halo = patch.halo
  if (patch.haloAlpha !== undefined) g.haloAlpha = patch.haloAlpha
  if (patch.alpha !== undefined) g.alpha = patch.alpha
  if (patch.auto !== undefined) g.auto = patch.auto
}

export function resetGlints(): void {
  const fresh = initial()
  for (const slot of [0, 1] as const) {
    const g = fresh[slot]
    setGlint(slot, { pos: [g.pos.x, g.pos.y, g.pos.z], core: g.core, halo: g.halo, haloAlpha: g.haloAlpha, alpha: g.alpha, auto: g.auto })
  }
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1)
  return t * t * (3 - 2 * t)
}

/** Lantern flicker, 0.92..1.0 at about 1 Hz (design.md §7.3.2, §15: nothing flashes). */
export function lanternFlicker(t: number): number {
  const w = 0.6 * Math.sin(2 * Math.PI * 1.0 * t) + 0.4 * Math.sin(2 * Math.PI * 2.3 * t + 1.3)
  return 0.96 + 0.04 * w
}

export interface GlintFrame {
  /** Visibility 0..1 before occlusion. */
  alpha: number
  /** Core diameter in CSS px. */
  core: number
}

/**
 * Fog density (the beat's, before the tier multiplier, plus any held boost) over which the lantern
 * glint goes out: from half of `FOG_COVER` it fades, and by 90% of it, well before the mist wall
 * peaks at 0.14, it is gone. Every other beat's fog sits under 0.05.
 */
export const LANTERN_FOG_FADE = [0.5 * FOG_COVER, 0.9 * FOG_COVER] as const

/**
 * The per-frame visibility and size of a slot. Pure; the ink pass projects and draws it. `fog` is
 * the outdoor fog density before the tier multiplier (journey `fogBase` plus `postFx.fogBoost`).
 */
export function glintFrame(slot: GlintSlot, g: GlintState, cameraDistance: number, jvh: number, flicker: number, fog = 0): GlintFrame {
  if (!g.auto) return { alpha: g.alpha, core: g.core }
  if (slot === 0) {
    const near = anchors.lanternMinDistance
    const fade = smooth(near, near + 5, cameraDistance) * (1 - smooth(LANTERN_FOG_FADE[0], LANTERN_FOG_FADE[1], fog))
    return { alpha: g.alpha * fade * flicker, core: 4 - smooth(40, 150, cameraDistance) }
  }
  return { alpha: g.alpha * smooth(MARKS.finaleStart, MARKS.finaleStart + 15, jvh), core: g.core }
}
