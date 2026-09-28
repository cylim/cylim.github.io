/**
 * The two clocks of qimen-spec.md §3: the absolute instant (terms, year, month) and the basis
 * wall clock (day and hour pillars). Wall fields come from shifting epoch milliseconds and
 * reading the UTC getters, never from `new Date(y, m, d, h)`, which would apply the browser's
 * own zone and fall into its DST gaps.
 */

import type { QimenOptions, ResolvedOptions, Wall } from './types'

export function deviceTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}

export function resolveOptions(opts: QimenOptions = {}): ResolvedOptions {
  return {
    timeZone: opts.utcOffsetMinutes != null ? null : (opts.timeZone ?? deviceTimeZone()),
    utcOffsetMinutes: opts.utcOffsetMinutes ?? null,
    timeBasis: opts.timeBasis ?? 'civil',
    longitude: opts.longitude ?? null,
    ziHour: opts.ziHour ?? 'zi23',
    deityNames: opts.deityNames ?? 'huXuan',
  }
}

const formatters = new Map<string, Intl.DateTimeFormat>()

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone)
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      era: 'short',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    })
    formatters.set(timeZone, f)
  }
  return f
}

/**
 * UTC offset in minutes east of an IANA zone at an instant, DST included. Not rounded: historical
 * offsets carry seconds (Africa/Monrovia −0:44:30 until 1972, America/St_Johns −3:30:52 before
 * 1935), and a whole-minute offset would put the wall clock, and so the hour pillar, up to 30 s off.
 */
export function offsetMinutesFor(instantMs: number, timeZone: string): number {
  const p: Record<string, string> = {}
  for (const part of formatterFor(timeZone).formatToParts(new Date(instantMs))) p[part.type] = part.value
  const year = p.era === 'BC' ? 1 - Number(p.year) : Number(p.year)
  const wallAsUtc = Date.UTC(year, Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute), Number(p.second))
  return (wallAsUtc - Math.floor(instantMs / 1000) * 1000) / 60000
}

/** NOAA equation of time in minutes (§3.4), good to about a minute. */
export function equationOfTimeMin(instantMs: number): number {
  const d = new Date(instantMs)
  const doy = Math.floor((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - Date.UTC(d.getUTCFullYear(), 0, 1)) / 86400000) + 1
  const hr = d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600
  const g = ((2 * Math.PI) / 365) * (doy - 1 + (hr - 12) / 24)
  return 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g))
}

/** Basis − UTC in minutes at an instant (§3.3). Fractional for 'trueSolar'. */
export function basisOffsetMinutes(instantMs: number, o: ResolvedOptions): number {
  if (o.timeBasis === 'trueSolar') {
    if (o.longitude == null) throw new RangeError('timeBasis trueSolar needs a longitude')
    return 4 * o.longitude + equationOfTimeMin(instantMs)
  }
  if (o.utcOffsetMinutes != null) return o.utcOffsetMinutes
  const zone = o.timeZone ?? deviceTimeZone()
  if (o.timeBasis === 'standard') {
    const y = new Date(instantMs).getUTCFullYear()
    return Math.min(offsetMinutesFor(Date.UTC(y, 0, 1), zone), offsetMinutesFor(Date.UTC(y, 6, 1), zone))
  }
  return offsetMinutesFor(instantMs, zone)
}

export function wallOf(ms: number): Wall {
  const d = new Date(ms)
  return { y: d.getUTCFullYear(), mo: d.getUTCMonth() + 1, d: d.getUTCDate(), h: d.getUTCHours(), mi: d.getUTCMinutes(), s: d.getUTCSeconds() }
}

/** Wall fields read as if they were UTC, in ms. The inverse of `wallOf`. */
export const wallMs = (w: Wall): number => Date.UTC(w.y, w.mo - 1, w.d, w.h, w.mi, w.s)

/** Whole days since 1970-01-01 of the wall date. */
export const wallDays = (w: Wall): number => Date.UTC(w.y, w.mo - 1, w.d) / 86400000

export interface BasisClock {
  wall: Wall
  offsetMinutes: number
  /** The instant truncated to the second: every wall field and boundary derives from it. */
  instantS: number
}

/** The wall clock that drives the day and hour pillars. */
export function basisClock(instantMs: number, o: ResolvedOptions): BasisClock {
  const offsetMinutes = basisOffsetMinutes(instantMs, o)
  const instantS = Math.floor(instantMs / 1000) * 1000
  return { wall: wallOf(instantS + Math.round(offsetMinutes * 60000)), offsetMinutes, instantS }
}

const pad = (x: number, n = 2): string => String(x).padStart(n, '0')

/** `YYYY-MM-DDTHH:mm:ss`, no zone suffix. */
export const formatWall = (w: Wall): string => `${pad(w.y, 4)}-${pad(w.mo)}-${pad(w.d)}T${pad(w.h)}:${pad(w.mi)}:${pad(w.s)}`

/** ISO 8601 UTC, milliseconds dropped when zero, e.g. 2026-09-28T11:00:00Z. */
export const isoUtc = (ms: number): string => new Date(ms).toISOString().replace('.000Z', 'Z')
