/**
 * The two path splines of design.md §5.1 as sampled polylines, plus the lookups the ground shader
 * and the scatter use. Pure TypeScript (no three), so tests and sections can call it.
 *
 * Both splines run strictly south (z decreasing), so each is a function x = c(z). The ground
 * shader relies on that: it looks the centre up by z instead of searching segments.
 */

import { pathToCabin, pathToGrove, PATH_WIDTH, type Vec2, type Vec3 } from '../core/world/layout'

/** Centripetal parameter step between two points: |b − a|^0.5. */
const knot = (a: Vec2, b: Vec2) => Math.max(Math.hypot(b[0] - a[0], b[1] - a[1]) ** 0.5, 1e-4)

/** Centripetal Catmull-Rom (alpha 0.5) through `points`, `perSegment` samples per span, ends included. */
export function sampleCentripetal(points: readonly Vec2[], perSegment = 16): Vec2[] {
  const n = points.length
  if (n < 2) return points.slice()
  const at = (i: number): Vec2 => {
    if (i < 0) {
      const a = points[0] as Vec2
      const b = points[1] as Vec2
      return [2 * a[0] - b[0], 2 * a[1] - b[1]]
    }
    if (i >= n) {
      const a = points[n - 1] as Vec2
      const b = points[n - 2] as Vec2
      return [2 * a[0] - b[0], 2 * a[1] - b[1]]
    }
    return points[i] as Vec2
  }
  const out: Vec2[] = []
  for (let i = 0; i < n - 1; i++) {
    const p0 = at(i - 1)
    const p1 = at(i)
    const p2 = at(i + 1)
    const p3 = at(i + 2)
    const t0 = 0
    const t1 = t0 + knot(p0, p1)
    const t2 = t1 + knot(p1, p2)
    const t3 = t2 + knot(p2, p3)
    const last = i === n - 2
    for (let s = 0; s < perSegment + (last ? 1 : 0); s++) {
      const t = t1 + ((t2 - t1) * s) / perSegment
      const mix = (a: Vec2, b: Vec2, ta: number, tb: number): Vec2 => {
        const w = (t - ta) / (tb - ta)
        return [a[0] + (b[0] - a[0]) * w, a[1] + (b[1] - a[1]) * w]
      }
      const a1 = mix(p0, p1, t0, t1)
      const a2 = mix(p1, p2, t1, t2)
      const a3 = mix(p2, p3, t2, t3)
      const b1 = mix(a1, a2, t0, t2)
      const b2 = mix(a2, a3, t1, t3)
      out.push(mix(b1, b2, t1, t2))
    }
  }
  return out
}

const xz = (p: Vec3): Vec2 => [p[0], p[2]]

/** Sampled centre lines, north to south. */
export const PATH_CURVES = {
  toCabin: sampleCentripetal(pathToCabin.map(xz), 24),
  toGrove: sampleCentripetal(pathToGrove.map(xz), 24),
} as const

/** Centre x of a sampled, z-monotonic polyline at `z`, or null outside its z range. */
function centreAt(curve: readonly Vec2[], z: number): number | null {
  const first = curve[0]
  const last = curve[curve.length - 1]
  if (!first || !last || z > first[1] || z < last[1]) return null
  for (let i = 1; i < curve.length; i++) {
    const a = curve[i - 1] as Vec2
    const b = curve[i] as Vec2
    if (z <= a[1] && z >= b[1]) {
      const t = a[1] === b[1] ? 0 : (a[1] - z) / (a[1] - b[1])
      return a[0] + (b[0] - a[0]) * t
    }
  }
  return null
}

/** Path centre x at `z` on whichever path covers it (the cabin gap, z −57 to −69, has none). */
export function pathCentreX(z: number): number | null {
  return centreAt(PATH_CURVES.toCabin, z) ?? centreAt(PATH_CURVES.toGrove, z)
}

/**
 * Ground-shader lookup table: path centre x every `step` metres from `z0` southward, packed four
 * per vec4 (uniform arrays of floats cost one vector slot per element on most drivers).
 * `NO_PATH` marks z values with no path.
 */
export const PATH_TABLE = { z0: 8, step: 1, count: 144, noPath: 1000 } as const

export function pathTable(): Float32Array {
  const { z0, step, count, noPath } = PATH_TABLE
  const data = new Float32Array(count)
  for (let i = 0; i < count; i++) data[i] = pathCentreX(z0 - i * step) ?? noPath
  return data
}

/** Ends of each strip (north, south), for the soft taper where a path starts or stops. */
export const PATH_ENDS = {
  toCabin: [pathToCabin[0]?.[2] ?? 6, pathToCabin[pathToCabin.length - 1]?.[2] ?? -57],
  toGrove: [pathToGrove[0]?.[2] ?? -69, pathToGrove[pathToGrove.length - 1]?.[2] ?? -132],
} as const

export const PATH_HALF_WIDTH = PATH_WIDTH / 2

/**
 * The walk's spine: both paths joined through the cabin, the grove centre and the lantern.
 * The pine field measures "near" and "far" from this line.
 */
export const WALK_LINE: readonly Vec2[] = [
  ...sampleCentripetal(pathToCabin.map(xz), 5),
  [4, -63],
  ...sampleCentripetal(pathToGrove.map(xz), 5),
  [0, -150],
  [0.6, -170],
  [1, -186.5],
]
