/**
 * 松针: the brushwork of a painted pine's needle clusters, generated once at startup as a texture
 * atlas (no download). Each cell is one pad seen from the side, the way painters draw it: a pale,
 * mottled wash for the mass (淡墨 渲染), and over it fans of tapered needle strokes in dark ink
 * whose tips make the ragged silhouette.
 *
 * Channels: R needle strokes, G wash. Pads alpha-test on max(R, G) (glsl/ink.frag.glsl).
 * The plan is pure and seeded (tested in node); `paintNeedleAtlas()` paints it with Canvas 2D.
 * The stage paints it in a worker before it mounts (env/prepare.ts) and hands the texels to
 * `primeNeedleAtlas`; `needleAtlasTexture()` only paints on this thread when that didn't happen.
 */

import { DataTexture, LinearFilter, LinearMipmapLinearFilter, NoColorSpace, RGFormat, UnsignedByteType, ClampToEdgeWrapping } from 'three'
import { lerp, rng } from '../random'

export const NEEDLE_ATLAS = { cols: 4, rows: 4, cellW: 512, cellH: 256 } as const
export const NEEDLE_CELLS = NEEDLE_ATLAS.cols * NEEDLE_ATLAS.rows
/** Nothing is painted this close to a cell's edge, so mip levels never bleed between cells. */
export const NEEDLE_MARGIN = 10

/** A tapered needle: root (x0, y0) to tip (x1, y1), root width `w`, in cell pixels (y down). */
export interface NeedleStroke {
  x0: number
  y0: number
  x1: number
  y1: number
  w: number
}

/** A closed wash shape: `points` in cell pixels, filled white at `alpha`. */
export interface WashShape {
  points: readonly (readonly [number, number])[]
  alpha: number
}

export interface NeedleCell {
  washes: WashShape[]
  needles: NeedleStroke[]
}

/** How full a cluster is: a dense old pad, an ordinary one, or a sparse dry one. */
type Style = 'dense' | 'fan' | 'sparse'
const STYLES: readonly Style[] = ['fan', 'dense', 'fan', 'sparse', 'dense', 'fan', 'fan', 'dense', 'sparse', 'fan', 'dense', 'fan', 'fan', 'sparse', 'dense', 'fan']

const { cellW: W, cellH: H } = NEEDLE_ATLAS
const clampX = (x: number) => Math.min(W - NEEDLE_MARGIN, Math.max(NEEDLE_MARGIN, x))
const clampY = (y: number) => Math.min(H - NEEDLE_MARGIN, Math.max(NEEDLE_MARGIN, y))

/** A lumpy, flat-bottomed cloud outline around (cx, cy): half-width a, top height bt, bottom height bb. */
function cloud(cx: number, cy: number, a: number, bt: number, bb: number, rand: () => number, n = 48): [number, number][] {
  const h = [0, 1, 2].map(() => ({ amp: lerp(0.03, 0.09, rand()), ph: rand() * Math.PI * 2 }))
  const pts: [number, number][] = []
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2
    const c = Math.cos(t)
    const s = Math.sin(t)
    // Superellipse, boxier than an ellipse: pads read as flat layers, not balls.
    const e = 2 / 2.6
    const x = Math.sign(c) * Math.abs(c) ** e
    const y = Math.sign(s) * Math.abs(s) ** e
    const wob = 1 + (h[0]?.amp ?? 0) * Math.sin(3 * t + (h[0]?.ph ?? 0)) + (h[1]?.amp ?? 0) * Math.sin(5 * t + (h[1]?.ph ?? 0)) + (h[2]?.amp ?? 0) * Math.sin(9 * t + (h[2]?.ph ?? 0)) + (rand() - 0.5) * 0.08
    pts.push([clampX(cx + x * a * wob), clampY(cy + y * (y < 0 ? bt : bb) * wob)])
  }
  return pts
}

/** One fan of needles rooted at (ox, oy), opening around `axis` (radians, canvas y down) by ±spread. */
function fan(out: NeedleStroke[], ox: number, oy: number, axis: number, spread: number, count: number, len: number, rand: () => number) {
  for (let k = 0; k < count; k++) {
    const t = count === 1 ? 0.5 : k / (count - 1)
    const ang = axis + lerp(-spread, spread, t) + (rand() - 0.5) * 0.1
    // Needles pointing down are shorter: the cluster hangs off its twig, it doesn't hover.
    const down = Math.max(0, Math.sin(ang))
    const l = len * lerp(0.72, 1.1, rand()) * (1 - 0.4 * down)
    const r0 = l * lerp(0.02, 0.08, rand())
    const dx = Math.cos(ang)
    const dy = Math.sin(ang)
    out.push({ x0: clampX(ox + dx * r0), y0: clampY(oy + dy * r0), x1: clampX(ox + dx * l), y1: clampY(oy + dy * l), w: lerp(1.7, 2.6, rand()) })
  }
}

/** One cell's strokes. Deterministic in `index`. */
export function planNeedleCell(index: number): NeedleCell {
  const rand = rng(0x5e11 + index * 7919)
  const style = STYLES[index % STYLES.length] ?? 'fan'
  const cx = W / 2 + (rand() - 0.5) * W * 0.05
  const cy = H * lerp(0.56, 0.6, rand())
  const a = W * lerp(0.33, 0.37, rand())
  const bt = H * lerp(0.24, 0.29, rand())
  const bb = H * lerp(0.13, 0.16, rand())

  // Wash: the mass, a little inside the needle fringe, mottled by pale dabs so the core reads
  // denser (淡墨 渲染 under the needles).
  const washes: WashShape[] = [{ points: cloud(cx, cy, a * 0.84, bt * 0.72, bb * 0.85, rand), alpha: 0.58 }]
  const dabs = style === 'sparse' ? 6 : 10
  for (let i = 0; i < dabs; i++) {
    const u = rand() * 2 - 1
    washes.push({
      points: cloud(cx + u * a * 0.62, cy + lerp(-bt * 0.3, bb * 0.4, rand()), a * lerp(0.16, 0.3, rand()) * (1 - 0.4 * Math.abs(u)), bt * lerp(0.2, 0.34, rand()), bb * lerp(0.4, 0.65, rand()), rand, 28),
      alpha: lerp(0.12, 0.24, rand()),
    })
  }

  // Needles: rows of overlapping fans over the whole mass, top row first. Fans in the top row set
  // the silhouette and lean outward at the ends; lower rows open wider and shorter, and the last
  // hangs a few needles below the wash, so the edge is needle tips all round.
  const needles: NeedleStroke[] = []
  const rows = style === 'sparse' ? 4 : 5
  const perRow = style === 'dense' ? 13 : style === 'fan' ? 11 : 8
  for (let r = 0; r < rows; r++) {
    const f = r / (rows - 1)
    const y = cy - bt * 0.68 + f * (bt * 0.68 + bb * 0.7)
    const dy = y < cy ? (cy - y) / bt : (y - cy) / bb
    const half = a * 0.95 * Math.sqrt(Math.max(0.05, 1 - dy * dy))
    const n = Math.max(3, Math.round(perRow * (half / a) + (rand() - 0.5) * 2))
    for (let k = 0; k < n; k++) {
      const u = n === 1 ? 0 : lerp(-1, 1, (k + 0.5) / n) + (rand() - 0.5) * (1.4 / n)
      const ox = cx + u * half
      const oy = y + (rand() - 0.5) * bt * 0.18
      const lean = u * lerp(0.7, 1.0, f) * (half / a)
      const hanging = r === rows - 1 && rand() < 0.35
      const axis = hanging ? Math.PI / 2 - u * 0.8 : -Math.PI / 2 + lean
      const spread = hanging ? lerp(0.5, 0.8, rand()) : lerp(0.9, 1.2, rand()) + f * 0.35
      const len = H * (hanging ? lerp(0.08, 0.12, rand()) : lerp(0.22, 0.3, rand()) * (1 - 0.35 * f) * (1 - 0.15 * Math.abs(u)))
      const count = Math.round((style === 'sparse' ? lerp(10, 14, rand()) : lerp(14, 20, rand())) * (hanging ? 0.6 : 1))
      fan(needles, ox, oy, axis, spread, count, len, rand)
    }
  }
  return { washes, needles }
}

type Ctx2D = OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D

function context(width: number, height: number): Ctx2D {
  const canvas = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(width, height) : Object.assign(document.createElement('canvas'), { width, height })
  const ctx = canvas.getContext('2d') as Ctx2D | null
  if (!ctx) throw new Error('needle atlas: no 2D canvas')
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, width, height)
  return ctx
}

function paintNeedle(ctx: Ctx2D, s: NeedleStroke) {
  // A tapered stroke: pressed at the root, lifted to a hair at the tip (起笔重, 收笔轻).
  const dx = s.x1 - s.x0
  const dy = s.y1 - s.y0
  const len = Math.hypot(dx, dy) || 1
  const nx = (-dy / len) * (s.w / 2)
  const ny = (dx / len) * (s.w / 2)
  ctx.beginPath()
  ctx.moveTo(s.x0 + nx, s.y0 + ny)
  ctx.quadraticCurveTo(s.x0 + dx * 0.55 + nx * 0.55, s.y0 + dy * 0.55 + ny * 0.55, s.x1, s.y1)
  ctx.quadraticCurveTo(s.x0 + dx * 0.55 - nx * 0.55, s.y0 + dy * 0.55 - ny * 0.55, s.x0 - nx, s.y0 - ny)
  ctx.closePath()
  ctx.fill()
}

let atlas: DataTexture | null = null
let primed: Uint8Array | null = null

/** Atlas size in texels. */
export const NEEDLE_ATLAS_SIZE = { width: NEEDLE_ATLAS.cols * W, height: NEEDLE_ATLAS.rows * H } as const

/**
 * Paints every cell and returns the atlas texels (RG8, row-major, y down). Canvas 2D through
 * OffscreenCanvas where there is one, so it also runs in a worker; about 100 ms on a desktop.
 */
export function paintNeedleAtlas(): Uint8Array {
  const { cols } = NEEDLE_ATLAS
  const { width, height } = NEEDLE_ATLAS_SIZE
  const needleCtx = context(width, height)
  const washCtx = context(width, height)
  needleCtx.fillStyle = '#fff'
  washCtx.fillStyle = '#fff'
  for (let i = 0; i < NEEDLE_CELLS; i++) {
    const cell = planNeedleCell(i)
    const ox = (i % cols) * W
    const oy = Math.floor(i / cols) * H
    washCtx.setTransform(1, 0, 0, 1, ox, oy)
    for (const w of cell.washes) {
      washCtx.globalAlpha = w.alpha
      washCtx.beginPath()
      w.points.forEach(([x, y], k) => (k === 0 ? washCtx.moveTo(x, y) : washCtx.lineTo(x, y)))
      washCtx.closePath()
      washCtx.fill()
    }
    needleCtx.setTransform(1, 0, 0, 1, ox, oy)
    for (const s of cell.needles) paintNeedle(needleCtx, s)
  }
  const needles = needleCtx.getImageData(0, 0, width, height).data
  const wash = washCtx.getImageData(0, 0, width, height).data
  const data = new Uint8Array(width * height * 2)
  for (let p = 0, q = 0; q < data.length; p += 4, q += 2) {
    data[q] = needles[p] ?? 0
    data[q + 1] = wash[p] ?? 0
  }
  return data
}

/** Texels painted elsewhere (a worker); the next `needleAtlasTexture()` uses them. */
export function primeNeedleAtlas(data: Uint8Array): void {
  if (!atlas && data.length === NEEDLE_ATLAS_SIZE.width * NEEDLE_ATLAS_SIZE.height * 2) primed = data
}

/**
 * The shared needle atlas (2048 × 1024, RG8, mipmapped): the primed texels, or painted here on
 * first use. Linear data, clamped, never disposed: every pine material and any section pine
 * samples the same one.
 */
export function needleAtlasTexture(): DataTexture {
  if (atlas) return atlas
  const data = primed ?? paintNeedleAtlas()
  primed = null
  const tex = new DataTexture(data, NEEDLE_ATLAS_SIZE.width, NEEDLE_ATLAS_SIZE.height, RGFormat, UnsignedByteType)
  tex.colorSpace = NoColorSpace
  tex.wrapS = ClampToEdgeWrapping
  tex.wrapT = ClampToEdgeWrapping
  tex.magFilter = LinearFilter
  tex.minFilter = LinearMipmapLinearFilter
  tex.generateMipmaps = true
  tex.flipY = false
  tex.needsUpdate = true
  atlas = tex
  return tex
}
