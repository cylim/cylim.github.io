/**
 * Compact encoding of the solar-term table (qimen-spec.md §4.3, §14.2). Shared by
 * scripts/build-terms.mts, which writes termData.ts, and terms.ts, which decodes it at runtime.
 *
 * No runtime imports on purpose: the generator imports this file directly under Node's type
 * stripping, which cannot resolve the extensionless specifiers the rest of src/ uses.
 *
 * Format. Row i is the i-th term start after the first, in epoch seconds (UTC). Rows run in
 * order with no gaps, so row i has term index i mod 24 (0 = 冬至).
 * - `anchor` holds rows 0..23 as absolute seconds.
 * - Each later row is stored as its distance from the same term one year earlier, minus a
 *   nominal year: `t[i] − t[i − 24] − yearSeconds`. That residual stays within about ±1000 s
 *   (lunar and planetary perturbations, nutation and ΔT), so two base-64 digits hold it.
 * - `years[k]` is one string per calendar row-year: 24 residuals × 2 characters.
 */

export interface TermTableData {
  /** Row 0 is tyme4ts `SolarTerm.fromIndex(firstYear, 0)`: the 冬至 of December firstYear − 1. */
  readonly firstYear: number
  /** Nominal tropical year in seconds, subtracted before encoding. */
  readonly yearSeconds: number
  /** Rows 0..23, epoch seconds. */
  readonly anchor: readonly number[]
  /** Rows 24 onward, 24 per string, two base-64 digits per row. */
  readonly years: readonly string[]
}

const DIGITS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
const BIAS = 2048
const RANGE = 64 * 64

const digitValue = new Int8Array(128).fill(-1)
for (let i = 0; i < DIGITS.length; i++) digitValue[DIGITS.charCodeAt(i)] = i

/** Encode a gap-free run of term starts (epoch seconds, row 0 a 冬至). Throws if a residual overflows. */
export function encodeTermTable(seconds: readonly number[], firstYear: number, yearSeconds: number): TermTableData {
  if (seconds.length < 24 || seconds.length % 24 !== 0) throw new RangeError('term table needs whole years of 24 rows')
  const anchor = seconds.slice(0, 24)
  const years: string[] = []
  for (let y = 24; y < seconds.length; y += 24) {
    let line = ''
    for (let i = y; i < y + 24; i++) {
      const v = (seconds[i] as number) - (seconds[i - 24] as number) - yearSeconds + BIAS
      if (!Number.isInteger(v) || v < 0 || v >= RANGE) throw new RangeError(`term residual out of range at row ${i}: ${v - BIAS}`)
      line += DIGITS[v >> 6]! + DIGITS[v & 63]!
    }
    years.push(line)
  }
  return { firstYear, yearSeconds, anchor, years }
}

/** Decode to epoch seconds, row 0 first. */
export function decodeTermSeconds(data: TermTableData): number[] {
  const out = data.anchor.slice()
  for (const line of data.years) {
    if (line.length !== 48) throw new RangeError('term table: each year string holds 24 rows')
    for (let j = 0; j < 48; j += 2) {
      const hi = digitValue[line.charCodeAt(j)] ?? -1
      const lo = digitValue[line.charCodeAt(j + 1)] ?? -1
      if (hi < 0 || lo < 0) throw new RangeError('term table: bad digit')
      out.push((out[out.length - 24] as number) + data.yearSeconds + hi * 64 + lo - BIAS)
    }
  }
  return out
}
