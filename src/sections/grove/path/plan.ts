/**
 * The path from the moon gate to the grove as data (design.md §8.5, §5.1, §11.2): the stepping
 * stones, the standing stones, every brush stroke of the bamboo clump, the mist-wall veils and
 * the fog hold. Pure TypeScript with no three.js import, so it is unit-tested.
 */

import { MARKS, MIST_WAIT } from '../../../core/world/journey'
import { pathZone, terrainHeight, type Vec3 } from '../../../core/world/layout'

/** Seeded PRNG (mulberry32): the path is identical on every load. */
function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const clamp01 = (t: number) => Math.min(1, Math.max(0, t))
const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a))
  return t * t * (3 - 2 * t)
}

// ---------------------------------------------------------------------------- stones

export interface StonePlacement {
  /** Ground point under the stone's centre. */
  readonly pos: Vec3
  /** Bounding box (x, y, z) handed to env's buildRock. */
  readonly size: Vec3
  readonly yaw: number
  /** Small tilt about the stone's own z axis, radians. */
  readonly tilt: number
  readonly seed: number
}

/**
 * env's buildRock sinks every rock by this share of its height so it sits in the ground. The
 * standing stones must show their full design height above the ground, so their box is taller.
 */
const ROCK_SINK = 0.08

/**
 * Five flattened stones across the stream, north bank to south bank, zigzagging between x0 and x1
 * as a walker's stride does (§5.1: x 1.3 to 2.1).
 */
export function steppingStones(): StonePlacement[] {
  const { count, x0, x1, z } = pathZone.steppingStones
  const reach = (pathZone.stream.width / 2) * 0.8
  const rand = rng(0x5a1e)
  return Array.from({ length: count }, (_, i) => {
    const t = i / Math.max(count - 1, 1)
    const side = i % 2 === 0 ? 1 : -1
    const frac = clamp01(0.5 + 0.5 * side * lerp(0.45, 1, rand()))
    const x = lerp(x0, x1, frac)
    const sz = z + reach * (1 - 2 * t) + (rand() - 0.5) * 0.06
    return {
      pos: [x, terrainHeight(x, sz), sz],
      size: [lerp(0.42, 0.54, rand()), lerp(0.13, 0.18, rand()), lerp(0.34, 0.42, rand())],
      yaw: (rand() - 0.5) * 1.2,
      tilt: (rand() - 0.5) * 0.08,
      seed: 401 + i * 17,
    }
  })
}

/** The plain, unlettered stones that mark the grove entrance (§5.1), broad face to the path. */
export function standingStones(): StonePlacement[] {
  const h = pathZone.standingStoneHeight / (1 - ROCK_SINK)
  return pathZone.standingStones.map((p, i) => {
    const side = p[0] < 0 ? -1 : 1
    return {
      pos: [p[0], terrainHeight(p[0], p[2]), p[2]],
      size: [i === 0 ? 0.66 : 0.6, h, i === 0 ? 0.42 : 0.46],
      yaw: side * (i === 0 ? 0.12 : 0.2),
      // Leaning a little away from the path, as old stones settle.
      tilt: -side * 0.035,
      seed: 911 + i * 29,
    }
  })
}

// ---------------------------------------------------------------------------- bamboo (§8.5 P1)

/** Stroke kinds in the bamboo shader: a stem segment, a leaf, a twig, a node mark. */
export const STROKE = { stem: 0, leaf: 1, twig: 2, node: 3 } as const
export type StrokeKind = (typeof STROKE)[keyof typeof STROKE]

/**
 * One brush stroke. The shader turns it to face the camera about its own axis, so it always reads
 * as a mark on paper. For node marks the roles swap: `axis` is the culm direction scaled to the
 * mark's length, and the mark lies across the culm.
 */
export interface BambooStroke {
  readonly kind: StrokeKind
  /** Start of the stroke (world). */
  readonly a: Vec3
  /** Start to end (world). */
  readonly axis: Vec3
  /** Full width at the widest point, metres. */
  readonly width: number
  /** Sideways curl of the tip, metres (signed, in the facing plane). */
  readonly bend: number
  /** Ink amount 0 (paper) to 1 (焦). */
  readonly ink: number
  readonly seed: number
  /** Index of the culm it belongs to (for sway). */
  readonly culm: number
}

export interface Culm {
  readonly base: Vec3
  readonly height: number
  /** Stem width at the foot, metres. */
  readonly width: number
  /** Horizontal lean per metre of height at the top (x west, z north). */
  readonly lean: readonly [x: number, z: number]
  /** Near culms carry dark ink, far ones pale (浓墨为面，淡墨为背). */
  readonly near: boolean
  readonly phase: number
}

/**
 * The direction the clump is mostly seen from: the P0 emerge and the P1 stream hold look at it
 * from the north-west. Leaf groups fan out in the plane facing it, so 个 and 介 read as characters.
 */
const VIEW: Vec3 = (() => {
  const v: Vec3 = [0.5, 0, 0.87]
  const n = Math.hypot(v[0], v[2])
  return [v[0] / n, 0, v[2] / n]
})()
/** Screen-right for a viewer looking along −VIEW: up × VIEW (mostly west, as facing south). */
const RIGHT: Vec3 = [VIEW[2], 0, -VIEW[0]]

const add = (p: Vec3, q: Vec3, k = 1): Vec3 => [p[0] + q[0] * k, p[1] + q[1] * k, p[2] + q[2] * k]
const sub = (p: Vec3, q: Vec3): Vec3 => [p[0] - q[0], p[1] - q[1], p[2] - q[2]]
const scale = (p: Vec3, k: number): Vec3 => [p[0] * k, p[1] * k, p[2] * k]
const norm = (p: Vec3): Vec3 => scale(p, 1 / Math.max(Math.hypot(p[0], p[1], p[2]), 1e-9))

/** Point on a culm's centre line at height fraction s (0 foot, 1 tip): it bows more near the top. */
export function culmPoint(c: Culm, s: number): Vec3 {
  const bow = c.height * (0.55 * s + 0.45 * s * s)
  return [c.base[0] + c.lean[0] * bow, c.base[1] + c.height * s, c.base[2] + c.lean[1] * bow]
}

/** A direction in the facing plane: `deg` from straight down, positive toward screen-right. */
function facingDir(deg: number, depth: number): Vec3 {
  const r = (deg * Math.PI) / 180
  return norm(add(add(scale(RIGHT, Math.sin(r)), [0, -Math.cos(r), 0]), VIEW, depth))
}

/** 个: three leaves from one point, like the character. 介: four, a 人 over two more. 人: two, the tip of a spray. */
const GROUPS = {
  ge: { angles: [-38, 2, 34], lengths: [0.86, 1, 0.8] },
  jie: { angles: [-50, -16, 14, 46], lengths: [0.8, 1, 0.94, 0.74] },
  ren: { angles: [-20, 22], lengths: [0.9, 0.75] },
} as const

function leafGroup(out: BambooStroke[], at: Vec3, droop: number, kind: keyof typeof GROUPS, ink: number, culm: number, rand: () => number, size = 1) {
  const g = GROUPS[kind]
  const curl = rand() < 0.5 ? -1 : 1
  g.angles.forEach((a, i) => {
    const len = lerp(0.3, 0.42, rand()) * (g.lengths[i] ?? 1) * size
    const dir = facingDir(droop + a + (rand() - 0.5) * 10, (rand() - 0.5) * 0.5)
    out.push({
      kind: STROKE.leaf,
      a: at,
      axis: scale(dir, len),
      width: lerp(0.052, 0.068, rand()) * size,
      // Brush strokes curl a little; the outer leaves of a group curl outward.
      bend: (Math.sign(a) || curl) * lerp(0.015, 0.045, rand()) * size,
      ink: ink * lerp(0.9, 1.05, rand()),
      seed: rand(),
      culm,
    })
  })
}

/**
 * The bamboo clump on the south bank at (−3.5, 0, −86) (§5.1, §8.5): a calligraphic accent, the
 * nod to Guo Xi's 林泉. Culms rise from just south of the water and lean west and north, over the
 * stream toward the path. Each culm is drawn as painters draw it: a stroke per internode with a
 * paper gap at the node and a small node mark bridging it; twigs from the upper nodes carry leaves
 * in 个 and 介 groups.
 */
export function bambooPlan(): { culms: Culm[]; strokes: BambooStroke[] } {
  const [cx, , cz] = pathZone.bamboo
  // Stand clear of the stream band: the bank sits at centreZ − width/2 with ±0.1 m of wobble.
  const bankZ = pathZone.stream.centreZ - pathZone.stream.width / 2 - 0.25
  const rand = rng(0xb4b0)
  const specs: readonly (readonly [dx: number, dz: number, height: number, near: boolean])[] = [
    [0.35, 0, 6.0, true],
    [-0.1, -0.35, 6.4, false],
    [0.7, -0.5, 5.4, true],
    [-0.55, -0.15, 5.9, false],
    [0.15, -0.8, 4.6, false],
    [1.0, -0.15, 3.6, true],
    [-0.3, -1.0, 3.1, false],
  ]
  const culms: Culm[] = specs.map(([dx, dz, height, near]) => {
    const x = cx + dx
    const z = Math.min(cz + dz, bankZ) - 0.05 - rand() * 0.2
    return {
      base: [x, terrainHeight(x, z) - 0.05, z],
      height,
      width: lerp(0.05, 0.068, rand()) * (height > 5 ? 1 : 0.8),
      lean: [lerp(0.2, 0.38, rand()), lerp(0.06, 0.18, rand())],
      near,
      phase: rand() * Math.PI * 2,
    }
  })

  const strokes: BambooStroke[] = []
  const GAP = 0.03
  culms.forEach((c, ci) => {
    const stemInk = c.near ? 0.62 : 0.4
    const leafInk = c.near ? 0.94 : 0.58
    // Internodes are short at the foot, longest through the middle, short again near the tip.
    const nodes: number[] = [0]
    let h = 0
    while (h < c.height) {
      const s = h / c.height
      h += lerp(0.2, 0.46, Math.sin(Math.PI * Math.min(1, s * 1.25)) ** 0.7) * lerp(0.9, 1.1, rand())
      nodes.push(Math.min(h, c.height) / c.height)
    }
    for (let k = 1; k < nodes.length; k++) {
      const s0 = (nodes[k - 1] as number) + (k === 1 ? 0 : GAP / 2 / c.height)
      const s1 = (nodes[k] as number) - (k === nodes.length - 1 ? 0 : GAP / 2 / c.height)
      if (s1 <= s0) continue
      const a = culmPoint(c, s0)
      strokes.push({ kind: STROKE.stem, a, axis: sub(culmPoint(c, s1), a), width: c.width * (1 - 0.45 * s0), bend: 0, ink: stemInk, seed: rand(), culm: ci })
    }
    // Node marks and twigs.
    for (let k = 1; k < nodes.length - 1; k++) {
      const s = nodes[k] as number
      const p = culmPoint(c, s)
      const dir = norm(sub(culmPoint(c, Math.min(1, s + 0.01)), p))
      const w = c.width * (1 - 0.45 * s)
      strokes.push({ kind: STROKE.node, a: p, axis: scale(dir, w * 1.9), width: 0.016, bend: 0.012, ink: Math.min(1, stemInk + 0.3), seed: rand(), culm: ci })
      // Twigs spring from alternate nodes in the upper half and carry the leaves.
      if (s < 0.45 || k % 2 === 1) continue
      const side = (k / 2) % 2 === 0 ? 1 : -1
      const up = lerp(35, 65, rand())
      const tdir = facingDir(180 - side * up, (rand() - 0.5) * 0.6)
      const tlen = lerp(0.35, 0.75, rand()) * (1.2 - s * 0.5)
      strokes.push({ kind: STROKE.twig, a: p, axis: scale(tdir, tlen), width: 0.014, bend: side * 0.03, ink: stemInk + 0.15, seed: rand(), culm: ci })
      const tip = add(p, tdir, tlen)
      // Leaves hang down and out, and lean west with the wind that moves the mist.
      const droop = side * lerp(25, 55, rand()) + 12
      leafGroup(strokes, tip, droop, rand() < 0.5 ? 'ge' : 'jie', leafInk, ci, rand)
      if (rand() < 0.55) leafGroup(strokes, add(p, tdir, tlen * 0.5), droop - side * 20, rand() < 0.6 ? 'ge' : 'ren', leafInk * 0.92, ci, rand, 0.85)
    }
    // The young tip: a small spray pointing up.
    const top = culmPoint(c, 1)
    leafGroup(strokes, top, 180 + (rand() - 0.5) * 30, 'ren', leafInk, ci, rand, 0.7)
  })
  return { culms, strokes }
}

/**
 * Bounds of every bamboo stroke, sway included. The strokes are placed by instance attributes, so
 * frustum culling needs this sphere instead of the instance matrices.
 */
export const BAMBOO_BOUNDS: { readonly centre: Vec3; readonly radius: number } = {
  centre: [pathZone.bamboo[0] + 0.8, 3.4, pathZone.bamboo[2] - 0.2],
  radius: 5.2,
}

// ---------------------------------------------------------------------------- the mist wall (§8.5 P2–P3, §11.2)

/**
 * Extra fog density (after the tier multiplier) that holds the mist wall at its peak while the
 * grove is not ready: "the mist waits for you" (§8.5 P2). Before the reveal the beat fog is still
 * climbing, so nothing is added there; from the reveal on it holds the peak until the grove is
 * ready or the walk leaves the grove. With the grove off the walk it waits for the lantern's scene
 * through P3 instead (MIST_WAIT).
 */
export function mistHoldBoost(jvh: number, fogBase: number, fogMultiplier: number, revealReady: boolean): number {
  if (revealReady || jvh < MIST_WAIT.jvh[0] || jvh >= MIST_WAIT.jvh[1]) return 0
  return Math.max(0, pathZone.mistWall.fogPeak - fogBase) * fogMultiplier
}

export interface Veil {
  /** Plane z (a vertical sheet across the path, facing north). */
  readonly z: number
  readonly x0: number
  readonly x1: number
  readonly height: number
  /** Peak opacity. */
  readonly opacity: number
  /** Lifts like a curtain as the mist parts (P3), instead of thinning in place. */
  readonly curtain: boolean
  readonly seed: number
}

/**
 * Sheets of paper-mist standing across the path in the wall (z −100 to −115) and past the crest.
 * Walking through them is what turns trees 3 m away into ghosts; the two curtains beyond the crest
 * rise as the camera tilts down onto the grove.
 */
export const VEILS: readonly Veil[] = [
  { z: -97, x0: -14, x1: 16, height: 9, opacity: 0.55, curtain: false, seed: 0.13 },
  { z: -101.5, x0: -15, x1: 15, height: 10, opacity: 0.7, curtain: false, seed: 0.37 },
  { z: -106, x0: -15, x1: 15, height: 11, opacity: 0.78, curtain: false, seed: 0.61 },
  { z: -110.5, x0: -15, x1: 15, height: 12, opacity: 0.78, curtain: false, seed: 0.83 },
  { z: -115, x0: -16, x1: 16, height: 12, opacity: 0.72, curtain: false, seed: 0.29 },
  { z: -127.5, x0: -18, x1: 18, height: 12, opacity: 0.85, curtain: true, seed: 0.47 },
  { z: -133, x0: -20, x1: 20, height: 14, opacity: 0.75, curtain: true, seed: 0.71 },
]

/** Jvh envelope of the wall veils: they gather with the rising fog and thin as it parts. */
export function veilOpacity(jvh: number, v: Veil): number {
  const [wall0] = MARKS.mistWall
  const [rev0, rev1] = MARKS.reveal
  const gather = smoothstep(wall0 - 4, wall0 + 8, jvh)
  // Wall sheets thin in place with the fog (630 to 642); curtains stay whole while they lift.
  const part = v.curtain ? 1 - smoothstep(rev1 - 8, rev1 - 1, jvh) : 1 - smoothstep(rev0 + 1, rev1 - 4, jvh)
  return v.opacity * gather * part
}

/** How far the curtains have risen, 0..1, over the fog's fall (§8.5 P3, "like a curtain lifting"). */
export function curtainLift(jvh: number): number {
  const [rev0, rev1] = MARKS.reveal
  return smoothstep(rev0 + 2, rev1 - 2, jvh)
}

/** Jvh span in which any veil can show; outside it the veil meshes are hidden. */
export const VEIL_SPAN: readonly [number, number] = [MARKS.mistWall[0] - 4, MARKS.reveal[1]]
