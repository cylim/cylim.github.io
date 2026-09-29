import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { J } from '../core/world/beats'
import { CARDS, trackJvh } from './cards'
import { INSCRIPTION_WINDOWS, inscriptionAt } from './chrome/Inscriptions'
import { Header } from './chrome/Header'
import { Progress } from './chrome/Progress'
import { runCommand, type RunContext } from './terminal/commands'

// The DOM with the grove paused, whatever content/features.ts says today (cards.test.ts and the
// rest pin the grove-on walk).
vi.mock('../content/features', () => ({ features: { grove: false } }))

const ctx: RunContext = { now: () => 0, random: () => 0, qimen: () => null }

describe('the DOM with the grove paused (content/features.ts)', () => {
  it('has no grove cards, and the contact card runs to the end of the shorter walk', () => {
    expect(CARDS.some((c) => c.beat === 'G1' || c.beat === 'G3' || c.beat === 'P1')).toBe(false)
    const e1 = CARDS.find((c) => c.beat === 'E1')
    expect(e1?.show).toEqual([669, J])
    expect(e1 && trackJvh(e1)).toBe(J - 663)
  })

  it('inscribes the cabin and the lantern only, the lantern from its card, not the stream', () => {
    expect(INSCRIPTION_WINDOWS).toEqual({ cabin: [250, 524], contact: [669, 783] })
    expect(inscriptionAt(596)).toBeNull()
    expect(inscriptionAt(700)).toBe('contact')
  })

  it('shows Work and Contact in the nav, and three progress ticks', () => {
    const header = renderToString(<Header />)
    expect(header).not.toContain('#grove')
    expect(header).toContain('#cabin')
    expect(header).toContain('#contact')
    const ticks = renderToString(<Progress />).match(/progress-tick/g) ?? []
    expect(ticks).toHaveLength(3)
  })

  it('keeps qimen and grove typable but out of help; grove walks on to the lantern', () => {
    const help = runCommand('help', ctx).lines.map((l) => l.text).join('\n')
    expect(help).not.toMatch(/qimen|grove/i)
    const r = runCommand('grove', ctx)
    expect(r.navigate).toBe('#contact')
    expect(runCommand('exit', ctx).navigate).toBe('#contact')
  })
})
