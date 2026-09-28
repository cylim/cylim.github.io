import {
  fill,
  fortunes,
  grove,
  qimenTemplate,
  terminal,
  terminalCommands,
  type QimenTemplateVars,
  type TerminalCommand,
} from '../../content'
import type { TerminalLine } from '../../core/store/journey'
import { linkIn } from './links'

/**
 * The cabin terminal's command engine (design.md §10, content.md §3). Pure: input in, lines out.
 * Every word it prints comes from content/terminal.ts; it never invents text. The UI (Terminal.tsx)
 * owns focus, history keys and timing; the 3D pane mirrors the resulting log from the store.
 */

export type LineDraft = Omit<TerminalLine, 'id'>

export interface QimenCast {
  vars: QimenTemplateVars
  /** One-line text for the canvas mirror, e.g. the inscription band. */
  band: string
}

export interface RunContext {
  now: () => number
  /** 0 ≤ x < 1, for `fortune`. */
  random: () => number
  /** Cast the chart at an instant; null if the engine can't. */
  qimen: (ms: number) => QimenCast | null
}

export type NavigateHash = Extract<TerminalCommand['action'], { type: 'navigate' }>['hash']

export interface RunResult {
  /** Lines to append; the echoed input line comes first. */
  lines: LineDraft[]
  /** Wipe the log before appending. */
  clear: boolean
  /** After printing, wait `terminal.navigateDelayMs`, then fog-dive here. */
  navigate: NavigateHash | null
  /** What goes into the history (null for blank input). */
  history: string | null
}

/** Trimmed, single-spaced, lower-cased. */
export const normalize = (input: string) => input.trim().replace(/\s+/g, ' ').toLowerCase()

export function findCommand(input: string): TerminalCommand | null {
  const n = normalize(input)
  if (!n) return null
  for (const c of terminalCommands) {
    if (c.match === 'prefix') {
      if (n === c.name || n.startsWith(`${c.name} `)) return c
    } else if (n === c.name || c.aliases?.includes(n)) return c
  }
  return null
}

/** An output line; known URLs make it a link line so the log renders a real <a>. */
export function outputLine(text: string): LineDraft {
  const link = linkIn(text)
  return link ? { kind: 'link', text, href: link.href } : { kind: 'output', text }
}

const hint = (text: string): LineDraft => ({ kind: 'hint', text })

export function runCommand(input: string, ctx: RunContext): RunResult {
  const raw = input.trim()
  const echo: LineDraft = { kind: 'input', text: raw }
  const result = (lines: LineDraft[], extra: Partial<RunResult> = {}): RunResult => ({
    lines,
    clear: false,
    navigate: null,
    history: raw || null,
    ...extra,
  })
  if (!raw) return result([echo])

  const cmd = findCommand(raw)
  if (!cmd) return result([echo, { kind: 'output', text: fill(terminal.notFound, { input: raw }) }])

  const printed = cmd.output.map(outputLine)
  const { action } = cmd
  switch (action.type) {
    case 'clear':
      return result([], { clear: true })
    case 'print':
      return result([echo, ...printed])
    case 'navigate':
      return result([echo, ...printed], { navigate: action.hash })
    case 'dynamic': {
      if (action.id === 'fortune') {
        const f = fortunes[Math.floor(ctx.random() * fortunes.length) % fortunes.length]
        return result(f ? [echo, { kind: 'output', text: f.zh }, { kind: 'output', text: f.en }, hint(f.source)] : [echo])
      }
      const at = ctx.now()
      const cast = ctx.qimen(at)
      if (!cast) return result([echo, hint(grove.chartUnavailable)])
      const filled = qimenTemplate.map((l) => fill(l, { ...cast.vars }))
      // The grid goes after the chart lines, before the closing hints (the lines after the blank one).
      const blank = filled.indexOf('')
      const info = blank < 0 ? filled : filled.slice(0, blank)
      const closing = blank < 0 ? [] : filled.slice(blank + 1)
      return result([
        echo,
        ...info.map((text): LineDraft => ({ kind: 'output', text })),
        { kind: 'qimen', text: cast.band, chartAtMs: at },
        ...closing.map(hint),
      ])
    }
  }
}

/** Command names Tab can complete to: listed commands and their aliases, never the hidden ones. */
export const completable: readonly string[] = terminalCommands
  .filter((c) => !c.hidden)
  .flatMap((c) => [c.name, ...(c.aliases ?? [])])
  .filter((n, i, all) => all.indexOf(n) === i)

export interface Completion {
  /** The new input value (unchanged when nothing matches). */
  value: string
  /** Every match when more than one fits, for a hint line. */
  options: readonly string[]
}

export function complete(input: string): Completion {
  const prefix = input.replace(/^\s+/, '').toLowerCase()
  if (!prefix) return { value: input, options: [] }
  const matches = completable.filter((n) => n.startsWith(prefix))
  if (matches.length === 0) return { value: input, options: [] }
  if (matches.length === 1) return { value: matches[0] as string, options: [] }
  let common = matches[0] as string
  for (const m of matches) while (!m.startsWith(common)) common = common.slice(0, -1)
  return { value: common.length > prefix.length ? common : input, options: matches }
}

/**
 * What Tab does in the input (design.md §10.3: Tab completes command names, and the terminal never
 * traps focus). It completes when that changes the input, and lists an ambiguous prefix's matches
 * once; `listed` is the input they were last listed for. null when there is nothing left to do: Tab
 * then moves focus on as usual, and the live log isn't told the same options again.
 */
export function tabCompletion(input: string, listed: string | null): Completion | null {
  if (!input.trim()) return null
  const c = complete(input)
  if (c.value !== input) return c
  if (c.options.length > 1 && listed !== input) return c
  return null
}

/** Ctrl+C: echo what was typed with ^C, and a fresh prompt. */
export const interruptLines = (input: string): LineDraft[] => [{ kind: 'input', text: `${input}${terminal.interrupt}` }]
