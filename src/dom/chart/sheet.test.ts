import { afterEach, describe, expect, it } from 'vitest'
import { journey } from '../../core/store/journey'
import { selectFromGrid, selectedInScene } from './selection'
import { SHEET_OPEN, SHEET_PEEK, releaseVelocity, snapSheet } from './sheetDrag'

describe('the phone chart sheet (design.md §8.6)', () => {
  const vh = 800
  it('settles on the nearer rest height', () => {
    expect(snapSheet(SHEET_PEEK * vh + 40, 0, vh)).toBe('peek')
    expect(snapSheet(SHEET_OPEN * vh - 40, 0, vh)).toBe('open')
  })

  it('follows a flick whatever the height', () => {
    expect(snapSheet(SHEET_PEEK * vh + 10, -0.8, vh)).toBe('open')
    expect(snapSheet(SHEET_OPEN * vh - 10, 0.8, vh)).toBe('peek')
  })

  it('measures the flick from the last moves, and not at all after a pause', () => {
    const moves = [
      { y: 100, t: 0 },
      { y: 120, t: 16 },
      { y: 160, t: 32 },
      { y: 220, t: 48 },
    ]
    expect(releaseVelocity(moves, 60)).toBeCloseTo(120 / 48)
    expect(releaseVelocity(moves, 400)).toBe(0)
    // Moves slower than the window still pair the last two.
    expect(releaseVelocity([{ y: 0, t: 0 }, { y: 100, t: 200 }], 210)).toBeCloseTo(0.5)
    expect(releaseVelocity([], 10)).toBe(0)
  })
})

describe('palace selection shared with the grove scene (design.md §9.7)', () => {
  afterEach(() => journey.setState({ selectedPalace: null }))

  it('tells the grid’s own selections from the scene’s', () => {
    selectFromGrid(4)
    expect(journey.getState().selectedPalace).toBe(4)
    expect(selectedInScene(4)).toBe(false)
    expect(selectedInScene(9)).toBe(true)
    // After the scene took over, the scene picking the grid's old palace is still the scene's.
    expect(selectedInScene(4)).toBe(true)
    expect(selectedInScene(null)).toBe(false)
  })
})
