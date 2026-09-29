/**
 * The finale colophon's date (design.md §8.7 E3), e.g. 丙午年 秋分后五日 戌时, and its English
 * sentence. Same calendar as the chart: the built-in term table and the chart's basis clock.
 *
 * Rules:
 * - The sexagenary year turns at the 立春 instant, not on 1 January.
 * - Term days count dates on the basis clock, with the chart's day boundary: under zi23 (the
 *   default) a date runs 23:00 to 23:00, so the 子时 at 23:30 belongs to the next date, as the
 *   day pillar does. The date a term falls on reads {term}日 all day, even in the hours before
 *   its instant (that is what an almanac prints for the date).
 * - Days 1 to 14 after it read {term}后N日 in Chinese numerals.
 * - Terms are 14 to 16 dates apart, so a 15th or 16th day can occur. Those read as the next
 *   term's eve instead, {next}前N日 (N is 1 or 2), the form almanacs and dated inscriptions use
 *   for the days just before a term (清明前一日). 后十五日 would be legible but reads as a count,
 *   not a date.
 *
 * Copy comes in from src/content (lib/ may not import it): pass `colophon` from content/site.ts
 * and `glossFor` from content/glossary.ts.
 */

import { basisClock, formatWall, resolveOptions, wallDays } from '../qimen/clock'
import { gz } from '../qimen/constants'
import { plainPinyin, type GlossLookup } from '../qimen/labels'
import { dayHourIndices, yearMonthIndices } from '../qimen/pillars'
import { termAt, termName } from '../qimen/termLookup'
import { termTable } from '../qimen/terms'
import type { GanZhi, QimenOptions, SolarTermName, TermRow, Wall } from '../qimen/types'

export interface TermDay {
  /** 'on' the term's date, days 'after' it (1..14), or days 'before' the next term (1..2). */
  kind: 'on' | 'after' | 'before'
  term: SolarTermName
  days: number
}

export interface ColophonDate {
  /** Year pillar, turning at 立春. */
  year: GanZhi
  /** Hour pillar of the basis clock; the colophon prints its branch. */
  hour: GanZhi
  termDay: TermDay
  /** Basis wall clock, `YYYY-MM-DDTHH:mm:ss`. */
  local: string
}

/** Shape of content's `colophon` (content/site.ts). The `…Before…` fields are optional until content adds them. */
export interface ColophonCopy {
  readonly zh: string
  readonly termDayZero: string
  readonly termDayAfter: string
  readonly termDayBefore?: string
  readonly en: string
  readonly termDayZeroEn: string
  readonly termDayAfterEn: string
  readonly termDayOneEn: string
  readonly termDayBeforeEn?: string
  readonly termDayOneBeforeEn?: string
  readonly numeralsZh: readonly string[]
  readonly numeralsEn: readonly string[]
}

// TODO(owner): wording for the eve form. Requested in content/site.ts `colophon`; used until it lands.
const BEFORE_FALLBACK = {
  zh: '{term}前{n}日',
  en: '{nEn} days before {termEn}',
  oneEn: 'the day before {termEn}',
} as const

const fill = (template: string, vars: Readonly<Record<string, string>>): string =>
  template.replace(/\{(\w+)\}/g, (whole, key: string) => vars[key] ?? whole)

export function colophonDate(instant: Date | number, options?: QimenOptions, terms: readonly TermRow[] = termTable()): ColophonDate {
  const t = typeof instant === 'number' ? instant : instant.getTime()
  const o = resolveOptions(options)
  const { wall } = basisClock(t, o)
  const { hourIdx } = dayHourIndices(wall, o.ziHour)
  const ti = termAt(terms, t)
  const { yearIdx } = yearMonthIndices(terms, ti)
  const cur = terms[ti] as TermRow
  const next = terms[ti + 1] as TermRow
  // Under zi23 the day starts at 23:00, as the chart's day pillar does, so 23:00–23:59 counts as
  // the next date: a 子时 never straddles two term days.
  const dayOf = (w: Wall) => wallDays(w) + (o.ziHour === 'zi23' && w.h === 23 ? 1 : 0)
  const today = dayOf(wall)
  const dateOf = (row: TermRow) => dayOf(basisClock(row.startMs, o).wall)

  let termDay: TermDay
  const since = today - dateOf(cur)
  if (dateOf(next) === today) termDay = { kind: 'on', term: termName(next.index), days: 0 }
  else if (since <= 0) termDay = { kind: 'on', term: termName(cur.index), days: 0 }
  else if (since <= 14) termDay = { kind: 'after', term: termName(cur.index), days: since }
  else termDay = { kind: 'before', term: termName(next.index), days: Math.max(1, dateOf(next) - today) }

  return { year: gz(yearIdx), hour: gz(hourIdx), termDay, local: formatWall(wall) }
}

/**
 * In-sentence English for a term: the glossary's `enPhrase` when it has one, else a local rule.
 * Solstices and equinoxes are common nouns ("the autumn equinox", as design.md §8.7 writes it);
 * "X of Y" names take "the"; the rest read as names ("Cold Dew").
 */
export function termPhraseEn(term: SolarTermName, lookup: GlossLookup): string {
  const hit = lookup(term)
  if (hit?.enPhrase) return hit.enPhrase
  const en = hit?.en ?? term
  if (/solstice|equinox/i.test(en)) return `the ${en.toLowerCase()}`
  if (/\bof\b/.test(en)) return `the ${en}`
  return en
}

export function formatColophon(date: ColophonDate, copy: ColophonCopy, lookup: GlossLookup): { zh: string; en: string } {
  const { termDay: td } = date
  const nZh = copy.numeralsZh[td.days - 1] ?? String(td.days)
  const nEn = copy.numeralsEn[td.days - 1] ?? String(td.days)
  const termEn = termPhraseEn(td.term, lookup)
  const vars = { term: td.term, n: nZh, nEn, termEn }

  let termDayZh: string
  let termDayEn: string
  if (td.kind === 'on') {
    termDayZh = fill(copy.termDayZero, vars)
    termDayEn = fill(copy.termDayZeroEn, vars)
  } else if (td.kind === 'after') {
    termDayZh = fill(copy.termDayAfter, vars)
    termDayEn = fill(td.days === 1 ? copy.termDayOneEn : copy.termDayAfterEn, vars)
  } else {
    termDayZh = fill(copy.termDayBefore ?? BEFORE_FALLBACK.zh, vars)
    termDayEn = fill(td.days === 1 ? (copy.termDayOneBeforeEn ?? BEFORE_FALLBACK.oneEn) : (copy.termDayBeforeEn ?? BEFORE_FALLBACK.en), vars)
  }

  const pinyinOf = (zh: string) => plainPinyin(lookup(zh)?.pinyin ?? zh)
  const branch = lookup(date.hour.branch)
  return {
    zh: fill(copy.zh, { yearGz: date.year.name, termDay: termDayZh, hourBranch: date.hour.branch }),
    en: fill(copy.en, {
      termDayEn,
      yearPinyin: `${pinyinOf(date.year.stem)}-${pinyinOf(date.year.branch)}`,
      hourAnimal: branch?.animal ?? branch?.en ?? date.hour.branch,
    }),
  }
}
