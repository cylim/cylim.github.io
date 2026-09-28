// The committed term table equals tyme4ts for every row, and is what the generator writes today.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { termTable } from '../src/lib/qimen/terms'
import { decodeTermSeconds, encodeTermTable } from '../src/lib/qimen/termCodec'
import { FIRST_YEAR, LAST_YEAR, OUT_PATH, YEAR_SECONDS, renderTermModule, tymeTermSeconds } from './build-terms.mts'

describe('scripts/build-terms', () => {
  const tyme = tymeTermSeconds()

  it(`decodes to tyme4ts exactly, to the second, for all ${(LAST_YEAR - FIRST_YEAR + 1) * 24} rows`, () => {
    const rows = termTable()
    expect(rows).toHaveLength(tyme.length)
    const mismatches = rows.filter((r, i) => r.startMs !== tyme[i]! * 1000 || r.index !== i % 24)
    expect(mismatches).toEqual([])
  })

  it('committed termData.ts is up to date', () => {
    const data = encodeTermTable(tyme, FIRST_YEAR, YEAR_SECONDS)
    expect(decodeTermSeconds(data)).toEqual(tyme)
    expect(readFileSync(OUT_PATH, 'utf8')).toBe(renderTermModule(data))
  })
})
