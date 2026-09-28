import { describe, expect, it } from 'vitest'
import { hall } from '../../../core/world/layout'
import { STAR_MIN_DISTANCE, shellStars } from './stars'

describe('night shell points', () => {
  const stars = shellStars()

  it('places about 300 points, all at least 20 m from the walk', () => {
    expect(stars.length).toBeGreaterThanOrEqual(280)
    for (const { position: [x, y, z] } of stars) {
      const dz = Math.max(hall.backWall.z, Math.min(hall.floor.zNorth, z)) - z
      expect(Math.hypot(x - hall.centreLineX, y - 2, dz)).toBeGreaterThanOrEqual(STAR_MIN_DISTANCE)
    }
  })

  it('stays inside the shell', () => {
    const s = hall.nightShell
    for (const { position: [x, y, z] } of stars) {
      expect(x).toBeGreaterThanOrEqual(s.x0)
      expect(x).toBeLessThanOrEqual(s.x1)
      expect(y).toBeGreaterThanOrEqual(s.y0)
      expect(y).toBeLessThanOrEqual(s.y1)
      expect(z).toBeGreaterThanOrEqual(s.zSouth)
      expect(z).toBeLessThanOrEqual(s.zNorth)
    }
  })

  it('is never a grid: spacing between neighbours varies widely', () => {
    const nearest = stars.map((a) =>
      Math.min(...stars.filter((b) => b !== a).map((b) => Math.hypot(a.position[0] - b.position[0], a.position[1] - b.position[1], a.position[2] - b.position[2]))),
    )
    const mean = nearest.reduce((s, d) => s + d, 0) / nearest.length
    const sd = Math.sqrt(nearest.reduce((s, d) => s + (d - mean) ** 2, 0) / nearest.length)
    expect(sd / mean).toBeGreaterThan(0.25)
  })
})
