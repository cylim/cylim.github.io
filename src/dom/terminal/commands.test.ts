import { describe, expect, it } from 'vitest'
import { contactOutput, fortunes, grove, terminal, terminalCommands, whoamiOutput } from '../../content'
import { inscriptionBand, qimenVars } from '../chart/format'
import { FIXTURE_A_MS, castPenang } from '../test/fixtures'
import { complete, completable, findCommand, interruptLines, normalize, outputLine, runCommand, tabCompletion, type RunContext } from './commands'
import { linkIn } from './links'

const ctx = (over: Partial<RunContext> = {}): RunContext => ({
  now: () => FIXTURE_A_MS,
  random: () => 0,
  qimen: (ms) => {
    const chart = castPenang(ms)
    return { vars: qimenVars(chart), band: inscriptionBand(chart) }
  },
  ...over,
})

const texts = (input: string, c = ctx()) => runCommand(input, c).lines.map((l) => l.text)

describe('findCommand', () => {
  it('matches names and aliases trimmed, single-spaced and case-insensitive', () => {
    expect(findCommand('  HELP ')?.name).toBe('help')
    expect(findCommand('ls   projects')?.name).toBe('projects')
    expect(findCommand('Cd Grove')?.name).toBe('grove')
    expect(findCommand('history')?.name).toBe('timeline')
    expect(normalize('  Rm   -rf  / ')).toBe('rm -rf /')
    expect(findCommand('rm -rf ~')?.name).toBe('rm -rf /')
  })

  it('treats sudo as a prefix and nothing else', () => {
    expect(findCommand('sudo make me a sandwich')?.name).toBe('sudo')
    expect(findCommand('sudo')?.name).toBe('sudo')
    expect(findCommand('sudoku')).toBeNull()
    expect(findCommand('')).toBeNull()
  })
})

describe('runCommand', () => {
  it('echoes the input and prints content.md output verbatim', () => {
    expect(texts('whoami')).toEqual(['whoami', ...whoamiOutput])
    const help = terminalCommands.find((c) => c.name === 'help')
    expect(texts('help')).toEqual(['help', ...(help?.output ?? [])])
  })

  it('answers unknown input with the not-found line, keeping what was typed', () => {
    expect(texts('  Make Coffee ')).toEqual(['Make Coffee', "Make Coffee: command not found. Try 'help'."])
    expect(runCommand('make coffee', ctx()).history).toBe('make coffee')
  })

  it('blank input echoes a prompt and records no history', () => {
    const r = runCommand('   ', ctx())
    expect(r.lines).toEqual([{ kind: 'input', text: '' }])
    expect(r.history).toBeNull()
  })

  it('clear wipes the log and prints nothing', () => {
    expect(runCommand('clear', ctx())).toMatchObject({ lines: [], clear: true, navigate: null })
  })

  it('grove and its aliases print the line and ask for a dive to #grove', () => {
    for (const cmd of ['grove', 'cd grove', 'exit', 'logout']) {
      const r = runCommand(cmd, ctx())
      expect(r.navigate).toBe('#grove')
      expect(r.lines.at(-1)?.text).toBe('You step out of the cabin. The mist closes behind you.')
    }
    expect(terminal.navigateDelayMs).toBe(600)
  })

  it('contact lines with a URL become link lines with the real href', () => {
    const lines = runCommand('contact', ctx()).lines
    expect(lines.map((l) => l.text)).toEqual(['contact', ...contactOutput])
    expect(lines.filter((l) => l.kind === 'link').map((l) => l.href)).toEqual([
      'https://github.com/cylim',
      'https://x.com/seewhy',
      'https://www.linkedin.com/in/cylim226',
      'https://cy.my/blog/',
    ])
  })

  it('projects links go to the repos, longest match first', () => {
    const hrefs = runCommand('work', ctx())
      .lines.filter((l) => l.kind === 'link')
      .map((l) => l.href)
    expect(hrefs).toEqual([
      'https://github.com/cylim/oripax',
      'https://github.com/cylim/supreme-dollop',
      'https://github.com/cylim/jrny-app-demo',
    ])
  })

  it('fortune prints Chinese first, English second, then the source', () => {
    const [, zh, en, src] = runCommand('fortune', ctx({ random: () => 0.999 })).lines
    const f = fortunes.at(-1)
    expect([zh?.text, en?.text, src?.text]).toEqual([f?.zh, f?.en, f?.source])
    expect(src?.kind).toBe('hint')
  })

  it('qimen fills the template from the engine and adds the grid line after the chart lines', () => {
    const r = runCommand('qimen', ctx())
    const t = r.lines.map((l) => l.text)
    expect(t[0]).toBe('qimen')
    expect(t).toContain('时家奇门 · 转盘 · 拆补法')
    expect(t).toContain('cast for 2026-09-28 19:05 (Asia/Kuala_Lumpur)')
    expect(t).toContain('丙午年 丁酉月 乙巳日 丙戌时')
    expect(t).toContain('阴遁四局 · Yin cycle, structure 4')
    expect(t).toContain('值符 天芮 Grass star, palace 6')
    expect(t).toContain('值使 死门 Death door, palace 9')
    expect(t).toContain('旬空 午未 · 驿马 申 (palace 2)')
    const grid = r.lines.find((l) => l.kind === 'qimen')
    expect(grid).toMatchObject({ chartAtMs: FIXTURE_A_MS, text: '阴遁四局 · 秋分下元 · 旬首 甲申' })
    // The closing hints come after the grid.
    expect(r.lines.at(-1)).toEqual({ kind: 'hint', text: 'For reflection, not advice.' })
    expect(t.some((x) => x.includes('{'))).toBe(false)
  })

  it('qimen says so when the engine cannot cast', () => {
    const r = runCommand('qimen', ctx({ qimen: () => null }))
    expect(r.lines.at(-1)).toEqual({ kind: 'hint', text: grove.chartUnavailable })
  })

  it('hidden commands answer but never appear in help', () => {
    expect(texts('sudo rm')).toEqual(['sudo rm', 'Permission denied. The cabin belongs to the forest.'])
    expect(texts('cat .mist').at(-1)).toContain('留白')
    const help = runCommand('help', ctx()).lines.map((l) => l.text).join('\n')
    for (const c of terminalCommands.filter((x) => x.hidden)) expect(help).not.toMatch(new RegExp(`^${c.name} `, 'm'))
  })
})

describe('complete', () => {
  it('completes a unique listed command, never a hidden one', () => {
    expect(complete('pro')).toEqual({ value: 'projects', options: [] })
    expect(complete('fort')).toEqual({ value: 'fort', options: [] })
    expect(completable).not.toContain('sudo')
  })

  it('offers every match when the prefix is shared', () => {
    const c = complete('c')
    expect(c.options).toEqual(expect.arrayContaining(['contact', 'clear', 'cd grove']))
    expect(c.value).toBe('c')
    expect(complete('s')).toMatchObject({ options: expect.arrayContaining(['services', 'stack', 'socials']) })
  })
})

describe('tabCompletion (A11Y-6: Tab never gets stuck in the input)', () => {
  it('completes when that changes the input', () => {
    expect(tabCompletion('pro', null)).toEqual({ value: 'projects', options: [] })
  })

  it('lists an ambiguous prefix once, then lets Tab move focus', () => {
    const first = tabCompletion('c', null)
    expect(first?.value).toBe('c')
    expect(first?.options.length).toBeGreaterThan(1)
    // The options were listed for "c": the next Tab leaves the input and adds nothing to the log.
    expect(tabCompletion('c', 'c')).toBeNull()
    // A new prefix lists again.
    expect(tabCompletion('s', 'c')?.options).toEqual(expect.arrayContaining(['services', 'stack', 'socials']))
  })

  it('passes Tab through when there is nothing to complete', () => {
    expect(tabCompletion('', null)).toBeNull()
    expect(tabCompletion('   ', null)).toBeNull()
    expect(tabCompletion('help', null)).toBeNull()
    expect(tabCompletion('zzz', null)).toBeNull()
  })
})

describe('lines', () => {
  it('Ctrl+C echoes the input with ^C', () => {
    expect(interruptLines('whoa')).toEqual([{ kind: 'input', text: 'whoa^C' }])
  })

  it('linkIn splits a line around a known URL only on whole path segments', () => {
    expect(linkIn('Blog      cy.my/blog')).toEqual({ before: 'Blog      ', display: 'cy.my/blog', after: '', href: 'https://cy.my/blog/' })
    expect(linkIn('see github.com/cylimx')).toBeNull()
    expect(outputLine('plain text')).toEqual({ kind: 'output', text: 'plain text' })
  })
})
