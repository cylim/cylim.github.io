import { describe, expect, it } from 'vitest'
import { computeChart } from '../qimen/index'
import { localStamp, shichenAt, shiftShichen } from './shichen'

const KL = { timeZone: 'Asia/Kuala_Lumpur' } as const

describe('shichenAt', () => {
  it('fixture A: 戌 hour, 19:00 to 20:59, next turn 21:00', () => {
    const s = shichenAt(Date.parse('2026-09-28T19:30:00+08:00'), KL)
    expect(s).toMatchObject({ branch: '戌', branchIndex: 10, start: '19:00', end: '20:59', next: '21:00', offsetMinutes: 480 })
    expect(s.hour.name).toBe('丙戌')
    expect(new Date(s.startMs).toISOString()).toBe('2026-09-28T11:00:00.000Z')
    expect(new Date(s.nextMs).toISOString()).toBe('2026-09-28T13:00:00.000Z')
  })

  it('agrees with the chart on the hour and the next turn when no term intervenes', () => {
    for (let t = Date.parse('2026-09-28T00:00:00+08:00'); t < Date.parse('2026-09-30T00:00:00+08:00'); t += 37 * 60e3) {
      const s = shichenAt(t, KL)
      const c = computeChart(t, KL)
      expect(s.hour).toEqual(c.pillars.hour)
      expect(new Date(s.nextMs).toISOString().replace('.000', '')).toBe(c.nextChangeUtc)
    }
  })

  it('spans midnight for 子 under zi23; splits it under split', () => {
    const late = Date.parse('2026-09-28T23:30:00+08:00')
    expect(shichenAt(late, KL)).toMatchObject({ branch: '子', start: '23:00', end: '00:59', next: '01:00' })
    expect(shichenAt(late, { ...KL, ziHour: 'split' })).toMatchObject({ branch: '子', start: '23:00', end: '23:59', next: '00:00' })
    const early = Date.parse('2026-09-29T00:30:00+08:00')
    expect(shichenAt(early, KL)).toMatchObject({ start: '23:00', end: '00:59' })
    expect(shichenAt(early, { ...KL, ziHour: 'midnight' })).toMatchObject({ start: '00:00', end: '00:59', next: '01:00' })
  })

  it('follows DST: New York spring forward', () => {
    const s = shichenAt(Date.parse('2026-03-08T01:30:00-05:00'), { timeZone: 'America/New_York' })
    expect(s).toMatchObject({ branch: '丑', start: '01:00', next: '03:00' })
    expect(new Date(s.nextMs).toISOString()).toBe('2026-03-08T07:00:00.000Z')
  })
})

describe('shiftShichen', () => {
  const t = Date.parse('2026-09-28T19:30:00+08:00')

  it('steps one 时辰 each way and lands on its start', () => {
    expect(new Date(shiftShichen(t, 1, KL)).toISOString()).toBe('2026-09-28T13:00:00.000Z')
    expect(new Date(shiftShichen(t, -1, KL)).toISOString()).toBe('2026-09-28T09:00:00.000Z')
    expect(new Date(shiftShichen(t, 0, KL)).toISOString()).toBe('2026-09-28T11:00:00.000Z')
    expect(shichenAt(shiftShichen(t, 12, KL), KL).hour.name).toBe('戊戌')
    expect(shiftShichen(shiftShichen(t, 5, KL), -5, KL)).toBe(shiftShichen(t, 0, KL))
  })

  it('walks the twelve branches in order across a day', () => {
    const branches: string[] = []
    for (let k = 0; k < 12; k++) branches.push(shichenAt(shiftShichen(t, k, KL), KL).branch)
    expect(branches.join('')).toBe('戌亥子丑寅卯辰巳午未申酉')
  })

  // qimen QM-2: taking wall time off at the current offset got stuck or skipped on DST nights.
  it('never stays in the same period across a DST change', () => {
    const london = { timeZone: 'Europe/London' }
    const springLondon = Date.parse('2026-03-29T00:30:00Z')
    expect(new Date(shiftShichen(springLondon, 1, london)).toISOString()).toBe('2026-03-29T01:00:00.000Z')
    expect(shichenAt(shiftShichen(springLondon, 1, london), london).branch).toBe('丑')
    const ny = { timeZone: 'America/New_York' }
    const fallNy = Date.parse('2026-11-01T07:30:00Z')
    expect(new Date(shiftShichen(fallNy, -1, ny)).toISOString()).toBe('2026-11-01T03:00:00.000Z')
    expect(shichenAt(shiftShichen(fallNy, -1, ny), ny).branch).toBe('子')
    for (const [zone, at] of [['Europe/London', springLondon], ['America/New_York', fallNy]] as const) {
      const o = { timeZone: zone }
      for (let k = -8; k < 8; k++) {
        const a = shiftShichen(at, k, o)
        const b = shiftShichen(at, k + 1, o)
        expect(b, `${zone} ${k}`).toBeGreaterThan(a)
        expect(shichenAt(a, o).startMs, `${zone} ${k}`).toBe(a)
      }
    }
  })
})

describe('localStamp', () => {
  it('formats the basis wall clock', () => {
    expect(localStamp(Date.parse('2026-09-28T14:05:30+08:00'), KL)).toEqual({ date: '2026-09-28', time: '14:05', dateTime: '2026-09-28 14:05' })
    expect(localStamp(Date.parse('2026-09-28T14:05:30+08:00'), { timeZone: 'Europe/London' }).dateTime).toBe('2026-09-28 07:05')
  })
})
