import { describe, expect, it } from 'vitest'
import type { TerminalLine } from '../../../core/store/journey'
import { terminal } from '../../../content'
import { CHART_ROWS, linkRuns, paneRows, wrapRuns } from './paneLayout'

const line = (id: number, kind: TerminalLine['kind'], text: string, extra: Partial<TerminalLine> = {}): TerminalLine => ({ id, kind, text, ...extra })
const flat = (runs: { text: string }[]) => runs.map((r) => r.text).join('')

describe('3D pane layout', () => {
  it('marks known URLs as links, whole path segments only', () => {
    const runs = linkRuns('GitHub    github.com/cylim')
    expect(runs.at(-1)).toEqual({ text: 'github.com/cylim', tone: 'link' })
    expect(linkRuns('github.com/cylimx').every((r) => r.tone === 'text')).toBe(true)
  })

  it('wraps at spaces within the column count and keeps every character', () => {
    const text = 'Blockchain-backed anti-counterfeiting for supply chains, and more words to wrap'
    const rows = wrapRuns([{ text, tone: 'text' }], 24)
    for (const r of rows) expect(flat(r).trimEnd().length).toBeLessThanOrEqual(24)
    expect(rows.map(flat).join('')).toBe(text)
  })

  it('hard-breaks a word longer than a row', () => {
    const rows = wrapRuns([{ text: 'x'.repeat(50), tone: 'text' }], 20)
    expect(rows.map(flat)).toEqual(['x'.repeat(20), 'x'.repeat(20), 'x'.repeat(10)])
  })

  it('shows the tail of the log, then an empty prompt row for the caret', () => {
    const lines = Array.from({ length: 30 }, (_, i) => line(i, 'output', `line ${i}`))
    const rows = paneRows(lines, 40, 10)
    expect(rows).toHaveLength(10)
    const last = rows.at(-1)
    expect(last?.kind === 'text' && flat(last.runs)).toBe(`${terminal.prompt} `)
    const first = rows[0]
    expect(first?.kind === 'text' && flat(first.runs)).toBe('line 21')
  })

  it('prefixes input lines with the prompt', () => {
    const [row] = paneRows([line(1, 'input', 'help')], 40, 5)
    expect(row?.kind === 'text' && row.runs.map((r) => r.tone)).toEqual(['prompt', 'text'])
  })

  it('gives a qimen line a block of chart rows and never shows a chart cut off at the top', () => {
    const lines = [line(1, 'input', 'qimen'), line(2, 'qimen', '', { chartAtMs: 1_790_000_000_000 }), line(3, 'hint', 'after')]
    const rows = paneRows(lines, 40, 20)
    expect(rows.filter((r) => r.kind === 'chart')).toHaveLength(CHART_ROWS)
    const cut = paneRows(lines, 40, 5)
    expect(cut.some((r) => r.kind === 'chart')).toBe(false)
  })
})
