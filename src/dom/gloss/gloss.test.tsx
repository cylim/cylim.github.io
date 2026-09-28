import { describe, expect, it } from 'vitest'
import { grove, hero, nav } from '../../content'
import { glossDetail, romanize } from './detail'
import { placeTooltip } from './GlossLayer'
import { accentGloss, bootGloss, segmentCopy } from './lookup'
import { renderToString } from 'react-dom/server'
import { LangText, writeLangText } from './LangText'
import { GlossText } from './GlossText'

describe('segmentCopy', () => {
  it('glosses every Chinese term in the grove copy, longest match first', () => {
    const segs = segmentCopy(grove.chartLead)
    const terms = segs.flatMap((s) => (s.kind === 'term' ? [s.term.zh] : []))
    expect(terms).toEqual(['时家奇门', '转盘', '拆补法'])
    expect(segs.some((s) => s.kind === 'zh')).toBe(false)
    expect(segmentCopy(grove.whatIsAChart).find((s) => s.kind === 'term')).toMatchObject({ term: { zh: '奇门遁甲' } })
  })

  it('keeps the plain text around terms intact', () => {
    const segs = segmentCopy('a 时辰, and 元.')
    expect(segs.map((s) => (s.kind === 'term' ? `[${s.term.zh}]` : s.text)).join('')).toBe('a [时辰], and [元].')
  })

  it('marks Chinese it cannot gloss, merged into one run', () => {
    expect(segmentCopy('写于槟城', () => undefined)).toEqual([{ kind: 'zh', text: '写于槟城' }])
  })

  it('every grove and method line in content has a gloss for its Chinese', () => {
    for (const line of [grove.chartLead, grove.whatIsAChart, grove.methodNote]) {
      expect(segmentCopy(line).filter((s) => s.kind === 'zh'), line).toEqual([])
    }
  })
})

describe('GlossText', () => {
  it("hides a term's spelled-out English from screen readers, which hear it in the gloss (CP-11)", () => {
    const root = document.createElement('div')
    root.innerHTML = renderToString(<GlossText text={grove.whatIsAChart} />)
    const echo = [...root.querySelectorAll('[aria-hidden="true"]')].find((e) => e.textContent === ' (Qimen Dunjia)')
    expect(echo).toBeDefined()
    // Sighted readers see the same words as before.
    const visible = root.cloneNode(true) as HTMLElement
    for (const h of visible.querySelectorAll('.visually-hidden')) h.remove()
    expect(visible.textContent).toBe(grove.whatIsAChart)
    // Text a screen reader gets: the name once, from the gloss.
    const spoken = root.cloneNode(true) as HTMLElement
    for (const h of spoken.querySelectorAll('[aria-hidden="true"]')) h.remove()
    expect(spoken.textContent?.match(/Qimen Dunjia/g)).toHaveLength(1)
  })
})

describe('accent glosses', () => {
  it('site accents carry a meaning for the tooltip', () => {
    expect(accentGloss(hero.accent)).toMatchObject({ zh: '入林', pinyin: 'rù lín', en: 'into the forest (林 is also Lim)' })
    expect(accentGloss(hero.accent).meaning).toBeTruthy()
    for (const n of nav) expect(bootGloss(n.accent.zh), n.accent.zh).toBeDefined()
  })

  it('3D glyphs resolve through the full glossary with their home palace', () => {
    expect(glossDetail('天英@9')).toMatchObject({ zh: '天英', pinyin: 'tiān yīng', en: 'Hero', note: 'home palace 9, 离 Li, south' })
    expect(glossDetail('休门')?.note).toBe('home palace 1, 坎 Kan, north')
    expect(glossDetail('不存在')).toBeNull()
    expect(romanize('lǜ')).toBe('Lu')
  })

  it('glosses a luopan mountain (@r4) as the mountain, not the stem or branch plate role (CD-3)', () => {
    expect(glossDetail('甲@r4')).toMatchObject({ zh: '甲', en: 'Mountain 75°' })
    expect(glossDetail('甲@r4')?.meaning).toMatch(/Twenty-four Mountains/)
    expect(glossDetail('甲')?.en).not.toBe('Mountain 75°')
    expect(glossDetail('子@r4')?.en).toBe('Mountain 0°')
    expect(glossDetail('乾@r4')?.meaning).toMatch(/Twenty-four Mountains/)
  })
})

const rect = (top: number, left = 500, width = 40, height = 20) => ({
  kind: 'rect' as const,
  rect: { top, left, width, height, bottom: top + height, right: left + width } as DOMRect,
})

describe('placeTooltip', () => {
  it('sits above the trigger when there is room under the header', () => {
    expect(placeTooltip(rect(400), 200, 60, 1280, 800)).toEqual({ left: 420, top: 332, side: 'above' })
  })

  it('flips below so it never covers the header or what it explains', () => {
    expect(placeTooltip(rect(70), 200, 60, 1280, 800)).toMatchObject({ top: 98, side: 'below' })
  })

  it('clears a header grown by a large text size (A11Y-5)', () => {
    // At 200% text the header is 112 px: a trigger at 150 has no room above, so the tip goes below.
    expect(placeTooltip(rect(150), 200, 60, 1280, 800)).toMatchObject({ side: 'above' })
    expect(placeTooltip(rect(150), 200, 60, 1280, 800, 120)).toMatchObject({ side: 'below' })
  })

  it('clamps to the viewport edges', () => {
    expect(placeTooltip(rect(400, 2), 200, 60, 390, 844).left).toBe(8)
    expect(placeTooltip({ kind: 'point', x: 385, y: 500 }, 200, 60, 390, 844).left).toBe(182)
  })
})

describe('LangText (A11Y-8, CD-8: CJK inside English copy has lang="zh-Hans")', () => {
  it('marks each Chinese run in a glossary meaning or the colophon, and glosses nothing', () => {
    const html = renderToString(<LangText text="The 甲 or 己 day that opens each block. 林 is Lim." />)
    expect(html).toBe('The <span lang="zh-Hans">甲</span> or <span lang="zh-Hans">己</span> day that opens each block. <span lang="zh-Hans">林</span> is Lim.')
    expect(renderToString(<LangText text="No Chinese here." />)).toBe('No Chinese here.')
  })

  it('writes live-region messages the same way, keeping the text', () => {
    const el = document.createElement('div')
    el.textContent = 'old'
    writeLangText(el, 'Chart recast for 17:00 to 18:59, 酉 hour.')
    expect(el.textContent).toBe('Chart recast for 17:00 to 18:59, 酉 hour.')
    expect(el.querySelector('[lang="zh-Hans"]')?.textContent).toBe('酉')
  })
})
