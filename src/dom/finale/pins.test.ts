import { describe, expect, it } from 'vitest'
import { PIN_GAP, leaderOf, placePins, speckKeepOut, type PinPlacement, type PinSize } from './pins'
import { finaleWindow } from './window'

const sizes: Record<string, PinSize> = { cabin: { w: 51, h: 44 }, grove: { w: 55, h: 44 }, threshold: { w: 47, h: 44 } }

const box = (p: { x: number; y: number }, pl: PinPlacement) => {
  const s = sizes[pl.id] as PinSize
  return { left: p.x + pl.dx, top: p.y + pl.dy, right: p.x + pl.dx + s.w, bottom: p.y + pl.dy + s.h }
}
const overlap = (a: ReturnType<typeof box>, b: ReturnType<typeof box>) =>
  a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom

describe('E3 map pin labels (design.md §8.7, wave-2 L1)', () => {
  it('puts a lone pin above-right of its dot, clear of it', () => {
    const [pl] = placePins([{ id: 'grove', x: 400, y: 400 }], sizes, finaleWindow(1280, 800))
    expect(pl).toEqual({ id: 'grove', dx: PIN_GAP, dy: -PIN_GAP - 44, side: 'ne', lift: 0 })
  })

  it('separates Start from Work when the meadow projects just above the cabin (phone, 390×844)', () => {
    const work = { id: 'cabin', x: 184.1, y: 422.3 }
    const grove = { id: 'grove', x: 214.8, y: 566.8 }
    const start = { id: 'threshold', x: 197.9, y: 395.5 }
    const win = { ...finaleWindow(390, 844), top: 300 }
    const placed = placePins([work, grove, start], sizes, win, [speckKeepOut(work)])
    expect(placed.map((p) => p.id)).toEqual(['cabin', 'grove', 'threshold'])
    const at = { cabin: work, grove, threshold: start } as const
    const boxes = placed.map((p) => box(at[p.id as keyof typeof at], p))
    for (let i = 0; i < boxes.length; i++)
      for (let j = i + 1; j < boxes.length; j++) expect(overlap(boxes[i]!, boxes[j]!)).toBe(false)
    // No label on another pin's dot or on the cabin's cyan speck.
    const speck = speckKeepOut(work)
    for (const b of boxes) {
      expect(overlap(b, speck)).toBe(false)
      for (const p of [work, grove, start]) expect(p.x > b.left && p.x < b.right && p.y > b.top && p.y < b.bottom).toBe(false)
    }
  })

  it('separates them on desktop too (about 37 px apart)', () => {
    const work = { id: 'cabin', x: 617, y: 266 }
    const start = { id: 'threshold', x: 634, y: 229 }
    const placed = placePins([work, start], sizes, finaleWindow(1280, 800), [speckKeepOut(work)])
    expect(placed).toHaveLength(2)
    const [w, s] = placed as [PinPlacement, PinPlacement]
    expect(overlap(box(work, w), box(start, s))).toBe(false)
  })

  it('lifts a label and ties it back with a leader when every corner is taken', () => {
    // A band of obstacles just above the point and everything below it: only a lifted spot is clear.
    const blocked = [
      { left: 540, top: 262, right: 740, bottom: 296 },
      { left: 540, top: 304, right: 740, bottom: 400 },
    ]
    const [s] = placePins([{ id: 'threshold', x: 640, y: 300 }], sizes, finaleWindow(1280, 800), blocked)
    expect(s).toMatchObject({ side: 'ne', lift: 36 })
    const leader = leaderOf(s!, sizes.threshold!)
    expect(leader.length).toBeGreaterThan(PIN_GAP + 36)
    expect(leader.angle).toBeLessThan(0)
  })

  it('hides the lesser pin when it has nowhere to go, and keeps labels inside the window', () => {
    const win = { left: 0, top: 0, right: 120, bottom: 100 }
    const placed = placePins(
      [
        { id: 'cabin', x: 60, y: 55 },
        { id: 'threshold', x: 62, y: 57 },
      ],
      sizes,
      win,
    )
    expect(placed.map((p) => p.id)).toEqual(['cabin'])
    const b = box({ x: 60, y: 55 }, placed[0]!)
    expect(b.left >= 0 && b.top >= 0 && b.right <= 120 && b.bottom <= 100).toBe(true)
  })
})
