import {
  deities,
  doors,
  fill,
  grove,
  palaces,
  solarTerms,
  stars,
  stems,
  type QimenTemplateVars,
} from '../../content'
import type { GlossaryTerm } from '../../content/types'
import { mountainAt, palaceAt, wrap360 } from '../../lib/compass'
import { BRANCHES, DUN_ZH, JU_ZH, MARKS_ZH, basisClock, inscription } from '../../lib/qimen'
import type { Branch, PalaceNo, QimenChart } from '../../lib/qimen/types'
import { romanize } from '../gloss/detail'

/**
 * Chart → words: every line the DOM chart, the terminal, the album and the live region print.
 * Pure. The chart's own wall clock (`basis.local`) is used throughout, never the browser's zone,
 * so what the page says always matches the chart that was cast.
 */

const YUAN_EN = { upper: 'upper third', middle: 'middle third', lower: 'lower third' } as const
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const

const pad = (n: number) => String(n).padStart(2, '0')

export const branchIndex = (b: Branch) => BRANCHES.indexOf(b)

/** "19:00 to 20:59" for 戌; 子 wraps midnight, "23:00 to 00:59". */
export function hourRange(b: Branch): string {
  const i = branchIndex(b)
  const start = (i * 2 + 23) % 24
  return `${pad(start)}:00 to ${pad((start + 1) % 24)}:59`
}

/** The chart's wall clock, parsed from basis.local. */
export function wall(chart: QimenChart) {
  const m = /^(\d+)-(\d+)-(\d+)T(\d+):(\d+)/.exec(chart.basis.local)
  const [y, mo, d, h, mi] = m ? m.slice(1).map(Number) : [1970, 1, 1, 0, 0]
  return { y: y ?? 1970, mo: mo ?? 1, d: d ?? 1, h: h ?? 0, mi: mi ?? 0 }
}

/** "Monday 28 September 2026". */
export function dateLabel(chart: QimenChart, withYear = true): string {
  const w = wall(chart)
  const wd = WEEKDAYS[new Date(Date.UTC(w.y, w.mo - 1, w.d)).getUTCDay()]
  return `${wd} ${w.d} ${MONTHS[w.mo - 1]}${withYear ? ` ${w.y}` : ''}`
}

/** "2026-09-28 19:05", as the terminal prints it. */
export const localDateTime = (chart: QimenChart) => chart.basis.local.slice(0, 16).replace('T', ' ')

/** The zone the chart was cast in: the IANA name, else "UTC+08:00". */
export function zoneLabel(chart: QimenChart): string {
  if (chart.options.timeZone) return chart.options.timeZone
  const off = chart.basis.offsetMinutes
  const sign = off < 0 ? '−' : '+'
  const a = Math.abs(Math.round(off))
  return `UTC${sign}${pad(Math.floor(a / 60))}:${pad(a % 60)}`
}

/**
 * "HH:MM" of an ISO instant on the chart's wall clock, at the offset in force at that instant: the
 * next turn on a DST night is read after the jump (03:00 EDT, not 02:00), as the device clock shows it.
 */
export function wallTime(chart: QimenChart, isoUtc: string): string {
  const w = basisClock(Date.parse(isoUtc), chart.options).wall
  return `${pad(w.h)}:${pad(w.mi)}`
}

const find = <T extends GlossaryTerm>(list: readonly T[], zh: string): T | undefined => list.find((t) => t.zh === zh)

export const starGloss = (zh: string) => find(stars, zh)
export const doorGloss = (zh: string) => find(doors, zh)
export const deityGloss = (zh: string) => find(deities, zh)
export const stemGloss = (zh: string) => find(stems, zh)
export const termGloss = (zh: string) => find(solarTerms, zh)
export const palaceGloss = (n: PalaceNo) => palaces.find((p) => p.number === n)

/** "离9". */
export const palaceTag = (n: PalaceNo) => `${palaceGloss(n)?.zh ?? ''}${n}`

/** "阴遁四局". */
export const juZh = (chart: QimenChart) => inscription(chart).structure

/** Carved on the north step and printed in the DOM header: "阴遁四局 · 秋分下元 · 旬首 甲申" (design.md §9.2). */
export const inscriptionBand = (chart: QimenChart) => inscription(chart).line

/** 年 月 日 时 pillars: "丙午年 丁酉月 乙巳日 丙戌时". */
export const pillarsZh = (chart: QimenChart) => inscription(chart).pillars

export interface HeaderParts {
  when: string
  pillars: string
  term: string
  structure: string
  duty: string
}

/**
 * The chart header (design.md §9.8): date and 时辰 range with time zone · four pillars · solar term ·
 * dun and 局 · 元 · 值符 and 值使 in plain English.
 */
export function headerParts(chart: QimenChart): HeaderParts {
  const b = chart.pillars.hour.branch
  const term = termGloss(chart.solarTerm.name)
  const star = chart.zhiFu.star
  const door = chart.zhiShi.door
  return {
    when: `${dateLabel(chart)}, ${hourRange(b)}, ${b} hour (${zoneLabel(chart)})`,
    pillars: pillarsZh(chart),
    term: `${chart.solarTerm.name} ${term?.en ?? ''}`.trim(),
    structure: `${juZh(chart)}, ${chart.dun} cycle, structure ${chart.ju}, ${inscription(chart).termYuan.slice(-2)} ${YUAN_EN[chart.yuan]}`,
    duty: `${MARKS_ZH.zhiFu} ${star} ${starGloss(star)?.en ?? ''} in ${palaceTag(chart.zhiFu.palace)}, ${MARKS_ZH.zhiShi} ${door} ${doorGloss(door)?.en ?? ''} in ${palaceTag(chart.zhiShi.palace)}`,
  }
}

export function figcaption(chart: QimenChart): string {
  return fill(grove.figcaption, {
    localDateTime: `${dateLabel(chart)}, ${hourRange(chart.pillars.hour.branch)} (${zoneLabel(chart)})`,
    zhifu: chart.zhiFu.star,
    zhifuPalace: palaceTag(chart.zhiFu.palace),
    zhishi: chart.zhiShi.door,
    zhishiPalace: palaceTag(chart.zhiShi.palace),
  })
}

/** "Cast for Monday 28 September 2026, 19:05, Asia/Kuala_Lumpur". */
export function castLabel(chart: QimenChart): string {
  const w = wall(chart)
  return fill(grove.castLabel, { localDateTime: `${dateLabel(chart)}, ${pad(w.h)}:${pad(w.mi)}`, timeZone: zoneLabel(chart) })
}

/** "The chart turns every two hours. Next turn at 21:00." */
export const turnNotice = (chart: QimenChart) => fill(grove.turnNotice, { nextTurnTime: wallTime(chart, chart.nextChangeUtc) })

/** "Chart recast for 21:00 to 22:59, 亥 hour." */
export const recastAnnouncement = (chart: QimenChart) =>
  fill(grove.recastAnnouncement, { range: hourRange(chart.pillars.hour.branch), branch: chart.pillars.hour.branch })

/** aria-valuetext of the hour slider: "Monday 28 September, 戌 hour, 19:00 to 20:59, yin dun structure 4". */
export const hourValueText = (chart: QimenChart) =>
  fill(grove.controls.hourValueText, {
    date: dateLabel(chart, false),
    branch: chart.pillars.hour.branch,
    range: hourRange(chart.pillars.hour.branch),
    dun: chart.dun,
    ju: chart.ju,
  })

const stripSuffix = (en: string | undefined, suffix: string) => (en ?? '').replace(new RegExp(`\\s*${suffix}$`), '')

/** The terminal's `qimen` template values (content/terminal.ts). */
export function qimenVars(chart: QimenChart): QimenTemplateVars {
  return {
    localDateTime: localDateTime(chart),
    timeZone: zoneLabel(chart),
    yearGz: chart.pillars.year.name,
    monthGz: chart.pillars.month.name,
    dayGz: chart.pillars.day.name,
    hourGz: chart.pillars.hour.name,
    dunZh: DUN_ZH[chart.dun],
    dunEn: chart.dun === 'yang' ? 'Yang' : 'Yin',
    ju: chart.ju,
    juZh: JU_ZH[chart.ju - 1] ?? String(chart.ju),
    zhifuZh: chart.zhiFu.star,
    zhifuEn: starGloss(chart.zhiFu.star)?.en ?? '',
    zhifuPalace: chart.zhiFu.palace,
    zhishiZh: chart.zhiShi.door,
    zhishiEn: stripSuffix(doorGloss(chart.zhiShi.door)?.en, 'Door'),
    zhishiPalace: chart.zhiShi.palace,
    kong: chart.void.hour.join(''),
    ma: chart.horse.branch,
    maPalace: chart.horse.palace,
  }
}

const withEn = (zh: string | null | undefined, g: (zh: string) => GlossaryTerm | undefined) => (zh ? `${zh} ${g(zh)?.en ?? ''}`.trim() : '')

/** "Facing 丙, 165°, palace 9 离 Li. This hour: 景门 View Door, 天英 Hero, 九天 Nine Heaven." */
export function compassReadout(chart: QimenChart, heading: number): string {
  const m = mountainAt(heading)
  const n = palaceAt(heading)
  const p = palaceGloss(n)
  const ps = chart.palaces[n]
  return fill(grove.compass.facing, {
    mountain: m.zh,
    deg: Math.round(wrap360(heading)) % 360,
    palace: n,
    trigram: p ? `${p.zh} ${romanize(p.pinyin)}` : '',
    door: withEn(ps.door, doorGloss),
    star: withEn(ps.stars[0], starGloss),
    deity: withEn(ps.deity, deityGloss),
  })
}
