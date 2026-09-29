import { describe, expect, it } from 'vitest'
import { TRACE_SPEC, generateTraceField } from './traceField'

const small = { width: 512, height: 128, seed: 7 }

describe('CircuitWood trace field', () => {
  it('is deterministic for a seed', () => {
    const a = generateTraceField(small)
    const b = generateTraceField(small)
    expect(Buffer.from(a.data).equals(Buffer.from(b.data))).toBe(true)
    expect(generateTraceField({ ...small, seed: 8 }).data).not.toEqual(a.data)
  })

  it('routes every trace in 0° and 45° steps only', () => {
    const { paths } = generateTraceField(TRACE_SPEC)
    expect(paths.length).toBeGreaterThan(8)
    for (const p of paths) {
      for (let i = 1; i < p.points.length; i++) {
        const [ax, ay] = p.points[i - 1] ?? [0, 0]
        const [bx, by] = p.points[i] ?? [0, 0]
        const dx = bx - ax
        const dy = by - ay
        expect(dx).toBeGreaterThan(0)
        expect(dy === 0 || Math.abs(dy) === dx).toBe(true)
      }
    }
  })

  it('ends each trace at a joint, a knot or a break, and joints sit on the plank ends', () => {
    const { paths, spec } = generateTraceField(TRACE_SPEC)
    for (const p of paths) {
      const first = p.points[0]
      const last = p.points[p.points.length - 1]
      if (p.start === 'joint') expect(first?.[0]).toBe(0)
      if (p.end === 'joint') expect(last?.[0]).toBe(spec.width - 1)
    }
    expect(paths.some((p) => p.start === 'joint' || p.end === 'joint')).toBe(true)
    expect(paths.some((p) => p.start === 'knot' || p.end === 'knot')).toBe(true)
  })

  it('writes coverage, premultiplied distance and via masks into RGBA', () => {
    const { data, spec } = generateTraceField(TRACE_SPEC)
    expect(data.length).toBe(spec.width * spec.height * 4)
    let covered = 0
    let vias = 0
    let bad = 0
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i] ?? 0
      const g = data[i + 1] ?? 0
      if (r > 0) covered++
      if ((data[i + 2] ?? 0) > 200) vias++
      if (g > r) bad++
    }
    const fraction = covered / (spec.width * spec.height)
    // Sparse lines on wood, not a filled board.
    expect(fraction).toBeGreaterThan(0.03)
    expect(fraction).toBeLessThan(0.25)
    expect(vias).toBeGreaterThan(50)
    expect(bad).toBe(0)
  })
})
