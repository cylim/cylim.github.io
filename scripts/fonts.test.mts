import { existsSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { fontFiles } from '../src/theme/tokens.ts'
import { QIMEN_GLYPHS } from '../src/lib/qimen/labels.ts'
import { ROOT } from './collect-cjk.mjs'
import { CHART_GLYPHS, DISPLAY_GLYPHS, FACES, FONT_BUDGET, FONTS_OUT, PINYIN, LATIN } from './fonts.config.mjs'

const out = (file: string) => join(ROOT, FONTS_OUT, file)

describe('font subsets', () => {
  it('name every face exactly as tokens.fontFiles does', () => {
    expect(new Set(FACES.map((f) => f.key))).toEqual(new Set(Object.keys(fontFiles)))
    for (const face of FACES) {
      expect(fontFiles[face.key]).toEqual({ woff2: `/fonts/${face.out}.woff2`, woff: `/fonts/${face.out}.woff` })
    }
  })

  it('are committed in both formats, with their licences', () => {
    for (const face of FACES) {
      expect(existsSync(out(`${face.out}.woff2`)), face.out).toBe(true)
      expect(existsSync(out(`${face.out}.woff`)), face.out).toBe(true)
      expect(existsSync(out(face.licence)), face.licence).toBe(true)
    }
  })

  it('stay inside the stack.md §4 budgets', () => {
    const latin = FACES.filter((f) => f.group === 'latin').reduce((n, f) => n + statSync(out(`${f.out}.woff2`)).size, 0)
    expect(latin).toBeLessThanOrEqual(FONT_BUDGET.latinWoff2Total)
    expect(statSync(out('wenkai-subset.woff')).size).toBeLessThanOrEqual(FONT_BUDGET.cjkWoff)
  })

  it('keep the whole chart vocabulary in WenKai and only the eight hero glyphs in Ma Shan Zheng', () => {
    const wenkai = readFileSync(out('wenkai-subset.glyphs.txt'), 'utf8')
    for (const ch of CHART_GLYPHS) expect(wenkai).toContain(ch)
    // The engine's own vocabulary, which the grove passes to troika as `characters`.
    expect([...QIMEN_GLYPHS].filter((ch) => !wenkai.includes(ch))).toEqual([])
    expect(readFileSync(out('mashanzheng-subset.glyphs.txt'), 'utf8').trim()).toBe(DISPLAY_GLYPHS)
  })

  it('give body text every pinyin tone vowel', () => {
    for (const ch of PINYIN) expect(LATIN).toContain(ch)
  })
})
