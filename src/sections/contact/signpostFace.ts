import { CanvasTexture, LinearMipmapLinearFilter } from 'three'
import { BRAND_GRID, BRAND_PATHS } from '../../content/brandMarks'
import { socialById, type SocialId } from '../../content/socials'
import { rng } from '../../env'
import { font } from '../../theme/tokens'
import { ATLAS, ATLAS_SIZE, BOARDS, boardOutline, boardRow, lettering, toAtlas, type Board } from './signpostGeometry'

/**
 * The signpost's board faces (design.md §8.7 E1), one row of a canvas atlas per board: the brand
 * mark and the username cut into the wood and filled with ink, no product names (the DOM keeps
 * those for screen readers). Drawn once as masks: r the ink fill, g the groove depth (the fill
 * blurred), which the carving shader turns into lit groove walls, and b the wood's grain and
 * weathering, laid on as dry-brush ink.
 *
 * The layout is pure, so the tests and the pointer mapping share it.
 */

const M = ATLAS.pxPerMetre
/** Lettering size and the mark beside it, metres; shrunk together if a username runs long. */
const TYPE = { size: 0.125, mark: 0.095, gap: 0.035 }
/** Outline width added to cut type, as a fraction of its size. */
const EMBOLDEN = 0.04

export type MeasureText = (text: string, px: number) => number

export interface FaceRow {
  readonly id: SocialId
  readonly text: string
  /** Row box in canvas px, top-down. */
  readonly top: number
  readonly bottom: number
  /** The lettering area on this board, canvas px. */
  readonly left: number
  readonly right: number
  readonly markX: number
  readonly markSize: number
  readonly textX: number
  readonly baseline: number
  readonly textPx: number
}

export interface FaceLayout {
  readonly width: number
  readonly height: number
  readonly rows: readonly FaceRow[]
}

/** The lettering span of a board in canvas px, left to right as seen from the front. */
function span(board: Board): { left: number; right: number } {
  const { a0, a1 } = lettering(board)
  const [x0] = toAtlas(board, a0, 0)
  const [x1] = toAtlas(board, a1, 0)
  return { left: Math.min(x0, x1), right: Math.max(x0, x1) }
}

export function layoutFaces(measure: MeasureText): FaceLayout {
  const size = TYPE.size * M
  // One size for every board, fitted to the tightest: mark, gap and the username in its span.
  const fit = Math.min(
    1,
    ...BOARDS.map((b) => {
      const { left, right } = span(b)
      return (right - left) / ((TYPE.mark + TYPE.gap) * M + measure(socialById(b.id).display, size))
    }),
  )
  const textPx = Math.floor(size * fit)
  const markSize = TYPE.mark * M * fit
  const gap = TYPE.gap * M * fit
  const rows = BOARDS.map((b): FaceRow => {
    const { top, bottom } = boardRow(b.index)
    const { left, right } = span(b)
    const text = socialById(b.id).display
    const blockW = markSize + gap + measure(text, textPx)
    const x0 = (left + right - blockW) / 2
    const mid = (top + bottom) / 2
    return { id: b.id, text, top, bottom, left, right, markX: x0, markSize, textX: x0 + markSize + gap, baseline: mid + textPx * 0.3, textPx }
  })
  return { width: ATLAS_SIZE.width, height: ATLAS_SIZE.height, rows }
}

/** Row bands in texture v (0 at the bottom), for the glow uniforms. */
export function rowBands(layout: FaceLayout): { v0: [number, number, number, number]; v1: [number, number, number, number] } {
  const v = (px: number) => 1 - px / layout.height
  const pick = (f: (r: FaceRow) => number) => [0, 1, 2, 3].map((i) => (layout.rows[i] ? f(layout.rows[i]) : 0)) as [number, number, number, number]
  return { v0: pick((r) => v(r.bottom)), v1: pick((r) => v(r.top)) }
}

/** The board under texture coordinate v, or null between the rows. */
export function rowAt(layout: FaceLayout, v: number): SocialId | null {
  const y = (1 - v) * layout.height
  return layout.rows.find((r) => y >= r.top && y < r.bottom)?.id ?? null
}

// ---------------------------------------------------------------------------- drawing (browser)

const fontFor = (px: number) => `600 ${px}px ${font.body}`

/** Wait for the face the cutting uses; after `timeoutMs` cut with whatever the browser has. */
async function fontsReady(timeoutMs: number): Promise<void> {
  const load = document.fonts.load(fontFor(40), BOARDS.map((b) => socialById(b.id).display).join(''))
  await Promise.race([load.catch(() => undefined), new Promise((r) => setTimeout(r, timeoutMs))])
}

function drawMark(ctx: CanvasRenderingContext2D, row: FaceRow): void {
  const mid = (row.top + row.bottom) / 2
  const s = row.markSize / BRAND_GRID
  ctx.save()
  ctx.translate(row.markX, mid - row.markSize / 2)
  ctx.scale(s, s)
  // oxlint-disable-next-line unicorn/no-array-fill-with-reference-type -- CanvasRenderingContext2D.fill, not Array.fill
  ctx.fill(new Path2D(BRAND_PATHS[row.id]))
  ctx.restore()
}

function outlinePath(board: Board): Path2D {
  const p = new Path2D()
  boardOutline(board).forEach(([a, b], i) => {
    const [x, y] = toAtlas(board, a, b)
    if (i === 0) p.moveTo(x, y)
    else p.lineTo(x, y)
  })
  p.closePath()
  return p
}

/**
 * Grain as a painter gives old timber: long, slightly wavering dry-brush lines along the board,
 * broken where the brush runs dry, a knot pushed round by them, a couple of checks opening from
 * the butt end, and the weather gathered at the lower edge and the ends.
 */
function drawGrain(ctx: CanvasRenderingContext2D, board: Board): void {
  const rand = rng(97 + board.index * 131)
  const { top, bottom } = boardRow(board.index)
  const h = bottom - top
  const [bx] = toAtlas(board, 0, 0)
  const [tx] = toAtlas(board, board.length, 0)
  const x0 = Math.min(bx, tx)
  const x1 = Math.max(bx, tx)
  ctx.save()
  ctx.clip(outlinePath(board))
  ctx.lineCap = 'round'
  // A knot toward one end, outside the lettering.
  const knotX = bx + (tx - bx) * (rand() < 0.5 ? 0.12 : 0.88)
  const knotY = top + h * (0.3 + rand() * 0.4)
  const knotR = h * (0.06 + rand() * 0.04)
  ctx.globalAlpha = 0.9
  ctx.lineWidth = 2.2
  ctx.beginPath()
  ctx.ellipse(knotX, knotY, knotR * 1.8, knotR, 0, 0, Math.PI * 2)
  ctx.stroke()
  ctx.globalAlpha = 0.55
  ctx.beginPath()
  ctx.ellipse(knotX, knotY, knotR * 0.7, knotR * 0.4, 0, 0, Math.PI * 2)
  // oxlint-disable-next-line unicorn/no-array-fill-with-reference-type -- CanvasRenderingContext2D.fill, not Array.fill
  ctx.fill()
  // Grain lines, bending round the knot.
  const lines = 11
  for (let i = 0; i < lines; i++) {
    const y0 = top + h * ((i + 0.5 + (rand() - 0.5) * 0.6) / lines)
    const amp = h * (0.008 + rand() * 0.012)
    const freq = (Math.PI * 2) / ((x1 - x0) * (0.5 + rand()))
    const phase = rand() * 6
    ctx.lineWidth = 1 + rand() * 1.6
    let drawing = rand() < 0.6
    let run = 0
    ctx.beginPath()
    for (let x = x0; x <= x1; x += 6) {
      const dy = y0 - knotY
      const bend = (knotR * 2.6 * Math.sign(dy || 1)) * Math.exp(-(((x - knotX) / (knotR * 3.2)) ** 2) - (dy / (knotR * 3)) ** 2)
      const y = y0 + amp * Math.sin(x * freq + phase) + bend
      run -= 6
      if (run <= 0) {
        // Dry brush: the line breaks and picks up again.
        drawing = !drawing
        run = drawing ? 40 + rand() * 160 : 8 + rand() * 50
        ctx.moveTo(x, y)
      } else if (drawing) ctx.lineTo(x, y)
      else ctx.moveTo(x, y)
    }
    ctx.globalAlpha = 0.35 + rand() * 0.45
    ctx.stroke()
  }
  // Checks opening from the butt end along the grain, tapering shut.
  ctx.globalAlpha = 1
  for (let i = 0; i < 2; i++) {
    const y = top + h * (0.25 + 0.5 * rand())
    const len = (0.06 + rand() * 0.08) * M * Math.sign(tx - bx)
    ctx.beginPath()
    ctx.moveTo(bx, y - 1.6)
    ctx.quadraticCurveTo(bx + len * 0.5, y + (rand() - 0.5) * 3, bx + len, y)
    ctx.quadraticCurveTo(bx + len * 0.5, y + (rand() - 0.5) * 3, bx, y + 1.6)
    // oxlint-disable-next-line unicorn/no-array-fill-with-reference-type -- CanvasRenderingContext2D.fill, not Array.fill
    ctx.fill()
  }
  // Weather: darker along the lower edge, where the rain runs off, and toward both ends.
  const low = ctx.createLinearGradient(0, bottom, 0, bottom - h * 0.35)
  low.addColorStop(0, 'rgba(255,255,255,0.45)')
  low.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.globalAlpha = 1
  ctx.fillStyle = low
  ctx.fillRect(x0, top, x1 - x0, h)
  for (const [from, to] of [[x0, x0 + h * 0.8], [x1, x1 - h * 0.8]] as const) {
    const g = ctx.createLinearGradient(from, 0, to, 0)
    g.addColorStop(0, 'rgba(255,255,255,0.35)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(x0, top, x1 - x0, h)
  }
  ctx.restore()
}

/** Box blur, three passes each way: close enough to a gaussian for a groove profile. */
function blur(src: Float32Array, w: number, h: number, r: number): Float32Array {
  let a: Float32Array = src
  let b: Float32Array = new Float32Array(src.length)
  const n = 2 * r + 1
  for (let pass = 0; pass < 3; pass++) {
    for (let y = 0; y < h; y++) {
      let acc = 0
      for (let x = -r; x <= r; x++) acc += a[y * w + Math.min(w - 1, Math.max(0, x))] ?? 0
      for (let x = 0; x < w; x++) {
        b[y * w + x] = acc / n
        acc += (a[y * w + Math.min(w - 1, x + r + 1)] ?? 0) - (a[y * w + Math.max(0, x - r)] ?? 0)
      }
    }
    ;[a, b] = [b, a]
    for (let x = 0; x < w; x++) {
      let acc = 0
      for (let y = -r; y <= r; y++) acc += a[Math.min(h - 1, Math.max(0, y)) * w + x] ?? 0
      for (let y = 0; y < h; y++) {
        b[y * w + x] = acc / n
        acc += (a[Math.min(h - 1, y + r + 1) * w + x] ?? 0) - (a[Math.max(0, y - r) * w + x] ?? 0)
      }
    }
    ;[a, b] = [b, a]
  }
  return a
}

const alphaOf = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
  const d = ctx.getImageData(0, 0, w, h).data
  const out = new Float32Array(w * h)
  for (let i = 0; i < out.length; i++) out[i] = (d[i * 4 + 3] ?? 0) / 255
  return out
}

export interface BoardFaces {
  readonly texture: CanvasTexture
  readonly layout: FaceLayout
}

async function cut(): Promise<BoardFaces> {
  await fontsReady(2500)
  const { width: W, height: H } = ATLAS_SIZE
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('signpost: no 2d context')
  const measure: MeasureText = (text, px) => {
    ctx.font = fontFor(px)
    return ctx.measureText(text).width
  }
  const layout = layoutFaces(measure)

  ctx.fillStyle = '#fff'
  ctx.strokeStyle = '#fff'
  for (const b of BOARDS) drawGrain(ctx, b)
  const grain = alphaOf(ctx, W, H)
  ctx.clearRect(0, 0, W, H)

  // Cut strokes a touch heavier than the type: from the path the lettering is only a few pixels tall.
  ctx.globalAlpha = 1
  ctx.fillStyle = '#fff'
  ctx.strokeStyle = '#fff'
  ctx.lineJoin = 'round'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  for (const row of layout.rows) {
    drawMark(ctx, row)
    ctx.font = fontFor(row.textPx)
    ctx.lineWidth = row.textPx * EMBOLDEN
    ctx.fillText(row.text, row.textX, row.baseline)
    ctx.strokeText(row.text, row.textX, row.baseline)
  }
  const fill = alphaOf(ctx, W, H)
  const depth = blur(fill, W, H, 1)

  const img = ctx.createImageData(W, H)
  for (let i = 0; i < fill.length; i++) {
    img.data[i * 4] = Math.round((fill[i] ?? 0) * 255)
    img.data[i * 4 + 1] = Math.round(Math.min(1, (depth[i] ?? 0) * 1.4) * 255)
    img.data[i * 4 + 2] = Math.round((grain[i] ?? 0) * 255)
    img.data[i * 4 + 3] = 255
  }
  ctx.putImageData(img, 0, 0)

  const texture = new CanvasTexture(canvas)
  texture.minFilter = LinearMipmapLinearFilter
  texture.anisotropy = 4
  texture.name = 'signpost-faces'
  return { texture, layout }
}

let pending: Promise<BoardFaces> | null = null
/** The board faces, drawn once per page; the Signpost suspends on them so prewarm sees the texture. */
export function boardFaces(): Promise<BoardFaces> {
  pending ??= cut().catch((e: unknown) => {
    pending = null
    throw e
  })
  return pending
}
