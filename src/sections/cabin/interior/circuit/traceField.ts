/**
 * CircuitWood's trace texture (design.md §8.4), generated once from a fixed seed. Pure: no DOM,
 * no three, so it runs in a worker, on the main thread as a fallback, and in tests.
 *
 * One texel row runs along a plank (u = along the grain, v = across it). The wood grain is a
 * scalar field: stripes along the plank, domain-warped by low-frequency noise and pushed around
 * a few knots. Every trace is a stretch of one grain isoline, routed PCB-style in 0° and 45°
 * steps so it never strays more than a few texels from the grain it follows. A trace ends at a
 * joint (the plank's end, where it gets a pad), at a knot's rim (a via) or at a break (a via).
 * Each knot carries a pad ring. Nothing is drawn that is not a grain line, a joint or a knot.
 *
 * Channels, 8-bit RGBA:
 * - R: trace coverage (antialiased, pads and vias included)
 * - G: distance along the trace / width, premultiplied by R (the shader divides by R, so mip
 *   levels average the distance correctly)
 * - B: via and pad mask
 * - A: wood grain tone for the plank's base colour
 *
 * The rasteriser writes a typed array instead of drawing on an OffscreenCanvas: canvas
 * antialiasing differs between browsers, and a fixed seed should give the same texels everywhere.
 */

export interface TraceSpec {
  width: number
  height: number
  seed: number
}

export const TRACE_SPEC: TraceSpec = { width: 1024, height: 256, seed: 0x6d75 }

export type Terminal = 'joint' | 'knot' | 'break'

export interface TracePath {
  /** Polyline vertices in texels; consecutive segments are 0° or ±45°. */
  points: [number, number][]
  start: Terminal
  end: Terminal
}

export interface Knot {
  x: number
  y: number
  rx: number
  ry: number
}

export interface TraceField {
  spec: TraceSpec
  data: Uint8Array
  paths: TracePath[]
  knots: Knot[]
}

/** Isoline spacing in texels: about 6.6 grain lines across a 0.28 m plank. */
const GRAIN_SPACING = 18
const TRACE_HALF_WIDTH = 1.35
const VIA_OUTER = 4.2
const VIA_INNER = 1.9
/** Start a 45° jog once the grain has moved this far from the trace; straighten within the second value. */
const JOG_START = 2.6
const JOG_STOP = 0.6

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

/** Seeded 2D value noise, smooth, 0..1. */
function valueNoise(seed: number): (x: number, y: number) => number {
  const hash = (ix: number, iy: number) => {
    let h = Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(seed, 2147483647)
    h = Math.imul(h ^ (h >>> 13), 1274126177)
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296
  }
  return (x, y) => {
    const ix = Math.floor(x)
    const iy = Math.floor(y)
    const fx = x - ix
    const fy = y - iy
    const sx = fx * fx * (3 - 2 * fx)
    const sy = fy * fy * (3 - 2 * fy)
    const a = hash(ix, iy)
    const b = hash(ix + 1, iy)
    const c = hash(ix, iy + 1)
    const d = hash(ix + 1, iy + 1)
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy
  }
}

/** The grain field φ(x, y): isolines are grain lines. Increases with y away from knots. */
function grainField(spec: TraceSpec, knots: readonly Knot[]) {
  const n1 = valueNoise(spec.seed ^ 0x51)
  const n2 = valueNoise(spec.seed ^ 0xa7)
  return (x: number, y: number) => {
    let v = y + (n1(x / 230, y / 90) - 0.5) * 26 + (n2(x / 60, y / 40) - 0.5) * 5
    for (const k of knots) {
      const dx = (x - k.x) / k.rx
      const dy = (y - k.y) / k.ry
      // Grain lines bend around the knot: lines above it bulge up, lines below bulge down.
      v -= Math.sign(y - k.y) * k.ry * 2.6 * Math.exp(-(dx * dx + dy * dy))
    }
    return v
  }
}

function sampleField(spec: TraceSpec, phi: (x: number, y: number) => number): Float32Array {
  const f = new Float32Array(spec.width * spec.height)
  for (let y = 0; y < spec.height; y++) for (let x = 0; x < spec.width; x++) f[y * spec.width + x] = phi(x, y)
  return f
}

/** y of the crossing φ = level in column x nearest to `near`, or null. */
function crossingNear(field: Float32Array, spec: TraceSpec, x: number, level: number, near: number): number | null {
  let best: number | null = null
  for (let y = 0; y < spec.height - 1; y++) {
    const a = field[y * spec.width + x] ?? 0
    const b = field[(y + 1) * spec.width + x] ?? 0
    if ((a - level) * (b - level) > 0 || a === b) continue
    const yc = y + (level - a) / (b - a)
    if (best === null || Math.abs(yc - near) < Math.abs(best - near)) best = yc
  }
  return best
}

const knotRim = (k: Knot, x: number, y: number) => ((x - k.x) / (k.rx + 5)) ** 2 + ((y - k.y) / (k.ry + 5)) ** 2

/**
 * Route a stretch of grain in 0° and 45° steps. The trace runs flat until the grain has drifted
 * JOG_START texels away, then jogs diagonally until it is back within JOG_STOP.
 */
function route(ideal: readonly number[], x0: number): [number, number][] {
  const first = ideal[0] ?? 0
  let y = Math.round(first)
  let dir = 0
  const steps: [number, number][] = [[x0, y]]
  for (let i = 1; i < ideal.length; i++) {
    const err = (ideal[i] ?? y) - y
    if (dir === 0 && Math.abs(err) > JOG_START) dir = Math.sign(err)
    else if (dir !== 0 && (Math.abs(err) < JOG_STOP || Math.sign(err) !== dir)) dir = 0
    y += dir
    steps.push([x0 + i, y])
  }
  // Keep only the corners.
  const pts: [number, number][] = []
  for (let i = 0; i < steps.length; i++) {
    const p = steps[i]
    const prev = steps[i - 1]
    const next = steps[i + 1]
    if (!p) continue
    if (!prev || !next || p[1] - prev[1] !== next[1] - p[1]) pts.push(p)
  }
  return pts
}

interface Raster {
  r: Float32Array
  g: Float32Array
  b: Float32Array
}

/** Stamp a capsule from a to b; G carries the distance along the trace (texels) at full coverage. */
function stampSegment(ras: Raster, spec: TraceSpec, a: [number, number], b: [number, number], s0: number, hw: number) {
  const [ax, ay] = a
  const [bx, by] = b
  const dx = bx - ax
  const dy = by - ay
  const len2 = dx * dx + dy * dy
  const len = Math.sqrt(len2)
  const pad = hw + 1
  const x0 = Math.max(0, Math.floor(Math.min(ax, bx) - pad))
  const x1 = Math.min(spec.width - 1, Math.ceil(Math.max(ax, bx) + pad))
  const y0 = Math.max(0, Math.floor(Math.min(ay, by) - pad))
  const y1 = Math.min(spec.height - 1, Math.ceil(Math.max(ay, by) + pad))
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const t = len2 === 0 ? 0 : Math.min(1, Math.max(0, ((x - ax) * dx + (y - ay) * dy) / len2))
      const d = Math.hypot(x - (ax + t * dx), y - (ay + t * dy))
      const cov = Math.min(1, Math.max(0, hw + 0.5 - d))
      if (cov <= 0) continue
      const i = y * spec.width + x
      if (cov > (ras.r[i] ?? 0)) {
        ras.r[i] = cov
        ras.g[i] = s0 + t * len
      }
    }
  }
}

/** A ring (via) or filled disc (inner 0) into R and B. */
function stampRing(ras: Raster, spec: TraceSpec, cx: number, cy: number, outer: number, inner: number, along: number) {
  const x0 = Math.max(0, Math.floor(cx - outer - 1))
  const x1 = Math.min(spec.width - 1, Math.ceil(cx + outer + 1))
  const y0 = Math.max(0, Math.floor(cy - outer - 1))
  const y1 = Math.min(spec.height - 1, Math.ceil(cy + outer + 1))
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const d = Math.hypot(x - cx, y - cy)
      const cov = Math.min(1, Math.max(0, outer + 0.5 - d)) * (inner > 0 ? Math.min(1, Math.max(0, d - inner + 0.5)) : 1)
      if (cov <= 0) continue
      const i = y * spec.width + x
      ras.b[i] = Math.max(ras.b[i] ?? 0, cov)
      if (cov > (ras.r[i] ?? 0)) {
        ras.r[i] = cov
        ras.g[i] = along
      }
    }
  }
}

/** A square pad where a trace meets the plank's end (a joint). */
function stampJointPad(ras: Raster, spec: TraceSpec, x: number, y: number, along: number) {
  const hx = 5
  const hy = 3.5
  for (let yy = Math.max(0, Math.floor(y - hy - 1)); yy <= Math.min(spec.height - 1, Math.ceil(y + hy + 1)); yy++) {
    for (let xx = Math.max(0, Math.floor(x - hx - 1)); xx <= Math.min(spec.width - 1, Math.ceil(x + hx + 1)); xx++) {
      const cov = Math.min(1, Math.max(0, hx + 0.5 - Math.abs(xx - x))) * Math.min(1, Math.max(0, hy + 0.5 - Math.abs(yy - y)))
      if (cov <= 0) continue
      const i = yy * spec.width + xx
      ras.b[i] = Math.max(ras.b[i] ?? 0, cov)
      if (cov > (ras.r[i] ?? 0)) {
        ras.r[i] = cov
        ras.g[i] = along
      }
    }
  }
}

function polylineLength(points: readonly [number, number][]): number {
  let s = 0
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]
    const b = points[i]
    if (a && b) s += Math.hypot(b[0] - a[0], b[1] - a[1])
  }
  return s
}

export function generateTraceField(spec: TraceSpec = TRACE_SPEC): TraceField {
  const rand = mulberry32(spec.seed)
  const { width: W, height: H } = spec

  const knots: Knot[] = []
  const knotCount = 2 + Math.floor(rand() * 2)
  for (let i = 0; i < knotCount; i++) {
    const x = W * (0.18 + 0.64 * ((i + 0.2 + rand() * 0.6) / knotCount))
    knots.push({ x, y: H * (0.2 + rand() * 0.6), rx: 22 + rand() * 16, ry: 8 + rand() * 6 })
  }
  const phi = grainField(spec, knots)
  const field = sampleField(spec, phi)

  const paths: TracePath[] = []
  const offset = rand() * GRAIN_SPACING
  for (let level = offset - 30; level < H + 30; level += GRAIN_SPACING) {
    // Nearly half the grain lines stay plain wood.
    if (rand() < 0.45) continue
    // Follow the isoline across the plank, splitting it wherever it touches a knot's rim.
    let near = level
    let run: number[] = []
    let runX0 = 0
    let runStart: Terminal = 'joint'
    const runs: { ideal: number[]; x0: number; start: Terminal; end: Terminal }[] = []
    const close = (end: Terminal) => {
      if (run.length > 24) runs.push({ ideal: run, x0: runX0, start: runStart, end })
      run = []
    }
    for (let x = 0; x < W; x++) {
      const y = crossingNear(field, spec, x, level, near)
      const inKnot = y !== null && knots.some((k) => knotRim(k, x, y) < 1)
      const offTexture = y === null || y < 3 || y > H - 4
      if (offTexture || inKnot) {
        if (run.length) close(inKnot ? 'knot' : 'break')
        if (y !== null) near = y
        runStart = inKnot ? 'knot' : 'break'
        continue
      }
      if (!run.length) runX0 = x
      run.push(y)
      near = y
    }
    if (run.length) close('joint')

    // Break some long runs into shorter traces with a gap, each end a via.
    for (const r of runs) {
      let pieces = [r]
      if (r.ideal.length > 360 && rand() < 0.7) {
        const cut = Math.floor(r.ideal.length * (0.3 + rand() * 0.4))
        const gap = 22 + Math.floor(rand() * 40)
        pieces = [
          { ideal: r.ideal.slice(0, cut), x0: r.x0, start: r.start, end: 'break' },
          { ideal: r.ideal.slice(cut + gap), x0: r.x0 + cut + gap, start: 'break', end: r.end },
        ]
      }
      for (const p of pieces) {
        if (p.ideal.length < 24) continue
        paths.push({ points: route(p.ideal, p.x0), start: p.x0 === 0 ? 'joint' : p.start, end: p.end })
      }
    }
  }

  const ras: Raster = { r: new Float32Array(W * H), g: new Float32Array(W * H), b: new Float32Array(W * H) }
  for (const path of paths) {
    let s = 0
    for (let i = 1; i < path.points.length; i++) {
      const a = path.points[i - 1]
      const b = path.points[i]
      if (!a || !b) continue
      stampSegment(ras, spec, a, b, s, TRACE_HALF_WIDTH)
      s += Math.hypot(b[0] - a[0], b[1] - a[1])
    }
    const first = path.points[0]
    const last = path.points[path.points.length - 1]
    const total = polylineLength(path.points)
    if (first) {
      if (path.start === 'joint') stampJointPad(ras, spec, first[0], first[1], 0)
      else stampRing(ras, spec, first[0], first[1], VIA_OUTER, VIA_INNER, 0)
    }
    if (last) {
      if (path.end === 'joint') stampJointPad(ras, spec, last[0], last[1], total)
      else stampRing(ras, spec, last[0], last[1], VIA_OUTER, VIA_INNER, total)
    }
  }
  // Pads at the knots: a ring round the heartwood and a dot in it.
  for (const k of knots) {
    stampRing(ras, spec, k.x, k.y, Math.min(k.rx, k.ry) * 0.75, Math.min(k.rx, k.ry) * 0.75 - 2.2, 0)
    stampRing(ras, spec, k.x, k.y, 2.6, 0, 0)
  }

  const grainNoise = valueNoise(spec.seed ^ 0x3c)
  const data = new Uint8Array(W * H * 4)
  for (let i = 0; i < W * H; i++) {
    const x = i % W
    const y = (i - x) / W
    const r = ras.r[i] ?? 0
    const along = Math.min(1, (ras.g[i] ?? 0) / W)
    const v = field[i] ?? 0
    // Fine grain between the traced lines, darker toward the knots' heartwood.
    const fine = 0.5 + 0.5 * Math.cos((2 * Math.PI * v) / (GRAIN_SPACING / 3))
    let grain = 0.55 * fine + 0.45 * grainNoise(x / 40, v / 6)
    for (const k of knots) grain *= 1 - 0.7 * Math.exp(-(((x - k.x) / k.rx) ** 2 + ((y - k.y) / k.ry) ** 2))
    data[i * 4] = Math.round(r * 255)
    data[i * 4 + 1] = Math.round(along * r * 255)
    data[i * 4 + 2] = Math.round((ras.b[i] ?? 0) * 255)
    data[i * 4 + 3] = Math.round(Math.min(1, Math.max(0, grain)) * 255)
  }
  return { spec, data, paths, knots }
}
