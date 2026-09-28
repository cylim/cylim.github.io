/**
 * Where the small brush marks go (design §8.1, §8.2): dry-brush grass in the meadow, grass and fern
 * clumps along both path edges, and 点苔 moss dots at the feet of near trunks and on the rock.
 * Pure TypeScript. Each list is shuffled so a tier's prefix (mesh.count) thins it evenly.
 */

import { threshold, terrainHeight, inKeepOut, KEEP_OUTS, type Vec2 } from '../../core/world/layout'
import { PATH_CURVES, PATH_HALF_WIDTH } from '../paths'
import type { PineInstance } from '../pines/forest'
import { lerp, rng } from '../random'

export interface Stroke {
  x: number
  y: number
  z: number
  /** Height of the stroke, metres. */
  height: number
  /** Width at the root, metres. */
  width: number
  /** Sideways curl at the tip, metres (signed). */
  bend: number
  /** Lean from vertical, radians (signed). */
  lean: number
  ink: number
  seed: number
}

export interface Dot {
  x: number
  y: number
  z: number
  size: number
  ink: number
  seed: number
}

function shuffle<T>(list: T[], rand: () => number): T[] {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    const t = list[i] as T
    list[i] = list[j] as T
    list[j] = t
  }
  return list
}

/**
 * A clump: blades fanning out from one root the way grass is painted (a few strokes, never a lawn).
 * They share a lean, as if the same wind bent them, spread outward in order, and curl the way they
 * lean, so neighbouring blades open like a fan instead of crossing into an X. The middle blades
 * are the longest.
 */
function clump(out: Stroke[], x: number, z: number, n: number, tall: number, rand: () => number, fern = false) {
  const wind = (rand() - 0.5) * 0.5
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0 : i / (n - 1) - 0.5
    // Roots step across the clump in the same order as the lean (x is screen-across on the walk).
    const sx = x + t * 0.08 + (rand() - 0.5) * 0.02
    const sz = z + (rand() - 0.5) * 0.04
    const lean = wind + t * (fern ? 1.3 : 0.9) + (rand() - 0.5) * 0.08
    out.push({
      x: sx,
      y: terrainHeight(sx, sz),
      z: sz,
      height: tall * lerp(0.8, 1.05, rand()) * (1 - 0.55 * Math.abs(t)),
      width: lerp(0.014, 0.026, rand()) * (fern ? 1.5 : 1),
      bend: Math.sign(lean || 1) * lerp(0.1, 0.3, rand()) * tall * (fern ? 1.2 : 0.8) * Math.min(1, Math.abs(lean) * 2 + 0.2),
      lean,
      ink: lerp(0.6, 0.9, rand()),
      seed: rand(),
    })
  }
}

export function planStrokes(): Stroke[] {
  const rand = rng(0x57a0)
  const out: Stroke[] = []
  // Meadow: sparse, low, dry.
  const { zNorth, zSouth } = threshold.grassStrokes
  for (let i = 0; i < 48; i++) {
    // Sparser toward K0, where each stroke would be large in the frame.
    const z = lerp(zSouth, zNorth, Math.pow(rand(), 1.6))
    const x = lerp(-16, 18, rand()) * lerp(0.5, 1, (zNorth - z) / (zNorth - zSouth))
    if (Math.abs(x) < 2.5 && z > 15) continue
    clump(out, x, z, 3 + Math.floor(rand() * 4), lerp(0.2, 0.46, rand()), rand)
  }
  // Path edges: clumps just outside the paper strip, alternating sides.
  const edge = (curve: readonly Vec2[]) => {
    let acc = 0
    let next = 0
    let side = 1
    for (let i = 1; i < curve.length; i++) {
      const a = curve[i - 1] as Vec2
      const b = curve[i] as Vec2
      const len = Math.hypot(b[0] - a[0], b[1] - a[1])
      while (next <= acc + len) {
        const t = (next - acc) / len
        const nx = -(b[1] - a[1]) / len
        const nz = (b[0] - a[0]) / len
        const off = PATH_HALF_WIDTH + lerp(0.15, 1.1, rand())
        const x = a[0] + (b[0] - a[0]) * t + nx * off * side
        const z = a[1] + (b[1] - a[1]) * t + nz * off * side
        if (!inKeepOut(x, z, KEEP_OUTS.filter((k) => k.id === 'stream' || k.id.startsWith('standing')), 0)) {
          const fern = rand() < 0.4
          clump(out, x, z, (fern ? 4 : 3) + Math.floor(rand() * 3), fern ? lerp(0.35, 0.7, rand()) : lerp(0.25, 0.5, rand()), rand, fern)
        }
        side = rand() < 0.7 ? -side : side
        next += lerp(0.9, 2.2, rand())
      }
      acc += len
    }
  }
  edge(PATH_CURVES.toCabin)
  edge(PATH_CURVES.toGrove)
  return shuffle(out, rand)
}

export function planMoss(pines: readonly PineInstance[]): Dot[] {
  const rand = rng(0x4055)
  const out: Dot[] = []
  const dot = (x: number, z: number, size: number) =>
    out.push({ x, y: terrainHeight(x, z) + size * 0.35, z, size, ink: lerp(0.85, 1, rand()), seed: rand() })
  for (const p of pines) {
    if (p.dWalk > 12 || rand() < 0.35) continue
    // A tight cluster on one side of the trunk foot, as 点苔 is dotted.
    const side = rand() * Math.PI * 2
    const n = 3 + Math.floor(rand() * 4)
    for (let i = 0; i < n; i++) {
      const a = side + (rand() - 0.5) * 1.6
      const r = lerp(0.3, 0.85, rand())
      dot(p.x + Math.cos(a) * r, p.z + Math.sin(a) * r, lerp(0.035, 0.08, rand()))
    }
  }
  // Around the foot of the rock; the dots on its top come from its facets (rockMossPoints).
  const [rx, , rz] = threshold.rock.pos
  for (let i = 0; i < 14; i++) {
    const a = rand() * Math.PI * 2
    const r = lerp(1.1, 2.4, rand())
    dot(rx + Math.cos(a) * r, rz + Math.sin(a) * r * 0.8, lerp(0.05, 0.1, rand()))
  }
  return shuffle(out, rand)
}
