import { describe, expect, it } from 'vitest'
import { TERM_NAMES } from './constants'
import { decodeTermSeconds, encodeTermTable } from './termCodec'
import { TERM_DATA } from './termData'
import { termAt, termRange, termTable } from './terms'

const DAY = 86400e3

describe('built-in solar-term table', () => {
  const rows = termTable()

  it('is gap-free from 冬至, strictly increasing, 14.7 to 15.8 days apart', () => {
    rows.forEach((r, i) => expect(r.index).toBe(i % 24))
    for (let i = 1; i < rows.length; i++) {
      const gap = (rows[i]!.startMs - rows[i - 1]!.startMs) / DAY
      expect(gap).toBeGreaterThan(14.7)
      expect(gap).toBeLessThan(15.8)
    }
  })

  it('has exactly 24 terms in every calendar year 1930–2100, each once', () => {
    for (let y = 1930; y <= 2100; y++) {
      const inYear = rows.filter((r) => new Date(r.startMs).getUTCFullYear() === y)
      expect(inYear.map((r) => r.index).toSorted((a, b) => a - b), String(y)).toEqual(TERM_NAMES.map((_, i) => i))
    }
  })

  it('puts every 立春 on 3–5 February UTC, which the year pillar relies on', () => {
    for (const r of rows.filter((x) => x.index === 3)) {
      const d = new Date(r.startMs)
      expect(d.getUTCMonth()).toBe(1)
      expect(d.getUTCDate()).toBeGreaterThanOrEqual(3)
      expect(d.getUTCDate()).toBeLessThanOrEqual(5)
    }
  })

  it('matches the 2026 instants calendar.md checked against HKO, to the second', () => {
    const t2026 = rows.filter((r) => r.startMs >= Date.UTC(2026, 0, 1) && r.startMs < Date.UTC(2027, 0, 1))
    const utc8 = t2026.map((r) => `${TERM_NAMES[r.index]} ${new Date(r.startMs + 8 * 3600e3).toISOString().slice(5, 19).replace('T', ' ')}`)
    expect(utc8).toEqual([
      '小寒 01-05 16:23:10', '大寒 01-20 09:44:56', '立春 02-04 04:02:08', '雨水 02-18 23:51:56', '惊蛰 03-05 21:59:00',
      '春分 03-20 22:45:59', '清明 04-05 02:40:00', '谷雨 04-20 09:39:08', '立夏 05-05 19:48:44', '小满 05-21 08:36:45',
      '芒种 06-05 23:48:21', '夏至 06-21 16:24:30', '小暑 07-07 09:56:57', '大暑 07-23 03:13:05', '立秋 08-07 19:42:43',
      '处暑 08-23 10:18:49', '白露 09-07 22:41:16', '秋分 09-23 08:05:14', '寒露 10-08 14:29:17', '霜降 10-23 17:37:57',
      '立冬 11-07 17:52:05', '小雪 11-22 15:23:21', '大雪 12-07 10:52:32', '冬至 12-22 04:50:14',
    ])
  })

  it('termAt finds the row in force and refuses to extrapolate', () => {
    const qiufen = Date.parse('2026-09-23T00:05:14Z')
    expect(TERM_NAMES[rows[termAt(rows, qiufen)]!.index]).toBe('秋分')
    expect(TERM_NAMES[rows[termAt(rows, qiufen - 1)]!.index]).toBe('白露')
    const { fromMs, toMs } = termRange()
    expect(() => termAt(rows, fromMs - 1)).toThrow(RangeError)
    expect(() => termAt(rows, toMs)).toThrow(RangeError)
    expect(termAt(rows, fromMs)).toBe(24)
    expect(termAt(rows, toMs - 1)).toBe(rows.length - 2)
  })
})

describe('term codec', () => {
  it('round-trips the committed data', () => {
    const seconds = decodeTermSeconds(TERM_DATA)
    const again = encodeTermTable(seconds, TERM_DATA.firstYear, TERM_DATA.yearSeconds)
    expect(again).toEqual(TERM_DATA)
  })

  it('rejects residuals it cannot hold and partial years', () => {
    const base = Array.from({ length: 48 }, (_, i) => i * 1_300_000)
    expect(() => encodeTermTable(base.slice(0, 30), 2000, 31_200_000)).toThrow(RangeError)
    expect(() => encodeTermTable(base, 2000, 0)).toThrow(RangeError)
    expect(decodeTermSeconds(encodeTermTable(base, 2000, 31_200_000))).toEqual(base)
  })
})
