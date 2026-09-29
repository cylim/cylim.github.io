/**
 * 时家奇门 · 转盘 · 拆补法: assembles one hour chart (qimen-spec.md §3–§13). Pure: no I/O and
 * no Date.now(); the solar-term table is injected so tests can pass any sorted table.
 */

import { basisClock, formatWall, isoUtc, resolveOptions } from './clock'
import { PALACE_NUMBERS, gz } from './constants'
import { hiddenStems, horseOf, voidOf } from './extras'
import { dayHourIndices, yearMonthIndices } from './pillars'
import { YUAN_NAMES, earthPlate, juOf, placeHour, turnPlates, yuanOf } from './plates'
import { nextHourChangeMs } from './schedule'
import { termAt, termName } from './termLookup'
import type { OuterPalaceNo, PalaceNo, PalaceState, QimenChart, QimenOptions, TermRow } from './types'

export function buildChart(instantMs: number, terms: readonly TermRow[], opts: QimenOptions = {}): QimenChart {
  if (!Number.isFinite(instantMs)) throw new RangeError('instant is not a finite time')
  const o = resolveOptions(opts)
  const clock = basisClock(instantMs, o)
  const { wall, offsetMinutes } = clock

  const { dayIdx, hourIdx, hourBranch } = dayHourIndices(wall, o.ziHour)

  const ti = termAt(terms, instantMs)
  const term = terms[ti] as TermRow
  const next = terms[ti + 1] as TermRow
  const { yearIdx, monthIdx } = yearMonthIndices(terms, ti)

  const yang = term.index < 12
  const { yuan, fuTouIdx } = yuanOf(dayIdx)
  const ju = juOf(term.index, yuan)
  const earth = earthPlate(ju, yang)
  const pl = placeHour(earth, hourIdx, yang)
  const outer = turnPlates(earth, pl, yang, o.deityNames)
  const hidden = hiddenStems(earth, pl, yang)
  const vh = voidOf(hourIdx)
  const vd = voidOf(dayIdx)
  const horse = horseOf(hourBranch)

  const palaces = {} as Record<PalaceNo, PalaceState>
  for (const p of PALACE_NUMBERS) {
    const outerP = p === 5 ? null : (p as OuterPalaceNo)
    const deity = outerP ? outer.deities[outerP] : null
    palaces[p] = {
      earth: earth[p],
      heaven: outerP ? outer.heaven[outerP] : [],
      stars: outerP ? outer.stars[outerP] : [],
      door: outerP ? outer.doors[outerP] : null,
      deity: deity ? deity.deity : null,
      deitySlot: deity ? deity.slot : null,
      hidden: hidden.stems[p],
      lodgedEarth: p === 2 ? earth[5] : null,
      flags: {
        zhiFu: p === pl.pt,
        zhiShi: p === pl.dt,
        hourVoid: (vh.palaces as PalaceNo[]).includes(p),
        dayVoid: (vd.palaces as PalaceNo[]).includes(p),
        horse: horse.palace === p,
      },
    }
  }

  const nextChangeMs = Math.min(next.startMs, nextHourChangeMs(o, clock))

  return {
    instantUtc: isoUtc(instantMs),
    basis: { timeBasis: o.timeBasis, offsetMinutes, local: formatWall(wall) },
    options: o,
    pillars: { year: gz(yearIdx), month: gz(monthIdx), day: gz(dayIdx), hour: gz(hourIdx) },
    solarTerm: {
      index: term.index,
      name: termName(term.index),
      startUtc: isoUtc(term.startMs),
      next: { index: next.index, name: termName(next.index), startUtc: isoUtc(next.startMs) },
    },
    dun: yang ? 'yang' : 'yin',
    yuan: YUAN_NAMES[yuan] as QimenChart['yuan'],
    ju,
    fuTou: gz(fuTouIdx),
    xunShou: { head: gz(pl.xun * 10), yi: pl.xunYi, palace: pl.p0 },
    zhiFu: { star: pl.zhiFuStar, homePalace: pl.p0, stem: pl.useStem, palaceRaw: pl.ptRaw, palace: pl.pt },
    zhiShi: { door: pl.zhiShiDoor, homePalace: pl.home, steps: pl.n, palaceRaw: pl.dtRaw, palace: pl.dt },
    rotation: { stars: pl.r, doors: pl.rd },
    fuYin: { stars: pl.r === 0, doors: pl.rd === 0 },
    fanYin: { stars: pl.r === 4, doors: pl.rd === 4 },
    void: { hour: vh.branches, hourPalaces: vh.palaces, day: vd.branches, dayPalaces: vd.palaces },
    horse,
    hiddenStart: hidden.start,
    nextChangeUtc: isoUtc(nextChangeMs),
    palaces,
  }
}
