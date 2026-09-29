import { BoxGeometry, BufferAttribute, BufferGeometry, Euler, Matrix4, OctahedronGeometry, Vector3 } from 'three'
import { exit } from '../../core/world/layout'
import { socials, type SocialId } from '../../content/socials'
import { buildRock } from '../../env'

/**
 * The wooden signpost at the end of the path (路牌, design.md §8.7 E1): one weathered, hand-hewn
 * post leaning a little, with a finger board per social link nailed to its north face, each
 * pointing away south-east or south-west into the mist past the ledge. A stone props its foot and
 * moss dots (点苔) gather there. Everything is ink: the timber takes the hemp-fibre strokes that
 * read as grain, the boards a plain wash with their grain and carving on the face overlay.
 *
 * Pure: the scene, the face atlas, the lantern's lean and the tests all read these numbers.
 * Coordinates are metres from the post's foot on the ground, +Z north (toward the approach),
 * +X west (screen-right from the approach, toward the lantern).
 */

export const POST = {
  /** Across the view (x) and front to back (z) at the foot; the top is a little slimmer. */
  width: 0.15,
  depth: 0.13,
  height: exit.signpost.height,
  /** Buried this far. */
  sink: 0.12,
  /** Rise of the low pyramid cut on top, which sheds the rain off the end grain. */
  cap: 0.055,
  taper: 0.92,
  /** Lean in degrees: toward screen-left (east) and away (south). */
  leanEast: 2.4,
  leanSouth: 1.1,
} as const

export const BOARD = {
  height: 0.22,
  thickness: 0.035,
  /** Length of the pointed end. */
  tip: 0.14,
  /** The butt end runs this far past the post's centre line. */
  overhang: 0.07,
  /** Wooden pegs through the board into the post, 2 per board. */
  peg: { size: 0.02, proud: 0.012, b: 0.06 },
} as const

export interface BoardPlace {
  /** Centre height on the post, metres above the foot. */
  readonly y: number
  /** +1 points screen-right (south-west), −1 screen-left (south-east). */
  readonly side: 1 | -1
  /** Yaw away from the view plane toward the south, degrees. */
  readonly away: number
  readonly length: number
  /** The tip sags this many degrees below level. */
  readonly droop: number
}

/** One board per link, top to bottom in the order of `socials`; staggered heights and yaws. */
const PLACES: Record<SocialId, BoardPlace> = {
  github: { y: 2.1, side: -1, away: 22, length: 0.9, droop: 1.6 },
  x: { y: 1.77, side: 1, away: 30, length: 0.95, droop: 1.0 },
  linkedin: { y: 1.44, side: -1, away: 26, length: 1.0, droop: 2.4 },
}

export interface Board extends BoardPlace {
  readonly id: SocialId
  readonly index: number
}

export const BOARDS: readonly Board[] = socials.map((s, index) => ({ id: s.id, index, ...PLACES[s.id] }))

/** The face overlay floats this far proud of the board's front, with a polygon offset on top. */
export const FACE_LIFT = 0.003

// ---------------------------------------------------------------------------- the face atlas

/** One canvas holds the three board faces as rows, each as seen from the front (tip left or right). */
export const ATLAS = { pxPerMetre: 720, gap: 0.04 } as const
const M = ATLAS.pxPerMetre
const maxLength = Math.max(...BOARDS.map((b) => b.length))
export const ATLAS_SIZE = {
  width: Math.ceil(maxLength * M) + 4,
  height: Math.ceil((BOARDS.length * BOARD.height + (BOARDS.length + 1) * ATLAS.gap) * M),
} as const

/** A board's row in the atlas, canvas px, top-down. */
export function boardRow(index: number): { top: number; bottom: number } {
  const top = Math.round((ATLAS.gap + index * (BOARD.height + ATLAS.gap)) * M)
  return { top, bottom: top + Math.round(BOARD.height * M) }
}

/**
 * The board's front outline as (a, b): a along the board from the butt end (0) to the tip
 * (length), b up from its centre line. A square butt with one corner knocked off, a pointed end.
 */
export function boardOutline(board: Board): [a: number, b: number][] {
  const h = BOARD.height / 2
  const L = board.length
  const t = BOARD.tip
  // Weathered: the butt corner nearest the ground is chipped on every other board.
  const chip = board.index % 2 === 0 ? 0.022 : 0.012
  return [
    [chip, -h],
    [L - t, -h],
    [L, -0.006],
    [L - t, h],
    [0, h],
    [0, -h + chip],
  ]
}

/** Local x of a point a along the board, as seen from the front: + is screen-right. */
export const boardX = (board: Board, a: number) => board.side * (a - BOARD.overhang)

/** The leftmost local x of the board's front, as seen from the front. */
const boardXMin = (board: Board) => Math.min(boardX(board, 0), boardX(board, board.length))

/** Canvas px of a point on the board's front, (a, b) as in `boardOutline`. */
export function toAtlas(board: Board, a: number, b: number): [x: number, y: number] {
  const row = boardRow(board.index)
  return [2 + (boardX(board, a) - boardXMin(board)) * M, row.top + (BOARD.height / 2 - b) * M]
}

/** The part of a board that takes lettering, as a range of a: clear of the pegs and the tip. */
export function lettering(board: Board): { a0: number; a1: number } {
  return { a0: BOARD.overhang + 0.035, a1: board.length - BOARD.tip * 0.5 }
}

// ---------------------------------------------------------------------------- transforms

const deg = Math.PI / 180

/** The post's lean about its foot. */
export const LEAN = new Matrix4().makeRotationFromEuler(new Euler(-POST.leanSouth * deg, 0, POST.leanEast * deg))

/** Board-local (x as `boardX`, y = b, z out of the front) to signpost space. */
export function boardMatrix(board: Board): Matrix4 {
  const zOff = POST.depth / 2 + BOARD.thickness / 2
  // Tip down: the roll turns the tip's end of the board below level.
  const roll = new Matrix4().makeRotationZ(-board.side * board.droop * deg)
  const yaw = new Matrix4().makeRotationY(board.side * board.away * deg)
  return new Matrix4()
    .multiply(LEAN)
    .multiply(new Matrix4().makeTranslation(0, board.y, 0))
    .multiply(yaw)
    .multiply(new Matrix4().makeTranslation(0, 0, zOff))
    .multiply(roll)
}

/** Centre of a board's lettered face, in signpost space (for the lantern's lean). */
export function boardFaceCentre(board: Board): Vector3 {
  const { a0, a1 } = lettering(board)
  return new Vector3(boardX(board, (a0 + a1) / 2), 0, BOARD.thickness / 2).applyMatrix4(boardMatrix(board))
}

/** Unit direction a board points, in signpost space (butt to tip, level). */
export function boardDirection(board: Board): Vector3 {
  const m = boardMatrix(board)
  const a = new Vector3(boardX(board, 0), 0, 0).applyMatrix4(m)
  const b = new Vector3(boardX(board, board.length), 0, 0).applyMatrix4(m)
  return b.sub(a).setY(0).normalize()
}

/** The front face's outward normal, in signpost space. */
export function boardNormal(board: Board): Vector3 {
  return new Vector3(0, 0, 1).transformDirection(boardMatrix(board))
}

// ---------------------------------------------------------------------------- geometry

/** Flat-shaded triangle soup with the ink material's optional per-vertex ink and AO. */
class Soup {
  private readonly pos: number[] = []
  private readonly ink: number[] = []
  private readonly ao: number[] = []
  private readonly uv: number[] = []

  tri(a: Vector3, b: Vector3, c: Vector3, ink: readonly number[] = [1, 1, 1], ao: readonly number[] = [1, 1, 1]): void {
    this.pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z)
    this.ink.push(...ink)
    this.ao.push(...ao)
  }

  triUv(a: Vector3, b: Vector3, c: Vector3, uv: readonly number[]): void {
    this.tri(a, b, c)
    this.uv.push(...uv)
  }

  /** Appends a geometry's triangles transformed by `m`, at one ink weight; keeps its AO if it has one. */
  add(geo: BufferGeometry, m: Matrix4, ink: number): void {
    const flat = geo.index ? geo.toNonIndexed() : geo
    const p = flat.getAttribute('position')
    const ao = flat.getAttribute('ao') as BufferAttribute | undefined
    const v = new Vector3()
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(m)
      this.pos.push(v.x, v.y, v.z)
      this.ink.push(ink)
      this.ao.push(ao ? ao.getX(i) : 1)
    }
    if (flat !== geo) flat.dispose()
    geo.dispose()
  }

  geometry(withUv = false): BufferGeometry {
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(new Float32Array(this.pos), 3))
    if (withUv) g.setAttribute('uv', new BufferAttribute(new Float32Array(this.uv), 2))
    else {
      g.setAttribute('iInk', new BufferAttribute(new Float32Array(this.ink), 1))
      g.setAttribute('ao', new BufferAttribute(new Float32Array(this.ao), 1))
    }
    g.computeVertexNormals()
    g.computeBoundingSphere()
    return g
  }
}

const hash = (n: number) => {
  const s = Math.sin(n * 91.3458 + 17.17) * 47453.5453
  return s - Math.floor(s)
}
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1)
  return t * t * (3 - 2 * t)
}

/** Season checks (裂): V splits along the grain, deepest mid-length, dark at the bottom. */
interface Check {
  /** 'n' on the north face at x = at; 'e' on the east face (−x) at z = at. */
  readonly face: 'n' | 'e'
  readonly at: number
  readonly y0: number
  readonly y1: number
  readonly depth: number
  readonly width: number
  /** Open at the top end grain instead of closing there. */
  readonly toTop?: boolean
}
const CHECKS: readonly Check[] = [
  { face: 'n', at: 0.024, y0: 0.2, y1: 1.3, depth: 0.03, width: 0.016 },
  { face: 'n', at: -0.038, y0: 1.9, y1: POST.height, depth: 0.028, width: 0.014, toTop: true },
  { face: 'e', at: -0.012, y0: 0.7, y1: 2.2, depth: 0.03, width: 0.016 },
]

function checkDepth(c: Check, y: number): number {
  if (y <= c.y0 || y >= c.y1 + (c.toTop ? 1 : 0)) return 0
  if (c.toTop) return c.depth * smooth(c.y0, c.y1, y)
  return c.depth * Math.sin((Math.PI * (y - c.y0)) / (c.y1 - c.y0))
}

/**
 * A ring of the post's cross-section at height y, counter-clockwise from above: a hewn rectangle
 * with chamfered arrises and the checks cut into it. Every ring has the same point count.
 */
function ring(y: number, k: number): { p: Vector3; ink: number }[] {
  const s = 1 - (1 - POST.taper) * (Math.max(y, 0) / POST.height)
  const w = (POST.width / 2) * s
  const d = (POST.depth / 2) * s
  const c = 0.018 * s
  const out: { x: number; z: number; ink: number }[] = []
  const put = (x: number, z: number, ink = 1) => out.push({ x, z, ink })
  const notch = (face: 'n' | 'e') => {
    // Counter-clockwise, both faces run toward lower `at`.
    for (const ch of CHECKS.filter((q) => q.face === face).toSorted((p, q) => q.at - p.at)) {
      const dep = checkDepth(ch, y)
      const ink = dep > 0.004 ? 2.2 : 1
      if (face === 'n') {
        put(ch.at + ch.width / 2, d)
        put(ch.at, d - dep, ink)
        put(ch.at - ch.width / 2, d)
      } else {
        put(-w, ch.at + ch.width / 2)
        put(-w + dep, ch.at, ink)
        put(-w, ch.at - ch.width / 2)
      }
    }
  }
  put(w, -d + c)
  put(w, d - c)
  put(w - c, d)
  notch('n')
  put(-w + c, d)
  put(-w, d - c)
  notch('e')
  put(-w, -d + c)
  put(-w + c, -d)
  put(w - c, -d)
  // Hand-hewn: every arris wanders a few millimetres.
  return out.map((q, i) => {
    const j = (hash(k * 31 + i) - 0.5) * 0.007
    const l = (hash(k * 17 + i * 3 + 5) - 0.5) * 0.007
    return { p: new Vector3(q.x + j, y, q.z + l), ink: q.ink }
  })
}

/** Baked AO up the post: darker toward the ground. */
const aoAt = (y: number) => 0.62 + 0.38 * smooth(-0.05, 0.5, y)
const lean = (v: Vector3) => v.clone().applyMatrix4(LEAN)

function addPost(soup: Soup): void {
  const H = POST.height
  const ys = [-POST.sink, 0.08, 0.2, 0.45, 0.7, 0.95, 1.2, 1.3, 1.55, 1.9, 2.05, 2.2, 2.35, H]
  const rings = ys.map((y, k) => ring(y, k))
  for (let r = 0; r + 1 < rings.length; r++) {
    const lo = rings[r] ?? []
    const hi = rings[r + 1] ?? []
    const aoLo = aoAt(ys[r] ?? 0)
    const aoHi = aoAt(ys[r + 1] ?? 0)
    for (let i = 0; i < lo.length; i++) {
      const j = (i + 1) % lo.length
      const p0 = lo[i]
      const p1 = lo[j]
      const p2 = hi[j]
      const p3 = hi[i]
      if (!p0 || !p1 || !p2 || !p3) continue
      soup.tri(lean(p0.p), lean(p2.p), lean(p1.p), [p0.ink, p2.ink, p1.ink], [aoLo, aoHi, aoLo])
      soup.tri(lean(p0.p), lean(p3.p), lean(p2.p), [p0.ink, p3.ink, p2.ink], [aoLo, aoHi, aoHi])
    }
  }
  // The low pyramid on top; its apex a little off centre, as an adze leaves it.
  const top = rings[rings.length - 1] ?? []
  const apex = lean(new Vector3(0.006, H + POST.cap, -0.004))
  for (let i = 0; i < top.length; i++) {
    const a = top[i]
    const b = top[(i + 1) % top.length]
    if (a && b) soup.tri(lean(a.p), apex, lean(b.p), [a.ink, 1.1, b.ink])
  }
}

/** A convex outline (x, y) in counter-clockwise order, extruded ±t/2 in z, transformed by m. */
function addPrism(soup: Soup, outline: readonly (readonly [number, number])[], t: number, m: Matrix4, ink: number): void {
  const F = outline.map(([x, y]) => new Vector3(x, y, t / 2).applyMatrix4(m))
  const B = outline.map(([x, y]) => new Vector3(x, y, -t / 2).applyMatrix4(m))
  const n = outline.length
  const k = [ink, ink, ink]
  for (let i = 1; i + 1 < n; i++) {
    const [f0, f1, f2, b0, b1, b2] = [F[0], F[i], F[i + 1], B[0], B[i], B[i + 1]]
    if (!f0 || !f1 || !f2 || !b0 || !b1 || !b2) continue
    soup.tri(f0, f1, f2, k)
    soup.tri(b0, b2, b1, k)
  }
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    const [bi, bj, fi, fj] = [B[i], B[j], F[i], F[j]]
    if (!bi || !bj || !fi || !fj) continue
    soup.tri(bi, bj, fj, k)
    soup.tri(bi, fj, fi, k)
  }
}

/** The board's front outline in board-local (x, y), counter-clockwise seen from the front. */
export function frontOutline(board: Board): [x: number, y: number][] {
  const pts = boardOutline(board).map(([a, b]): [number, number] => [boardX(board, a), b])
  // Mirrored boards (pointing left) come out clockwise.
  return board.side === 1 ? pts : pts.toReversed()
}

function addBoard(soup: Soup, board: Board): void {
  const m = boardMatrix(board)
  addPrism(soup, frontOutline(board), BOARD.thickness, m, 1)
  // Two pegs on the post's centre line, dark with handling and weather.
  const { size, proud, b } = BOARD.peg
  for (const y of [b, -b]) {
    const peg = new BoxGeometry(size, size, proud + 0.01)
    const at = new Matrix4().makeTranslation(boardX(board, BOARD.overhang) + (hash(board.index + y) - 0.5) * 0.01, y, BOARD.thickness / 2 + (proud - 0.01) / 2)
    soup.add(peg, m.clone().multiply(at).multiply(new Matrix4().makeRotationZ(0.3 + board.index)), 1.9)
  }
}

/** 点苔: small dark dots in clusters, where a painter puts them: the post's foot and its stone. */
const MOSS: readonly (readonly [x: number, y: number, z: number, r: number])[] = [
  // Round the foot, on the ground.
  [0.11, 0.008, 0.12, 0.038],
  [0.16, 0.008, 0.08, 0.028],
  [0.14, 0.008, 0.18, 0.022],
  [-0.1, 0.008, 0.14, 0.03],
  [0.21, 0.008, -0.04, 0.026],
  [-0.04, 0.008, 0.17, 0.02],
  [0.4, 0.008, 0.26, 0.022],
  [0.44, 0.008, 0.21, 0.016],
  // On the stone's crown.
  [-0.2, 0.19, 0.12, 0.034],
  [-0.26, 0.17, 0.08, 0.026],
  [-0.15, 0.17, 0.18, 0.022],
  [-0.31, 0.13, 0.17, 0.022],
  // The pebble.
  [0.27, 0.075, 0.2, 0.02],
]
/** Moss climbing the post's north face near the ground (post space, before the lean). */
const MOSS_ON_POST: readonly (readonly [x: number, y: number, r: number])[] = [
  [0.04, 0.06, 0.022],
  [0.02, 0.14, 0.017],
  [0.055, 0.2, 0.013],
  [-0.045, 0.09, 0.018],
]

/** The stone that props the post, and a pebble. */
const STONES = [
  { seed: 211, size: [0.42, 0.21, 0.32] as const, at: [-0.22, 0.1] as const, yaw: 0.5, chops: 7 },
  { seed: 223, size: [0.17, 0.085, 0.14] as const, at: [0.27, 0.19] as const, yaw: 1.9, chops: 5 },
]

export interface SignpostGeometry {
  /** Post, stones and moss: one draw call with the grain (hemp) ink material. */
  readonly timber: BufferGeometry
  /** Boards and pegs: one draw call with a plain ink wash. */
  readonly boards: BufferGeometry
  /** The boards' front faces with atlas uvs: one draw call with the carving material. */
  readonly faces: BufferGeometry
}

export function buildTimber(): BufferGeometry {
  const soup = new Soup()
  addPost(soup)
  for (const s of STONES) {
    const m = new Matrix4().makeTranslation(s.at[0], 0, s.at[1]).multiply(new Matrix4().makeRotationY(s.yaw))
    soup.add(buildRock(s.seed, s.size, s.chops), m, 1.15)
  }
  const dot = (m: Matrix4) => soup.add(new OctahedronGeometry(1, 0), m, 2.2)
  for (const [x, y, z, r] of MOSS) dot(new Matrix4().makeTranslation(x, y, z).multiply(new Matrix4().makeScale(r, r * 0.5, r)))
  for (const [x, y, r] of MOSS_ON_POST) {
    const m = new Matrix4().makeTranslation(x, y, POST.depth / 2 + 0.002).multiply(new Matrix4().makeScale(r, r * 0.7, r * 0.35))
    dot(LEAN.clone().multiply(m))
  }
  return soup.geometry()
}

export function buildBoards(): BufferGeometry {
  const soup = new Soup()
  for (const b of BOARDS) addBoard(soup, b)
  return soup.geometry()
}

/** The front faces, each mapped onto its row of the atlas (u right, v up, flipY canvas). */
export function buildFaces(): BufferGeometry {
  const soup = new Soup()
  for (const board of BOARDS) {
    const m = boardMatrix(board)
    const outline = boardOutline(board)
    const ccw = board.side === 1 ? outline : outline.toReversed()
    const pts = ccw.map(([a, b]) => ({
      p: new Vector3(boardX(board, a), b, BOARD.thickness / 2 + FACE_LIFT).applyMatrix4(m),
      uv: toAtlas(board, a, b),
    }))
    const uv = (q: { uv: [number, number] }) => [q.uv[0] / ATLAS_SIZE.width, 1 - q.uv[1] / ATLAS_SIZE.height]
    for (let i = 1; i + 1 < pts.length; i++) {
      const [a, b, c] = [pts[0], pts[i], pts[i + 1]]
      if (a && b && c) soup.triUv(a.p, b.p, c.p, [...uv(a), ...uv(b), ...uv(c)])
    }
  }
  return soup.geometry(true)
}

export function buildSignpost(): SignpostGeometry {
  return { timber: buildTimber(), boards: buildBoards(), faces: buildFaces() }
}
