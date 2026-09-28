import { CanvasTexture, LinearMipmapLinearFilter } from 'three'
import { contact } from '../../content/site'
import { siteAccents } from '../../content/accents'
import { socials, type SocialId } from '../../content/socials'
import { font } from '../../theme/tokens'
import { BRAND_GRID, BRAND_PATHS } from '../../content/brandMarks'

/**
 * The stele's carved face (design.md §8.7 E1): the stele line from content, then four rows of a
 * brand mark and its "shown as" text. Drawn once into a canvas as masks: r is the ink fill, g the
 * groove depth (the fill blurred), which the carving shader turns into lit groove walls.
 *
 * The carved region is a rectangle on the tablet face under the round head, in metres from the
 * tablet's foot. The layout is pure, so the tests and the pointer mapping share it.
 */
export const FACE = {
  width: 0.8,
  height: 1.2,
  /** Bottom of the carved region above the tablet's foot. */
  bottom: 1.0,
  pxPerMetre: 640,
} as const

const M = FACE.pxPerMetre
const W = Math.round(FACE.width * M)
const H = Math.round(FACE.height * M)

const LINE = { size: 0.066, lineHeight: 1.22, width: 0.7 }
const ROW = { pitch: 0.128, mark: 0.058, gap: 0.028, size: 0.048 }
const GAPS = { top: 0.07, afterLine: 0.05, rule: [0.18, 0.005] as const, afterRule: 0.06 }
/** Outline width added to carved type, as a fraction of its size. */
const EMBOLDEN = 0.045

export type MeasureText = (text: string, px: number, face: 'display' | 'body') => number

export interface FaceRow {
  readonly id: SocialId
  readonly text: string
  /** Row box in canvas px, top-down. */
  readonly top: number
  readonly bottom: number
  readonly markX: number
  readonly markSize: number
  readonly textX: number
  readonly baseline: number
  readonly textPx: number
}

export interface FaceLayout {
  readonly width: number
  readonly height: number
  readonly line: { readonly lines: readonly string[]; readonly baselines: readonly number[]; readonly px: number; readonly centreX: number }
  readonly rule: { readonly x: number; readonly y: number; readonly w: number; readonly h: number }
  readonly rows: readonly FaceRow[]
}

/** Greedy word wrap to `max` px. */
export function wrap(text: string, max: number, measure: (s: string) => number): string[] {
  const lines: string[] = []
  let cur = ''
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = cur ? `${cur} ${word}` : word
    if (cur && measure(next) > max) {
      lines.push(cur)
      cur = word
    } else cur = next
  }
  if (cur) lines.push(cur)
  return lines
}

export function layoutFace(measure: MeasureText): FaceLayout {
  const linePx = Math.round(LINE.size * M)
  const lines = wrap(contact.line, LINE.width * M, (s) => measure(s, linePx, 'display'))
  const lh = linePx * LINE.lineHeight
  let y = GAPS.top * M
  const baselines = lines.map((_, i) => y + linePx * 0.8 + i * lh)
  y += lines.length * lh + GAPS.afterLine * M
  const rule = { x: (W - GAPS.rule[0] * M) / 2, y, w: GAPS.rule[0] * M, h: Math.max(2, GAPS.rule[1] * M) }
  y += rule.h + GAPS.afterRule * M

  const markSize = ROW.mark * M
  const gap = ROW.gap * M
  const room = LINE.width * M - markSize - gap
  const widest = Math.max(...socials.map((s) => measure(s.display, ROW.size * M, 'body')))
  const textPx = Math.floor(ROW.size * M * Math.min(1, room / widest))
  const blockW = markSize + gap + Math.min(widest * (textPx / (ROW.size * M)), room)
  const x0 = (W - blockW) / 2
  const pitch = ROW.pitch * M
  const rows = socials.map((s, i): FaceRow => {
    const top = y + i * pitch
    const mid = top + pitch / 2
    return {
      id: s.id,
      text: s.display,
      top,
      bottom: top + pitch,
      markX: x0,
      markSize,
      textX: x0 + markSize + gap,
      baseline: mid + textPx * 0.34,
      textPx,
    }
  })
  return { width: W, height: H, line: { lines, baselines, px: linePx, centreX: W / 2 }, rule, rows }
}

/** Row bands in texture v (0 at the bottom), for the glow uniforms. */
export function rowBands(layout: FaceLayout): { v0: [number, number, number, number]; v1: [number, number, number, number] } {
  const v = (px: number) => 1 - px / layout.height
  const pick = (f: (r: FaceRow) => number) => [0, 1, 2, 3].map((i) => (layout.rows[i] ? f(layout.rows[i]) : 0)) as [number, number, number, number]
  return { v0: pick((r) => v(r.bottom)), v1: pick((r) => v(r.top)) }
}

/** The row under texture coordinate v, or null between and outside the rows. */
export function rowAt(layout: FaceLayout, v: number): SocialId | null {
  const y = (1 - v) * layout.height
  return layout.rows.find((r) => y >= r.top && y < r.bottom)?.id ?? null
}

// ---------------------------------------------------------------------------- drawing (browser)

const fontFor = (px: number, face: 'display' | 'body') => (face === 'display' ? `600 ${px}px ${font.display}` : `400 ${px}px ${font.body}`)

const WEN = siteAccents.find((t) => t.zh === '文')

/** Wait for the faces the carving uses; after `timeoutMs` carve with whatever the browser has. */
async function fontsReady(timeoutMs: number): Promise<void> {
  const loads = [
    document.fonts.load(fontFor(40, 'display'), contact.line),
    document.fonts.load(fontFor(30, 'body'), socials.map((s) => s.display).join('')),
    ...(WEN ? [document.fonts.load(`400 40px ${font.cjk}`, WEN.zh)] : []),
  ]
  await Promise.race([Promise.allSettled(loads), new Promise((r) => setTimeout(r, timeoutMs))])
}

function drawMark(ctx: CanvasRenderingContext2D, row: FaceRow): void {
  const mid = (row.top + row.bottom) / 2
  if (row.id === 'blog') {
    if (!WEN) return
    ctx.font = `400 ${Math.round(row.markSize * 1.05)}px ${font.cjk}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(WEN.zh, row.markX + row.markSize / 2, mid)
    return
  }
  const s = row.markSize / BRAND_GRID
  ctx.save()
  ctx.translate(row.markX, mid - row.markSize / 2)
  ctx.scale(s, s)
  // oxlint-disable-next-line unicorn/no-array-fill-with-reference-type -- CanvasRenderingContext2D.fill, not Array.fill
  ctx.fill(new Path2D(BRAND_PATHS[row.id]))
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

export interface CarvedFace {
  readonly texture: CanvasTexture
  readonly layout: FaceLayout
}

async function carve(): Promise<CarvedFace> {
  await fontsReady(2500)
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('stele: no 2d context')
  const measure: MeasureText = (text, px, face) => {
    ctx.font = fontFor(px, face)
    return ctx.measureText(text).width
  }
  const layout = layoutFace(measure)

  // Cut strokes a touch heavier than the type: from the path the carving is only a few pixels tall.
  const carveText = (text: string, x: number, y: number, px: number) => {
    ctx.lineWidth = px * EMBOLDEN
    ctx.fillText(text, x, y)
    ctx.strokeText(text, x, y)
  }
  ctx.fillStyle = '#fff'
  ctx.strokeStyle = '#fff'
  ctx.lineJoin = 'round'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.font = fontFor(layout.line.px, 'display')
  layout.line.lines.forEach((line, i) => carveText(line, layout.line.centreX, layout.line.baselines[i] ?? 0, layout.line.px))
  ctx.fillRect(layout.rule.x, layout.rule.y, layout.rule.w, layout.rule.h)
  for (const row of layout.rows) {
    drawMark(ctx, row)
    ctx.textAlign = 'left'
    ctx.textBaseline = 'alphabetic'
    ctx.font = fontFor(row.textPx, 'body')
    carveText(row.text, row.textX, row.baseline, row.textPx)
  }

  const img = ctx.getImageData(0, 0, W, H)
  const fill = new Float32Array(W * H)
  for (let i = 0; i < fill.length; i++) fill[i] = (img.data[i * 4 + 3] ?? 0) / 255
  const depth = blur(fill, W, H, 1)
  for (let i = 0; i < fill.length; i++) {
    img.data[i * 4] = Math.round((fill[i] ?? 0) * 255)
    img.data[i * 4 + 1] = Math.round(Math.min(1, (depth[i] ?? 0) * 1.4) * 255)
    img.data[i * 4 + 2] = 0
    img.data[i * 4 + 3] = 255
  }
  ctx.putImageData(img, 0, 0)

  const texture = new CanvasTexture(canvas)
  texture.minFilter = LinearMipmapLinearFilter
  texture.anisotropy = 4
  texture.name = 'stele-face'
  return { texture, layout }
}

let pending: Promise<CarvedFace> | null = null
/** The carved face, drawn once per page; the Stele suspends on it so prewarm sees the texture. */
export function carvedFace(): Promise<CarvedFace> {
  pending ??= carve().catch((e: unknown) => {
    pending = null
    throw e
  })
  return pending
}
