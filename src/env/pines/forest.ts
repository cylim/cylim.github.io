/**
 * Where every instanced pine stands (design.md §5.1, §7.2, §8.1, §8.2, §8.6). Pure TypeScript.
 *
 * The result is in draw order: the grove's old pines first, then the corridor in passes of shrinking
 * spacing. A tier's `mesh.count` takes a prefix, so every tier keeps the grove ring and an even forest.
 */

import { cabin, grove, inKeepOut, KEEP_OUTS, terrainHeight, threshold } from '../../core/world/layout'
import { WALK_LINE } from '../paths'
import { FIELD_HEIGHTS } from './pineHeights'
import { lerp, rng, smoothstep, valueNoise1 } from '../random'
import { distanceGrid, poissonScatter, type ScatterPoint } from '../scatter'

/** 0–2 are the corridor variants; 3 is the old crooked pine of the grove ring. */
export type PineVariant = 0 | 1 | 2 | 3
export const PINE_VARIANTS: readonly PineVariant[] = [0, 1, 2, 3]

export interface PineInstance {
  x: number
  y: number
  z: number
  variant: PineVariant
  /** Uniform scale on the variant's modelled size. */
  scale: number
  yaw: number
  /** Small tilt in radians about x and z, so no two trunks stand quite plumb. */
  tiltX: number
  tiltZ: number
  /** Ink weight multiplier: 焦/浓 near the walk, 淡 far from it. */
  ink: number
  seed: number
  /** Distance to the walk line in metres. */
  dWalk: number
  /** Draw with the far LOD: away from the walk and not one of the grove's old pines. */
  far: boolean
}

/** Pines farther than this from the walk use the far LOD. */
export const FAR_LOD_WALK_DISTANCE = 14

/** Forest band either side of the walk (design §5.1 "3 to 40 m"), plus a ragged outer edge. */
const BAND_FAR = 40
/** Trunks keep this far outside keep-outs (trunk radius plus the lowest pads). */
const TRUNK_MARGIN = 1
const LEDGE_Z = -190.5
const SEED = 0x11a7

/** The forest edge north of the walk: z 6 with a ragged, brushed line. */
const forestEdgeZ = (x: number) => threshold.forestEdgeZ + (valueNoise1(x * 0.18, 3) - 0.5) * 5

const BOUNDS = { x0: -52, x1: 56, z0: 8, z1: -192 }

function inCorridor(x: number, z: number, walkDist: (x: number, z: number) => number): { d: number } | null {
  if (z > forestEdgeZ(x) || z < LEDGE_Z) return null
  const d = walkDist(x, z)
  const edge = BAND_FAR + 4 + (valueNoise1(z * 0.05 + x * 0.02, 9) - 0.5) * 10
  if (d > edge) return null
  if (inKeepOut(x, z, KEEP_OUTS, TRUNK_MARGIN)) return null
  return { d }
}

const groveDist = (x: number, z: number) => Math.hypot(x - grove.centre[0], z - grove.centre[2])

/**
 * The ring stays open where the camera comes in over the crest and sits at G1, 8.5 m up and
 * 16 m north of the centre (design §6.1): an old pine there would put the seat inside its crown.
 * The standing stones mark the same gap as the grove's entrance.
 */
const SEAT_CLEAR = { x: 0, z: -133, r: 7.5 }
const nearSeat = (x: number, z: number) => Math.hypot(x - SEAT_CLEAR.x, z - SEAT_CLEAR.z) < SEAT_CLEAR.r
const inGroveRing = (x: number, z: number) => {
  const r = groveDist(x, z)
  return r >= grove.oldPines.r0 + 0.8 && r <= grove.oldPines.r1
}

/**
 * Pines around the lantern (design §8.7 E0: "into the southern trees"), 6 to 9 m from the flame so
 * the warm term has trunks to reach. Hand-placed, so every tier draws them.
 */
const EXIT_PINES: readonly (readonly [x: number, z: number])[] = [
  [-7.2, -182.6],
  [7.9, -183.4],
  [-8.4, -188.9],
  [6.6, -178.7],
  [9.6, -189.2],
]

/** Hand-placed trunks the scatter must not crowd. */
const HERO_BLOCKERS: ScatterPoint[] = [
  { x: threshold.cornerPineA.base[0], z: threshold.cornerPineA.base[2], r: 4, pass: -1 },
  { x: threshold.wipePineB.base[0], z: threshold.wipePineB.base[2], r: 3.5, pass: -1 },
  { x: threshold.rock.pos[0], z: threshold.rock.pos[2], r: 3, pass: -1 },
  ...cabin.closeTrunks.map((t): ScatterPoint => ({ x: t.base[0], z: t.base[2], r: 2.5, pass: -1 })),
]

const DEG = Math.PI / 180

/**
 * K0's composition (design §8.1): the forest reads as a low band with the ridges above it, and the
 * top left, where the name sits, stays paper. From K0 at eye height, a pine's crown only stays that
 * low if it is short for its distance, so pines across the K0 frame are capped to crowns at most
 * K0_CROWN_DEG above the eye line; corridor pines (the walk itself) may rise to K0_CORRIDOR_DEG,
 * so the band has a few taller crowns over the path. Only corner pine A, a hero mesh, breaks it.
 */
const K0_CROWN_DEG = 4.5
const K0_CORRIDOR_DEG = 7.5

function k0HeightCap(x: number, z: number, dWalk: number): { maxHeight: number; weight: number } | null {
  const [kx, ky, kz] = threshold.k0
  const ahead = kz - z
  if (ahead <= 0) return null
  const angle = Math.atan2(x - kx, ahead) / DEG // + is screen right (west)
  const weight = smoothstep(24, 17, angle) * smoothstep(-44, -34, angle)
  if (weight <= 0) return null
  const deg = lerp(K0_CORRIDOR_DEG, K0_CROWN_DEG, smoothstep(3, 8, dWalk))
  return { maxHeight: ky + Math.hypot(x - kx, ahead) * Math.tan(deg * DEG), weight }
}

/**
 * 浓淡相间: painters alternate dark and pale groups so a forest reads as layers with mist between,
 * not one even mass. A slow field over the ground, so neighbours share a tone; the pale groups sit
 * at about two thirds of the dark ones' ink.
 */
export function groupTone(x: number, z: number): number {
  const n = valueNoise1(x * 0.06 + valueNoise1(z * 0.05, 21) * 3.1, 23)
  return lerp(0.64, 1, smoothstep(0.28, 0.62, n))
}

/**
 * C1's 高远 (design §8.3): from the cabin approach the cabin's peak must rise over the roof into
 * open sky, so the pines behind the cabin in that sightline stay under the roofline, the way a
 * painter keeps the hut's grove low under the mountain. Capped to crowns at most C1_CROWN_DEG
 * above C1's eye across the middle of the frame, easing off toward its edges.
 */
const C1_EYE = [4, 1.7, -47] as const
const C1_CROWN_DEG = 12.5

function c1HeightCap(x: number, z: number): { maxHeight: number; weight: number } | null {
  const [cx, cy, cz] = C1_EYE
  const ahead = cz - z
  // Only the pines behind the cabin; the ones along the approach frame it and keep their height.
  if (ahead <= 8) return null
  const angle = Math.atan2(x - cx, ahead) / DEG
  const weight = smoothstep(30, 18, Math.abs(angle)) * smoothstep(8, 16, ahead)
  if (weight <= 0) return null
  return { maxHeight: cy + Math.hypot(x - cx, ahead) * Math.tan(C1_CROWN_DEG * DEG), weight }
}

export interface ForestPlan {
  pines: PineInstance[]
  /** How many of `pines` the grove ring holds (always inside every tier's prefix). */
  groveCount: number
}

export function planForest(max = 1500): ForestPlan {
  const walkDist = distanceGrid(WALK_LINE, BOUNDS, 2)
  const groveRing = poissonScatter({
    seed: SEED,
    bounds: { x0: -30, x1: 30, z0: -180, z1: -120 },
    radius: (x, z) => (inGroveRing(x, z) && !nearSeat(x, z) && !inKeepOut(x, z, KEEP_OUTS, TRUNK_MARGIN) ? 4.2 : null),
    passes: [1],
    dartsPerM2: 3,
  })

  const corridor = poissonScatter({
    seed: SEED + 1,
    bounds: BOUNDS,
    radius: (x, z) => {
      if (groveDist(x, z) <= grove.oldPines.r1) return null
      const c = inCorridor(x, z, walkDist)
      // Near the path a painted corridor wants a few trunks, not a wall; the far band carries the count.
      if (!c) return null
      // Groups and glades: painters set pines in clumps with mist between them, never an even stand.
      const clump = smoothstep(0.32, 0.72, valueNoise1(x * 0.09 + valueNoise1(z * 0.07, 5) * 3, 13))
      const far = smoothstep(8, 24, c.d)
      return lerp(2.3, 1.75, far) * lerp(0.8, lerp(2.3, 1.35, far), clump)
    },
    passes: [2.3, 1.5, 1],
    dartsPerM2: 5,
    max: max - groveRing.length - EXIT_PINES.length,
    fixed: [...HERO_BLOCKERS, ...EXIT_PINES.map(([x, z]): ScatterPoint => ({ x, z, r: 2.4, pass: -1 })), ...groveRing.map((p) => ({ ...p, pass: -1 }))],
  })

  const exitPines: ScatterPoint[] = EXIT_PINES.map(([x, z]) => ({ x, z, r: 2.4, pass: -1 }))
  const rand = rng(SEED + 2)
  const pines: PineInstance[] = []
  const place = (p: ScatterPoint, old: boolean) => {
    const d = walkDist(p.x, p.z)
    const variant: PineVariant = old ? 3 : (Math.floor(rand() * 3) as 0 | 1 | 2)
    // The forest edge is young growth: short pines at z 6, full height by z −30. From K0 this keeps
    // the band low in the frame instead of a wall of crowns 18 m away (§8.1).
    const edgeRamp = lerp(0.5, 1, smoothstep(6, -30, p.z))
    let scale = (old ? lerp(1.05, 1.35, rand()) : lerp(0.8, 1.2, rand())) * (old ? 1 : edgeRamp)
    for (const cap of old ? [] : [k0HeightCap(p.x, p.z, d), c1HeightCap(p.x, p.z)]) {
      const h = FIELD_HEIGHTS[variant] * scale
      if (cap && h > cap.maxHeight) scale = lerp(scale, Math.max(cap.maxHeight, 2.6) / FIELD_HEIGHTS[variant], cap.weight)
    }
    pines.push({
      x: p.x,
      y: terrainHeight(p.x, p.z),
      z: p.z,
      variant,
      scale,
      yaw: rand() * Math.PI * 2,
      tiltX: (rand() - 0.5) * 0.08,
      tiltZ: (rand() - 0.5) * 0.08,
      // The trees that frame the walk (within 6 m) keep their full ink; groups behind them alternate.
      ink: (old ? 0.95 : lerp(1, 0.42, smoothstep(3, 38, d))) * lerp(0.9, 1.05, rand()) * lerp(groupTone(p.x, p.z), 1, old ? 0.3 : 1 - smoothstep(4, 9, d)),
      seed: rand(),
      dWalk: d,
      far: !old && d > FAR_LOD_WALK_DISTANCE,
    })
  }
  for (const p of groveRing) place(p, true)
  for (const p of exitPines) place(p, false)
  for (const p of corridor) place(p, false)
  return { pines, groveCount: groveRing.length }
}

/**
 * How many instances of `variant` (optionally only one LOD) fall inside the first `n` of the plan:
 * the `mesh.count` of that variant's mesh for a tier.
 */
export function variantPrefixCount(pines: readonly PineInstance[], variant: PineVariant, n: number, far?: boolean): number {
  let c = 0
  const end = Math.min(n, pines.length)
  for (let i = 0; i < end; i++) {
    const p = pines[i]
    if (p?.variant === variant && (far === undefined || p.far === far)) c++
  }
  return c
}


let cached: ForestPlan | null = null
/**
 * The plan, computed once per page (about 80 ms) and shared by the pine field and the moss dots.
 * The stage plans it in a worker before it mounts (env/prepare.ts → `primeForestPlan`); it is only
 * planned here, inside the render, when that didn't happen.
 */
export function forestPlan(): ForestPlan {
  cached ??= planForest()
  return cached
}

/** A plan made elsewhere (a worker running `planForest()`), used by the next `forestPlan()`. */
export function primeForestPlan(plan: ForestPlan): void {
  cached ??= plan
}
