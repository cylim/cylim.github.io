import type { PalaceNo, QimenChart } from '../../../lib/qimen/types'
import { LUO_SHU_GRID } from '../../../lib/qimen/constants'
import { PALACE_ZH } from '../../../lib/qimen/labels'
import { color, font } from '../../../theme/tokens'
import { CHART_ROWS, type PaneRow, type Tone } from './paneLayout'

/**
 * Draws the pane's canvas (design.md §10.1): JetBrains Mono in cyan-line, hints in cyan-dim, the
 * prompt and links in cyan-bright with links underlined, a 1 px cyan-dim border at 2 px radius.
 * No corner brackets, no fake window buttons, no scanlines. The glass itself is the shader.
 */

export const PANE_PX = { width: 1024, height: 640 } as const

export interface PaneMetrics {
  pad: number
  fontPx: number
  lineHeight: number
  charWidth: number
  cols: number
  rows: number
}

const TONE: Record<Tone, string> = { prompt: color.cyanBright, text: color.cyanLine, dim: color.cyanDim, link: color.cyanBright }

/** 1 CSS px of the DOM terminal is about 2 canvas px at the I3 framing. */
const SCALE = 2

export function measurePane(ctx: CanvasRenderingContext2D): PaneMetrics {
  const fontPx = 14 * SCALE
  ctx.font = `${fontPx}px ${font.mono}`
  const charWidth = ctx.measureText('M').width || fontPx * 0.6
  const pad = 16 * SCALE
  const lineHeight = Math.round(fontPx * 1.45)
  return {
    pad,
    fontPx,
    lineHeight,
    charWidth,
    cols: Math.floor((PANE_PX.width - 2 * pad) / charWidth),
    rows: Math.floor((PANE_PX.height - 2 * pad) / lineHeight),
  }
}

/** One palace cell of the south-up grid: deity; stars and heaven stems; door and earth stem; number. */
function drawCell(ctx: CanvasRenderingContext2D, chart: QimenChart, n: PalaceNo, x: number, y: number, w: number, h: number) {
  const p = chart.palaces[n]
  const px = Math.round(h / 4.2)
  ctx.strokeStyle = color.cyanGhost
  ctx.lineWidth = 1
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1)
  ctx.font = `${px}px ${font.cjk}`
  ctx.textBaseline = 'top'
  const line = (parts: { zh: string; mark: boolean }[], row: number, tone: string) => {
    let cx = x + px * 0.4
    const cy = y + px * 0.3 + row * px * 1.2
    for (const { zh, mark } of parts) {
      const tw = ctx.measureText(zh).width
      if (mark) {
        // 值符 and 值使 in inverse video (night on cyan-line): the cabin stays one hue.
        ctx.fillStyle = color.cyanLine
        ctx.fillRect(cx - 2, cy - 2, tw + 4, px + 4)
        ctx.fillStyle = color.night
      } else ctx.fillStyle = tone
      ctx.fillText(zh, cx, cy)
      cx += tw + px * 0.35
    }
  }
  if (p.deity) line([{ zh: p.deity, mark: false }], 0, color.cyanSoft)
  line(
    [...p.stars.map((s) => ({ zh: s, mark: p.flags.zhiFu && s === chart.zhiFu.star })), ...p.heaven.map((s) => ({ zh: s, mark: false }))],
    1,
    color.cyanLine,
  )
  line([...(p.door ? [{ zh: p.door, mark: p.flags.zhiShi }] : []), { zh: p.earth, mark: false }], 2, color.cyanLine)
  ctx.fillStyle = color.cyanDim
  ctx.font = `${Math.round(px * 0.7)}px ${font.cjk}`
  ctx.textAlign = 'right'
  ctx.fillText(`${PALACE_ZH[n]}${n}`, x + w - px * 0.3, y + h - px * 0.95)
  ctx.textAlign = 'left'
}

function drawChart(ctx: CanvasRenderingContext2D, chart: QimenChart | null, x: number, y: number, m: PaneMetrics) {
  const h = CHART_ROWS * m.lineHeight - m.lineHeight * 0.4
  const cell = h / 3
  const w = cell * 1.7
  if (!chart) return
  // South up, east on the left: the books' orientation (design.md Appendix C).
  LUO_SHU_GRID.forEach((row, r) => row.forEach((n, c) => drawCell(ctx, chart, n, x + c * w, y + r * cell, w, cell)))
}

export interface DrawResult {
  /** Caret block in canvas px: x, y, width, height. */
  caret: [number, number, number, number]
}

export function drawPane(
  ctx: CanvasRenderingContext2D,
  rows: readonly PaneRow[],
  m: PaneMetrics,
  chartAt: (atMs: number) => QimenChart | null,
): DrawResult {
  const { width: W, height: H } = PANE_PX
  ctx.clearRect(0, 0, W, H)
  // 1 px cyan-dim border, 2 px radius, in DOM pixels.
  ctx.strokeStyle = color.cyanDim
  ctx.lineWidth = SCALE
  ctx.beginPath()
  ctx.roundRect(SCALE / 2, SCALE / 2, W - SCALE, H - SCALE, 2 * SCALE)
  ctx.stroke()

  ctx.textBaseline = 'alphabetic'
  let y = m.pad
  let caretX = m.pad
  const drawn = new Set<number>()
  rows.forEach((row, i) => {
    const baseline = y + m.fontPx
    if (row.kind === 'chart') {
      if (row.row === 0 && !drawn.has(row.atMs)) {
        drawn.add(row.atMs)
        drawChart(ctx, chartAt(row.atMs), m.pad, y + m.lineHeight * 0.2, m)
      }
    } else {
      let x = m.pad
      ctx.font = `${m.fontPx}px ${font.mono}`
      for (const run of row.runs) {
        ctx.fillStyle = TONE[run.tone]
        ctx.fillText(run.text, x, baseline)
        const w = run.text.length * m.charWidth
        if (run.tone === 'link') ctx.fillRect(x, baseline + SCALE * 2, w, SCALE)
        x += w
      }
      if (i === rows.length - 1) caretX = x
    }
    y += m.lineHeight
  })
  const lastTop = m.pad + (rows.length - 1) * m.lineHeight
  return { caret: [caretX, lastTop + (m.lineHeight - m.fontPx) * 0.25, m.charWidth, m.fontPx * 1.1] }
}
