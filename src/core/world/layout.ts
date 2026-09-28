/**
 * World layout: every fixed coordinate in the walk (design.md §0, §5, §8, §9).
 *
 * Units are metres, +Y is up, and the world is compass-true:
 *   north = +Z, south = −Z, east = −X, west = +X.
 * The walk heads south (−Z), three.js's default camera forward. Facing south, screen-right is
 * west (+X) and screen-left is east (−X): the traditional south-up Chinese map the grove relies on.
 *
 * Pure data and pure helpers. No three.js import, so lib/, tests and the DOM can read it.
 * Convert with `new Vector3(...v)`. Owner: env (may extend, must not break).
 */

export type Vec2 = readonly [x: number, z: number]
export type Vec3 = readonly [x: number, y: number, z: number]

const DEG = Math.PI / 180

// ---------------------------------------------------------------------------- compass (§0)

export const NORTH: Vec3 = [0, 0, 1]
export const SOUTH: Vec3 = [0, 0, -1]
export const EAST: Vec3 = [-1, 0, 0]
export const WEST: Vec3 = [1, 0, 0]
export const UP: Vec3 = [0, 1, 0]

/** Normalise degrees to [0, 360). */
export const wrapDeg = (deg: number) => ((deg % 360) + 360) % 360

/** Unit ground direction of a compass bearing (degrees clockwise from north): (−sin b, 0, cos b). */
export function bearingToDir(bearingDeg: number): Vec3 {
  const b = bearingDeg * DEG
  return [-Math.sin(b), 0, Math.cos(b)]
}

/** Compass bearing (degrees clockwise from north, [0, 360)) of a ground direction (dx, dz). */
export function dirToBearing(dx: number, dz: number): number {
  return wrapDeg(Math.atan2(-dx, dz) / DEG)
}

/** Bearing from one ground point to another. */
export function bearingBetween(from: Vec2, to: Vec2): number {
  return dirToBearing(to[0] - from[0], to[1] - from[1])
}

// ---------------------------------------------------------------------------- landmarks (§5.1)

export const threshold = {
  /** K0 camera, facing south. */
  k0: [0, 1.6, 24] as Vec3,
  meadow: { zNorth: 24, zSouth: 6 },
  grassStrokes: { zNorth: 20, zSouth: 10 },
  forestEdgeZ: 6,
  /** Pines stand this far either side of the path spline. */
  forestBand: { near: 3, far: 40 },
  /** Hero pine, unique mesh, exempt from keep-outs. Leans 8° east (toward −X); its long branch crosses the top-right of K0. */
  cornerPineA: { base: [4.6, 0, 11] as Vec3, height: 13, leanDeg: 8, leanToward: EAST },
  /** Hero pine, unique mesh, exempt from keep-outs. Split trunk, first branches 3.5 m up, leans west over the path. */
  wipePineB: { base: [-1.5, 0, -17] as Vec3, height: 11, firstBranch: 3.5, leanToward: WEST },
  /** Axe-cut rock (斧劈皴). */
  rock: { pos: [2.8, 0, -30] as Vec3, height: 2.2 },
  /**
   * The 焦 plane of the forest walk (design §8.2), drawn by the threshold scene: one trunk per copy
   * hold, right of the path so it stays out of zone L. F1 (100–142), then F3 (175–215), past the rock.
   */
  nearTrunks: [{ base: [1.6, 0, -8.5] as Vec3 }, { base: [2.35, 0, -34.5] as Vec3 }],
} as const

/** The paper-white path strip (留白), 1.2 m wide, written by the ground shader. Centripetal Catmull-Rom through these. */
export const pathToCabin: readonly Vec3[] = [
  [0, 0, 6],
  [-0.9, 0, -8],
  [0.8, 0, -24],
  [-0.4, 0, -38],
  [1.6, 0, -50],
  [3.6, 0, -57],
]

/** Path from the moon-gate emerge point to the grove. The y values are nominal; sample `terrainHeight` for the ground. */
export const pathToGrove: readonly Vec3[] = [
  [3.0, 0, -69],
  [2.0, 0, -80],
  [1.7, 0, -85],
  [1.0, 0, -98],
  [0.4, 1.2, -112],
  [0, 1.8, -120],
  [0, 0, -132],
]

export const PATH_WIDTH = 1.2

export const cabin = {
  /** Footprint of the exterior shell (x 1.5 to 6.5, z −60 to −66). Gable faces north. */
  footprint: { x0: 1.5, x1: 6.5, zNorth: -60, zSouth: -66 },
  centre: [4, 0, -63] as Vec3,
  floorY: 0.45,
  eavesY: 3.05,
  /** Underside of the ridge: the 40° pitch rising from the wall plates at eavesY over the 2.5 m half-span. */
  ridgeY: 5.15,
  overhang: 0.5,
  roofPitchDeg: 40,
  /** Door centre in the north wall plane. Hinges on the east (screen-left) side, swings inward. */
  door: { centre: [4, 0.45, -60] as Vec3, width: 1.0, height: 2.0, planeZ: -60, hingeSide: 'east', swingMaxDeg: 95 },
  steps: [-59.4, -58.8] as readonly number[],
  /** 步步锦 lattice window, 0.7 × 0.7 m, screen-left of the door from the approach. */
  latticeWindow: { centre: [2.6, 1.9, -60] as Vec3, size: 0.7 },
  /** Stone stack inside the south-west corner; tall enough to clear the gable's roof line from C1. */
  chimney: { base: [6.0, 0, -65.5] as Vec3, topY: 6.2 },
  /** Close trunks behind the cabin that prove it is 6 m deep during the nudge. */
  closeTrunks: [
    { base: [2.0, 0, -67.9] as Vec3, radius: 0.5, height: 14 },
    { base: [6.3, 0, -68.7] as Vec3, radius: 0.5, height: 14 },
  ],
  /** Emissive cyan box inside the plank shell, visible only through gaps: exactly the size of the outside. */
  leakBox: { size: [4.8, 2.5, 5.8] as Vec3 },
  /** Cyan spill term at the door (§7.1). */
  spill: { pos: [4, 0.45, -60] as Vec3, radius: 6 },
} as const

/** The hall behind the door (§8.4). Drawn only through the door stencil or when inside. */
export const hall = {
  floor: { x0: -3, x1: 11, zNorth: -60, zSouth: -106, y: 0.45 },
  nearRoom: { x0: 1.8, x1: 6.2, zNorth: -60, zSouth: -64, ceilingY: 3.05 },
  dissolve: { zNorth: -64, zSouth: -72 },
  postPairs: { x: [0, 8] as readonly number[], z: [-72, -78, -84, -90, -96, -102] as readonly number[], height: 6.5 },
  beamY: 7.4,
  nightShell: { x0: -25, x1: 33, y0: -5, y1: 30, zNorth: -60, zSouth: -130 },
  backWall: { z: -106, width: 10, height: 7 },
  moonGate: { centre: [4, 2.35, -106] as Vec3, radius: 1.6 },
  /** Hanging scrolls of light, 1.1 × 2.8 m, yawed 25° toward the centre line x = 4. */
  scrolls: [
    { centre: [0.9, 2.45, -75] as Vec3, side: 'left', cardZone: 'R' },
    { centre: [7.1, 2.45, -81] as Vec3, side: 'right', cardZone: 'L' },
    { centre: [0.9, 2.45, -87] as Vec3, side: 'left', cardZone: 'R' },
    { centre: [7.1, 2.45, -93] as Vec3, side: 'right', cardZone: 'L' },
  ],
  scrollSize: { width: 1.1, height: 2.8, topMargin: 0.45, core: 1.6, textZone: 0.45 },
  scrollYawDeg: 25,
  centreLineX: 4,
  /** Writing desk (书案), 1.8 × 0.8 m, top at y 1.20. */
  desk: { pos: [4, 0.45, -99.6] as Vec3, width: 1.8, depth: 0.8, topY: 1.2 },
  /** Terminal pane, 1.6 × 1.0 m, tilted back 8°, floating above the desk. */
  terminalPane: { centre: [4, 1.9, -99.9] as Vec3, width: 1.6, height: 1.0, tiltBackDeg: 8 },
  /** Interior exp² fade to `night`, applied by interior materials (§7.4). */
  nightFogDensity: 0.03,
} as const

export const pathZone = {
  /** Where the camera reappears after the moon gate. */
  emerge: [3.0, 0, -69] as Vec3,
  /** Stream flows west (+X). */
  stream: { centreZ: -85, width: 2.2, flowDir: WEST },
  steppingStones: { count: 5, x0: 1.3, x1: 2.1, z: -85 },
  /** Medium and high tiers only. */
  bamboo: [-3.5, 0, -86] as Vec3,
  mistWall: { zNorth: -100, zSouth: -115, fogPeak: 0.14 },
  crest: { zNorth: -118, zSouth: -122, y: 1.8 },
  standingStones: [
    [-3, 0, -131],
    [3, 0, -131],
  ] as readonly Vec3[],
  standingStoneHeight: 1.8,
} as const

// ---------------------------------------------------------------------------- grove (§8.6, §9)

/** Luo Shu palace numbers. Kept local so this file has no lib/ dependency. */
type Palace = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9

export const grove = {
  centre: [0, 0, -150] as Vec3,
  clearingRadius: 18,
  oldPines: { r0: 18, r1: 28 },
  /** Stone floor disc under the platform. */
  floorDisc: { radius: 6.6, topY: 0.1 },
  /** Earth plate 地盘: nine 3 m slabs, 0.12 m grout, top y 0.45. */
  platform: { centre: [0, 0.45, -150] as Vec3, size: 9, slab: 3, grout: 0.12, topY: 0.45 },
  northStep: { width: 3, zNorth: -144.9, zSouth: -145.5, topY: 0.22 },
  /** Turning rings, outward. `gap` is the stone gap between rings. */
  rings: {
    heaven: { r0: 6.7, r1: 7.9, topY: 0.32 },
    human: { r0: 8.0, r1: 8.9, topY: 0.24 },
    spirit: { r0: 9.0, r1: 9.9, topY: 0.16 },
    mountains: { r0: 10.1, r1: 11.3, topY: 0.06, tickBand: 0.2 },
    gap: 0.04,
  },
  /** 天池 needle, floating 1.5 m above the centre palace; its south tip is cinnabar. */
  needle: [0, 1.95, -150] as Vec3,
  groundMist: { belowY: 0.4, density: 0.25, clearInside: 11 },
  /** Palace slab centres, compass-true (§9.1). South row z −153, north row z −147; east is −X. */
  palaceCentre: {
    4: [-3, 0.45, -153],
    9: [0, 0.45, -153],
    2: [3, 0.45, -153],
    3: [-3, 0.45, -150],
    5: [0, 0.45, -150],
    7: [3, 0.45, -150],
    8: [-3, 0.45, -147],
    1: [0, 0.45, -147],
    6: [3, 0.45, -147],
  } as const satisfies Record<Palace, Vec3>,
  /** Ring slot k (0..7) sits at bearing k × 45° and belongs to RING_PALACES[k] (§9.2). */
  ringPalaces: [1, 8, 3, 4, 9, 2, 7, 6] as readonly Palace[],
  /** R4 outer circle plus 1 m margin: what h_fit frames in the plan view (§6.1). */
  planFitRadius: 12.3,
} as const

/** Direction of ring slot k (0..7): bearing k × 45°. */
export const ringSlotDir = (k: number): Vec3 => bearingToDir(k * 45)

// ---------------------------------------------------------------------------- exit (§5.1, §8.7)

export const exit = {
  /** 1.8 m octagonal stone lantern. The only warm light in the ink world. */
  lantern: { base: [1.0, 0, -186.5] as Vec3, height: 1.8, flame: [1.0, 1.35, -186.5] as Vec3 },
  /** Lit faces within this radius tint toward lantern-halo by (1 − d/r)² × 0.35 (§7.1). */
  lanternWarmRadius: 14,
  /** Han round-headed stele, faces north; screen-left of the lantern from the approach. */
  stele: { base: [-1.4, 0, -188] as Vec3, width: 0.9, height: 2.6, depth: 0.28, plinth: 0.4, facing: NORTH },
  ledgeZ: -192,
  beyondLedgeY: -25,
  /** E2 orbit centre if the spline wobbles: yaw 0° → 180° via the east, radius 8 → 53 m, height 1.25 → 30 m. */
  orbitCentre: [-0.2, 0, -187.2] as Vec3,
  /**
   * Finale mist belts (§8.7 E2), drawn by the ink pass: bands of paper across the walk, centred on
   * these z with these half-widths, lying low over the ground with ragged tops (metres), x −150 to
   * 150. They sit between the finale's subjects, never on them, so the frame reads bottom to top as
   * a hanging scroll's layers: the exit trees (between the lantern and the grove), the mist wall
   * (grove and cabin), the forest walk (cabin and the forest edge), the lowland north of the meadow
   * (meadow and ridges). Crowns taller than a belt stand out of it.
   */
  mistBelts: {
    z: [-171, -98, -29, 50] as readonly number[],
    halfWidth: [7, 26, 21, 20] as readonly number[],
    top: [7, 18, 16, 18] as readonly number[],
    x0: -150,
    x1: 150,
  },
  /** DOM map pins projected over these world points in E3. */
  mapPins: {
    cabin: [4, 5, -63] as Vec3,
    grove: [0, 0.5, -150] as Vec3,
    threshold: [0, 2, 20] as Vec3,
  },
  /**
   * Glint slot 1 in E2–E3. `glints.cabin` sits on the door wall, which faces away from the finale
   * camera in the south; this is a plank gap under the south eave, on the side it looks at.
   */
  finaleCabinGlint: [4, 2.5, -66.06] as Vec3,
  /**
   * From E2 on, pines in this corridor stand aside so the finale camera sees the grove's rings over
   * the south arc of the old-pine ring (x −8.5 to 11.5, z −162.5 to −177.5; the exit pines stay).
   * It opens as E2 starts, while the camera at the stele faces south and has them behind it.
   */
  finaleOpening: { points: [[-1, -170], [4, -170]] as readonly Vec2[], halfWidth: 7.5 },
} as const

// ---------------------------------------------------------------------------- mountains and light

export const mountains = {
  /** Main peak card, 220 m wide, summit y 115, base dissolved in a mist belt. The stele's 高远 (E1). */
  mainPeak: { centre: [-20, 0, -340] as Vec3, width: 220, summitY: 115 },
  /**
   * The cabin's 高远 (design §8.3 C1, after Fan Kuan): a massif straight behind the roof from the
   * approach, its summit about 22° up from C1, between the close trunks and under their crowns. It is part of that one leaf
   * of the album only: it condenses out of the mist as the camera comes down the F4 glide (camera
   * z from `gate[0]` to `gate[1]`) and is gone again behind the cabin (`gate[2]` to `gate[3]`),
   * so it never stands in the threshold, grove or finale views, which the main peak composes.
   */
  cabinPeak: { centre: [4, 0, -262] as Vec3, width: 150, summitY: 90, belt: [50, 7] as const, gate: [-30, -42, -58, -63] as const },
  /**
   * Ridge ring cards on every side; the finale looks north. Layers shown depend on tier.
   * `southPush`: in the south each layer stands further out (radius × (1 + push), easing in over
   * the southern half), so from the stele (E0, E1) the nearest is 140 m past the ledge, not 60:
   * at 60 m a card reads as a flat cut-out. Heights scale with the distance from K0, so the
   * threshold's 平远 crests keep their place in the first frame.
   */
  ridgeRing: { centre: [0, 0, -90] as Vec3, radii: [160, 230, 320] as readonly number[], southPush: [0.44, 0.3, 0.22] as readonly number[] },
} as const

/** Painter's light, fixed: from the upper left of a south-facing viewer, slightly from behind (§7.1). Not normalised. */
export const PAINTER_LIGHT: Vec3 = [-0.5, 0.8, 0.35]

/** Screen-space glint anchors composited after fog (§7.3). */
export const glints = {
  lantern: exit.lantern.flame,
  /** Cyan pinprick where the cabin planks leak; E2 and E3 only. */
  cabin: [4, 3.2, -60] as Vec3,
  /** The lantern glint fades in beyond this camera distance; closer, the flame billboard takes over. */
  lanternMinDistance: 25,
} as const

// ---------------------------------------------------------------------------- terrain (§5.1)

/**
 * Ground profile along z as (z, y) knots, north to south, smoothstepped between knots.
 * Flat to z −95, a crest of 1.8 m from z −118 to −122, flat again from −130 to the ledge at −192,
 * then a drop to y −25.
 */
export const TERRAIN_KNOTS: readonly (readonly [z: number, y: number])[] = [
  [80, 0],
  [-95, 0],
  [-118, 1.8],
  [-122, 1.8],
  [-130, 0],
  [-192, 0],
  [-195, -25],
  [-700, -25],
]

const smoothstep01 = (t: number) => t * t * (3 - 2 * t)

/** The knot profile alone: ground height along z, ignoring the saddle. */
export function terrainProfile(z: number): number {
  const first = TERRAIN_KNOTS[0]
  const last = TERRAIN_KNOTS[TERRAIN_KNOTS.length - 1]
  if (!first || !last) return 0
  if (z >= first[0]) return first[1]
  if (z <= last[0]) return last[1]
  for (let i = 1; i < TERRAIN_KNOTS.length; i++) {
    const a = TERRAIN_KNOTS[i - 1]
    const b = TERRAIN_KNOTS[i]
    if (!a || !b) continue
    if (z <= a[0] && z >= b[0]) {
      const t = (a[0] - z) / (a[0] - b[0])
      return a[1] + (b[1] - a[1]) * smoothstep01(t)
    }
  }
  return 0
}

/**
 * The eye-to-flame line from K0. It crosses the crest (z −120) at 1.43 m, under the 1.8 m crest,
 * so without the saddle below the terrain would hide the lantern glint in the first frame.
 */
export const lanternSightline = { from: threshold.k0, to: exit.lantern.flame, halfWidth: 0.75 } as const

/** Point of the sightline at `z` as [x, y]. */
export function sightlineAt(z: number): readonly [x: number, y: number] {
  const { from, to } = lanternSightline
  const t = (from[2] - z) / (from[2] - to[2])
  return [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t]
}

/**
 * Worn saddle where the path crosses the crest: a flat-floored notch along the sightline, kept this
 * far below it. `flat` and `edge` are half-widths in metres. It spans about z −108.5 to −127 and
 * stays 0.65 m clear of x = 0, so the crest still reads 1.8 m on the path's east side.
 */
export const CREST_SADDLE = { clearance: 0.35, flat: 0.3, edge: 0.65 } as const

/**
 * The ledge is not ruled: its edge wanders up to about 1.3 m north or south of z −192 away from the
 * stele and lantern (it stays straight for |x| < 3). Positive moves the edge north.
 */
export function ledgeWobble(x: number): number {
  const a = Math.abs(x)
  const reach = a <= 3 ? 0 : a >= 9 ? 1 : smoothstep01((a - 3) / 6)
  return 1.3 * reach * (0.65 * Math.sin(0.27 * x + 4.0) + 0.35 * Math.sin(0.45 * x + 1.0))
}

/** Ground height at (x, z): the knot profile, the wandering ledge and the crest saddle. Env's ground mesh follows this exactly. */
export function terrainHeight(x: number, z: number): number {
  const ledge = z < -189 ? ledgeWobble(x) * smoothstep01(Math.min(1, (-189 - z) / 2)) : 0
  const h = terrainProfile(z - ledge)
  const [sx, sy] = sightlineAt(z)
  const floor = sy - CREST_SADDLE.clearance
  if (h <= floor) return h
  const dx = Math.abs(x - sx)
  if (dx >= CREST_SADDLE.edge) return h
  const w = 1 - smoothstep01(Math.max(0, (dx - CREST_SADDLE.flat) / (CREST_SADDLE.edge - CREST_SADDLE.flat)))
  return h - (h - floor) * w
}

// ---------------------------------------------------------------------------- scatter keep-outs (§5.1)

export type KeepOut =
  | { readonly id: string; readonly kind: 'circle'; readonly centre: Vec2; readonly r: number }
  | { readonly id: string; readonly kind: 'corridor'; readonly points: readonly Vec2[]; readonly halfWidth: number }

const toXZ = (p: Vec3): Vec2 => [p[0], p[2]]

/**
 * Poisson-disc scatter must skip these. Hero pines A and B are exempt.
 * Path corridors use the spline control points as a polyline; the sampled spline stays within
 * about 0.5 m of it, so env may swap in the sampled curve for tighter placement.
 */
export const KEEP_OUTS: readonly KeepOut[] = [
  { id: 'path-to-cabin', kind: 'corridor', points: pathToCabin.map(toXZ), halfWidth: 2 },
  { id: 'path-to-grove', kind: 'corridor', points: pathToGrove.map(toXZ), halfWidth: 2 },
  // The lantern glint must be visible from K0, P3 and G1.
  { id: 'lantern-sightline', kind: 'corridor', points: [toXZ(threshold.k0), toXZ(exit.lantern.base)], halfWidth: 0.75 },
  { id: 'cabin', kind: 'circle', centre: toXZ(cabin.centre), r: 10 },
  { id: 'grove', kind: 'circle', centre: toXZ(grove.centre), r: 18 },
  { id: 'exit', kind: 'circle', centre: [-0.2, -187.2], r: 6 },
  // Props of the path zone (§8.5): nothing grows in the stream or on the stones.
  { id: 'stream', kind: 'corridor', points: [[-80, pathZone.stream.centreZ], [80, pathZone.stream.centreZ]], halfWidth: pathZone.stream.width / 2 + 0.5 },
  { id: 'bamboo', kind: 'circle', centre: toXZ(pathZone.bamboo), r: 2.5 },
  ...pathZone.standingStones.map((p, i): KeepOut => ({ id: `standing-stone-${i}`, kind: 'circle', centre: toXZ(p), r: 1.5 })),
]

/** Distance from a ground point to a polyline. */
export function distanceToPolyline(x: number, z: number, points: readonly Vec2[]): number {
  let best = Infinity
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]
    const b = points[i]
    if (!a || !b) continue
    const dx = b[0] - a[0]
    const dz = b[1] - a[1]
    const len2 = dx * dx + dz * dz
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / len2))
    const ex = x - (a[0] + t * dx)
    const ez = z - (a[1] + t * dz)
    best = Math.min(best, ex * ex + ez * ez)
  }
  // Squared distances in the loop: Math.hypot is several times slower, and the pine scatter calls this per dart.
  return Math.sqrt(best)
}

/** True if a ground point falls inside any keep-out, optionally padded by `margin` metres. */
export function inKeepOut(x: number, z: number, keepOuts: readonly KeepOut[] = KEEP_OUTS, margin = 0): boolean {
  return keepOuts.some((k) =>
    k.kind === 'circle'
      ? Math.hypot(x - k.centre[0], z - k.centre[1]) < k.r + margin
      : distanceToPolyline(x, z, k.points) < k.halfWidth + margin,
  )
}
