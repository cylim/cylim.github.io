import { describe, expect, it } from 'vitest'
import { resolveOptions } from './clock'
import { computeChart } from './index'
import { periodStartMs as startOf, stepPeriodMs as stepOf } from './schedule'
import type { QimenOptions } from './types'

const next = (iso: string, opts: QimenOptions) => computeChart(Date.parse(iso), opts).nextChangeUtc

describe('nextChangeUtc (qimen-spec §12.6)', () => {
  it('is the next odd hour of the basis clock', () => {
    expect(next('2026-09-28T19:30:00+08:00', { utcOffsetMinutes: 480 })).toBe('2026-09-28T13:00:00Z')
    expect(next('2026-09-28T20:59:59+08:00', { utcOffsetMinutes: 480 })).toBe('2026-09-28T13:00:00Z')
    expect(next('2026-09-28T21:00:00+08:00', { utcOffsetMinutes: 480 })).toBe('2026-09-28T15:00:00Z')
  })

  it('crosses midnight in the 子 hour under zi23, stops at 00:00 under split and midnight', () => {
    const at = '2026-09-26T23:30:00+08:00'
    expect(next(at, { utcOffsetMinutes: 480 })).toBe('2026-09-26T17:00:00Z')
    expect(next(at, { utcOffsetMinutes: 480, ziHour: 'split' })).toBe('2026-09-26T16:00:00Z')
    expect(next(at, { utcOffsetMinutes: 480, ziHour: 'midnight' })).toBe('2026-09-26T16:00:00Z')
  })

  it('is the term instant when a term starts first', () => {
    // 秋分 2026 at 08:05:14 +08:00, inside the 辰 hour.
    expect(next('2026-09-23T07:50:00+08:00', { utcOffsetMinutes: 480 })).toBe('2026-09-23T00:05:14Z')
  })

  it('follows a spring-forward jump instead of waiting an extra hour', () => {
    // New York, 2026-03-08: 02:00 EST jumps to 03:00 EDT at 07:00Z. 01:30 is 丑; 03:00 is 寅.
    expect(next('2026-03-08T01:30:00-05:00', { timeZone: 'America/New_York' })).toBe('2026-03-08T07:00:00Z')
  })

  it('waits through a fall-back hour that stays in the same 时辰', () => {
    // New York, 2026-11-01: 02:00 EDT falls back to 01:00 EST at 06:00Z; 丑 lasts until 03:00 EST.
    expect(next('2026-11-01T01:30:00-04:00', { timeZone: 'America/New_York' })).toBe('2026-11-01T08:00:00Z')
  })

  it('lands on the exact second under true solar time', () => {
    const opts: QimenOptions = { timeBasis: 'trueSolar', longitude: 100.3288, utcOffsetMinutes: 480 }
    const at = Date.parse('2026-03-15T10:20:00+08:00')
    const c = computeChart(at, opts)
    const t = Date.parse(c.nextChangeUtc)
    expect(computeChart(t - 1000, opts).pillars.hour.name).toBe('丙辰')
    expect(computeChart(t, opts).pillars.hour.name).toBe('丁巳')
    expect(computeChart(t, opts).basis.local).toBe('2026-03-15T09:00:00')
  })
})

const opts = (timeZone: string, ziHour?: QimenOptions['ziHour']): QimenOptions => ({ timeZone, ziHour })
const stepPeriodMs = (o: QimenOptions, ms: number, steps: number) => stepOf(resolveOptions(o), ms, steps)
const periodStartMs = (o: QimenOptions, ms: number) => startOf(resolveOptions(o), ms)
const iso = (ms: number) => new Date(ms).toISOString().replace('.000Z', 'Z')
const hourAt = (ms: number, o: QimenOptions) => computeChart(ms, o).pillars.hour.name
/** A chart period is a day-and-hour pair: under split, 00:00 turns the day inside 子. */
const periodAt = (ms: number, o: QimenOptions) => {
  const p = computeChart(ms, o).pillars
  return `${p.day.name}${p.hour.name}`
}

describe('stepping by 时辰 (Earlier / Later, the hour slider and marker)', () => {

  it('matches the plain arithmetic on a fixed-offset clock', () => {
    const o: QimenOptions = { utcOffsetMinutes: 480 }
    const t = Date.parse('2026-09-28T19:30:00+08:00')
    expect(iso(stepPeriodMs(o, t, 0))).toBe('2026-09-28T11:00:00Z')
    expect(iso(stepPeriodMs(o, t, 1))).toBe('2026-09-28T13:00:00Z')
    expect(iso(stepPeriodMs(o, t, -1))).toBe('2026-09-28T09:00:00Z')
    expect(stepPeriodMs(o, stepPeriodMs(o, t, 5), -5)).toBe(stepPeriodMs(o, t, 0))
  })

  it('steps over a spring-forward gap that opens at an odd hour (London): 辛丑 stays reachable', () => {
    // 2026-03-29: 01:00 GMT jumps to 02:00 BST at 01:00Z, so 丑 is only 02:00–02:59 BST.
    const o = opts('Europe/London')
    const zi = Date.parse('2026-03-29T00:30:00Z')
    expect(hourAt(zi, o)).toBe('庚子')
    const later = stepPeriodMs(o, zi, 1)
    expect(iso(later)).toBe('2026-03-29T01:00:00Z')
    expect(hourAt(later, o)).toBe('辛丑')
    expect(hourAt(stepPeriodMs(o, zi, 2), o)).toBe('壬寅')
    expect(stepPeriodMs(o, stepPeriodMs(o, zi, 2), -1)).toBe(later)
    expect(iso(stepPeriodMs(o, later, -1))).toBe('2026-03-28T23:00:00Z')
  })

  it('does not stay in the same 时辰 across a fall-back hour (New York)', () => {
    // 2026-11-01: 02:00 EDT falls back to 01:00 EST at 06:00Z; 乙丑 runs 05:00Z–08:00Z.
    const o = opts('America/New_York')
    const t = Date.parse('2026-11-01T02:30:00-05:00')
    expect(iso(periodStartMs(o, t))).toBe('2026-11-01T05:00:00Z')
    const earlier = stepPeriodMs(o, t, -1)
    expect(iso(earlier)).toBe('2026-11-01T03:00:00Z')
    expect(hourAt(earlier, o)).toBe('甲子')
  })

  it('changes the chart period on every step, both ways, through DST nights in several zones', () => {
    const cases: [string, string][] = [
      ['Europe/London', '2026-03-28T20:00:00Z'],
      ['Europe/London', '2026-10-24T20:00:00Z'],
      ['America/New_York', '2026-03-07T20:00:00Z'],
      ['America/New_York', '2026-10-31T20:00:00Z'],
      ['Australia/Lord_Howe', '2026-04-04T08:00:00Z'],
      ['America/St_Johns', '2026-03-07T20:00:00Z'],
    ]
    for (const [zone, start] of cases) {
      for (const ziHour of ['zi23', 'split'] as const) {
        const o = opts(zone, ziHour)
        let t = Date.parse(start)
        const names = [periodAt(t, o)]
        for (let k = 0; k < 12; k++) {
          const later = stepPeriodMs(o, t, 1)
          expect(later, `${zone} ${ziHour} step ${k}`).toBeGreaterThan(t)
          expect(stepPeriodMs(o, later, -1), `${zone} ${ziHour} back ${k}`).toBe(periodStartMs(o, t))
          names.push(periodAt(later, o))
          t = later
        }
        for (let k = 1; k < names.length; k++) expect(names[k], `${zone} ${ziHour} ${k}`).not.toBe(names[k - 1])
      }
    }
  })
})
