/**
 * Where every part of the cabin shell goes (design.md §5.1, §8.3). Pure data from core/world/layout.ts
 * plus the builder dimensions the design leaves to the implementer; geometry.ts turns it into meshes.
 */

import { cabin, type Vec3 } from '../../../core/world/layout'
import { rng } from '../../../env'
import { PLANK as SHARED_PLANK } from '../shared/planks'

const DEG = Math.PI / 180
const { footprint, floorY, eavesY, door, latticeWindow } = cabin

/** Plank face height and the gaps between them (§8.3), shared with the near room inside; planks sit out 0–1 cm at random. */
export const PLANK = {
  height: SHARED_PLANK.rowHeight,
  gapMin: SHARED_PLANK.gapMin,
  gapMax: SHARED_PLANK.gapMax,
  thickness: SHARED_PLANK.wallThickness,
  maxOffset: 0.01,
} as const

/** Gable roof (悬山): 40° pitch from the wall plates at the eaves, overhanging the gables and the eaves. */
export const ROOF = {
  pitch: cabin.roofPitchDeg * DEG,
  halfSpan: (footprint.x1 - footprint.x0) / 2,
  thickness: 0.26,
} as const

/** Ridge height of the roof's underside, from the pitch. layout.ts `cabin.ridgeY` records the same number. */
export const RIDGE_Y = eavesY + ROOF.halfSpan * Math.tan(ROOF.pitch)

/**
 * The two stone steps up to the door (layout.ts `cabin.steps` holds their centres, outer last): each
 * 0.6 m deep and one riser high, and the footings stand this far proud of the walls.
 */
export const STEPS = { depth: 0.6, rise: 0.15, footingLip: 0.15 } as const

/** Door frame and window frame widths: planks stop at their outer edges. */
export const FRAME = { jamb: 0.08, depth: 0.12, window: 0.05 } as const

/** A rectangle in wall coordinates: s along the wall from its start, y up. */
export interface WallRect {
  readonly s0: number
  readonly s1: number
  readonly y0: number
  readonly y1: number
}

export interface Wall {
  readonly name: 'north' | 'south' | 'east' | 'west'
  /** Start of the wall's outer face line at floor level (y is ignored). */
  readonly origin: Vec3
  /** Unit direction along the wall. */
  readonly along: Vec3
  /** Unit outward normal. */
  readonly out: Vec3
  /** rotation.y that turns a box's local +X along the wall and local +Z outward. */
  readonly yaw: number
  readonly length: number
  /** Gable walls carry the triangle up to the ridge. */
  readonly gable: boolean
  readonly openings: readonly WallRect[]
}

const width = footprint.x1 - footprint.x0
const depth = footprint.zNorth - footprint.zSouth

/** The four walls, each running left to right as seen from outside. The north wall faces the approach; its s runs west from the east corner. */
export const WALLS: readonly Wall[] = [
  {
    name: 'north',
    origin: [footprint.x0, 0, footprint.zNorth],
    along: [1, 0, 0],
    out: [0, 0, 1],
    yaw: 0,
    length: width,
    gable: true,
    openings: [
      {
        s0: door.centre[0] - door.width / 2 - FRAME.jamb - footprint.x0,
        s1: door.centre[0] + door.width / 2 + FRAME.jamb - footprint.x0,
        y0: floorY,
        y1: floorY + door.height + FRAME.jamb,
      },
      {
        s0: latticeWindow.centre[0] - latticeWindow.size / 2 - FRAME.window - footprint.x0,
        s1: latticeWindow.centre[0] + latticeWindow.size / 2 + FRAME.window - footprint.x0,
        y0: latticeWindow.centre[1] - latticeWindow.size / 2 - FRAME.window,
        y1: latticeWindow.centre[1] + latticeWindow.size / 2 + FRAME.window,
      },
    ],
  },
  { name: 'south', origin: [footprint.x1, 0, footprint.zSouth], along: [-1, 0, 0], out: [0, 0, -1], yaw: Math.PI, length: width, gable: true, openings: [] },
  { name: 'east', origin: [footprint.x0, 0, footprint.zSouth], along: [0, 0, 1], out: [-1, 0, 0], yaw: -Math.PI / 2, length: depth, gable: false, openings: [] },
  { name: 'west', origin: [footprint.x1, 0, footprint.zNorth], along: [0, 0, -1], out: [1, 0, 0], yaw: Math.PI / 2, length: depth, gable: false, openings: [] },
]

export interface Plank {
  readonly centre: Vec3
  /** Length along the wall, height, thickness. */
  readonly size: Vec3
  readonly yaw: number
  /** Ink weight multiplier (the `iInk` instance attribute). */
  readonly ink: number
  readonly seed: number
  readonly wall: Wall['name']
}

/** Course bottoms and heights from the floor to the ridge, shared by all four walls so the gaps meet at the corners. */
export function plankCourses(seed = 11): readonly { y0: number; h: number }[] {
  const rand = rng(seed)
  const out: { y0: number; h: number }[] = []
  let y = floorY
  while (y < RIDGE_Y - 0.05) {
    out.push({ y0: y, h: PLANK.height })
    y += PLANK.height + PLANK.gapMin + rand() * (PLANK.gapMax - PLANK.gapMin)
  }
  return out
}

/** Half-width of the gable triangle at height y (the underside of the roof). */
export const gableHalfWidth = (y: number) => (y <= eavesY ? ROOF.halfSpan : Math.max(0, ROOF.halfSpan * (RIDGE_Y - y) / (RIDGE_Y - eavesY)))

/**
 * Cut a course's rectangle around the openings it overlaps. A course that only crosses an opening's
 * top or bottom edge keeps a narrower plank above or below the frame, so no hole opens beside it.
 */
function cutOpenings(course: WallRect, openings: readonly WallRect[]): WallRect[] {
  let rects: WallRect[] = [course]
  for (const o of openings) {
    rects = rects.flatMap((r): WallRect[] => {
      if (o.s1 <= r.s0 || o.s0 >= r.s1 || o.y1 <= r.y0 || o.y0 >= r.y1) return [r]
      const s0 = Math.max(r.s0, o.s0)
      const s1 = Math.min(r.s1, o.s1)
      return [
        { ...r, s1: o.s0 },
        { ...r, s0: o.s1 },
        { s0, s1, y0: o.y1, y1: r.y1 },
        { s0, s1, y0: r.y0, y1: o.y0 },
      ]
    })
  }
  return rects.filter((r) => r.s1 - r.s0 > 0.04 && r.y1 - r.y0 > 0.03)
}

/**
 * Every wall plank: horizontal, 0.22 m faces with 6–10 mm gaps, pushed out 0–1 cm at random (§8.3).
 * Courses above the eaves exist only on the gables, cut to the roof line; long runs get one butt
 * joint at random so the walls don't read as ruled.
 */
export function wallPlanks(seed = 7): readonly Plank[] {
  const rand = rng(seed)
  const courses = plankCourses()
  const out: Plank[] = []
  for (const wall of WALLS) {
    for (const { y0, h } of courses) {
      const top = Math.min(y0 + h, wall.gable ? RIDGE_Y : eavesY)
      if (top - y0 < 0.03) continue
      const trim = Math.max(0, wall.length / 2 - gableHalfWidth(y0 + (top - y0) / 2))
      let rects = cutOpenings({ s0: trim, s1: wall.length - trim, y0, y1: top }, wall.openings)
      if (y0 < eavesY) {
        rects = rects.flatMap((r): WallRect[] => {
          if (r.s1 - r.s0 < 2.5 || rand() > 0.45) return [r]
          const j = r.s0 + (r.s1 - r.s0) * (0.3 + rand() * 0.4)
          return [
            { ...r, s1: j - 0.004 },
            { ...r, s0: j + 0.004 },
          ]
        })
      }
      for (const r of rects) {
        const len = r.s1 - r.s0
        const push = rand() * PLANK.maxOffset
        const mid = r.s0 + len / 2
        const inset = PLANK.thickness / 2 - push
        out.push({
          centre: [
            wall.origin[0] + wall.along[0] * mid - wall.out[0] * inset,
            (r.y0 + r.y1) / 2,
            wall.origin[2] + wall.along[2] * mid - wall.out[2] * inset,
          ],
          size: [len, r.y1 - r.y0, PLANK.thickness],
          yaw: wall.yaw,
          ink: 0.84 + rand() * 0.16,
          seed: rand(),
          wall: wall.name,
        })
      }
    }
  }
  return out
}

/**
 * The 步步锦 ("step by step, brocade") lattice in window-local metres, centred on the window: bars
 * as [x, y, w, h]. Nested frames alternate which way they run full length, so each ring steps in
 * from the last; short struts tie the rings together. Openings stay 6–12 cm so the leak shows.
 */
export function latticeBars(size = latticeWindow.size, bar = 0.018): readonly (readonly [number, number, number, number])[] {
  const h = size / 2
  const r1 = h - 0.1
  const r2 = h - 0.2
  const out: (readonly [number, number, number, number])[] = []
  // Ring 1 runs horizontally edge to edge; its uprights sit between.
  out.push([0, r1, size, bar], [0, -r1, size, bar])
  out.push([r1, 0, bar, 2 * r1], [-r1, 0, bar, 2 * r1])
  // Ring 2 runs vertically between ring 1's rails; its rails sit between.
  out.push([r2, 0, bar, 2 * r1], [-r2, 0, bar, 2 * r1])
  out.push([0, r2, 2 * r2, bar], [0, -r2, 2 * r2, bar])
  // Struts: ring 1 to the frame (mid-height at the sides, in line with ring 2 above and below),
  // ring 2 to ring 1 at mid-width, and a centre cross-tie.
  const s = (h - r1) / 2
  out.push([r1 + s, 0, h - r1, bar], [-(r1 + s), 0, h - r1, bar])
  for (const x of [r2, -r2]) out.push([x, r1 + s, bar, h - r1], [x, -(r1 + s), bar, h - r1])
  out.push([0, (r1 + r2) / 2, bar, r1 - r2], [0, -(r1 + r2) / 2, bar, r1 - r2])
  out.push([0, 0, 2 * r2, bar])
  return out
}
