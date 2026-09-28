import { describe, expect, it } from 'vitest'
import { color, inkRamp } from '../../../theme/tokens'
import { makeInkRamp, makeInkRampData } from './inkRamp'
import { generatePaperGrain } from './paperGrain'
import { SRGBColorSpace } from 'three'

const hex = (d: Uint8Array, i: number) =>
  `#${[d[i * 4], d[i * 4 + 1], d[i * 4 + 2]].map((v) => (v ?? 0).toString(16).padStart(2, '0')).join('')}`.toUpperCase()

describe('ink ramp', () => {
  it('lands every stop on its palette hex', () => {
    const data = makeInkRampData(inkRamp, 256)
    expect(hex(data, 0)).toBe(color.inkJiao)
    expect(hex(data, 255)).toBe(color.paper)
    for (const [stop, h] of inkRamp) {
      const i = Math.round(stop * 255)
      // Stops that fall between texels are within one lerp step of the token.
      const [r, g, b] = [1, 3, 5].map((k) => Number.parseInt(h.slice(k, k + 2), 16))
      expect(Math.abs((data[i * 4] ?? 0) - (r ?? 0))).toBeLessThanOrEqual(3)
      expect(Math.abs((data[i * 4 + 1] ?? 0) - (g ?? 0))).toBeLessThanOrEqual(3)
      expect(Math.abs((data[i * 4 + 2] ?? 0) - (b ?? 0))).toBeLessThanOrEqual(3)
    }
  })

  it('is monotonic from ink to paper', () => {
    const data = makeInkRampData()
    for (let i = 1; i < 256; i++) expect(data[i * 4 + 1] ?? 0).toBeGreaterThanOrEqual(data[(i - 1) * 4 + 1] ?? 0)
  })

  it('is an sRGB texture, so the shader samples linear values', () => {
    expect(makeInkRamp().colorSpace).toBe(SRGBColorSpace)
  })
})

describe('paper grain', () => {
  const size = 128
  const data = generatePaperGrain(size, 7)

  const channel = (c: number) => {
    const out = new Float64Array(size * size)
    for (let i = 0; i < out.length; i++) out[i] = (data[i * 4 + c] ?? 0) / 255
    return out
  }

  it('is deterministic', () => {
    expect(generatePaperGrain(size, 7)).toEqual(data)
    expect(generatePaperGrain(size, 8)).not.toEqual(data)
  })

  it('keeps every channel centred on 0.5, so paper stays the paper token on average', () => {
    for (const c of [0, 1, 2]) {
      const v = channel(c)
      const mean = v.reduce((a, b) => a + b, 0) / v.length
      expect(Math.abs(mean - 0.5)).toBeLessThan(0.01)
    }
  })

  it('tiles: the step across the wrap is no bigger than a typical step inside', () => {
    for (const c of [0, 1, 2]) {
      const v = channel(c)
      const at = (x: number, y: number) => v[(((y % size) + size) % size) * size + (((x % size) + size) % size)] ?? 0
      const step = (x: number) => {
        let sum = 0
        for (let y = 0; y < size; y++) sum += Math.abs(at(x, y) - at(x + 1, y)) + Math.abs(at(y, x) - at(y, x + 1))
        return sum
      }
      let typical = 0
      for (let x = 0; x < size - 1; x++) typical += step(x) / (size - 1)
      expect(step(size - 1)).toBeLessThan(typical * 2.5 + 0.5)
    }
  })
})
