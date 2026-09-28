/**
 * Every CJK label the chart shows, and the join to the glossary.
 *
 * The Chinese strings here are the engine's own values (qimen-spec.md §13), not copy. The pinyin
 * and English come from src/content/glossary.ts, but lib/ may not import content (it is a leaf,
 * .oxlintrc.json), so callers pass the lookup in:
 *
 *   import { glossFor } from '../content'
 *   const labels = chartLabels(chart, glossFor)
 *
 * scripts/subset-fonts reads QIMEN_GLYPHS (stack.md §7), and troika builds its atlas from it.
 */

import { BRANCHES, DEITY_SLOTS, HOME_DOOR, HOME_STAR, MOUNTAINS, PALACE_NUMBERS, STEMS, TERM_NAMES } from './constants'
import type { Deity, Dun, GanZhi, OuterPalaceNo, PalaceNo, QimenChart, Yuan } from './types'

/** One glossed label. Matches the first line of every tooltip: "{zh} {pinyin} · {en}". */
export interface Gloss {
  readonly zh: string
  readonly pinyin: string
  readonly en: string
}

/** Structurally the same as content's `glossFor`; the extra optional fields are read when present. */
export type GlossLookup = (zh: string) => (Gloss & { readonly animal?: string; readonly enPhrase?: string; readonly meaning?: string }) | undefined

export const DUN_ZH: Readonly<Record<Dun, '阳遁' | '阴遁'>> = { yang: '阳遁', yin: '阴遁' }
export const YUAN_ZH: Readonly<Record<Yuan, '上元' | '中元' | '下元'>> = { upper: '上元', middle: '中元', lower: '下元' }
/** 局 numerals, index = ju − 1. */
export const JU_ZH: readonly string[] = ['一', '二', '三', '四', '五', '六', '七', '八', '九']

/** Palace names as the chart prints them: trigram, or 中五 for the centre (design.md §9.3). */
export const PALACE_ZH: Readonly<Record<PalaceNo, string>> = {
  1: '坎', 2: '坤', 3: '震', 4: '巽', 5: '中五', 6: '乾', 7: '兑', 8: '艮', 9: '离',
}

/** Marks and fixed carvings on the platform and in the header. */
export const MARKS_ZH = {
  zhiFu: '值符',
  zhiShi: '值使',
  xunShou: '旬首',
  void: '旬空',
  horse: '驿马',
  /** The 0.25 m slab mark for 驿马. */
  horseMark: '马',
  /** Carved on 中五: the centre star and stem travel with 坤2. */
  lodged: '禽寄坤',
  method: '时家奇门 · 转盘 · 拆补法',
} as const

const ALL_DEITIES: readonly Deity[] = [...DEITY_SLOTS, '勾陈', '朱雀']

/**
 * Glosses the glossary does not have yet. TODO(owner): move into src/content/glossary.ts
 * (requested from dom); a lookup hit always wins over these.
 */
const FALLBACK: Readonly<Record<string, Gloss>> = {
  上元: { zh: '上元', pinyin: 'shàng yuán', en: 'Upper third' },
  中元: { zh: '中元', pinyin: 'zhōng yuán', en: 'Middle third' },
  下元: { zh: '下元', pinyin: 'xià yuán', en: 'Lower third' },
  中五: { zh: '中五', pinyin: 'zhōng wǔ', en: 'Centre 5' },
  禽寄坤: { zh: '禽寄坤', pinyin: 'qín jì kūn', en: 'Bird lodges in Kun' },
}

/** Single glyphs that stand for a longer term. */
const ALIASES: Readonly<Record<string, string>> = { 马: '驿马' }

/** Every string the chart can ask the glossary for. `missingGlosses(glossFor)` lists the ones content lacks. */
export const CHART_VOCABULARY: readonly string[] = [
  ...new Set([
    ...STEMS,
    ...BRANCHES,
    ...Object.values(HOME_STAR),
    ...Object.values(HOME_DOOR),
    ...ALL_DEITIES,
    ...PALACE_NUMBERS.map((p) => PALACE_ZH[p]),
    ...TERM_NAMES,
    ...Object.values(DUN_ZH),
    ...Object.values(YUAN_ZH),
    '局',
    '元',
    '符头',
    MARKS_ZH.zhiFu,
    MARKS_ZH.zhiShi,
    MARKS_ZH.xunShou,
    MARKS_ZH.void,
    MARKS_ZH.horse,
    MARKS_ZH.lodged,
    '天盘',
    '地盘',
    '时辰',
  ]),
]

/** Every CJK character the chart, its header, the 24 mountains and the colophon date can render, sorted. */
export const QIMEN_GLYPHS: string = [
  ...new Set(
    [
      ...CHART_VOCABULARY,
      ...MOUNTAINS,
      ...JU_ZH,
      MARKS_ZH.method,
      MARKS_ZH.horseMark,
      '年月日时',
      '十十一十二十三十四后前',
    ]
      .join('')
      .replace(/[^\p{Script=Han}]/gu, ''),
  ),
]
  .toSorted()
  .join('')

/** Gloss for a chart string: the lookup first, then the local fallbacks, then the bare glyph. */
export function glossOf(zh: string, lookup: GlossLookup): Gloss {
  const hit = lookup(zh) ?? lookup(ALIASES[zh] ?? '')
  if (hit) return { zh, pinyin: hit.pinyin, en: hit.en }
  return FALLBACK[zh] ?? { zh, pinyin: '', en: '' }
}

/** Chart strings the lookup cannot gloss (fallbacks excluded). Empty when content is complete. */
export const missingGlosses = (lookup: GlossLookup, vocabulary: readonly string[] = CHART_VOCABULARY): string[] =>
  vocabulary.filter((zh) => !lookup(zh))

/** "bǐng" → "Bing": tone marks off, first letter up, for romanised names like Bing-Wu. */
export function plainPinyin(pinyin: string): string {
  const bare = pinyin.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ü/g, 'u')
  return bare.charAt(0).toUpperCase() + bare.slice(1)
}

// ---------------------------------------------------------------------------- header

export interface ChartInscription {
  /** 阴遁四局 */
  structure: string
  /** 秋分下元 */
  termYuan: string
  /** 旬首 甲申 */
  xunShou: string
  /** 丙午年 丁酉月 乙巳日 丙戌时 */
  pillars: string
  /** The carved band on the north step (design.md §9.2): 阴遁四局 · 秋分下元 · 旬首 甲申 */
  line: string
}

export function inscription(chart: QimenChart): ChartInscription {
  const structure = `${DUN_ZH[chart.dun]}${JU_ZH[chart.ju - 1]}局`
  const termYuan = `${chart.solarTerm.name}${YUAN_ZH[chart.yuan]}`
  const xunShou = `${MARKS_ZH.xunShou} ${chart.xunShou.head.name}`
  const { year, month, day, hour } = chart.pillars
  const pillars = `${year.name}年 ${month.name}月 ${day.name}日 ${hour.name}时`
  return { structure, termYuan, xunShou, pillars, line: `${structure} · ${termYuan} · ${xunShou}` }
}

// ---------------------------------------------------------------------------- palaces

export interface PalaceLabels {
  palace: PalaceNo
  /** Trigram (or 中五) with its gloss. */
  name: Gloss
  deity: Gloss | null
  /** [天芮, 天禽] when they ride together. */
  stars: Gloss[]
  /** Heaven stems, in the same order as `stars`. */
  heaven: Gloss[]
  door: Gloss | null
  earth: Gloss
  /** Palace 2 only: the centre's earth stem (中五寄坤二). */
  lodgedEarth: Gloss | null
  /** Glossed marks in reading order: 值符, 值使, 旬空, 驿马. */
  marks: Gloss[]
}

export interface ChartLabels {
  inscription: ChartInscription
  dun: Gloss
  yuan: Gloss
  solarTerm: Gloss
  pillars: Record<'year' | 'month' | 'day' | 'hour', GanZhi>
  zhiFu: { star: Gloss; palace: OuterPalaceNo; palaceName: Gloss }
  zhiShi: { door: Gloss; palace: OuterPalaceNo; palaceName: Gloss }
  /** 1..9 in Luo Shu order, the order practitioners count in. */
  palaces: PalaceLabels[]
}

export function palaceLabels(chart: QimenChart, p: PalaceNo, lookup: GlossLookup): PalaceLabels {
  const s = chart.palaces[p]
  const g = (zh: string) => glossOf(zh, lookup)
  const marks: Gloss[] = []
  if (s.flags.zhiFu) marks.push(g(MARKS_ZH.zhiFu))
  if (s.flags.zhiShi) marks.push(g(MARKS_ZH.zhiShi))
  if (s.flags.hourVoid) marks.push(g(MARKS_ZH.void))
  if (s.flags.horse) marks.push(g(MARKS_ZH.horse))
  return {
    palace: p,
    name: g(PALACE_ZH[p]),
    deity: s.deity ? g(s.deity) : null,
    stars: s.stars.map(g),
    heaven: s.heaven.map(g),
    door: s.door ? g(s.door) : null,
    earth: g(s.earth),
    lodgedEarth: s.lodgedEarth ? g(s.lodgedEarth) : null,
    marks,
  }
}

/** Everything the DOM chart, the album SVG and the 3D glyph tooltips label, glossed once. */
export function chartLabels(chart: QimenChart, lookup: GlossLookup): ChartLabels {
  const g = (zh: string) => glossOf(zh, lookup)
  const palaceName = (p: PalaceNo) => g(PALACE_ZH[p])
  return {
    inscription: inscription(chart),
    dun: g(DUN_ZH[chart.dun]),
    yuan: g(YUAN_ZH[chart.yuan]),
    solarTerm: g(chart.solarTerm.name),
    pillars: chart.pillars,
    zhiFu: { star: g(chart.zhiFu.star), palace: chart.zhiFu.palace, palaceName: palaceName(chart.zhiFu.palace) },
    zhiShi: { door: g(chart.zhiShi.door), palace: chart.zhiShi.palace, palaceName: palaceName(chart.zhiShi.palace) },
    palaces: PALACE_NUMBERS.map((p) => palaceLabels(chart, p, lookup)),
  }
}
