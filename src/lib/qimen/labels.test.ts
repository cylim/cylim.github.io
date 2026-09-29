import { describe, expect, it } from 'vitest'
import { computeChart } from './index'
import { CHART_VOCABULARY, QIMEN_GLYPHS, chartLabels, glossOf, inscription, missingGlosses, plainPinyin, type GlossLookup } from './labels'

// lib/ may not import src/content, so these tests use a stand-in with the glossary's shape.
const FAKE: Record<string, { zh: string; pinyin: string; en: string }> = {
  天芮: { zh: '天芮', pinyin: 'tiān ruì', en: 'Grass' },
  天禽: { zh: '天禽', pinyin: 'tiān qín', en: 'Bird' },
  乾: { zh: '乾', pinyin: 'qián', en: 'Heaven' },
  驿马: { zh: '驿马', pinyin: 'yì mǎ', en: 'Post Horse' },
  死门: { zh: '死门', pinyin: 'sǐ mén', en: 'Death Door' },
}
const lookup: GlossLookup = (zh) => FAKE[zh]

describe('labels', () => {
  const chart = computeChart(Date.parse('2026-09-28T19:30:00+08:00'), { utcOffsetMinutes: 480 })

  it('writes the inscription band (design.md §9.2)', () => {
    expect(inscription(chart)).toEqual({
      structure: '阴遁四局',
      termYuan: '秋分下元',
      xunShou: '旬首 甲申',
      pillars: '丙午年 丁酉月 乙巳日 丙戌时',
      line: '阴遁四局 · 秋分下元 · 旬首 甲申',
    })
  })

  it('glosses from the lookup, then local fallbacks, then the bare glyph', () => {
    expect(glossOf('天芮', lookup)).toEqual({ zh: '天芮', pinyin: 'tiān ruì', en: 'Grass' })
    expect(glossOf('马', lookup)).toEqual({ zh: '马', pinyin: 'yì mǎ', en: 'Post Horse' })
    expect(glossOf('下元', lookup).en).toBe('Lower third')
    expect(glossOf('甲', lookup)).toEqual({ zh: '甲', pinyin: '', en: '' })
  })

  it('labels every palace of fixture A', () => {
    const l = chartLabels(chart, lookup)
    expect(l.palaces.map((p) => p.palace)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
    const p6 = l.palaces[5]!
    expect(p6.name).toEqual({ zh: '乾', pinyin: 'qián', en: 'Heaven' })
    expect(p6.stars.map((s) => s.en)).toEqual(['Grass', 'Bird'])
    expect(p6.heaven.map((s) => s.zh)).toEqual(['庚', '乙'])
    expect(p6.marks.map((m) => m.zh)).toEqual(['值符'])
    expect(l.palaces[1]!.lodgedEarth?.zh).toBe('乙')
    expect(l.palaces[4]).toMatchObject({ deity: null, door: null, stars: [], heaven: [], name: { zh: '中五', en: 'Centre 5' } })
    expect(l.zhiShi).toMatchObject({ door: { zh: '死门', en: 'Death Door' }, palace: 9 })
    expect(l.yuan.zh).toBe('下元')
    // 旬空 午未 → palaces 2 and 9; 驿马 申 → palace 2.
    expect(l.palaces[1]!.marks.map((m) => m.zh)).toEqual(['旬空', '驿马'])
    expect(l.palaces[8]!.marks.map((m) => m.zh)).toEqual(['值使', '旬空'])
  })

  it('knows its vocabulary and every glyph it can draw', () => {
    expect(missingGlosses(lookup)).toHaveLength(CHART_VOCABULARY.length - Object.keys(FAKE).length)
    expect(new Set(CHART_VOCABULARY).size).toBe(CHART_VOCABULARY.length)
    for (const ch of '甲子天芮禽寄坤驿马阴遁四局秋分下元旬首年月日时壬乾亥后前十') expect(QIMEN_GLYPHS).toContain(ch)
    expect([...QIMEN_GLYPHS].every((ch) => /\p{Script=Han}/u.test(ch))).toBe(true)
    expect(new Set(QIMEN_GLYPHS).size).toBe([...QIMEN_GLYPHS].length)
  })

  it('romanises pinyin for names like Bing-Wu', () => {
    expect([plainPinyin('bǐng'), plainPinyin('wǔ'), plainPinyin('lǘ'), plainPinyin('xū')]).toEqual(['Bing', 'Wu', 'Lu', 'Xu'])
  })
})
