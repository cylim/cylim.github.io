import { describe, expect, it, vi } from 'vitest'
import { createStore } from 'zustand/vanilla'
import { initialJourneyState, type JourneyState } from '../../core/store/journey'
import { chartOptions } from '../../content'
import { computeChart } from '../../lib/qimen'
import type { QimenChart } from '../../lib/qimen/types'
import { FIXTURE_A_MS, PENANG, castPenang, fixtureA } from '../test/fixtures'
import { createChartSource } from './chartSource'
import {
  castLabel,
  compassReadout,
  figcaption,
  headerParts,
  hourRange,
  hourValueText,
  inscriptionBand,
  qimenVars,
  recastAnnouncement,
  turnNotice,
} from './format'
import { READING_ORDER, SOUTH_UP, moveInGrid } from './grid'

/** The live "Next turn at" line for a moment in a zone. */
const turnNoticeIn = (iso: string, timeZone: string) => turnNotice(computeChart(Date.parse(iso), { ...chartOptions, timeZone }))

describe('chart words (Fixture A, design.md Appendix D)', () => {
  const c = fixtureA()

  it('names the 时辰 range, wrapping 子 over midnight', () => {
    expect(hourRange('戌')).toBe('19:00 to 20:59')
    expect(hourRange('子')).toBe('23:00 to 00:59')
    expect(hourRange('丑')).toBe('01:00 to 02:59')
  })

  it('prints the header, caption, band and cast label from the chart clock', () => {
    const h = headerParts(c)
    expect(h.when).toBe('Monday 28 September 2026, 19:00 to 20:59, 戌 hour (Asia/Kuala_Lumpur)')
    expect(h.pillars).toBe('丙午年 丁酉月 乙巳日 丙戌时')
    expect(h.term).toBe('秋分 Autumn Equinox')
    expect(h.structure).toBe('阴遁四局, yin cycle, structure 4, 下元 lower third')
    expect(h.duty).toBe('值符 天芮 Grass in 乾6, 值使 死门 Death Door in 离9')
    expect(inscriptionBand(c)).toBe('阴遁四局 · 秋分下元 · 旬首 甲申')
    expect(figcaption(c)).toBe(
      'Qimen chart cast for Monday 28 September 2026, 19:00 to 20:59 (Asia/Kuala_Lumpur). South is at the top. 值符 天芮 in 乾6, 值使 死门 in 离9.',
    )
    expect(castLabel(c)).toBe('Cast for Monday 28 September 2026, 19:05, Asia/Kuala_Lumpur')
    expect(turnNotice(c)).toBe('The chart turns every two hours. Next turn at 21:00.')
    expect(recastAnnouncement(c)).toBe('Chart recast for 19:00 to 20:59, 戌 hour.')
    expect(hourValueText(c)).toBe('Monday 28 September, 戌 hour, 19:00 to 20:59, yin dun structure 4')
  })

  it('fills every terminal template variable', () => {
    expect(qimenVars(c)).toMatchObject({
      localDateTime: '2026-09-28 19:05',
      timeZone: 'Asia/Kuala_Lumpur',
      dunZh: '阴遁',
      juZh: '四',
      zhifuZh: '天芮',
      zhifuEn: 'Grass',
      zhifuPalace: 6,
      zhishiZh: '死门',
      zhishiEn: 'Death',
      zhishiPalace: 9,
      kong: '午未',
      ma: '申',
      maPalace: 2,
    })
  })

  it('reads the next turn on the wall clock in force at the turn, DST nights included', () => {
    const at = turnNoticeIn
    // New York spring forward: 01:30 EST, 丑 ends when 02:00 EST jumps to 03:00 EDT.
    expect(at('2026-03-08T01:30:00-05:00', 'America/New_York')).toMatch(/Next turn at 03:00\.$/)
    // London spring forward: 00:30 GMT in 子, which ends at 01:00 GMT = 02:00 BST (01:00 never happens).
    expect(at('2026-03-29T00:30:00Z', 'Europe/London')).toMatch(/Next turn at 02:00\.$/)
    // New York fall back: 01:30 EDT, 丑 runs on through the repeated hour to 03:00 EST.
    expect(at('2026-11-01T01:30:00-04:00', 'America/New_York')).toMatch(/Next turn at 03:00\.$/)
  })

  it('reads out the palace the phone faces', () => {
    expect(compassReadout(c, 165)).toBe('Facing 丙, 165°, palace 9 离 Li. This hour: 死门 Death Door, 天冲 Impulse, 六合 Six Harmony.')
    expect(compassReadout(c, 359.6)).toMatch(/^Facing 子, 0°, palace 1 坎 Kan\./)
  })
})

describe('roving focus in the south-up grid', () => {
  it('lays the palaces out south-up and reads them 1 to 9', () => {
    expect(SOUTH_UP.flat()).toEqual([4, 9, 2, 3, 5, 7, 8, 1, 6])
    expect(READING_ORDER).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
  })

  it('moves by visual position and stops at the edges', () => {
    expect(moveInGrid(5, 'ArrowUp')).toBe(9)
    expect(moveInGrid(5, 'ArrowLeft')).toBe(3)
    expect(moveInGrid(1, 'ArrowRight')).toBe(6)
    expect(moveInGrid(9, 'ArrowUp')).toBe(9)
    expect(moveInGrid(6, 'ArrowDown')).toBe(6)
    expect(moveInGrid(7, 'Home')).toBe(1)
    expect(moveInGrid(7, 'End')).toBe(9)
    expect(moveInGrid(7, 'Enter')).toBeNull()
  })
})

function setup(compute: (ms: number) => QimenChart = castPenang) {
  const store = createStore<JourneyState>()(() => initialJourneyState())
  let now = FIXTURE_A_MS
  const spy = vi.fn(compute)
  const source = createChartSource({ store, compute: spy, now: () => now, options: PENANG })
  return { store, source, spy, advance: (ms: number) => (now += ms) }
}

describe('chartSource', () => {
  it('live: one cast per 时辰, the same snapshot object until the chart can change', () => {
    const { source, spy, advance } = setup()
    const a = source.getSnapshot()
    expect(a.live).toBe(true)
    expect(a.chart?.pillars.hour.name).toBe('丙戌')
    advance(30 * 60_000)
    expect(source.getSnapshot()).toBe(a)
    expect(spy).toHaveBeenCalledTimes(1)
    advance(90 * 60_000)
    const b = source.getSnapshot()
    expect(b).not.toBe(a)
    expect(b.chart?.pillars.hour.branch).toBe('亥')
  })

  it('a picked moment casts that instant; clearing it goes back to live', () => {
    const { store, source } = setup()
    const picked = Date.parse('2026-01-01T04:00:00Z')
    store.setState({ chartInstantMs: picked })
    const s = source.getSnapshot()
    expect(s).toMatchObject({ live: false, instantMs: picked })
    expect(source.getSnapshot()).toBe(s)
    store.setState({ chartInstantMs: null })
    expect(source.getSnapshot().live).toBe(true)
  })

  it('?now= freezes the live chart', () => {
    const { store, source, advance } = setup()
    store.setState({ nowOverride: Date.parse('2026-01-01T04:00:00Z') })
    const s = source.getSnapshot()
    advance(24 * 3_600_000)
    expect(source.getSnapshot()).toBe(s)
    expect(s.chart?.instantUtc).toBe('2026-01-01T04:00:00Z')
  })

  it('reports engine errors instead of throwing', () => {
    const { source } = setup(() => {
      throw new RangeError('outside the term table')
    })
    expect(source.getSnapshot()).toMatchObject({ chart: null, error: 'outside the term table' })
  })

  it('notifies subscribers when the picked moment changes', () => {
    const { store, source } = setup()
    const cb = vi.fn()
    const stop = source.subscribe(cb)
    store.setState({ chartInstantMs: FIXTURE_A_MS - 7_200_000 })
    expect(cb).toHaveBeenCalled()
    stop()
  })
})
