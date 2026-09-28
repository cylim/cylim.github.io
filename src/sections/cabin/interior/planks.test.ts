import { describe, expect, it } from 'vitest'
import { hall } from '../../../core/world/layout'
import { hallPlanks } from './planks'

describe('hall planks', () => {
  const planks = hallPlanks()

  it('is deterministic and stays inside the instancing budget', () => {
    expect(hallPlanks()).toEqual(planks)
    expect(planks.length).toBeGreaterThan(900)
    expect(planks.length).toBeLessThan(2000)
  })

  it('covers the floor from the door to the back wall', () => {
    const floor = planks.filter((p) => Math.abs(p.position[1] - (hall.floor.y - 0.02)) < 1e-6)
    const minZ = Math.min(...floor.map((p) => p.position[2] - p.scale[0] / 2))
    const maxZ = Math.max(...floor.map((p) => p.position[2] + p.scale[0] / 2))
    expect(maxZ).toBeCloseTo(hall.floor.zNorth, 5)
    expect(minZ).toBeGreaterThanOrEqual(hall.floor.zSouth - 1e-6)
    expect(minZ).toBeLessThan(hall.floor.zSouth + 0.05)
  })

  it('keeps every piece within one texture length so joints land on joint pads', () => {
    for (const p of planks) {
      expect(p.scale[0]).toBeLessThanOrEqual(2.4 + 1e-9)
      expect(Math.abs(p.uv[2])).toBeLessThanOrEqual(1)
    }
  })

  it('lets the walls come apart only in the dissolve zone, and bob only there', () => {
    const drifting = planks.filter((p) => p.meta[1] > 0)
    expect(drifting.length).toBeGreaterThan(50)
    for (const p of drifting) {
      expect(p.position[2]).toBeLessThan(hall.dissolve.zNorth)
      expect(p.position[2]).toBeGreaterThan(hall.dissolve.zSouth - 1)
    }
    // In the honest room every wall plank sits exactly on its wall line.
    const honestWalls = planks.filter((p) => p.meta[1] === 0 && p.position[2] > hall.nearRoom.zSouth && Math.abs(p.position[1] - hall.nearRoom.ceilingY) > 0.1)
    for (const plank of honestWalls.filter((p) => p.meta[0] > 0)) expect([hall.nearRoom.x0, hall.nearRoom.x1]).toContain(plank.position[0])
  })
})
