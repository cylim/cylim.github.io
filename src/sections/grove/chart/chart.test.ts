// The stone chart against the engine (and so the DOM chart), and the casting clock (design.md §9.5–9.6).
import { describe, expect, it } from 'vitest'
import { chartOptions } from '../../../content'
import { PALACES, PALACE_NUMBERS, RING, computeChart, deitySlot, palaceAtSlot } from '../../../lib/qimen'
import type { PalaceNo, QimenChart } from '../../../lib/qimen/types'
import { buildModel, readPalaces, type ChartModel, type Rider } from './model'
import { CAST, ChartMotion } from './motion'
import { blockOffset, deityBearing, dotNumeral, palaceLocal, riderBearing, trigramSpot } from './layout'

const FIXTURE_A = Date.parse('2026-09-28T19:30:00+08:00')
const YANG = Date.parse('2026-03-15T10:20:00+08:00')
const opts = { ...chartOptions, utcOffsetMinutes: 480 }
const cast = (ms: number) => computeChart(ms, opts)

/** The DOM chart's palace rows (QimenFigure reads chart.palaces directly). */
function domRows(c: QimenChart): Record<PalaceNo, string> {
  const out = {} as Record<PalaceNo, string>
  for (const p of PALACE_NUMBERS) {
    const s = c.palaces[p]
    out[p] = [s.deity ?? '', s.stars.join('+'), s.heaven.join('+'), s.door ?? '', s.earth].join(' ')
  }
  return out
}

function stoneRows(m: ChartModel): Record<PalaceNo, string> {
  const out = {} as Record<PalaceNo, string>
  const read = readPalaces(m)
  for (const p of PALACE_NUMBERS) {
    const s = read[p]
    out[p] = [s.deity ?? '', s.stars.join('+'), s.heaven.join('+'), s.door ?? '', s.earth].join(' ')
  }
  return out
}

/** The palace a rider's ring slot points at once its ring has turned by the chart's offset. */
function ringLanding(m: ChartModel, r: Rider): PalaceNo {
  const bearing = r.ring === 'spirit' ? deityBearing(m.offsets.spirit, deitySlot(0, m.offsets.dun, r.index)) : riderBearing(r.index, m.offsets[r.ring])
  return palaceAtSlot(Math.round(bearing / 45))
}

describe.each([
  ['fixture A (yin 4)', FIXTURE_A],
  ['a yang-dun hour (惊蛰 中元, yang 7)', YANG],
  ['fixture B (伏吟)', Date.parse('2026-09-28T15:30:00+08:00')],
])('%s', (_, ms) => {
  const chart = cast(ms)
  const model = buildModel(chart)

  it('settles every palace exactly as the DOM chart shows it', () => {
    expect(stoneRows(model)).toEqual(domRows(chart))
  })

  it('turns every ring so each rider’s slot points at the palace it settles in', () => {
    for (const r of model.riders) expect([r.key, ringLanding(model, r)]).toEqual([r.key, r.palace])
  })

  it('carves each star’s home earth stem on the heaven plate, which the star carries as its heaven stem', () => {
    for (const r of model.riders.filter((x) => x.role === 'stem')) {
      const carving = model.carvings.find((c) => c.key === `c-stem:${r.index}`)
      expect(carving?.text).toBe(r.text)
    }
  })
})

describe('fixture A details (design.md Appendix D)', () => {
  const model = buildModel(cast(FIXTURE_A))
  it('has the expected offsets, marks and arc', () => {
    expect(model.offsets).toEqual({ heaven: 2, human: -1, spirit: 7, dun: 'yin' })
    expect([model.zhiFu, model.zhiShi]).toEqual([6, 9])
    expect(model.arc).toEqual({ from: 2, to: 6 })
    expect(model.voids.toSorted()).toEqual([2, 9])
    expect(model.horse).toBe(2)
    expect(model.band.fields).toEqual(['阴遁四局', '秋分下元', '旬首 甲申'])
    expect(model.band.pillars).toBe('丙午年 丁酉月 乙巳日 丙戌时')
    expect(model.luoShuPath).toEqual([9, 8, 7, 6, 5, 4, 3, 2, 1])
  })
  it('carves 芮·禽 and a second stem on the slot 天芮 comes home to', () => {
    const k = RING.indexOf(2)
    expect(model.carvings.find((c) => c.key === `c-star:${k}`)?.text).toBe('芮·禽')
    expect(model.carvings.find((c) => c.key === `c-stem2:${k}`)?.text).toBe('乙')
    expect(model.riders.find((r) => r.key === `star2:${k}`)).toMatchObject({ text: '禽', gloss: '天禽', palace: 6 })
  })
})

/** The rider the board raises onto the cinnabar 值符 plate. */
const plated = (m: ChartModel) => m.riders.filter((r) => r.role === m.zhiFuRole && r.palace === m.zhiFu)

describe('the 值符 plate (design.md §9.4, qimen-spec D14)', () => {

  it('sits under 天芮 when 天芮 is the 值符 (fixture A)', () => {
    const chart = cast(FIXTURE_A)
    const m = buildModel(chart)
    expect(chart.zhiFu.star).toBe('天芮')
    expect(m.zhiFuRole).toBe('star')
    expect(plated(m).map((r) => r.gloss)).toEqual(['天芮'])
  })

  it('sits under the small 禽 when the 旬首 hides in 中5 and 天禽 is the 值符', () => {
    // 2026-01-07 14:30 +08: 值符 天禽, which rides with 天芮 into 坎1.
    const chart = cast(Date.parse('2026-01-07T14:30:00+08:00'))
    const m = buildModel(chart)
    expect([chart.zhiFu.star, chart.zhiFu.palace]).toEqual(['天禽', 1])
    expect(m.zhiFuRole).toBe('star2')
    expect(plated(m).map((r) => [r.text, r.gloss])).toEqual([['禽', '天禽']])
  })

  it('always plates the 值符 star itself, whichever star that is (every hour of Jan to Mar 2026)', () => {
    let qin = 0
    for (let t = Date.parse('2026-01-01T00:30:00+08:00'); t < Date.parse('2026-04-01T00:00:00+08:00'); t += 7_200_000) {
      const chart = cast(t)
      const m = buildModel(chart)
      expect(plated(m).map((r) => r.gloss), chart.instantUtc).toEqual([chart.zhiFu.star])
      if (chart.zhiFu.star === '天禽') qin++
    }
    expect(qin).toBeGreaterThan(50)
  })
})

describe('the casting clock (§9.5)', () => {
  const model = buildModel(cast(FIXTURE_A))

  it('starts at 伏吟, unlit, with 值符 at 坎1', () => {
    const m = new ChartMotion(model)
    m.cast(model, 10)
    const f = m.frame(10)
    expect(f.angle).toEqual({ heaven: 0, human: 0, spirit: 0 })
    expect(f.fly).toEqual({ heaven: 0, human: 0, spirit: 0 })
    expect(f.ink.slice(1)).toEqual(Array(9).fill(0))
    expect([f.marks, f.arc, f.band]).toEqual([0, 0, 0])
  })

  it('inks the earth stems along the Luo Shu path, 140 ms a palace, backward in the yin dun', () => {
    const m = new ChartMotion(model)
    m.cast(model, 0)
    const f = m.frame(2 * CAST.perPalace + CAST.inkDur + 0.001)
    expect([f.ink[9], f.ink[8], f.ink[7]]).toEqual([1, 1, 1])
    expect(f.ink[6]).toBeLessThan(0.5)
    expect([f.ink[5], f.ink[1]]).toEqual([0, 0])
  })

  it('turns R1, then R2 250 ms later, then R3 500 ms later, the shortest way, without overshoot', () => {
    const m = new ChartMotion(model)
    m.cast(model, 0)
    const at = CAST.turn.at + 0.2
    const f = m.frame(at)
    expect(f.angle.heaven).toBeGreaterThan(0)
    expect(f.angle.human).toBe(0)
    expect(f.angle.spirit).toBe(0)
    let peak = -Infinity
    let low = Infinity
    for (let t = 0; t < 6; t += 0.01) {
      const g = m.frame(t)
      peak = Math.max(peak, g.angle.heaven)
      low = Math.min(low, g.angle.human, g.angle.spirit)
    }
    expect(peak).toBe(2)
    expect(low).toBe(-1)
    const end = m.frame(6)
    expect(end.angle).toEqual({ heaven: 2, human: -1, spirit: -1 })
  })

  it('settles, stamps the marks, draws the arc and prints the band, then rests with the arc at 40%', () => {
    const m = new ChartMotion(model)
    m.cast(model, 0)
    expect(m.frame(CAST.settle.at + 0.3).fly.heaven).toBeGreaterThan(0)
    expect(m.frame(CAST.marks.at + 0.3).marks).toBe(1)
    expect(m.frame(5.3).band).toBe(4)
    const end = m.end
    expect(end).toBeGreaterThan(8)
    expect(m.frame(end + 0.01).arcAlpha).toBeCloseTo(0.4)
    expect(m.busy(end + 0.01)).toBe(false)
  })

  it('completes in 300 ms when the visitor scrolls past', () => {
    const m = new ChartMotion(model)
    m.cast(model, 0)
    m.finish(2)
    const f = m.frame(2.31)
    expect(f.angle).toEqual({ heaven: 2, human: -1, spirit: -1 })
    expect(f.fly).toEqual({ heaven: 1, human: 1, spirit: 1 })
    expect(f.ink.slice(1)).toEqual(Array(9).fill(1))
    expect(f.band).toBe(4)
  })
})

describe('recasting (§9.6)', () => {
  const a = buildModel(cast(FIXTURE_A))
  const next = buildModel(cast(FIXTURE_A + 2 * 3_600_000))

  it('lifts, turns the shortest way, then settles into the new palaces', () => {
    const m = new ChartMotion(a)
    m.snap(a)
    m.recast(next, 100)
    expect(m.frame(100.15).fly.heaven).toBe(0)
    expect(m.frame(100.15).model).toBe(next)
    const end = m.frame(102)
    expect(end.fly.heaven).toBe(1)
    expect(((end.angle.heaven % 8) + 8) % 8).toBe(((next.offsets.heaven % 8) + 8) % 8)
    expect(((end.angle.spirit % 8) + 8) % 8).toBe(next.offsets.spirit)
  })

  it('keeps glyphs lifted through fast steps and settles 300 ms after the last', () => {
    const m = new ChartMotion(a)
    m.snap(a)
    let model = a
    let t = 100
    for (let i = 1; i <= 4; i++) {
      model = buildModel(cast(FIXTURE_A + i * 2 * 3_600_000))
      m.recast(model, t)
      t += 0.2
    }
    const last = t - 0.2
    expect(m.frame(last + 0.1).fly.heaven).toBe(0)
    expect(m.frame(last + 0.29).fly.heaven).toBe(0)
    expect(m.frame(last + 0.6).fly.heaven).toBe(1)
    expect(((m.frame(last + 0.6).angle.heaven % 8) + 8) % 8).toBe(((model.offsets.heaven % 8) + 8) % 8)
  })

  it('reorders the deities individually when the dun flips', () => {
    const yang = buildModel(cast(YANG))
    const m = new ChartMotion(a)
    m.snap(a)
    m.recast(yang, 50)
    expect(m.frame(50.3).spiritLift).toBe(1)
    const f = m.frame(53)
    f.deityRel.forEach((rel, k) => expect((((rel - deitySlot(0, 'yang', k)) % 8) + 8) % 8).toBe(0))
    expect(f.spiritLift).toBe(0)
  })
})

describe('the earth plate (design.md §9.1–9.3, Appendix C)', () => {
  it('lays the palaces compass-true: south row z −153, east is −X', () => {
    expect(palaceLocal(9)).toEqual([0, -3])
    expect(palaceLocal(1)).toEqual([0, 3])
    expect(palaceLocal(3)).toEqual([-3, 0])
    expect(palaceLocal(7)).toEqual([3, 0])
    expect(palaceLocal(4)).toEqual([-3, -3])
    expect(palaceLocal(6)).toEqual([3, 3])
  })

  it('stacks each trigram outward along its palace bearing, so the bottom line is nearest the centre', () => {
    for (const p of RING) {
      const spot = trigramSpot(p)
      expect([p, spot.out]).toEqual([p, PALACES[p].azimuth])
      const [x, z] = blockOffset(spot.u, spot.v)
      const [cx, cz] = palaceLocal(p)
      // The bars sit on the slab's outer edge (or outer corner), not toward the centre.
      expect(Math.hypot(cx + x, cz + z)).toBeGreaterThan(Math.hypot(cx, cz))
    }
  })

  it('draws the Luo Shu numerals as dots: odd hollow, even filled, joined; 5 a quincunx', () => {
    for (const p of PALACE_NUMBERS) {
      const n = dotNumeral(p)
      expect(n.dots).toHaveLength(p)
      expect(n.hollow).toBe(p % 2 === 1)
      expect(n.joins).toHaveLength(p === 5 ? 4 : p - 1)
    }
    const five = dotNumeral(5)
    const [centre, ...corners] = five.dots
    for (const c of corners) expect(Math.hypot(c.u - (centre?.u ?? 0), c.v - (centre?.v ?? 0))).toBeCloseTo(Math.hypot(0.06, 0.06))
  })
})
