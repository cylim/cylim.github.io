import { afterEach, describe, expect, it, vi } from 'vitest'
import { watchDevicePixelRatio } from './dprWatch'

afterEach(() => vi.unstubAllGlobals())

describe('watchDevicePixelRatio (QM-P8)', () => {
  it('reports each new ratio and re-arms the query at it', () => {
    const win = { devicePixelRatio: 1 }
    const queries: { media: string; listeners: Set<() => void> }[] = []
    vi.stubGlobal('window', win)
    vi.stubGlobal('matchMedia', (media: string) => {
      const listeners = new Set<() => void>()
      queries.push({ media, listeners })
      return { addEventListener: (_: string, l: () => void) => listeners.add(l), removeEventListener: (_: string, l: () => void) => listeners.delete(l) }
    })
    const seen: number[] = []
    const stop = watchDevicePixelRatio((r) => seen.push(r))
    expect(queries.map((q) => q.media)).toEqual(['(resolution: 1dppx)'])

    win.devicePixelRatio = 2
    for (const l of queries[0]?.listeners ?? []) l()
    expect(seen).toEqual([2])
    expect(queries.map((q) => q.media)).toEqual(['(resolution: 1dppx)', '(resolution: 2dppx)'])
    expect(queries[0]?.listeners.size).toBe(0)

    stop()
    expect(queries[1]?.listeners.size).toBe(0)
  })
})
