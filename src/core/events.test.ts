import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CY_EVENT, emit } from './events'

afterEach(() => vi.unstubAllGlobals())

describe('core/events (QM-7)', () => {
  it('dispatches each event on window with its one payload', () => {
    const target = new EventTarget()
    vi.stubGlobal('window', target)
    const seen: unknown[] = []
    target.addEventListener(CY_EVENT.announce, (e) => seen.push((e as CustomEvent).detail))
    emit(CY_EVENT.announce, 'Now at Work')
    expect(seen).toEqual(['Now at Work'])
  })

  it('is the only place src/ spells a cy: event name', () => {
    // Every layer (core, dom, sections, audio) emits and listens through CY_EVENT.
    const src = fileURLToPath(new URL('..', import.meta.url))
    const offenders: string[] = []
    const walk = (dir: string) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, e.name)
        if (e.isDirectory()) walk(path)
        else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) && relative(src, path) !== join('core', 'events.ts')) {
          // Quoted string literals only; docs mention the names in backticks.
          if (/['"]cy:[a-z-]+['"]/.test(readFileSync(path, 'utf8'))) offenders.push(relative(src, path))
        }
      }
    }
    walk(src)
    expect(offenders).toEqual([])
  })
})
