import { describe, expect, it, vi } from 'vitest'
import { J, SECTION_SPANS } from './beats'
import { groveOnWalk, groveReachable, joinGroveWalk } from './walk'
import { WALK_SECTION_IDS, sectionFromHash, walkSection } from '../sections/ids'
import { registry } from '../sections/registry'
import { hero, meta, nav, terminal, terminalCommands } from '../../content'

// The grove off (paused), whatever content/features.ts says today: the same groveless walk as a
// detour (groveOff.test.ts), with nothing pointing at the grove and no way to join it.
vi.mock('../../content/features', () => ({ features: { grove: 'off' } }))

describe('the grove off (content/features.ts)', () => {
  it('sends #grove, and anything asking for the grove, to the lantern', () => {
    expect(groveReachable()).toBe(false)
    expect(sectionFromHash('#grove')).toBe('contact')
    expect(walkSection('grove')).toBe('contact')
    expect(SECTION_SPANS.grove.arrivalJvh).toBe(SECTION_SPANS.contact.arrivalJvh)
    expect(registry.grove.arrivalJvh).toBe(669)
  })

  it('never joins the grove walk', () => {
    expect(joinGroveWalk()).toBe(false)
    expect(groveOnWalk()).toBe(false)
    expect(J).toBe(783)
    expect(WALK_SECTION_IDS).toEqual(['threshold', 'cabin', 'contact'])
  })

  it('leaves the grove out of the nav, the first-screen copy, the meta tags and the terminal help', () => {
    expect(nav.map((n) => n.id)).toEqual(['threshold', 'cabin', 'contact'])
    for (const s of [hero.subline, meta.description, meta.og.description]) expect(s).not.toMatch(/Qimen|grove/i)
    const help = terminalCommands.find((c) => c.name === 'help')?.output ?? []
    expect(help.join('\n')).not.toMatch(/qimen|grove/i)
    expect(terminalCommands.filter((c) => c.name === 'qimen' || c.name === 'grove').every((c) => c.hidden)).toBe(true)
    expect(terminalCommands.find((c) => c.name === 'grove')?.action).toEqual({ type: 'navigate', hash: '#contact' })
    expect(terminal.chips).not.toContain('qimen')
  })
})
