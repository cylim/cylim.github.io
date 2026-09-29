import { hall } from '../../../core/world/layout'

/**
 * The points on the night shell (design.md §8.4): about 300 irregular cyan points, every one at
 * least 20 m from the camera's walk down the hall. Never a grid: positions are free floats,
 * thinned by a smooth noise so they gather in loose drifts, with a minimum spacing so no two
 * clump into one blob.
 */

export interface ShellStar {
  position: [number, number, number]
  size: number
  seed: [number, number, number, number]
}

export const STAR_MIN_DISTANCE = 20

/** The camera's walk through the hall, as a segment (x, y, z from and to). */
const WALK: [[number, number, number], [number, number, number]] = [
  [hall.centreLineX, 2, hall.floor.zNorth],
  [hall.centreLineX, 2, hall.backWall.z],
]

function distanceToWalk(p: readonly [number, number, number]): number {
  const [a, b] = WALK
  const dz = b[2] - a[2]
  const t = Math.min(1, Math.max(0, (p[2] - a[2]) / dz))
  return Math.hypot(p[0] - a[0], p[1] - a[1], p[2] - (a[2] + t * dz))
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Smooth, cheap drift field for thinning (sum of a few skewed sines). */
const drift = (x: number, y: number, z: number) =>
  0.5 + 0.25 * Math.sin(x * 0.21 + z * 0.13) * Math.cos(y * 0.17 - z * 0.07) + 0.25 * Math.sin(x * 0.05 - y * 0.23 + z * 0.19)

export function shellStars(count = 300, seed = 0x5eed): ShellStar[] {
  const rand = mulberry32(seed)
  const s = hall.nightShell
  // Inset so points sit just inside the walls and never z-fight them.
  const e = 0.3
  const faces: { area: number; at: () => [number, number, number] }[] = [
    { area: (s.y1 - s.y0) * (s.zNorth - s.zSouth), at: () => [s.x0 + e, s.y0 + rand() * (s.y1 - s.y0), s.zSouth + rand() * (s.zNorth - s.zSouth)] },
    { area: (s.y1 - s.y0) * (s.zNorth - s.zSouth), at: () => [s.x1 - e, s.y0 + rand() * (s.y1 - s.y0), s.zSouth + rand() * (s.zNorth - s.zSouth)] },
    { area: (s.x1 - s.x0) * (s.zNorth - s.zSouth), at: () => [s.x0 + rand() * (s.x1 - s.x0), s.y1 - e, s.zSouth + rand() * (s.zNorth - s.zSouth)] },
    { area: (s.x1 - s.x0) * (s.zNorth - s.zSouth), at: () => [s.x0 + rand() * (s.x1 - s.x0), s.y0 + e, s.zSouth + rand() * (s.zNorth - s.zSouth)] },
    { area: (s.x1 - s.x0) * (s.y1 - s.y0), at: () => [s.x0 + rand() * (s.x1 - s.x0), s.y0 + rand() * (s.y1 - s.y0), s.zSouth + e] },
  ]
  const total = faces.reduce((a, f) => a + f.area, 0)
  const out: ShellStar[] = []
  const minGap = 2.2
  for (let tries = 0; out.length < count && tries < count * 200; tries++) {
    let r = rand() * total
    const face = faces.find((f) => (r -= f.area) < 0) ?? faces[0]
    if (!face) break
    const p = face.at()
    if (distanceToWalk(p) < STAR_MIN_DISTANCE) continue
    if (rand() > drift(p[0], p[1], p[2]) ** 1.6) continue
    if (out.some((o) => Math.hypot(o.position[0] - p[0], o.position[1] - p[1], o.position[2] - p[2]) < minGap)) continue
    const bright = rand() < 0.08
    out.push({ position: p, size: bright ? 0.28 + rand() * 0.14 : 0.1 + rand() * 0.12, seed: [rand(), rand(), rand(), rand()] })
  }
  return out
}
