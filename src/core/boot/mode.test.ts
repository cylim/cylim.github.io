import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { describe, expect, it } from 'vitest'
import { decideBoot, type BootEnvironment } from './mode'
import { parseBootParams } from './params'
import type { Prefs } from './prefs'

const desktop = (over: Partial<BootEnvironment> = {}): BootEnvironment => ({
  hasWebgl2: true,
  reducedMotion: false,
  saveData: false,
  deviceMemory: 8,
  cores: 8,
  coarsePointer: false,
  probe: () => ({ ok: true, renderer: 'ANGLE (Apple, Apple M2, OpenGL 4.1)' }),
  ...over,
})
const decide = (search: string, env: BootEnvironment, prefs: Prefs = {}) => decideBoot(parseBootParams(search), prefs, env)

describe('decideBoot (design.md §13.2)', () => {
  it('walks the forest on a capable desktop, starting high', () => {
    expect(decide('', desktop())).toEqual({ mode: 'immersive', staticReason: null, tier: 'high' })
  })

  it('shows the album for each gate, with the reason for the banner', () => {
    expect(decide('', desktop({ hasWebgl2: false })).staticReason).toBe('nowebgl')
    expect(decide('', desktop({ probe: () => ({ ok: false, renderer: undefined }) })).staticReason).toBe('nowebgl')
    expect(decide('', desktop({ saveData: true })).staticReason).toBe('saveData')
    expect(decide('', desktop({ deviceMemory: 2 })).staticReason).toBe('memory')
    expect(decide('', desktop(), { mode: 'static' }).staticReason).toBe('pref')
    expect(decide('', desktop({ reducedMotion: true })).staticReason).toBe('reduced')
    expect(decide('?mode=static', desktop()).staticReason).toBe('param')
  })

  it('lets a reduced-motion visitor opt in to the walk', () => {
    expect(decide('', desktop({ reducedMotion: true }), { mode: 'immersive' }).mode).toBe('immersive')
  })

  it('lets "Walk the forest" opt in past Save-Data and low memory too (design.md §14.1)', () => {
    expect(decide('', desktop({ saveData: true }), { mode: 'immersive' }).mode).toBe('immersive')
    expect(decide('', desktop({ deviceMemory: 2 }), { mode: 'immersive' }).mode).toBe('immersive')
    expect(decide('', desktop({ deviceMemory: 0.5, saveData: true, reducedMotion: true }), { mode: 'immersive' }).mode).toBe(
      'immersive',
    )
    // The opt-in still needs a real context.
    expect(decide('', desktop({ saveData: true, hasWebgl2: false }), { mode: 'immersive' }).staticReason).toBe('nowebgl')
  })

  it('puts a saved "Still version" ahead of the device gates, as the head script does', () => {
    expect(decide('', desktop({ saveData: true, deviceMemory: 1 }), { mode: 'static' }).staticReason).toBe('pref')
  })

  it('keeps the soft gates under e2e, which only relaxes the performance-caveat probe', () => {
    expect(decide('?e2e=1', desktop({ reducedMotion: true })).staticReason).toBe('reduced')
    expect(decide('?e2e=1&mode=immersive', desktop({ reducedMotion: true })).mode).toBe('immersive')
  })

  it('only asks for failIfMajorPerformanceCaveat when nothing forced the walk', () => {
    const seen: boolean[] = []
    const probe: BootEnvironment['probe'] = (o) => {
      seen.push(o.failIfMajorPerformanceCaveat)
      return { ok: true, renderer: 'Google SwiftShader' }
    }
    decide('', desktop({ probe }))
    decide('?e2e=1&tier=high', desktop({ probe }))
    decide('?still=E3', desktop({ probe, reducedMotion: true }))
    expect(seen).toEqual([true, false, false])
  })

  it('guesses the tier from the device, and ?tier= or the saved choice wins', () => {
    expect(decide('', desktop({ probe: () => ({ ok: true, renderer: 'Google SwiftShader' }) })).tier).toBe('low')
    expect(decide('', desktop({ coarsePointer: true, cores: 8, deviceMemory: 8 })).tier).toBe('medium')
    expect(decide('', desktop({ coarsePointer: true, cores: 4 })).tier).toBe('low')
    expect(decide('?tier=high', desktop({ coarsePointer: true, cores: 4 })).tier).toBe('high')
    expect(decide('', desktop(), { quality: 'low' }).tier).toBe('low')
    expect(decide('', desktop(), { quality: 'auto' }).tier).toBe('high')
  })

  it('never creates a context when a cheap gate already failed', () => {
    let probed = false
    decide('', desktop({ saveData: true, probe: () => ((probed = true), { ok: true, renderer: undefined }) }))
    expect(probed).toBe(false)
  })
})

/**
 * index.html's inline head script makes the same call before first paint. Run it against the same
 * matrix so the two copies of the rules cannot drift apart again (QM-4: the head script honoured the
 * opt-in for Save-Data and memory, decideBoot did not, so "Walk the forest" reloaded into the album).
 */
describe('index.html head script agrees with decideBoot', () => {
  const html = readFileSync(new URL('../../../index.html', import.meta.url), 'utf8')
  const headScript = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1] ?? '').find((s) => s.includes('cy.prefs'))

  interface Case {
    env: BootEnvironment
    prefs: Prefs
    search: string
  }
  const runHead = ({ env, prefs, search }: Case): { mode: string | undefined; reason: string | undefined } => {
    const attrs: Record<string, string> = {}
    const window: Record<string, unknown> = env.hasWebgl2 ? { WebGL2RenderingContext: Object } : {}
    runInNewContext(headScript ?? '', {
      window,
      document: {
        documentElement: {
          setAttribute: (k: string, v: string) => void (attrs[k] = v),
          removeAttribute: (k: string) => void delete attrs[k],
        },
      },
      navigator: { deviceMemory: env.deviceMemory, connection: { saveData: env.saveData } },
      localStorage: { getItem: (k: string) => (k === 'cy.prefs' ? JSON.stringify(prefs) : null) },
      matchMedia: (q: string) => ({ matches: q.includes('reduced-motion') && env.reducedMotion }),
      location: { search, hash: '' },
      URLSearchParams,
      setTimeout: () => 0,
    })
    return { mode: attrs['data-mode'], reason: attrs['data-static-reason'] }
  }

  it('finds the head script', () => {
    expect(headScript).toContain('data-static-reason')
  })

  it('gives the same mode and reason for every gate and saved choice', () => {
    const cases: Case[] = []
    for (const hasWebgl2 of [true, false])
      for (const saveData of [false, true])
        for (const deviceMemory of [undefined, 0.5, 2, 4])
          for (const reducedMotion of [false, true])
            for (const mode of [undefined, 'static', 'immersive'] as const)
              for (const search of ['', '?mode=immersive'])
                cases.push({ env: desktop({ hasWebgl2, saveData, deviceMemory, reducedMotion }), prefs: mode ? { mode } : {}, search })
    expect(cases.length).toBe(192)
    for (const c of cases) {
      const d = decideBoot(parseBootParams(c.search), c.prefs, c.env)
      const head = runHead(c)
      // With ?mode=immersive and no WebGL2 the head script optimistically paints the walk; boot's probe
      // then overturns it. Every other case must match exactly, reason included.
      if (!c.env.hasWebgl2 && c.search) continue
      expect({ ...head, case: c }).toEqual({ mode: d.mode, reason: d.staticReason ?? undefined, case: c })
    }
  })
})

describe('?still', () => {
  it('accepts beat ids only', () => {
    expect(parseBootParams('?still=C3').still).toBe('C3')
    expect(parseBootParams('?still=Z9').still).toBe(null)
  })
})
