import { describe, expect, it } from 'vitest'
import { Color, SRGBColorSpace } from 'three'
import { color } from '../../../theme/tokens'
import { agx, agxInverse } from './tone'
import { emblemPlan, hashName } from './scroll/emblem'

const hexThroughAgx = (c: Color) => {
  const [r, g, b] = agx([c.r, c.g, c.b])
  return `#${new Color(r, g, b).getHexString(SRGBColorSpace)}`.toUpperCase()
}

describe('AgX pre-compensation', () => {
  it.each(['night', 'cinnabar', 'cyanGhost', 'paper', 'inkNong'] as const)('lands %s exactly on its token after the cabin grade', (key) => {
    expect(hexThroughAgx(agxInverse(color[key]))).toBe(color[key].toUpperCase())
  })

  it('keeps cinnabar under the bloom threshold, so the desk seal never glows', () => {
    const c = agxInverse(color.cinnabar)
    expect(0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b).toBeLessThan(0.9)
  })

  it('shows why it is needed: raw night comes out of AgX darker and bluer', () => {
    const raw = new Color().setStyle(color.night, SRGBColorSpace)
    expect(hexThroughAgx(raw)).not.toBe(color.night.toUpperCase())
  })
})

describe('scroll emblems', () => {
  it('is seeded by the project name and stable', () => {
    expect(hashName('OripaX')).toBe(hashName('OripaX'))
    expect(emblemPlan('OripaX')).toEqual(emblemPlan('OripaX'))
    expect(emblemPlan('OripaX')).not.toEqual(emblemPlan('JRNY'))
  })

  it('draws spokes only at multiples of 45° and a mirrored chip', () => {
    for (const name of ['OripaX', 'JRNY', 'Cosmos insights platform', 'Terra swap and invest app']) {
      const plan = emblemPlan(name)
      expect(plan.spokes.length).toBeGreaterThanOrEqual(3)
      for (const s of plan.spokes) expect(Number.isInteger(s) && s >= 0 && s < 8).toBe(true)
      for (let r = 0; r < 5; r++) {
        const row = plan.pads.slice(r * 5, r * 5 + 5)
        expect(row).toEqual(row.toReversed())
      }
    }
  })
})
