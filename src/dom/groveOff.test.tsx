import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { J } from '../core/world/beats'
import { CARDS, trackJvh } from './cards'
import { INSCRIPTION_WINDOWS, inscriptionAt } from './chrome/Inscriptions'
import { Header } from './chrome/Header'
import { Progress } from './chrome/Progress'
import { runCommand, type RunContext } from './terminal/commands'

// The DOM on the walk without the grove, as a detour starts it, whatever content/features.ts says
// today (cards.test.ts and the rest pin the grove-on walk).
vi.mock('../content/features', () => ({ features: { grove: 'detour' } }))

const ctx: RunContext = { now: () => 0, random: () => 0, qimen: () => null }

describe('the DOM without the grove on the walk (a detour, content/features.ts)', () => {
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

  it('keeps Grove in the nav, with three progress ticks for the three places on the walk', () => {
    const header = renderToString(<Header />)
    expect(header).toContain('#grove')
    expect(header).toContain('#cabin')
    expect(header).toContain('#contact')
    const ticks = renderToString(<Progress />).match(/progress-tick/g) ?? []
    expect(ticks).toHaveLength(3)
  })

  it('offers qimen and grove in help; grove and exit take the detour to the grove', () => {
    const help = runCommand('help', ctx).lines.map((l) => l.text).join('\n')
    expect(help).toMatch(/qimen/)
    expect(help).toMatch(/grove/)
    expect(runCommand('grove', ctx).navigate).toBe('#grove')
    expect(runCommand('exit', ctx).navigate).toBe('#grove')
  })
})
