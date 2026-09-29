import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { act } from 'react'
import { renderToString } from 'react-dom/server'
import { hydrateRoot, type Root } from 'react-dom/client'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { journey } from '../core/store/journey'
import { WALK_SECTION_IDS } from '../core/sections/ids'
import { BEAT_SPANS } from '../core/world/beats'
import { features } from '../content/features'
import { ContentLayer } from './ContentLayer'

/**
 * Every chunk src/dom loads with import(), by path from src/dom. Hydration starts the lazy ones, and
 * an import still in flight when the file finishes resolves after jsdom's teardown: vitest then
 * reports "window is not defined" or EnvironmentTeardownError and exits 1 with every test passing
 * (QM-D5). So they all load before hydrating, and the roots unmount inside act. The last test keeps
 * this list in step with the source.
 */
const CHUNKS: Record<string, () => Promise<unknown>> = {
  'chrome/Settings': () => import('./chrome/Settings'),
  'chrome/WalkChrome': () => import('./chrome/WalkChrome'),
  'gloss/GlossLayer': () => import('./gloss/GlossLayer'),
  'gloss/detail': () => import('./gloss/detail'),
  'terminal/Terminal': () => import('./terminal/Terminal'),
  'chart/ChartPanel': () => import('./chart/ChartPanel'),
  'chart/CastLabel': () => import('./chart/CastLabel'),
  'chart/AlbumChart': () => import('./chart/AlbumChart'),
  'finale/Colophon': () => import('./finale/Colophon'),
  'leaves/Grove': () => import('./leaves/Grove'),
}

const roots: Root[] = []

// jsdom lacks these; the content layer only touches them after hydration.
beforeAll(async () => {
  await Promise.all(Object.values(CHUNKS).map((load) => load()))
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  window.matchMedia ??= ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia
  globalThis.IntersectionObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return []
    }
    root = null
    rootMargin = ''
    thresholds = []
  } as unknown as typeof IntersectionObserver
  // With the chunks preloaded the lazy parts mount inside the test, and the finale measures itself.
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
})

afterEach(async () => {
  // Unmount inside act, so no render work or Suspense retry is left for after teardown.
  await act(async () => {
    for (const r of roots.splice(0)) r.unmount()
  })
  document.body.innerHTML = ''
})

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean
}

describe('prerender and hydration', () => {
  it('hydrates the prerendered content layer without a mismatch, in both modes', async () => {
    for (const mode of ['static', 'immersive'] as const) {
      const html = renderToString(<ContentLayer />)
      const root = document.createElement('div')
      root.id = 'root'
      root.innerHTML = html
      document.body.append(root)
      document.documentElement.dataset.mode = mode
      const errors: unknown[] = []
      const consoleError = vi.spyOn(console, 'error').mockImplementation((...args) => errors.push(args.join(' ')))
      await act(async () => {
        roots.push(hydrateRoot(root, <ContentLayer />, { onRecoverableError: (e) => errors.push(e) }))
      })
      // The boot script sets the mode after hydration starts; the tree must follow without errors.
      await act(async () => journey.setState({ mode }))
      consoleError.mockRestore()
      expect(errors, mode).toEqual([])
      expect(root.querySelector('#threshold-heading')?.textContent).toBe('CY Lim')
      await act(async () => roots.pop()?.unmount())
      root.remove()
    }
  })

  it('keeps the section contract other modules rely on', () => {
    const root = document.createElement('div')
    root.innerHTML = renderToString(<ContentLayer />)
    // The sections follow content/features.ts: four with the grove on the walk, three while it is a
    // detour (until a dive joins it) or off. The nav links to it unless it is off.
    const onWalk = features.grove === 'walk'
    const reachable = features.grove !== 'off'
    expect(WALK_SECTION_IDS).toEqual(onWalk ? ['threshold', 'cabin', 'grove', 'contact'] : ['threshold', 'cabin', 'contact'])
    for (const id of WALK_SECTION_IDS) {
      const s = root.querySelector(`section#${id}`)
      expect(s?.getAttribute('aria-labelledby')).toBe(`${id}-heading`)
      expect(root.querySelector(`#${id}-heading`)?.getAttribute('tabindex')).toBe('-1')
    }
    expect(root.querySelectorAll('main section.leaf')).toHaveLength(WALK_SECTION_IDS.length)
    expect(root.querySelectorAll('main#content .beat[data-beat]')).toHaveLength(onWalk ? 31 : 26)
    expect(root.querySelectorAll('main#content .beat[data-beat]')).toHaveLength(BEAT_SPANS.length)
    expect(root.querySelectorAll('a[data-jump]').length).toBeGreaterThanOrEqual(reachable ? 5 : 4)
    expect(root.querySelector('[data-scroll-jvh="742"]') !== null).toBe(onWalk)
    expect(root.querySelector('a[href="#grove"]') !== null).toBe(reachable)
    expect(root.querySelector('.skip-link')?.getAttribute('href')).toBe('#content')
    expect(root.querySelectorAll('h1')).toHaveLength(1)
    expect(root.querySelector('footer.site-footer')).not.toBeNull()
  })

  it('marks every CJK accent with lang and an inline gloss', () => {
    const root = document.createElement('div')
    root.innerHTML = renderToString(<ContentLayer />)
    const triggers = [...root.querySelectorAll('.zh[data-gloss]')]
    // They are in the grove's copy; while it is off the walk there may be none, and any left must still hold.
    expect(triggers.length).toBeGreaterThanOrEqual(features.grove === 'walk' ? 6 : 0)
    for (const t of triggers) {
      expect(t.getAttribute('lang')).toBe('zh-Hans')
      const gloss = root.querySelector(`#${CSS.escape(t.getAttribute('aria-describedby') ?? '')}`)
      expect(gloss?.textContent, t.textContent ?? '').toMatch(/\(.+, .+\)/)
    }
  })

  it('preloads every chunk src/dom imports dynamically (QM-D5)', () => {
    const here = dirname(fileURLToPath(import.meta.url))
    const found = new Set<string>()
    const walk = (dir: string) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, e.name)
        if (e.isDirectory()) walk(path)
        else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) {
          for (const m of readFileSync(path, 'utf8').matchAll(/\bimport\(\s*'(\.[^']+)'\s*\)/g)) {
            found.add(relative(here, resolve(dirname(path), m[1] as string)).replace(/\\/g, '/'))
          }
        }
      }
    }
    walk(here)
    expect([...found].toSorted()).toEqual(Object.keys(CHUNKS).toSorted())
  })
})
