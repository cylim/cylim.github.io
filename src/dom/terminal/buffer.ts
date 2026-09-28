import { journey, type TerminalLine } from '../../core/store/journey'
import { terminal } from '../../content'
import type { LineDraft } from './commands'

/**
 * The terminal's output buffer and history. The log itself lives in the journey store
 * (`terminal.lines`, written only here) so the cabin's 3D pane can mirror it without importing the
 * DOM layer; history stays here. Both persist in sessionStorage (design.md §10.3).
 */

export const SESSION_KEY = 'cy.terminal'
const HISTORY_MAX = 50

interface Session {
  lines: readonly TerminalLine[]
  history: string[]
  nextId: number
}

type SessionStorage = Pick<Storage, 'getItem' | 'setItem'>

let history: string[] = []
let nextId = 1
let loaded = false

const storage = (): SessionStorage | undefined => {
  try {
    return globalThis.sessionStorage
  } catch {
    return undefined
  }
}

const bannerLines = (): TerminalLine[] => terminal.banner.map((text) => ({ id: nextId++, kind: 'hint', text }))

function isLine(v: unknown): v is TerminalLine {
  if (!v || typeof v !== 'object') return false
  const l = v as Record<string, unknown>
  return typeof l.id === 'number' && typeof l.text === 'string' && typeof l.kind === 'string'
}

function persist(lines: readonly TerminalLine[], store = storage()): void {
  try {
    store?.setItem(SESSION_KEY, JSON.stringify({ lines, history, nextId } satisfies Session))
  } catch {
    // quota or private mode: the log just won't survive a reload
  }
}

/**
 * Restore the session log (or start with the banner) into the store. Idempotent; call on mount.
 * The banner is in the log before the live region mounts, so it is never announced.
 */
export function loadBuffer(store: SessionStorage | undefined = storage()): readonly TerminalLine[] {
  if (loaded) return journey.getState().terminal.lines
  loaded = true
  let lines: TerminalLine[] = []
  try {
    const raw = store?.getItem(SESSION_KEY)
    const v: unknown = raw ? JSON.parse(raw) : null
    if (v && typeof v === 'object') {
      const s = v as Partial<Session>
      if (Array.isArray(s.lines)) lines = s.lines.filter(isLine).slice(-terminal.scrollback)
      if (Array.isArray(s.history)) history = s.history.filter((h): h is string => typeof h === 'string').slice(-HISTORY_MAX)
      if (typeof s.nextId === 'number') nextId = s.nextId
    }
  } catch {
    lines = []
  }
  if (lines.length === 0) lines = bannerLines()
  nextId = Math.max(nextId, ...lines.map((l) => l.id + 1))
  journey.setState({ terminal: { lines } })
  return lines
}

/** Append lines (after an optional clear), capped at the scrollback limit. */
export function appendLines(drafts: readonly LineDraft[], opts: { clear?: boolean } = {}): void {
  const prev = opts.clear ? [] : journey.getState().terminal.lines
  const added = drafts.map((d) => ({ ...d, id: nextId++ }))
  const lines = [...prev, ...added].slice(-terminal.scrollback)
  journey.setState({ terminal: { lines } })
  persist(lines)
}

export const clearLines = () => appendLines([], { clear: true })

export function pushHistory(entry: string): void {
  if (history.at(-1) !== entry) history = [...history, entry].slice(-HISTORY_MAX)
  persist(journey.getState().terminal.lines)
}

export const getHistory = (): readonly string[] => history

/** Test hook: forget the module state. */
export function resetBuffer(): void {
  history = []
  nextId = 1
  loaded = false
  journey.setState({ terminal: { lines: [] } })
}
