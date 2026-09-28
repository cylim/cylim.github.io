import { describe, expect, it } from 'vitest'
import { stillAt } from '../album/LostStill'
import { finaleWindow, insideWindow } from './window'

describe('the finale window (design.md §8.7 E2)', () => {
  it('leaves a centred 3:4 window between the mounts on landscape screens, under the header', () => {
    const w = finaleWindow(1280, 800)
    expect(w.right - w.left).toBeCloseTo(600)
    expect(w.left).toBeCloseTo(340)
    expect(w.top).toBe(56)
    expect(w.bottom).toBe(800)
  })

  it('keeps a 12 px border on portrait screens, above the phone bar', () => {
    expect(finaleWindow(390, 844)).toEqual({ left: 12, top: 12, right: 378, bottom: 788 })
    expect(finaleWindow(820, 1180)).toMatchObject({ left: 12, right: 808 })
  })

  it('shows a pin only inside the window, with a margin', () => {
    const w = finaleWindow(1280, 800)
    expect(insideWindow({ x: 640, y: 400 }, w)).toBe(true)
    expect(insideWindow({ x: 345, y: 400 }, w)).toBe(false)
    expect(insideWindow({ x: 640, y: 60 }, w)).toBe(false)
    expect(insideWindow({ x: 1000, y: 400 }, w)).toBe(false)
  })
})

describe('the still behind a lost canvas (design.md §13.3)', () => {
  it('follows the stretch of the walk, with painted mist on the path and in the grove', () => {
    expect(stillAt(0)).toBe('T0')
    expect(stillAt(200)).toBe('T0')
    expect(stillAt(300)).toBe('C3')
    expect(stillAt(345)).toBe('I1')
    expect(stillAt(700)).toBeNull()
    expect(stillAt(900)).toBe('E1')
    expect(stillAt(995)).toBe('E3')
  })
})
