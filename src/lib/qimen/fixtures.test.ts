// design.md Appendix D fixtures, and ringOffsets (design.md §9.5).
import { describe, expect, it } from 'vitest'
import { computeChart, ringOffsets } from './index'
import { deitySlot, palaceAtSlot, shortestSlots, turnBetween } from './rings'
import type { PalaceNo, QimenChart, QimenOptions } from './types'

const PENANG: QimenOptions = { timeZone: 'Asia/Kuala_Lumpur' }

/** Palace rows as the fixture table prints them: deity, stars, heaven stems, door, earth. */
function grid(c: QimenChart): Record<PalaceNo, string> {
  const out = {} as Record<PalaceNo, string>
  for (const p of [1, 2, 3, 4, 5, 6, 7, 8, 9] as const) {
    const s = c.palaces[p]
    out[p] = [s.deity ?? '', s.stars.join('+'), s.heaven.join('+'), s.door ?? '', s.earth].join(' ')
  }
  return out
}

describe('fixture A: Monday 28 September 2026, 19:00 to 20:59, UTC+8', () => {
  const expected: Record<PalaceNo, string> = {
    4: '白虎 天任 癸 景门 戊',
    9: '六合 天冲 己 死门 壬',
    2: '太阴 天辅 戊 惊门 庚',
    3: '玄武 天蓬 辛 杜门 己',
    5: '    乙',
    7: '螣蛇 天英 壬 开门 丁',
    8: '九地 天心 丙 伤门 癸',
    1: '九天 天柱 丁 生门 辛',
    6: '值符 天芮+天禽 庚+乙 休门 丙',
  }

  it.each(['2026-09-28T19:00:00+08:00', '2026-09-28T20:00:00+08:00', '2026-09-28T20:59:59+08:00'])('%s', (iso) => {
    for (const opts of [PENANG, { utcOffsetMinutes: 480 }] as const) {
      const c = computeChart(Date.parse(iso), opts)
      const { year, month, day, hour } = c.pillars
      expect([year.name, month.name, day.name, hour.name]).toEqual(['丙午', '丁酉', '乙巳', '丙戌'])
      expect([c.solarTerm.name, c.fuTou.name, c.yuan, c.dun, c.ju]).toEqual(['秋分', '甲辰', 'lower', 'yin', 4])
      expect([c.xunShou.head.name, c.xunShou.yi, c.xunShou.palace]).toEqual(['甲申', '庚', 2])
      expect([c.zhiFu.star, c.zhiFu.palace, c.zhiShi.door, c.zhiShi.palace]).toEqual(['天芮', 6, '死门', 9])
      expect(c.void.hour).toEqual(['午', '未'])
      expect(c.horse.branch).toBe('申')
      expect(grid(c)).toEqual(expected)
      expect(ringOffsets(c)).toEqual({ heaven: 2, human: -1, spirit: 7, dun: 'yin' })
    }
  })
})

describe('fixture B: the same day, 15:00 to 16:59, a 甲申 hour', () => {
  it('puts stars, stems and doors at home (伏吟)', () => {
    const c = computeChart(Date.parse('2026-09-28T15:30:00+08:00'), PENANG)
    expect(c.pillars.hour.name).toBe('甲申')
    expect(c.rotation).toEqual({ stars: 0, doors: 0 })
    expect(c.fuYin).toEqual({ stars: true, doors: true })
    expect([c.zhiFu.star, c.zhiFu.palace, c.zhiShi.door, c.zhiShi.palace]).toEqual(['天芮', 2, '死门', 2])
    expect(grid(c)).toEqual({
      4: '太阴 天辅 戊 杜门 戊',
      9: '螣蛇 天英 壬 景门 壬',
      2: '值符 天芮+天禽 庚+乙 死门 庚',
      3: '六合 天冲 己 伤门 己',
      5: '    乙',
      7: '九天 天柱 丁 惊门 丁',
      8: '白虎 天任 癸 生门 癸',
      1: '玄武 天蓬 辛 休门 辛',
      6: '九地 天心 丙 开门 丙',
    })
    expect(ringOffsets(c)).toEqual({ heaven: 0, human: 0, spirit: 5, dun: 'yin' })
  })
})

describe('ringOffsets', () => {
  it('counts palace 5 as 2: 值符 天禽 from 中五 (Q08)', () => {
    const c = computeChart(Date.parse('2026-01-07T14:30:00+08:00'), PENANG)
    expect([c.zhiFu.homePalace, c.zhiFu.palace, c.zhiShi.homePalace, c.zhiShi.palace]).toEqual([5, 1, 2, 6])
    expect(ringOffsets(c)).toEqual({ heaven: 3, human: 2, spirit: 0, dun: 'yang' })
  })

  it('keeps a half turn as +4 and folds 5..7 to −3..−1 (Q16 反吟, Q01)', () => {
    const q16 = computeChart(Date.parse('2026-01-07T18:30:00+08:00'), PENANG)
    expect(ringOffsets(q16)).toMatchObject({ heaven: 4, human: 4 })
    const q01 = computeChart(Date.parse('2026-03-15T10:20:00+08:00'), PENANG)
    expect(q01.rotation).toEqual({ stars: 1, doors: 5 })
    expect(ringOffsets(q01)).toMatchObject({ heaven: 1, human: -3, spirit: 3, dun: 'yang' })
  })

  it('places deities clockwise in the yang dun and anticlockwise in the yin', () => {
    const yang = computeChart(Date.parse('2026-01-05T04:00:00+08:00'), PENANG) // Q05: 值符 8, 九天 1
    const o = ringOffsets(yang)
    expect(palaceAtSlot(deitySlot(o.spirit, o.dun, 0))).toBe(8)
    expect(palaceAtSlot(deitySlot(o.spirit, o.dun, 7))).toBe(1)
    const yin = computeChart(Date.parse('2026-09-28T19:00:00+08:00'), PENANG) // fixture A: 值符 6, 螣蛇 7
    const oy = ringOffsets(yin)
    expect(palaceAtSlot(deitySlot(oy.spirit, oy.dun, 1))).toBe(7)
  })

  it('shortest turns', () => {
    expect([0, 1, 4, 5, 7, 8, -1, -4, -5, 12].map(shortestSlots)).toEqual([0, 1, 4, -3, -1, 0, -1, 4, 3, 4])
    expect(turnBetween(3, -3)).toBe(2)
    expect(turnBetween(-1, 2)).toBe(3)
  })
})
