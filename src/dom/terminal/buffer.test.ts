import { beforeEach, describe, expect, it } from 'vitest'
import { journey } from '../../core/store/journey'
import { terminal } from '../../content'
import { SESSION_KEY, appendLines, clearLines, getHistory, loadBuffer, pushHistory, resetBuffer } from './buffer'

beforeEach(() => {
  sessionStorage.clear()
  resetBuffer()
})

describe('terminal buffer', () => {
  it('starts with the banner, in the store, so the 3D pane can mirror it', () => {
    const lines = loadBuffer()
    expect(lines.map((l) => l.text)).toEqual([...terminal.banner])
    expect(journey.getState().terminal.lines).toBe(lines)
  })

  it('appends with fresh ids, caps scrollback at 200 and clears', () => {
    loadBuffer()
    appendLines(Array.from({ length: 250 }, (_, i) => ({ kind: 'output' as const, text: `line ${i}` })))
    const lines = journey.getState().terminal.lines
    expect(lines).toHaveLength(terminal.scrollback)
    expect(lines.at(-1)?.text).toBe('line 249')
    expect(new Set(lines.map((l) => l.id)).size).toBe(lines.length)
    clearLines()
    expect(journey.getState().terminal.lines).toEqual([])
  })

  it('persists log and history in sessionStorage and restores them', () => {
    loadBuffer()
    appendLines([{ kind: 'input', text: 'whoami' }])
    pushHistory('whoami')
    pushHistory('whoami')
    pushHistory('help')
    const saved = JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? '{}') as { history: string[] }
    expect(saved.history).toEqual(['whoami', 'help'])

    resetBuffer()
    const restored = loadBuffer()
    expect(restored.at(-1)?.text).toBe('whoami')
    expect(getHistory()).toEqual(['whoami', 'help'])
    appendLines([{ kind: 'output', text: 'next' }])
    const ids = journey.getState().terminal.lines.map((l) => l.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('ignores a corrupt session', () => {
    sessionStorage.setItem(SESSION_KEY, '{nope')
    expect(loadBuffer().map((l) => l.text)).toEqual([...terminal.banner])
  })
})
