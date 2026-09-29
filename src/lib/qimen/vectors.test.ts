// The 29 vectors of qimen-spec.md §16 (docs/plan/qimen-vectors.json), cell for cell (§14.3):
// term start and basis clock within 60 s, everything else exact.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { computeChart } from './index'
import type { PalaceNo, QimenOptions } from './types'

interface Vector {
  id: string
  description: string
  input: { datetime: string; tz: string; options: QimenOptions }
  expected: {
    meta: Record<string, unknown> & { basisLocal: string; solarTerm: { name: string; index: number; startUtc: string } }
    palaces: Record<string, { earth: string; heaven: string[]; stars: string[]; door: string | null; deity: string | null; hidden: string }>
  }
}

const vectors = JSON.parse(readFileSync(new URL('../../../docs/plan/qimen-vectors.json', import.meta.url), 'utf8')) as Vector[]
const within60s = (a: string, b: string) => Math.abs(Date.parse(a) - Date.parse(b)) <= 60_000

describe('qimen-spec §16 vectors', () => {
  it('has all 29', () => {
    expect(vectors.map((v) => v.id)).toEqual(Array.from({ length: 29 }, (_, i) => `Q${String(i + 1).padStart(2, '0')}`))
  })

  it.each(vectors.map((v) => [v.id, v] as const))('%s', (_id, v) => {
    const c = computeChart(Date.parse(v.input.datetime), { timeZone: v.input.tz, ...v.input.options })
    const { basisLocal, solarTerm, ...meta } = v.expected.meta
    expect(within60s(c.solarTerm.startUtc, solarTerm.startUtc), 'term start').toBe(true)
    expect(within60s(`${c.basis.local}Z`, `${basisLocal}Z`), 'basis clock').toBe(true)
    expect(c.solarTerm.name).toBe(solarTerm.name)
    expect(c.solarTerm.index).toBe(solarTerm.index)
    expect({
      pillars: { year: c.pillars.year.name, month: c.pillars.month.name, day: c.pillars.day.name, hour: c.pillars.hour.name },
      dun: c.dun,
      yuan: c.yuan,
      ju: c.ju,
      fuTou: c.fuTou.name,
      xunShou: { head: c.xunShou.head.name, yi: c.xunShou.yi, palace: c.xunShou.palace },
      zhiFu: c.zhiFu,
      zhiShi: c.zhiShi,
      rotation: c.rotation,
      fuYin: c.fuYin,
      fanYin: c.fanYin,
      void: c.void,
      horse: c.horse,
      hiddenStart: c.hiddenStart,
    }).toEqual(meta)
    for (const p of [1, 2, 3, 4, 5, 6, 7, 8, 9] as const satisfies readonly PalaceNo[]) {
      const { earth, heaven, stars, door, deity, hidden } = c.palaces[p]
      expect({ earth, heaven, stars, door, deity, hidden }, `palace ${p}`).toEqual(v.expected.palaces[p])
    }
  })

  it('Q01 and Q28 differ only by the basis clock (civil vs true solar in Penang)', () => {
    const at = Date.parse('2026-03-15T10:20:00+08:00')
    const civil = computeChart(at, { timeZone: 'Asia/Kuala_Lumpur' })
    const solar = computeChart(at, { timeZone: 'Asia/Kuala_Lumpur', timeBasis: 'trueSolar', longitude: 100.3288 })
    expect(civil.basis.local).toBe('2026-03-15T10:20:00')
    expect(solar.basis.local).toBe('2026-03-15T08:51:34')
    expect(solar.basis.offsetMinutes).toBeCloseTo(391.567, 2)
    expect([civil.pillars.hour.name, solar.pillars.hour.name]).toEqual(['丁巳', '丙辰'])
  })
})
