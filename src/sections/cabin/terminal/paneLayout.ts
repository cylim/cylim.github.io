import type { TerminalLine } from '../../../core/store/journey'
import { socials, terminal, workItems } from '../../../content'

/**
 * What the 3D pane shows (design.md §10.2): the same log as the DOM terminal, laid out on a
 * monospace grid. Pure, so it is tested without a canvas.
 */

export type Tone = 'prompt' | 'text' | 'dim' | 'link'

export interface Run {
  text: string
  tone: Tone
}

export type PaneRow = { kind: 'text'; runs: Run[] } | { kind: 'chart'; atMs: number; row: number }

/** A `qimen` line's 3 × 3 grid takes this many text rows. */
export const CHART_ROWS = 7

const displayOf = (href: string) => href.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')

let known: string[] | null = null
/** Every URL the terminal prints, in the display form the log uses, longest first. */
function knownLinks(): string[] {
  known ??= [...new Set([...socials.map((s) => s.href), ...Object.values(workItems).flatMap((w) => w.links.map((l) => l.href))])]
    .map(displayOf)
    .toSorted((a, b) => b.length - a.length)
  return known
}

/** Split a line into runs, marking the first known URL as a link (the DOM log makes it an <a>). */
export function linkRuns(text: string, tone: Tone = 'text'): Run[] {
  for (const d of knownLinks()) {
    const i = text.indexOf(d)
    if (i < 0) continue
    const end = i + d.length
    // Whole path segments only, as in the DOM log.
    if (/[\w/-]/.test(text.charAt(end))) continue
    const runs: Run[] = [
      { text: text.slice(0, i), tone },
      { text: d, tone: 'link' },
      { text: text.slice(end), tone },
    ]
    return runs.filter((r) => r.text.length > 0)
  }
  return [{ text, tone }]
}

/** Wrap runs to `cols` columns, breaking at spaces where it can and hard-breaking longer words. */
export function wrapRuns(runs: readonly Run[], cols: number): Run[][] {
  const rows: Run[][] = [[]]
  let used = 0
  const newRow = () => {
    rows.push([])
    used = 0
  }
  const put = (text: string, tone: Tone) => {
    const row = rows[rows.length - 1]
    const last = row?.[row.length - 1]
    if (last && last.tone === tone) last.text += text
    else row?.push({ text, tone })
    used += text.length
  }
  for (const run of runs) {
    for (const word of run.text.split(/(?<= )/)) {
      let w = word
      while (w.length > 0) {
        if (w.trimEnd().length <= cols - used) {
          put(w, run.tone)
          break
        }
        if (used > 0) {
          newRow()
          continue
        }
        put(w.slice(0, cols), run.tone)
        w = w.slice(cols)
        if (w.length > 0) newRow()
      }
    }
  }
  return rows
}

function rowsOf(line: TerminalLine, cols: number): PaneRow[] {
  const text = (runs: Run[]): PaneRow[] => wrapRuns(runs, cols).map((r) => ({ kind: 'text', runs: r }))
  switch (line.kind) {
    case 'input':
      return text([
        { text: `${terminal.prompt} `, tone: 'prompt' },
        { text: line.text, tone: 'text' },
      ])
    case 'hint':
      return text(linkRuns(line.text, 'dim'))
    case 'link':
      return text([{ text: line.text, tone: 'link' }])
    case 'qimen':
      return line.chartAtMs === undefined ? [] : Array.from({ length: CHART_ROWS }, (_, row) => ({ kind: 'chart', atMs: line.chartAtMs ?? 0, row }))
    default:
      return text(line.text ? linkRuns(line.text) : [{ text: '', tone: 'text' }])
  }
}

/**
 * The rows the pane shows: the tail of the log that fits above the prompt row, like a terminal
 * scrolled to the bottom. A chart cut off at the top is dropped whole rather than shown in part.
 */
export function paneRows(lines: readonly TerminalLine[], cols: number, maxRows: number): PaneRow[] {
  const all = lines.flatMap((l) => rowsOf(l, cols))
  let tail = all.slice(Math.max(0, all.length - (maxRows - 1)))
  const first = tail[0]
  if (first?.kind === 'chart' && first.row > 0) tail = tail.filter((r) => !(r.kind === 'chart' && r.atMs === first.atMs))
  return [...tail, { kind: 'text', runs: [{ text: `${terminal.prompt} `, tone: 'prompt' }] }]
}
