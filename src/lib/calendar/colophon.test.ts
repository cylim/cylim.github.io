import { describe, expect, it } from 'vitest'
import { basisClock, resolveOptions } from '../qimen/clock'
import type { GlossLookup } from '../qimen/labels'
import { dayHourIndices } from '../qimen/pillars'
import { colophonDate, formatColophon, termPhraseEn, type ColophonCopy } from './colophon'

// lib/ may not import src/content; this mirrors content/site.ts `colophon` and a slice of the glossary.
const COPY: ColophonCopy = {
  zh: '{yearGz}年 {termDay} {hourBranch}时 · 林',
  termDayZero: '{term}日',
  termDayAfter: '{term}后{n}日',
  en: 'Inscribed in Penang for your visit, {termDayEn}, in the {yearPinyin} year, at the hour of the {hourAnimal}.',
  termDayZeroEn: 'on the day of {termEn}',
  termDayAfterEn: '{nEn} days after {termEn}',
  termDayOneEn: 'one day after {termEn}',
  numeralsZh: ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二', '十三', '十四'],
  numeralsEn: ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen'],
}
const GLOSS: Record<string, { zh: string; pinyin: string; en: string; animal?: string }> = {
  丙: { zh: '丙', pinyin: 'bǐng', en: 'Moon Wonder' },
  乙: { zh: '乙', pinyin: 'yǐ', en: 'Sun Wonder' },
  午: { zh: '午', pinyin: 'wǔ', en: 'Horse', animal: 'Horse' },
  巳: { zh: '巳', pinyin: 'sì', en: 'Snake', animal: 'Snake' },
  戌: { zh: '戌', pinyin: 'xū', en: 'Dog', animal: 'Dog' },
  丑: { zh: '丑', pinyin: 'chǒu', en: 'Ox', animal: 'Ox' },
  子: { zh: '子', pinyin: 'zǐ', en: 'Rat', animal: 'Rat' },
  秋分: { zh: '秋分', pinyin: 'qiū fēn', en: 'Autumn Equinox' },
  立春: { zh: '立春', pinyin: 'lì chūn', en: 'Start of Spring' },
  大暑: { zh: '大暑', pinyin: 'dà shǔ', en: 'Major Heat' },
  寒露: { zh: '寒露', pinyin: 'hán lù', en: 'Cold Dew' },
}
const lookup: GlossLookup = (zh) => GLOSS[zh]
const PENANG = { timeZone: 'Asia/Kuala_Lumpur' } as const
const at = (iso: string, opts: Parameters<typeof colophonDate>[1] = PENANG) => formatColophon(colophonDate(Date.parse(iso), opts), COPY, lookup)

describe('colophon (design.md §8.7 E3)', () => {
  it('writes the design example five days after 秋分', () => {
    expect(at('2026-09-28T19:30:00+08:00')).toEqual({
      zh: '丙午年 秋分后五日 戌时 · 林',
      en: 'Inscribed in Penang for your visit, five days after the autumn equinox, in the Bing-Wu year, at the hour of the Dog.',
    })
  })

  it('reads {term}日 on the date of the term, before and after its instant (秋分 08:05)', () => {
    expect(at('2026-09-23T07:00:00+08:00').zh).toBe('丙午年 秋分日 辰时 · 林')
    expect(at('2026-09-23T10:00:00+08:00').zh).toBe('丙午年 秋分日 巳时 · 林')
    expect(at('2026-09-23T10:00:00+08:00').en).toContain('on the day of the autumn equinox')
  })

  it('says one day after, then counts to 十四', () => {
    const one = at('2026-09-24T12:00:00+08:00')
    expect(one.zh).toBe('丙午年 秋分后一日 午时 · 林')
    expect(one.en).toContain('one day after the autumn equinox')
    expect(at('2026-10-07T12:00:00+08:00').zh).toBe('丙午年 秋分后十四日 午时 · 林')
    expect(at('2026-10-08T01:00:00+08:00').zh).toBe('丙午年 寒露日 丑时 · 林')
  })

  it('writes the eve of the next term past fourteen days (小暑 07-07 → 大暑 07-23)', () => {
    const d = colophonDate(Date.parse('2026-07-22T12:00:00+08:00'), PENANG)
    expect(d.termDay).toEqual({ kind: 'before', term: '大暑', days: 1 })
    const c = at('2026-07-22T12:00:00+08:00')
    expect(c.zh).toBe('丙午年 大暑前一日 午时 · 林')
    expect(c.en).toContain('the day before Major Heat')
  })

  it('never writes a day count past fourteen, 1930–2100', () => {
    for (let t = Date.UTC(1930, 0, 1, 4); t < Date.UTC(2100, 11, 31); t += 86400e3 * 3.7) {
      const { termDay } = colophonDate(t, { utcOffsetMinutes: 480 })
      if (termDay.kind === 'after') expect(termDay.days).toBeLessThanOrEqual(14)
      if (termDay.kind === 'before') expect([1, 2]).toContain(termDay.days)
      if (termDay.kind === 'on') expect(termDay.days).toBe(0)
    }
  })

  it('turns the year at the 立春 instant (04:02:08 +08:00), not 1 January', () => {
    expect(at('2026-01-10T12:00:00+08:00').zh.slice(0, 3)).toBe('乙巳年')
    const before = at('2026-02-04T03:00:00+08:00')
    expect(before.zh).toBe('乙巳年 立春日 寅时 · 林')
    expect(before.en).toContain('on the day of the Start of Spring, in the Yi-Si year')
    expect(at('2026-02-04T05:00:00+08:00').zh).toBe('丙午年 立春日 卯时 · 林')
  })

  it("counts days on the visitor's clock: 秋分 is 09-22 in New York", () => {
    expect(at('2026-09-22T22:00:00-04:00', { timeZone: 'America/New_York' }).zh).toBe('丙午年 秋分日 亥时 · 林')
    expect(at('2026-09-22T22:00:00-04:00').zh).toBe('丙午年 秋分日 巳时 · 林')
  })

  it('uses the 子 hour from 23:00, and under zi23 that hour already counts as the next date', () => {
    expect(at('2026-09-28T23:30:00+08:00').zh).toBe('丙午年 秋分后六日 子时 · 林')
    expect(at('2026-09-29T00:30:00+08:00').zh).toBe('丙午年 秋分后六日 子时 · 林')
    // The 子时 before the equinox date is the equinox date's 子时, not the eve's.
    expect(at('2026-09-22T22:30:00+08:00').zh).toBe('丙午年 秋分前一日 亥时 · 林')
    expect(at('2026-09-22T23:30:00+08:00').zh).toBe('丙午年 秋分日 子时 · 林')
  })

  it('dates a term that falls at 23:xx on the zi23 date (雨水 2026-02-18 23:51 +08:00)', () => {
    expect(at('2026-02-18T22:30:00+08:00').zh).toBe('丙午年 立春后十四日 亥时 · 林')
    expect(at('2026-02-18T23:20:00+08:00').zh).toBe('丙午年 雨水日 子时 · 林')
    expect(at('2026-02-19T12:00:00+08:00').zh).toBe('丙午年 雨水日 午时 · 林')
    // With a midnight day boundary the civil date is used throughout.
    const civil = { ...PENANG, ziHour: 'midnight' } as const
    expect(at('2026-02-18T23:20:00+08:00', civil).zh).toBe('丙午年 雨水日 子时 · 林')
    expect(at('2026-02-19T12:00:00+08:00', civil).zh).toBe('丙午年 雨水后一日 午时 · 林')
    expect(at('2026-09-22T23:30:00+08:00', { ...PENANG, ziHour: 'split' }).zh).toBe('丙午年 秋分前一日 子时 · 林')
  })

  // 8760 hours × 3 zi-hour rules: well under a second alone, but give it room on a loaded CI runner.
  it('changes term day only where the chart changes day pillar, 2026 hour by hour', () => {
    for (const ziHour of ['zi23', 'split', 'midnight'] as const) {
      const o = { ...PENANG, ziHour }
      let prev: { day: number; termDay: string } | null = null
      for (let t = Date.UTC(2025, 11, 20); t < Date.UTC(2027, 0, 5); t += 3600e3) {
        const { wall } = basisClock(t, resolveOptions(o))
        const day = dayHourIndices(wall, ziHour).dayIdx
        const termDay = JSON.stringify(colophonDate(t, o).termDay)
        if (prev && prev.day === day) expect(termDay, new Date(t).toISOString()).toBe(prev.termDay)
        prev = { day, termDay }
      }
    }
  }, 20_000)

  it('prefers the glossary phrase when it has one', () => {
    expect(termPhraseEn('寒露', lookup)).toBe('Cold Dew')
    expect(termPhraseEn('立春', lookup)).toBe('the Start of Spring')
    expect(termPhraseEn('秋分', (zh) => (zh === '秋分' ? { zh, pinyin: '', en: 'x', enPhrase: 'the equinox' } : undefined))).toBe('the equinox')
  })
})
