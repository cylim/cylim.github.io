/**
 * Progressive Poisson-disc scatter (pure TypeScript, deterministic).
 *
 * Points come out in passes of shrinking spacing, and every pass keeps the points before it. So any
 * prefix of the result is itself evenly spread, which is what lets a tier change set `mesh.count`
 * (300 / 700 / 1500) without re-scattering: low tier gets the coarse pass, a sparser but still
 * even forest, and the fog covers the rest.
 */

import type { Vec2 } from '../core/world/layout'
import { rng } from './random'

export interface ScatterPoint {
  x: number
  z: number
  /** Base spacing at this point. Pass k compares spacings times `passes[k]`. */
  r: number
  /** Pass that placed it; −1 for `fixed` points, whose `r` is absolute and never shrinks. */
  pass: number
}

export interface ScatterOptions {
  seed: number
  bounds: { x0: number; x1: number; z0: number; z1: number }
  /** Base spacing at (x, z), or null to reject the spot (outside the region, inside a keep-out). */
  radius: (x: number, z: number) => number | null
  /** Spacing multipliers per pass, largest first, ending at 1. */
  passes: readonly number[]
  /** Darts per square metre of bounds in the final pass; coarser passes need fewer (÷ mult²). */
  dartsPerM2?: number
  /** Stop once this many points exist. */
  max?: number
  /** Points already placed (hand-placed trees, an earlier scatter). They block but are not returned. */
  fixed?: readonly ScatterPoint[]
}

export function poissonScatter(opts: ScatterOptions): ScatterPoint[] {
  const { bounds, radius, passes } = opts
  const rand = rng(opts.seed)
  const max = opts.max ?? Infinity
  const w = bounds.x1 - bounds.x0
  const h = bounds.z1 - bounds.z0
  const area = Math.abs(w * h)

  // Flat bucket grid over the bounds; queries widen to cover the largest spacing in play.
  const cell = 4
  const gx0 = Math.min(bounds.x0, bounds.x1)
  const gz0 = Math.min(bounds.z0, bounds.z1)
  const nx = Math.ceil(Math.abs(w) / cell) + 1
  const nz = Math.ceil(Math.abs(h) / cell) + 1
  const buckets: ScatterPoint[][] = Array.from({ length: nx * nz }, () => [])
  let reach = 0
  const insert = (p: ScatterPoint) => {
    const cx = Math.floor((p.x - gx0) / cell)
    const cz = Math.floor((p.z - gz0) / cell)
    if (cx < 0 || cz < 0 || cx >= nx || cz >= nz) return
    buckets[cz * nx + cx]?.push(p)
    reach = Math.max(reach, p.r)
  }
  const blocked = (x: number, z: number, r: number, mult: number) => {
    const span = Math.ceil((Math.max(r, reach) * Math.max(mult, 1)) / cell)
    const cx = Math.floor((x - gx0) / cell)
    const cz = Math.floor((z - gz0) / cell)
    for (let j = Math.max(0, cz - span); j <= Math.min(nz - 1, cz + span); j++) {
      for (let i = Math.max(0, cx - span); i <= Math.min(nx - 1, cx + span); i++) {
        const list = buckets[j * nx + i]
        if (!list) continue
        for (const q of list) {
          const need = Math.max(r * mult, q.pass < 0 ? q.r : q.r * mult)
          const dx = q.x - x
          const dz = q.z - z
          if (dx * dx + dz * dz < need * need) return true
        }
      }
    }
    return false
  }

  for (const p of opts.fixed ?? []) insert(p)
  const out: ScatterPoint[] = []
  passes.forEach((mult, pass) => {
    const darts = Math.ceil((area * (opts.dartsPerM2 ?? 0.5)) / (mult * mult))
    for (let d = 0; d < darts && out.length < max; d++) {
      const x = bounds.x0 + rand() * w
      const z = bounds.z0 + rand() * h
      const r = radius(x, z)
      if (r === null) continue
      if (blocked(x, z, r, mult)) continue
      const p = { x, z, r, pass }
      out.push(p)
      insert(p)
    }
  })
  return out
}

/** Distance from (x, z) to the nearest point of `line`, and the arc-length position of that point. */
export function nearestOnPolyline(x: number, z: number, line: readonly Vec2[]): { d: number; s: number } {
  let best = Infinity
  let bestS = 0
  let acc = 0
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1] as Vec2
    const b = line[i] as Vec2
    const dx = b[0] - a[0]
    const dz = b[1] - a[1]
    const len2 = dx * dx + dz * dz
    const len = Math.sqrt(len2)
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / len2))
    const ex = x - (a[0] + t * dx)
    const ez = z - (a[1] + t * dz)
    const d2 = ex * ex + ez * ez
    if (d2 < best) {
      best = d2
      bestS = acc + t * len
    }
    acc += len
  }
  return { d: Math.sqrt(best), s: bestS }
}

/**
 * Distance to a polyline sampled on a grid and read back bilinearly: exact at the samples and within
 * a few centimetres between them at `step` 1 m, and thousands of times cheaper per lookup.
 */
export function distanceGrid(
  line: readonly Vec2[],
  bounds: { x0: number; x1: number; z0: number; z1: number },
  step = 1,
): (x: number, z: number) => number {
  const xMin = Math.min(bounds.x0, bounds.x1)
  const zMin = Math.min(bounds.z0, bounds.z1)
  const nx = Math.ceil(Math.abs(bounds.x1 - bounds.x0) / step) + 1
  const nz = Math.ceil(Math.abs(bounds.z1 - bounds.z0) / step) + 1
  const data = new Float32Array(nx * nz)
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) data[j * nx + i] = nearestOnPolyline(xMin + i * step, zMin + j * step, line).d
  }
  return (x, z) => {
    const fx = Math.min(Math.max((x - xMin) / step, 0), nx - 1.001)
    const fz = Math.min(Math.max((z - zMin) / step, 0), nz - 1.001)
    const i = Math.floor(fx)
    const j = Math.floor(fz)
    const tx = fx - i
    const tz = fz - j
    const at = (a: number, b: number) => data[b * nx + a] ?? 0
    const top = at(i, j) + (at(i + 1, j) - at(i, j)) * tx
    const bottom = at(i, j + 1) + (at(i + 1, j + 1) - at(i, j + 1)) * tx
    return top + (bottom - top) * tz
  }
}
