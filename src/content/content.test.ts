import { describe, expect, it } from 'vitest'
import { features } from './features'
import {
  alsoOrder,
  branches,
  cabin,
  chartTerms,
  chartOptions,
  featuredOrder,
  fill,
  glossFor,
  glossForMark,
  glossForMountain,
  hero,
  meta,
  mountains,
  nav,
  seals,
  serviceById,
  services,
  socials,
  forest,
  stems,
  terminalCommands,
  timeline,
  timelineCaption,
  workItems,
} from './index'
import { missingGlosses } from '../lib/qimen/labels'
import { segmentCopy } from '../dom/gloss/lookup'

describe('owner defaults (design.md §18.1)', () => {
  it('hero has no accent, the full-stack positioning line and no availability line', () => {
    expect('accent' in hero).toBe(false)
    expect(hero.positioning).toBe(hero.positioningOptions[3])
    expect(hero.availability).toBeNull()
    expect(hero.showSocialRow).toBe(true)
  })

  it.runIf(features.grove)('nav reads Work / Grove / Contact with 木屋 / 九宫 / 石灯', () => {
    const places = nav.filter((n) => n.id !== 'threshold')
    expect(places.map((n) => n.label)).toEqual(['Work', 'Grove', 'Contact'])
    expect(places.map((n) => n.accent.zh)).toEqual(['木屋', '九宫', '石灯'])
    expect(places.map((n) => n.href)).toEqual(['#cabin', '#grove', '#contact'])
  })

  it.runIf(!features.grove)('nav reads Work / Contact with 木屋 / 石灯 while the grove is paused', () => {
    const places = nav.filter((n) => n.id !== 'threshold')
    expect(places.map((n) => n.label)).toEqual(['Work', 'Contact'])
    expect(places.map((n) => n.accent.zh)).toEqual(['木屋', '石灯'])
    expect(places.map((n) => n.href)).toEqual(['#cabin', '#contact'])
    // No Qimen in the copy a visitor meets first (the terminal's whoami keeps its fengshui line).
    for (const s of [hero.subline, meta.description, meta.og.description]) expect(s).not.toMatch(/Qimen|grove/i)
  })

  it('four featured scrolls, four "Also" items, JRNY Spark nowhere', () => {
    expect(featuredOrder).toEqual(['tokenyze', 'kysen', 'nextrare', 'asterix'])
    expect(alsoOrder).toEqual(['miroma', 'atticc', 'mercury-labs', 'jrny'])
    const shown = new Set<string>([...featuredOrder, ...alsoOrder])
    expect(shown.has('jrny-spark')).toBe(false)
    expect(Object.keys(workItems)).toContain('jrny-spark')
  })

  it('services split across the two forest cards, each exactly once', () => {
    const ids = forest.cards.flatMap((c) => c.serviceIds)
    expect(ids.toSorted()).toEqual(services.map((s) => s.id).toSorted())
  })

  it('socials only: GitHub, X, LinkedIn, Telegram (no blog)', () => {
    expect(socials.map((s) => s.href)).toEqual([
      'https://github.com/cylim',
      'https://x.com/seewhy',
      'https://www.linkedin.com/in/cylim226',
      'https://t.me/cyants',
    ])
    expect(socials.find((s) => s.id === 'x')?.label).toBe('X')
  })

  it('林 seal ships; the name seal is off', () => {
    expect(seals.lin.enabled).toBe(true)
    expect(Object.keys(seals)).toEqual(['lin'])
  })

  it('chart conventions default to civil / zi23 / huXuan', () => {
    expect(chartOptions).toEqual({ timeBasis: 'civil', ziHour: 'zi23', deityNames: 'huXuan' })
  })
})

describe('helpers', () => {
  it('fill replaces known placeholders and leaves unknown ones visible', () => {
    expect(fill('Cast for {localDateTime}, {timeZone}', { localDateTime: '2026-09-28 19:05' })).toBe(
      'Cast for 2026-09-28 19:05, {timeZone}',
    )
  })

  it('glossFor finds chart glyphs and site accents', () => {
    expect(glossFor('天英')?.en).toBe('Hero')
    expect(glossFor('秋分')?.en).toBe('Autumn Equinox')
    expect(glossFor('林')?.pinyin).toBe('lín')
    expect(glossFor('不存在')).toBeUndefined()
  })
})

describe('chart glosses', () => {
  it('glosses every string the Qimen chart can print (lib/qimen/labels.ts)', () => {
    expect(missingGlosses(glossFor)).toEqual([])
  })
})

describe('glosses in context (review CD-2, CD-3, CD-5)', () => {
  it('a calendar pillar glosses as a stem-branch pair, not as the plate role of its stem', () => {
    expect(glossFor('丙午')).toMatchObject({ pinyin: 'bǐng wǔ', en: 'Fire Horse' })
    expect(glossFor('乙巳')?.en).toBe('Wood Snake')
    expect(glossFor('癸亥')?.en).toBe('Water Pig')
    // All sixty pairs, and only valid ones (a yang stem never pairs with a yin branch).
    for (let i = 0; i < 60; i++) expect(glossFor(`${stems[i % 10]?.zh}${branches[i % 12]?.zh}`), String(i)).toBeDefined()
    expect(glossFor('甲丑')).toBeUndefined()
    // Single glyphs keep their chart meaning.
    expect(glossFor('丙')?.en).toBe('Moon Wonder')
    expect(glossFor('午')?.en).toBe('Horse')
    // The chart header's pillar line (fixture A) segments into whole pillars.
    const terms = segmentCopy('丙午年 丁酉月 乙巳日 丙戌时', glossFor).flatMap((x) => (x.kind === 'term' ? [`${x.term.zh} ${x.term.en}`] : []))
    expect(terms).toEqual(['丙午 Fire Horse', '丁酉 Fire Rooster', '乙巳 Wood Snake', '丙戌 Fire Dog'])
  })

  it('the header structure 阴遁四局 glosses 四局 whole, numeral included', () => {
    expect(glossFor('四局')).toMatchObject({ pinyin: 'sì jú', en: 'Structure 4' })
    expect(glossFor('九局')).toMatchObject({ pinyin: 'jiǔ jú', en: 'Structure 9' })
    expect(glossFor('局')?.en).toBe('Structure')
    const segs = segmentCopy('阴遁四局, yin cycle, structure 4', glossFor)
    expect(segs.flatMap((x) => (x.kind === 'term' ? [x.term.zh] : []))).toEqual(['阴遁', '四局'])
    expect(segs.some((x) => x.kind === 'zh')).toBe(false)
  })

  it('值符 as a mark or in the duty line is the Duty Chief; as a deity it is the Chief', () => {
    expect(glossForMark('值符')?.en).toBe('Duty Chief')
    expect(glossForMark('值使')?.en).toBe('Duty Envoy')
    expect(glossForMark('旬空')?.en).toBe('Void')
    expect(glossForMark('天芮')?.en).toBe('Grass')
    expect(glossFor('值符')?.en).toBe('Chief')
  })

  it('a luopan mountain glosses as a mountain, never as the stem that names it', () => {
    const jia = glossForMountain('甲')
    expect(jia).toMatchObject({ zh: '甲', pinyin: 'jiǎ', en: 'Mountain 75°' })
    expect(jia?.meaning).toContain('67.5° to 82.5°, in palace 3 震, east')
    expect(jia?.meaning).not.toMatch(/never shown/i)
    expect(glossForMountain('子')?.meaning).toContain('352.5° to 7.5°')
    for (const m of mountains) expect(glossForMountain(m.zh)?.en, m.zh).toBe(`Mountain ${m.bearing}°`)
    expect(glossForMountain('值符')).toBeUndefined()
  })

  it('an hour decade is ten two-hour periods, not ten hours', () => {
    for (const t of chartTerms) expect(t.meaning, t.zh).not.toMatch(/ten-hour/)
    expect(glossFor('旬首')?.meaning).toContain('ten two-hour periods')
    expect(glossFor('旬空')?.meaning).toContain('ten two-hour periods')
  })
})

describe('career facts (LinkedIn export, github.com/cylim/talks; review CP-4, CP-5, CP-10)', () => {
  it('Cyants is the owner\'s studio (owner-confirmed), and JRNY is a Cyants product', () => {
    const cyants = timeline.find((e) => e.org === 'Cyants')
    expect(cyants).toMatchObject({ start: 2018, end: 'now', role: 'Founder' })
    for (const id of ['jrny', 'jrny-plan', 'jrny-spark'] as const) expect(workItems[id].context).toBe('Cyants')
  })

  it('personal projects are labelled personal, never client work', () => {
    expect(meta.og.description).not.toMatch(/client work/i)
    expect(serviceById('web-apps').body).toMatch(/my studio Cyants, whose own products include JRNY/)
    expect(workItems.oripax.context).toBe('Personal project')
    const projects = terminalCommands.find((c) => c.name === 'projects')?.output ?? []
    expect(projects.find((l) => l.includes('OripaX'))).toMatch(/\(personal\)$/)
    for (const name of ['JRNY Plan', 'JRNY ']) expect(projects.find((l) => l.includes(name)), name).toMatch(/\(Cyants\)$/)
  })

  it('reads as one chronology under a caption that covers every kind of row', () => {
    expect(timelineCaption).toBe("Where I've been")
    expect(cabin.timelineHeading).toBe(timelineCaption)
    for (let i = 1; i < timeline.length; i++) {
      expect((timeline[i] as (typeof timeline)[number]).start, (timeline[i] as (typeof timeline)[number]).org).toBeLessThanOrEqual(
        (timeline[i - 1] as (typeof timeline)[number]).start,
      )
    }
  })

  it('JS Penang talks were 2018; the Docker talk was Docker Penang in 2019', () => {
    const js = timeline.find((e) => e.org === 'JavaScript Malaysia')
    expect(js).toMatchObject({ start: 2017, end: 2018 })
    expect(js?.note).not.toMatch(/docker/i)
    expect(timeline.find((e) => e.org === 'Docker Penang')).toMatchObject({ kind: 'community', start: 2019, end: null })
  })
})
