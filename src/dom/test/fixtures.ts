import { chartOptions } from '../../content'
import { computeChart } from '../../lib/qimen'
import type { QimenChart } from '../../lib/qimen/types'

/** Test helpers only. Fixture A (design.md Appendix D): Monday 28 September 2026, 19:05 in Penang. */
export const FIXTURE_A_MS = Date.parse('2026-09-28T19:05:00+08:00')
export const PENANG = { ...chartOptions, timeZone: 'Asia/Kuala_Lumpur' } as const

export const castPenang = (ms: number): QimenChart => computeChart(ms, PENANG)
export const fixtureA = (): QimenChart => castPenang(FIXTURE_A_MS)
