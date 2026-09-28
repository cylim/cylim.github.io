import { invalidate } from '@react-three/fiber'
import { CanvasTexture, LinearMipmapLinearFilter, SRGBColorSpace, Vector4 } from 'three'
import { chartOptions } from '../../../content'
import { journey, type TerminalLine } from '../../../core/store/journey'
import type { QimenChart } from '../../../lib/qimen/types'
import { font } from '../../../theme/tokens'
import { PANE_PX, drawPane, measurePane, type PaneMetrics } from './paneDraw'
import { paneRows } from './paneLayout'

/** At most 30 redraws a second while someone types (design.md §10.2). */
const MIN_REDRAW_MS = 1000 / 30

type Engine = typeof import('../../../lib/qimen')

/**
 * The pane's CanvasTexture, mirroring `journey.terminal.lines`. It redraws only when the log
 * changes (and once the fonts arrive), never per frame. `caret` is the caret block in UV for the
 * pane shader, which makes it breathe.
 */
class PaneScreen {
  readonly canvas: HTMLCanvasElement
  readonly texture: CanvasTexture
  readonly caret = new Vector4(1, 1, 0, 0)
  private readonly ctx: CanvasRenderingContext2D | null
  private metrics: PaneMetrics | null = null
  private lines: readonly TerminalLine[] = []
  private lastDraw = -Infinity
  private timer: ReturnType<typeof setTimeout> | null = null
  private engine: Engine | null = null
  private readonly charts = new Map<number, QimenChart | null>()
  private users = 0
  private unsubscribe: (() => void) | null = null

  constructor() {
    this.canvas = document.createElement('canvas')
    this.canvas.width = PANE_PX.width
    this.canvas.height = PANE_PX.height
    this.ctx = this.canvas.getContext('2d')
    this.texture = new CanvasTexture(this.canvas)
    this.texture.colorSpace = SRGBColorSpace
    this.texture.minFilter = LinearMipmapLinearFilter
    this.texture.anisotropy = 4
    // Redraw once the terminal's faces are in; the canvas can't wait on CSS the way the DOM does.
    const size = `${28}px`
    void Promise.all([document.fonts.load(`${size} ${font.mono}`), document.fonts.load(`${size} ${font.cjk}`, '值符')])
      .catch(() => undefined)
      .then(() => {
        this.metrics = null
        this.schedule()
      })
  }

  /** Start mirroring the store (reference-counted: the pane and the inkstone's reflection both use it). */
  retain(): void {
    if (this.users++ > 0) return
    this.lines = journey.getState().terminal.lines
    this.schedule()
    this.unsubscribe = journey.subscribe((s, prev) => {
      if (s.terminal.lines === prev.terminal.lines) return
      this.lines = s.terminal.lines
      this.schedule()
    })
  }

  release(): void {
    if (--this.users > 0) return
    this.unsubscribe?.()
    this.unsubscribe = null
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
  }

  private schedule(): void {
    if (this.timer) return
    const wait = Math.max(0, this.lastDraw + MIN_REDRAW_MS - performance.now())
    this.timer = setTimeout(() => {
      this.timer = null
      this.draw()
    }, wait)
  }

  private chartAt = (atMs: number): QimenChart | null => {
    if (this.charts.has(atMs)) return this.charts.get(atMs) ?? null
    if (!this.engine) {
      // The engine carries the solar-term table: load it only when a `qimen` line shows up.
      void import('../../../lib/qimen').then((engine) => {
        this.engine = engine
        this.schedule()
      })
      return null
    }
    let chart: QimenChart | null = null
    try {
      chart = this.engine.computeChart(atMs, chartOptions)
    } catch {
      chart = null
    }
    this.charts.set(atMs, chart)
    return chart
  }

  private draw(): void {
    const ctx = this.ctx
    if (!ctx) return
    this.lastDraw = performance.now()
    this.metrics ??= measurePane(ctx)
    const m = this.metrics
    const { caret } = drawPane(ctx, paneRows(this.lines, m.cols, m.rows), m, this.chartAt)
    const [x, y, w, h] = caret
    this.caret.set(x / PANE_PX.width, 1 - (y + h) / PANE_PX.height, (x + w) / PANE_PX.width, 1 - y / PANE_PX.height)
    this.texture.needsUpdate = true
    invalidate()
  }
}

let screen: PaneScreen | null = null

export function paneScreen(): PaneScreen {
  screen ??= new PaneScreen()
  return screen
}
