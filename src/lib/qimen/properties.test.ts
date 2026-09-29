// Property tests of qimen-spec.md §14.4 over thousands of seeded random instants, 1930–2100,
// in every mode: zones with DST and odd offsets, fixed offsets, true solar time, all three
// 子-hour rules and both deity naming sets.
import { describe, expect, it } from 'vitest'
import { HOME_DOOR, HOME_STAR, JU_TABLE, PALACE_NUMBERS, QIYI, RING, STEMS, mod } from './constants'
import { buildChart, computeChart, ringOffsets, termRange, termTable } from './index'
import { earthPlate } from './plates'
import { deitySlot } from './rings'
import type { OuterPalaceNo, PalaceNo, QimenChart, QimenOptions, Stem } from './types'

/** mulberry32: small, seedable, good enough to spread instants. */
function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const MODES: readonly QimenOptions[] = [
  { timeZone: 'Asia/Kuala_Lumpur' },
  { timeZone: 'America/New_York' },
  { timeZone: 'America/New_York', timeBasis: 'standard' },
  { timeZone: 'Europe/London', ziHour: 'split' },
  { timeZone: 'Asia/Kolkata', ziHour: 'midnight' },
  { timeZone: 'Asia/Kathmandu', deityNames: 'gouQue' },
  { timeZone: 'Pacific/Chatham' },
  { timeZone: 'Australia/Sydney', timeBasis: 'standard', ziHour: 'split' },
  { utcOffsetMinutes: 480 },
  { utcOffsetMinutes: -210, ziHour: 'midnight', deityNames: 'gouQue' },
  { timeZone: 'Asia/Kuala_Lumpur', timeBasis: 'trueSolar', longitude: 100.3288 },
  { timeZone: 'UTC', timeBasis: 'trueSolar', longitude: -122.4 },
]

const OUTER: readonly OuterPalaceNo[] = RING
const N = 6000

function sample(): { at: number; opts: QimenOptions; chart: QimenChart }[] {
  const rand = rng(20260928)
  const { fromMs, toMs } = termRange()
  const lo = Math.max(fromMs, Date.UTC(1930, 0, 1))
  const hi = Math.min(toMs, Date.UTC(2100, 11, 31, 12))
  const out: { at: number; opts: QimenOptions; chart: QimenChart }[] = []
  for (let i = 0; i < N; i++) {
    let at = Math.floor(lo + rand() * (hi - lo))
    // A quarter of the draws fall in the disputed 23:xx hour of the UTC+8 clock.
    if (i % 4 === 0) at = at - mod(at + 8 * 3600e3, 86400e3) + 23 * 3600e3 + Math.floor(rand() * 3600e3)
    if (at < lo || at >= hi) continue
    const opts = MODES[i % MODES.length] as QimenOptions
    out.push({ at, opts, chart: computeChart(at, opts) })
  }
  return out
}

const charts = sample()
const changeKey = (c: QimenChart) => [c.pillars.hour.index, c.pillars.day.index, c.solarTerm.index].join()
const count = <T,>(xs: readonly T[]) => {
  const m = new Map<T, number>()
  for (const x of xs) m.set(x, (m.get(x) ?? 0) + 1)
  return m
}

describe('局 and earth plate tables', () => {
  it('JU_TABLE equals its generator (§5), group starts included', () => {
    const groupStart = [1, 8, 3, 4, 9, 2, 7, 6] // 冬至 立春 春分 立夏 夏至 立秋 秋分 立冬
    for (let t = 0; t < 24; t++) {
      const s = t < 12 ? 1 : -1
      const k = t % 3
      let upper = groupStart[Math.floor(t / 3)] as number
      for (let j = 0; j < k; j++) upper = mod(upper - 1 + s, 9) + 1
      const middle = mod(upper - 1 + 6 * s, 9) + 1
      const lower = mod(middle - 1 + 6 * s, 9) + 1
      expect(JU_TABLE[t], `term ${t}`).toEqual([upper, middle, lower])
    }
  })

  it('earthPlate equals the §7 table for all 18 局', () => {
    const table: Record<string, string> = {
      阳1: '戊己庚辛壬癸丁丙乙', 阳2: '乙戊己庚辛壬癸丁丙', 阳3: '丙乙戊己庚辛壬癸丁', 阳4: '丁丙乙戊己庚辛壬癸', 阳5: '癸丁丙乙戊己庚辛壬',
      阳6: '壬癸丁丙乙戊己庚辛', 阳7: '辛壬癸丁丙乙戊己庚', 阳8: '庚辛壬癸丁丙乙戊己', 阳9: '己庚辛壬癸丁丙乙戊',
      阴1: '戊乙丙丁癸壬辛庚己', 阴2: '己戊乙丙丁癸壬辛庚', 阴3: '庚己戊乙丙丁癸壬辛', 阴4: '辛庚己戊乙丙丁癸壬', 阴5: '壬辛庚己戊乙丙丁癸',
      阴6: '癸壬辛庚己戊乙丙丁', 阴7: '丁癸壬辛庚己戊乙丙', 阴8: '丙丁癸壬辛庚己戊乙', 阴9: '乙丙丁癸壬辛庚己戊',
    }
    for (const [key, row] of Object.entries(table)) {
      const plate = earthPlate(Number(key.slice(1)), key.startsWith('阳'))
      expect(PALACE_NUMBERS.map((p) => plate[p]).join(''), key).toBe(row)
    }
  })
})

describe(`§14.4 properties over ${N} random instants`, () => {
  it('sampled enough charts in every mode', () => {
    expect(charts.length).toBeGreaterThan(N * 0.95)
  })

  it('heaven stems, 天禽 included, are the nine earth stems', () => {
    for (const { chart } of charts) {
      const heaven = OUTER.flatMap((p) => chart.palaces[p].heaven)
      const earth = PALACE_NUMBERS.map((p) => chart.palaces[p].earth)
      expect(count(heaven)).toEqual(count(earth))
    }
  })

  it('rotation.stars is 0 exactly when every outer heaven stem sits on its own earth stem', () => {
    for (const { chart } of charts) {
      const home = OUTER.every((p) => chart.palaces[p].heaven[0] === chart.palaces[p].earth)
      expect(chart.rotation.stars === 0).toBe(home)
    }
  })

  it('甲 hours have both rotations 0; 癸 hours have rotation.doors 0', () => {
    let jia = 0
    let gui = 0
    for (const { chart } of charts) {
      if (chart.pillars.hour.stem === '甲') {
        jia++
        expect(chart.rotation).toEqual({ stars: 0, doors: 0 })
      }
      if (chart.pillars.hour.stem === '癸') {
        gui++
        expect(chart.rotation.doors).toBe(0)
      }
    }
    expect(jia).toBeGreaterThan(100)
    expect(gui).toBeGreaterThan(100)
  })

  it('值符 deity and star share zhiFu.palace; zhiShi.palace holds the 值使 door', () => {
    for (const { chart } of charts) {
      const zf = chart.palaces[chart.zhiFu.palace]
      expect(zf.deity).toBe('值符')
      expect(zf.deitySlot).toBe(0)
      expect(zf.stars).toContain(chart.zhiFu.star)
      expect(zf.flags.zhiFu).toBe(true)
      expect(chart.palaces[chart.zhiShi.palace].door).toBe(chart.zhiShi.door)
      expect(chart.palaces[chart.zhiShi.palace].flags.zhiShi).toBe(true)
      expect(chart.zhiFu.star).toBe(HOME_STAR[chart.xunShou.palace])
      expect(chart.zhiShi.door).toBe(HOME_DOOR[chart.zhiShi.homePalace])
    }
  })

  it('outer palaces hold nine stars, eight distinct doors and eight deities; palace 5 holds none', () => {
    for (const { chart } of charts) {
      const stars = OUTER.flatMap((p) => chart.palaces[p].stars)
      expect(new Set(stars).size).toBe(9)
      expect(stars).toHaveLength(9)
      expect(new Set(OUTER.map((p) => chart.palaces[p].door)).size).toBe(8)
      expect(new Set(OUTER.map((p) => chart.palaces[p].deitySlot)).size).toBe(8)
      const c = chart.palaces[5]
      expect([c.stars, c.heaven, c.door, c.deity, c.deitySlot]).toEqual([[], [], null, null, null])
      expect(chart.palaces[2].lodgedEarth).toBe(c.earth)
    }
  })

  it('the nine hidden stems are distinct and the start palace holds the used hour stem', () => {
    for (const { chart } of charts) {
      expect(new Set(PALACE_NUMBERS.map((p) => chart.palaces[p].hidden)).size).toBe(9)
      expect(chart.palaces[chart.hiddenStart].hidden).toBe(chart.zhiFu.stem)
    }
  })

  it('deity names follow deityNames and the dun, positions never do', () => {
    for (const { at, opts, chart } of charts) {
      const other = computeChart(at, { ...opts, deityNames: opts.deityNames === 'gouQue' ? 'huXuan' : 'gouQue' })
      for (const p of OUTER) expect(other.palaces[p].deitySlot).toBe(chart.palaces[p].deitySlot)
      const names = new Set(OUTER.map((p) => chart.palaces[p].deity))
      const gouQue = chart.dun === 'yang' && chart.options.deityNames === 'gouQue'
      expect(names.has('勾陈')).toBe(gouQue)
      expect(names.has('白虎')).toBe(!gouQue)
    }
  })

  it('ring offsets agree with the rotations and with every deity slot', () => {
    for (const { chart } of charts) {
      const o = ringOffsets(chart)
      expect(mod(o.heaven, 8)).toBe(chart.rotation.stars)
      expect(mod(o.human, 8)).toBe(chart.rotation.doors)
      expect(o.heaven).toBeGreaterThanOrEqual(-3)
      expect(o.heaven).toBeLessThanOrEqual(4)
      for (const p of OUTER) {
        const k = chart.palaces[p].deitySlot as number
        expect(RING[deitySlot(o.spirit, o.dun, k)]).toBe(p)
      }
    }
  })

  it('pillars are consistent: 五鼠遁 hour stem, 元 and 符头 from the day', () => {
    for (const { chart } of charts) {
      const { day, hour } = chart.pillars
      expect(chart.fuTou.index).toBe(day.index - (day.index % 5))
      expect(['upper', 'middle', 'lower'][Math.floor(day.index / 5) % 3]).toBe(chart.yuan)
      expect(chart.dun).toBe(chart.solarTerm.index < 12 ? 'yang' : 'yin')
      expect(chart.ju).toBe(JU_TABLE[chart.solarTerm.index]?.[['upper', 'middle', 'lower'].indexOf(chart.yuan)])
      expect(chart.xunShou.head.index).toBe(Math.floor(hour.index / 10) * 10)
      expect(chart.xunShou.yi).toBe(QIYI[Math.floor(hour.index / 10)])
      expect(chart.palaces[chart.xunShou.palace].earth).toBe(chart.xunShou.yi)
    }
  })

  it('nothing changes before nextChangeUtc, and something does at it', () => {
    for (const { at, opts, chart } of charts.slice(0, 2000)) {
      const next = Date.parse(chart.nextChangeUtc)
      expect(next).toBeGreaterThan(at)
      // Two hours at most, plus one when a DST change falls back inside the 时辰.
      expect(next - at).toBeLessThanOrEqual(3 * 3600e3)
      const before = computeChart(next - 1000, opts)
      expect(before.pillars.hour).toEqual(chart.pillars.hour)
      expect(before.pillars.day).toEqual(chart.pillars.day)
      expect(before.solarTerm.index).toBe(chart.solarTerm.index)
      expect(before.palaces).toEqual(chart.palaces)
      expect(changeKey(computeChart(next, opts))).not.toBe(changeKey(chart))
    }
  })
})

describe('input handling', () => {
  it('accepts a Date or epoch ms and matches buildChart with the built-in table', () => {
    const at = Date.parse('2026-09-28T19:30:00+08:00')
    const a = computeChart(new Date(at), { utcOffsetMinutes: 480 })
    const b = computeChart(at, { utcOffsetMinutes: 480 })
    expect(a).toEqual(b)
    expect(buildChart(at, termTable(), { utcOffsetMinutes: 480 })).toEqual(b)
    expect(a.instantUtc).toBe('2026-09-28T11:30:00Z')
  })

  it('throws a RangeError outside the table and for NaN', () => {
    expect(() => computeChart(Date.UTC(1929, 0, 1))).toThrow(RangeError)
    expect(() => computeChart(Date.UTC(2102, 0, 1))).toThrow(RangeError)
    expect(() => computeChart(Number.NaN)).toThrow(RangeError)
  })

  it('covers every instant of 1930 to 2100 in any zone', () => {
    const { fromMs, toMs } = termRange()
    expect(fromMs).toBeLessThanOrEqual(Date.UTC(1930, 0, 1) - 14 * 3600e3)
    expect(toMs).toBeGreaterThan(Date.UTC(2101, 0, 1) + 12 * 3600e3)
    expect(() => computeChart(Date.UTC(1929, 11, 31, 10), { timeZone: 'Pacific/Kiritimati' })).not.toThrow()
    expect(() => computeChart(Date.UTC(2101, 0, 1, 11), { timeZone: 'Pacific/Pago_Pago' })).not.toThrow()
  })

  it('trueSolar without a longitude is an error', () => {
    expect(() => computeChart(Date.UTC(2026, 0, 1), { timeBasis: 'trueSolar' })).toThrow(RangeError)
  })

  it('keeps historical offsets to the second, so the wall clock and hour pillar match the zone', () => {
    // Africa/Monrovia was UTC−0:44:30 until 1972: 01:44:15Z is 00:59:45 on the wall, still 子.
    const monrovia = computeChart(Date.parse('1965-06-10T01:44:15Z'), { timeZone: 'Africa/Monrovia' })
    expect(monrovia.basis.local).toBe('1965-06-10T00:59:45')
    expect(monrovia.basis.offsetMinutes).toBe(-44.5)
    expect(monrovia.pillars.hour.branch).toBe('子')
    // America/St_Johns was UTC−3:30:52 in summer 1934 (−2:30:52): 01:00:00 on the wall is 丑, not 00:59 子.
    const stJohns = computeChart(Date.parse('1934-06-10T03:30:52Z'), { timeZone: 'America/St_Johns' })
    expect(stJohns.basis.local).toBe('1934-06-10T01:00:00')
    expect(stJohns.pillars.hour.branch).toBe('丑')
  })

  it('utcOffsetMinutes wins over timeZone and resolves to a null zone', () => {
    const c = computeChart(Date.parse('2026-06-20T20:30:00-04:00'), { timeZone: 'America/New_York', utcOffsetMinutes: 480 })
    expect(c.options.timeZone).toBeNull()
    expect(c.basis.local).toBe('2026-06-21T08:30:00')
  })

  it('stems are the ten 天干 in order', () => {
    expect(STEMS.join('')).toBe('甲乙丙丁戊己庚辛壬癸')
    const unused: Stem[] = STEMS.filter((s) => !QIYI.includes(s))
    expect(unused).toEqual(['甲'])
    const palaces: PalaceNo[] = [...RING, 5]
    expect(new Set(palaces).size).toBe(9)
  })
})
