/**
 * Procedural painted pines (design.md §7.2): a bent, tapering trunk with elbows, knots and root
 * buttresses, and needle pads drawn as brushwork, the way 松 is painted, not the cone of a
 * botanical conifer.
 *
 * Pads are cards: quads whose four corners share the pad centre as `position`. The vertex shader
 * (glsl/ink.vert.glsl, INK_NEEDLES) opens each card toward the camera, upright, so a pad is always
 * seen side-on like a painted one, and the fragment shader draws it from the needle atlas
 * (needleAtlas.ts). Two or three cards per pad, offset and tilted, layer it into a cluster.
 *
 * Geometry carries the attributes createInkMaterial reads: `ao` (baked), `swayW` (0 rooted, 1 pad
 * tip), `rim` (−1 wood, 0.5 pad card), `uv` (wood: around 0..1 and up in metres), and for cards
 * `card` (corner x, corner y, atlas cell + 16 if mirrored, tilt in radians) and `cardSize`
 * (half width, half height in metres, seed 0..1).
 */

import { BufferGeometry, Float32BufferAttribute, Vector3 } from 'three'
import { lerp, rng, smoothstep } from '../random'
import { NEEDLE_CELLS } from './needleAtlas'
import { FIELD_HEIGHTS } from './pineHeights'

export interface BranchSpec {
  /** Height on the trunk, as a fraction of the trunk's length. */
  at: number
  /** Direction in the ground plane, radians from +X toward +Z. */
  azimuth: number
  /** Horizontal reach, metres. */
  length: number
  /** Tip height relative to the start, metres (a slight up-turn, as painted). */
  rise: number
  padRadius: number
  /** Extra, smaller pads along the branch before the tip (0 to 2). */
  extraPads?: number
  /** A bare stub: no pad at all (old pines). */
  dead?: boolean
}

export interface PineSpec {
  seed: number
  height: number
  trunkRadius: number
  /** Trunk top offset from the base, metres (x, z). */
  lean: readonly [number, number]
  /** Sideways reach of the trunk's elbows, metres. */
  bend: number
  branches: readonly BranchSpec[]
  /** Flat crown pad on top, radius in metres (0 for none). */
  crown: number
  /** Pad height, metres: scales the needle cards' height (0.9 is a typical painted pad). */
  padThickness: number
  detail: PineDetail
  /** Split the trunk at this height (metres) into a second, shorter leader (pine B). */
  split?: { at: number; lean: readonly [number, number]; height: number }
}

/** 'far' is the field pine's distant LOD: under the fog, branches vanish and pads only need a silhouette. */
export type PineDetail = 'hero' | 'field' | 'far'

interface Detail {
  trunkRadial: number
  trunkSegments: number
  branchRadial: number
  branchSegments: number
  /** Needle cards per pad. */
  cards: number
  branches: boolean
  /** Root buttresses and an irregular cross-section. */
  roots: boolean
}

// Triangles a tree: hero about 1.5k, field about 180 (290 split), far 35 to 60. With the far LOD on
// pines more than 14 m from the walk, the forest costs about 32k triangles on low, 64k on medium and
// 125k on high (design §13.4: 120k mobile, 300k desktop, for everything). Cards cost 2 triangles;
// their pixels cost more.
const DETAIL: Record<PineDetail, Detail> = {
  hero: { trunkRadial: 14, trunkSegments: 40, branchRadial: 6, branchSegments: 7, cards: 3, branches: true, roots: true },
  field: { trunkRadial: 6, trunkSegments: 9, branchRadial: 3, branchSegments: 2, cards: 2, branches: true, roots: true },
  far: { trunkRadial: 4, trunkSegments: 3, branchRadial: 3, branchSegments: 1, cards: 1, branches: false, roots: false },
}

/** Card shape relative to the pad radius: the atlas cell is 2:1, and the painted mass sits a little below its centre. */
const CARD_HALF_WIDTH = 1.45
const CARD_MASS_Y = -0.18

class MeshBuilder {
  readonly pos: number[] = []
  readonly uv: number[] = []
  readonly ao: number[] = []
  readonly sway: number[] = []
  readonly rim: number[] = []
  readonly card: number[] = []
  readonly cardSize: number[] = []
  readonly idx: number[] = []
  maxCard = 0

  vertex(p: Vector3, u: number, v: number, ao: number, sway: number, rim: number): number {
    this.pos.push(p.x, p.y, p.z)
    this.uv.push(u, v)
    this.ao.push(ao)
    this.sway.push(sway)
    this.rim.push(rim)
    this.card.push(0, 0, 0, 0)
    this.cardSize.push(0, 0, 0)
    return this.pos.length / 3 - 1
  }

  /** A needle card: four corners at `centre`, opened by the vertex shader. */
  cardQuad(centre: Vector3, halfW: number, halfH: number, cell: number, tilt: number, seed: number, ao: number, sway: number) {
    const first = this.pos.length / 3
    for (const [cx, cy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
      this.pos.push(centre.x, centre.y, centre.z)
      this.uv.push((cx + 1) / 2, (cy + 1) / 2)
      this.ao.push(ao)
      this.sway.push(sway)
      this.rim.push(0.5)
      this.card.push(cx, cy, cell, tilt)
      this.cardSize.push(halfW, halfH, seed)
    }
    this.idx.push(first, first + 1, first + 2, first, first + 2, first + 3)
    this.maxCard = Math.max(this.maxCard, Math.hypot(halfW, halfH))
  }

  tri(a: number, b: number, c: number) {
    this.idx.push(a, b, c)
  }

  build(): BufferGeometry {
    const g = new BufferGeometry()
    g.setAttribute('position', new Float32BufferAttribute(this.pos, 3))
    g.setAttribute('uv', new Float32BufferAttribute(this.uv, 2))
    g.setAttribute('ao', new Float32BufferAttribute(this.ao, 1))
    g.setAttribute('swayW', new Float32BufferAttribute(this.sway, 1))
    g.setAttribute('rim', new Float32BufferAttribute(this.rim, 1))
    g.setAttribute('card', new Float32BufferAttribute(this.card, 4))
    g.setAttribute('cardSize', new Float32BufferAttribute(this.cardSize, 3))
    g.setIndex(this.idx)
    g.computeVertexNormals()
    // Cards are degenerate until the shader opens them; give them an upward normal so the lantern
    // and door-spill terms light them from above instead of reading a zero vector.
    const n = g.getAttribute('normal')
    for (let i = 0; i < this.rim.length; i++) if ((this.rim[i] ?? -1) >= 0) n.setXYZ(i, 0, 1, 0)
    g.computeBoundingSphere()
    if (g.boundingSphere) g.boundingSphere.radius += this.maxCard
    return g
  }
}

const UP = new Vector3(0, 1, 0)
const X = new Vector3(1, 0, 0)

/**
 * A tapering tube along `curve`, t in [0, 1]. `shape(t, a)` scales the radius around the ring
 * (a in radians), for root buttresses and a trunk that is never quite round.
 */
function tube(
  mb: MeshBuilder,
  curve: (t: number, out: Vector3) => Vector3,
  radius: (t: number) => number,
  segments: number,
  radial: number,
  attrs: (t: number, y: number) => { ao: number; sway: number },
  shape?: (t: number, a: number) => number,
) {
  const c = new Vector3()
  const c2 = new Vector3()
  const tangent = new Vector3()
  const nrm = new Vector3()
  const bin = new Vector3()
  const p = new Vector3()
  let along = 0
  const prev = new Vector3()
  const rings: number[] = []
  for (let i = 0; i <= segments; i++) {
    const t = i / segments
    curve(t, c)
    curve(Math.min(1, t + 0.01), c2)
    if (t >= 1) {
      curve(0.99, tangent)
      tangent.subVectors(c, tangent)
    } else tangent.subVectors(c2, c)
    tangent.normalize()
    if (i > 0) along += c.distanceTo(prev)
    prev.copy(c)
    const ref = Math.abs(tangent.y) < 0.9 ? UP : X
    nrm.crossVectors(ref, tangent).normalize()
    bin.crossVectors(tangent, nrm)
    const r = radius(t)
    const { ao, sway } = attrs(t, c.y)
    rings.push(mb.pos.length / 3)
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2
      const k = shape ? shape(t, a % (Math.PI * 2)) : 1
      p.copy(c)
        .addScaledVector(nrm, Math.cos(a) * r * k)
        .addScaledVector(bin, Math.sin(a) * r * k)
      mb.vertex(p, j / radial, along, ao, sway, -1)
    }
  }
  for (let i = 0; i < segments; i++) {
    const a0 = rings[i] as number
    const b0 = rings[i + 1] as number
    for (let j = 0; j < radial; j++) {
      mb.tri(a0 + j, b0 + j, a0 + j + 1)
      mb.tri(a0 + j + 1, b0 + j, b0 + j + 1)
    }
  }
}

/**
 * A needle pad: `cards` needle cards around `centre`. The first carries the mass; the others,
 * smaller, sit up and out along the branch so the pad reads as layered clusters, each tilted a
 * little with the branch.
 */
function pad(mb: MeshBuilder, centre: Vector3, along: Vector3, radius: number, thickness: number, cards: number, sway: number, ao: number, rand: () => number) {
  const across = new Vector3().crossVectors(UP, along).normalize()
  const heightScale = thickness / 0.9
  const c = new Vector3()
  for (let i = 0; i < cards; i++) {
    const k = i === 0 ? 1 : lerp(0.55, 0.78, rand())
    c.copy(centre)
    if (i > 0) {
      const side = i % 2 === 1 ? 1 : -1
      c.addScaledVector(along, side * lerp(0.3, 0.6, rand()) * radius)
        .addScaledVector(UP, lerp(0.12, 0.38, rand()) * radius)
        .addScaledVector(across, (rand() - 0.5) * 0.7 * radius)
    }
    const halfW = radius * CARD_HALF_WIDTH * k
    const halfH = (halfW / 2) * heightScale
    c.addScaledVector(UP, -CARD_MASS_Y * halfH)
    const cell = Math.floor(rand() * NEEDLE_CELLS) + (rand() < 0.5 ? 16 : 0)
    const tilt = (rand() - 0.5) * 0.3
    mb.cardQuad(c, halfW, halfH, cell, tilt, rand(), i === 0 ? ao : Math.min(1, ao + 0.1), sway)
  }
}

/**
 * Trunk centre line: base at the origin, top at (lean, height). Painted pines bend at elbows, not
 * in a smooth sine: a few kinks at random heights, alternating sides, smoothed just enough.
 */
function trunkCurve(spec: { height: number; lean: readonly [number, number]; bend: number }, seed: number) {
  const rand = rng(seed)
  const knots: { t: number; x: number; z: number }[] = [{ t: 0, x: 0, z: 0 }]
  const n = 3
  let side = rand() < 0.5 ? -1 : 1
  for (let i = 1; i <= n; i++) {
    side = -side
    const t = i / (n + 1) + (rand() - 0.5) * 0.12
    const reach = spec.bend * lerp(0.5, 1.1, rand()) * Math.sin(Math.PI * t) * 1.2
    const a = rand() * Math.PI * 2
    knots.push({ t, x: side * reach * Math.abs(Math.cos(a)) + Math.sin(a) * reach * 0.3, z: reach * 0.7 * Math.sin(a) })
  }
  knots.push({ t: 1, x: 0, z: 0 })
  return (t: number, out: Vector3) => {
    let i = 1
    while (i < knots.length - 1 && t > (knots[i]?.t ?? 1)) i++
    const a = knots[i - 1] ?? knots[0]!
    const b = knots[i] ?? knots[knots.length - 1]!
    const f = b.t === a.t ? 0 : (t - a.t) / (b.t - a.t)
    // Ease in and out of each knot, but only a little, so the elbows keep an angle.
    const s = lerp(f, f * f * (3 - 2 * f), 0.6)
    return out.set(spec.lean[0] * t * t + lerp(a.x, b.x, s), spec.height * t, spec.lean[1] * t * t + lerp(a.z, b.z, s))
  }
}

/** Knot bulges along a trunk: t positions and strengths. */
function trunkKnots(rand: () => number): { t: number; k: number }[] {
  const n = 2 + Math.floor(rand() * 3)
  return Array.from({ length: n }, () => ({ t: lerp(0.12, 0.8, rand()), k: lerp(0.08, 0.2, rand()) }))
}

export function buildPine(spec: PineSpec, detail: PineDetail = spec.detail): BufferGeometry {
  const d = DETAIL[detail]
  const mb = new MeshBuilder()
  const rand = rng(spec.seed)
  const H = spec.height
  const heightSway = (y: number) => (y / H) ** 2

  const trunks: { curve: (t: number, out: Vector3) => Vector3; height: number; r0: number; from: number }[] = []
  const main = trunkCurve(spec, spec.seed + 1)
  trunks.push({ curve: main, height: H, r0: spec.trunkRadius, from: 0 })
  if (spec.split) {
    const s = spec.split
    const base = main(s.at / H, new Vector3())
    const leader = trunkCurve({ height: s.height - s.at, lean: s.lean, bend: spec.bend * 0.8 }, spec.seed + 7)
    trunks.push({
      curve: (t, out) => leader(t, out).add(base),
      height: s.height,
      r0: spec.trunkRadius * 0.62,
      from: s.at,
    })
  }

  for (const tr of trunks) {
    const len = tr.height - tr.from
    const knots = trunkKnots(rand)
    const rootPhase = rand() * Math.PI * 2
    const rootLobes = 3 + Math.floor(rand() * 2)
    const oval = lerp(0.06, 0.14, rand())
    tube(
      mb,
      tr.curve,
      (t) => {
        const y = tr.from + t * len
        // Root flare near the ground, a taper to a twig at the top, and knots where old branches were.
        const flare = tr.from === 0 ? 1 + 0.5 * (1 - smoothstep(0, 1.1, y)) : 1
        let knot = 1
        for (const k of knots) knot += k.k * Math.exp(-(((t - k.t) / 0.035) ** 2))
        return tr.r0 * (1 - 0.8 * t ** 0.85) * flare * knot
      },
      d.trunkSegments,
      d.trunkRadial,
      (_t, y) => ({ ao: lerp(0.55, 1, smoothstep(0, 1.6, y)), sway: heightSway(y) * 0.25 }),
      d.roots
        ? (t, a) => {
            const y = tr.from + t * len
            const roots = tr.from === 0 ? 0.35 * (1 - smoothstep(0, 0.9, y)) * Math.max(0, Math.cos(rootLobes * a + rootPhase)) ** 2 : 0
            return 1 + roots + oval * Math.cos(2 * a + rootPhase)
          }
        : undefined,
    )
  }

  const p = new Vector3()
  const dir = new Vector3()
  for (const b of spec.branches) {
    main(b.at, p)
    const start = p.clone()
    dir.set(Math.cos(b.azimuth), 0, Math.sin(b.azimuth))
    const tip = start.clone().addScaledVector(dir, b.length).add(new Vector3(0, b.rise, 0))
    // Painted branches kink: out and slightly down first, then up toward the pad.
    const side = new Vector3(-dir.z, 0, dir.x).multiplyScalar((rand() - 0.5) * 0.6 * b.length)
    const mid = start
      .clone()
      .addScaledVector(dir, b.length * 0.45)
      .add(side)
      .add(new Vector3(0, -lerp(0.08, 0.2, rand()) * b.length, 0))
    const bez = (t: number, out: Vector3) => {
      const u = 1 - t
      return out
        .copy(start)
        .multiplyScalar(u * u)
        .addScaledVector(mid, 2 * u * t)
        .addScaledVector(tip, t * t)
    }
    const r0 = spec.trunkRadius * (1 - 0.8 * b.at ** 0.85) * 0.6
    if (d.branches)
      tube(
        mb,
        bez,
        (t) => lerp(r0, b.dead ? 0.012 : 0.03, Math.sqrt(t)),
        d.branchSegments,
        d.branchRadial,
        (t, y) => ({ ao: 0.9, sway: heightSway(y) * (0.3 + 0.5 * t) }),
      )
    if (b.dead) continue
    const swayAt = (y: number) => lerp(0.6, 1, y / H)
    // Lower pads sit in the shade of the ones above: a little darker.
    const aoAt = (y: number) => lerp(0.82, 1, smoothstep(H * 0.3, H * 0.85, y))
    pad(mb, tip.clone().add(new Vector3(0, spec.padThickness * 0.2, 0)), dir, b.padRadius, spec.padThickness, d.cards, swayAt(tip.y), aoAt(tip.y), rand)
    for (let e = 0; e < (b.extraPads ?? 0); e++) {
      const t = lerp(0.45, 0.7, (e + 1) / ((b.extraPads ?? 0) + 1))
      bez(t, p)
      pad(mb, p.clone().add(new Vector3(0, spec.padThickness * 0.3, 0)), dir, b.padRadius * 0.62, spec.padThickness * 0.85, Math.max(1, d.cards - 1), swayAt(p.y), aoAt(p.y), rand)
    }
  }

  if (spec.crown > 0) {
    for (const tr of trunks) {
      tr.curve(0.97, p)
      const crownR = tr === trunks[0] ? spec.crown : spec.crown * 0.75
      dir.set(Math.cos(rand() * 6.28), 0, Math.sin(rand() * 6.28))
      pad(mb, p.clone(), dir, crownR, spec.padThickness * 1.1, d.cards, 1, 1, rand)
    }
  }
  return mb.build()
}

/**
 * Seeded branch layout for the field variants: `count` branches spiralling up from `firstAt`,
 * shorter toward the top, reaching mostly sideways like painted pines.
 */
export function fieldBranches(seed: number, count: number, firstAt: number, reach: readonly [number, number], padRadius: readonly [number, number], deadStubs = 0): BranchSpec[] {
  const rand = rng(seed)
  const out: BranchSpec[] = []
  let az = rand() * Math.PI * 2
  for (let i = 0; i < count; i++) {
    const f = count === 1 ? 0 : i / (count - 1)
    az += 2.4 + (rand() - 0.5) * 0.8
    out.push({
      at: lerp(firstAt, 0.9, f) + (rand() - 0.5) * 0.04,
      azimuth: az,
      length: lerp(reach[1], reach[0], f) * lerp(0.8, 1.15, rand()),
      rise: lerp(0.1, 0.6, rand()),
      padRadius: lerp(padRadius[1], padRadius[0], f) * lerp(0.85, 1.15, rand()),
    })
  }
  for (let i = 0; i < deadStubs; i++) {
    out.push({ at: lerp(0.25, 0.45, rand()), azimuth: rand() * Math.PI * 2, length: lerp(0.8, 1.6, rand()), rise: -0.2, padRadius: 0, dead: true })
  }
  return out
}

/** The four instanced variants: three corridor pines and the grove's old crooked pine. */
export const FIELD_SPECS: readonly PineSpec[] = [
  // Tall, nearly straight, layered pads up the top half.
  { seed: 101, height: FIELD_HEIGHTS[0], trunkRadius: 0.24, lean: [0.9, 0.2], bend: 0.55, branches: fieldBranches(11, 4, 0.5, [1.4, 2.8], [1.2, 1.9]), crown: 1.9, padThickness: 0.9, detail: 'field' },
  // Leaning, with its weight thrown to one side, and a second leader from low on the trunk.
  { seed: 202, height: FIELD_HEIGHTS[1], trunkRadius: 0.22, lean: [2.2, 0.5], bend: 0.7, branches: fieldBranches(22, 4, 0.44, [1.3, 3.1], [1.1, 1.8]), crown: 1.7, padThickness: 0.9, detail: 'field', split: { at: 3.6, lean: [-1.4, -0.6], height: 8.6 } },
  // Shorter and broad.
  { seed: 303, height: FIELD_HEIGHTS[2], trunkRadius: 0.23, lean: [-1.1, 0.4], bend: 0.6, branches: fieldBranches(33, 4, 0.46, [1.5, 3.2], [1.3, 2.0]), crown: 2.0, padThickness: 1.0, detail: 'field' },
  // Old and crooked, for the grove ring: strong bends, big pads, a dead stub (design §8.6).
  { seed: 404, height: FIELD_HEIGHTS[3], trunkRadius: 0.34, lean: [2.0, -0.9], bend: 1.3, branches: fieldBranches(44, 4, 0.36, [2.0, 3.8], [1.5, 2.4], 1), crown: 2.3, padThickness: 1.05, detail: 'field' },
]
