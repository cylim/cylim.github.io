import { hall } from '../../../core/world/layout'
import { PLANK } from '../shared/planks'

/**
 * Where every hall plank goes (design.md §8.4): the honest near room, the dissolve zone where the
 * walls come apart, the floor and the back wall. Pure data for one InstancedMesh of a unit box
 * whose local x is the plank's length (the grain), y its height or thickness, z its width or
 * thickness. The trace texture's u runs along local x, so pulses flow the way `iUv` points.
 */

export interface PlankInstance {
  position: [number, number, number]
  /** Euler XYZ, radians. */
  rotation: [number, number, number]
  /** Length, height, depth of the box in metres. */
  scale: [number, number, number]
  /** Trace texture window: u0, v0, su, sv. */
  uv: [number, number, number, number]
  /** Ignition delay (s), bob amplitude (m), bob phase, wood tone. */
  meta: [number, number, number, number]
}

/** Local x points to world −z (toward the desk): the floor's, walls' and ceiling's grain runs down the hall. */
const DOWN_HALL = Math.PI / 2
const WALL_DELAY = 0.3

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

/** A texture window for a plank of this length and width; `flipU` reverses the grain direction. */
function texWindow(rand: () => number, length: number, width: number, flipU = false): [number, number, number, number] {
  const su = Math.min(1, length / PLANK.textureLength)
  const sv = Math.min(1, width / PLANK.textureWidth)
  const v0 = rand() * (1 - sv)
  return flipU ? [su, v0, -su, sv] : [0, v0, su, sv]
}

/** Split [from, to] (from > to, walking down the hall) into texture-length pieces, starting `stagger` in. */
function pieces(from: number, to: number, stagger: number): [number, number][] {
  const out: [number, number][] = []
  let z = from
  let first = PLANK.textureLength - stagger
  while (z - PLANK.gap > to) {
    const len = Math.min(first > 0.2 ? first : PLANK.textureLength, z - to)
    out.push([z, z - len])
    z -= len + PLANK.gap
    first = PLANK.textureLength
  }
  return out
}

function floor(rand: () => number, out: PlankInstance[]) {
  const f = hall.floor
  const pitch = PLANK.floorWidth + PLANK.gap
  const count = Math.floor((f.x1 - f.x0) / pitch)
  const x0 = (f.x0 + f.x1) / 2 - ((count - 1) * pitch) / 2
  for (let i = 0; i < count; i++) {
    const x = x0 + i * pitch
    for (const [a, b] of pieces(f.zNorth, f.zSouth, rand() * PLANK.textureLength)) {
      const len = a - b
      out.push({
        position: [x, f.y - PLANK.floorThickness / 2, (a + b) / 2],
        rotation: [0, DOWN_HALL, 0],
        scale: [len, PLANK.floorThickness, PLANK.floorWidth],
        uv: texWindow(rand, len, PLANK.floorWidth),
        meta: [0, 0, 0, 0.55 + rand() * 0.45],
      })
    }
  }
}

/**
 * The near room's two walls and ceiling, continued through the dissolve zone, where each piece is
 * shorter, the gaps grow to 0.6 m, and the planks drift outward and up and bob.
 */
function room(rand: () => number, out: PlankInstance[]) {
  const r = hall.nearRoom
  const d = hall.dissolve
  const wallRows = Math.floor((r.ceilingY - hall.floor.y) / (PLANK.rowHeight + PLANK.gap))
  const drift = (z: number) => Math.min(1, Math.max(0, (d.zNorth - z) / (d.zNorth - d.zSouth)))

  const run = (side: 'east' | 'west' | 'ceiling', lane: number, lanes: number, base: [number, number, number], dims: [number, number, number]) => {
    const stagger = rand() * PLANK.textureLength
    // Honest room: whole planks.
    for (const [a, b] of pieces(r.zNorth, r.zSouth, stagger)) {
      const len = a - b
      out.push({
        position: [base[0], base[1], (a + b) / 2],
        rotation: [0, DOWN_HALL, 0],
        scale: [len, dims[1], dims[2]],
        uv: texWindow(rand, len, side === 'ceiling' ? dims[2] : dims[1], side === 'west'),
        meta: [WALL_DELAY, 0, 0, 0.55 + rand() * 0.45],
      })
    }
    // Dissolve zone: the wall comes apart.
    let z = r.zSouth - PLANK.gap
    while (z > d.zSouth) {
      const t0 = drift(z)
      const len = Math.max(0.35, 1.3 - 0.7 * t0 + (rand() - 0.5) * 0.3)
      const mid = z - len / 2
      const t = drift(mid)
      const t2 = t * t
      const height = lane / Math.max(1, lanes - 1)
      const out3: [number, number, number] =
        side === 'ceiling'
          ? [base[0] + Math.sign(base[0] - hall.centreLineX) * t2 * (1.4 + rand() * 0.9), base[1] + t2 * (2.6 + rand() * 1.4), mid]
          : [base[0] + (side === 'east' ? -1 : 1) * t2 * (1.2 + rand() * 0.6), base[1] + t2 * (0.5 + height * 1.1 + rand() * 0.3), mid]
      out.push({
        position: out3,
        rotation: [(rand() - 0.5) * 0.3 * t, DOWN_HALL + (rand() - 0.5) * 0.2 * t, (rand() - 0.5) * 0.24 * t],
        scale: [len, dims[1], dims[2]],
        uv: texWindow(rand, len, side === 'ceiling' ? dims[2] : dims[1], side === 'west'),
        meta: [WALL_DELAY, 0.004 + 0.012 * t, rand() * Math.PI * 2, 0.55 + rand() * 0.45],
      })
      z -= len + PLANK.gap + 0.6 * t0 * (0.7 + rand() * 0.6)
    }
  }

  for (let i = 0; i < wallRows; i++) {
    const y = hall.floor.y + PLANK.rowHeight / 2 + i * (PLANK.rowHeight + PLANK.gap)
    run('east', i, wallRows, [r.x0, y, 0], [0, PLANK.rowHeight, PLANK.wallThickness])
    run('west', i, wallRows, [r.x1, y, 0], [0, PLANK.rowHeight, PLANK.wallThickness])
  }
  const pitch = PLANK.floorWidth + PLANK.gap
  const count = Math.floor((r.x1 - r.x0) / pitch)
  const x0 = (r.x0 + r.x1) / 2 - ((count - 1) * pitch) / 2
  for (let i = 0; i < count; i++) {
    run('ceiling', i, count, [x0 + i * pitch, r.ceilingY + PLANK.wallThickness / 2, 0], [0, PLANK.wallThickness, PLANK.floorWidth])
  }
}

/** The back wall's horizontal planks; the moon gate's opening is cut in the shader. */
function backWall(rand: () => number, out: PlankInstance[]) {
  const w = hall.backWall
  const rows = Math.floor(w.height / (PLANK.rowHeight + PLANK.gap))
  const xw = hall.centreLineX - w.width / 2
  for (let i = 0; i < rows; i++) {
    const y = hall.floor.y + PLANK.rowHeight / 2 + i * (PLANK.rowHeight + PLANK.gap)
    // pieces() walks downward, so walk x as −x and flip back.
    for (const [a, b] of pieces(-xw, -(xw + w.width), rand() * PLANK.textureLength)) {
      const len = a - b
      out.push({
        position: [-(a + b) / 2, y, w.z + PLANK.wallThickness / 2],
        rotation: [0, 0, 0],
        scale: [len, PLANK.rowHeight, PLANK.wallThickness],
        uv: texWindow(rand, len, PLANK.rowHeight),
        meta: [WALL_DELAY, 0, 0, 0.55 + rand() * 0.45],
      })
    }
  }
}

export function hallPlanks(seed = 0x9a11): PlankInstance[] {
  const rand = mulberry32(seed)
  const out: PlankInstance[] = []
  floor(rand, out)
  room(rand, out)
  backWall(rand, out)
  return out
}
