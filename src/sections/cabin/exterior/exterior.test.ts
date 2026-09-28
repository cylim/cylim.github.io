import { Box3, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { MARKS } from '../../../core/world/journey'
import { cabin } from '../../../core/world/layout'
import inkFrag from '../../../env/glsl/ink.frag.glsl'
import { DOOR_LEAF, DOOR_MAX_ANGLE, doorAngle, doorClear, doorInteractive, floorSpill, maskFullScreen, portalOn, spillAmount } from './door'
import { buildSpillStrip, leakBoxMatrix } from './geometry'
import { gableHalfWidth, latticeBars, PLANK, plankCourses, RIDGE_Y, wallPlanks, WALLS } from './layout'
import { PLANK_RIM_ANCHORS } from './materials'

const { footprint, door, eavesY, floorY, latticeWindow } = cabin

describe('the door over the walk', () => {
  it('is shut until the swing, fully open after it, and eases through', () => {
    const [a, b] = MARKS.doorSwing
    expect(doorAngle(a - 10)).toBe(0)
    expect(doorAngle(a)).toBe(0)
    expect(doorAngle(b)).toBeCloseTo(DOOR_MAX_ANGLE)
    expect(doorAngle(b + 30)).toBeCloseTo((95 * Math.PI) / 180)
    expect(doorAngle((a + b) / 2)).toBeCloseTo(DOOR_MAX_ANGLE / 2)
    for (let j = a; j < b; j += 0.5) expect(doorAngle(j + 0.5)).toBeGreaterThanOrEqual(doorAngle(j))
  })

  it('lets light out in proportion to the gap', () => {
    expect(doorClear(0)).toBe(0)
    expect(spillAmount(0)).toBe(0)
    expect(floorSpill(0)).toBe(0)
    expect(doorClear(DOOR_MAX_ANGLE)).toBe(1)
    expect(spillAmount(DOOR_MAX_ANGLE)).toBe(1)
    // A crack already throws a full-strength (narrow) wedge on the floor.
    expect(floorSpill((25 * Math.PI) / 180)).toBe(1)
    expect(doorClear((20 * Math.PI) / 180)).toBeGreaterThan(0.3)
  })

  it('writes the portal stencil from the portal mark until the moon-gate swap', () => {
    expect(portalOn(MARKS.doorPortalOn - 0.1)).toBe(false)
    expect(portalOn(MARKS.doorPortalOn)).toBe(true)
    expect(portalOn(MARKS.doorSwing[0])).toBe(true)
    expect(portalOn(MARKS.stageSwap - 0.1)).toBe(true)
    expect(portalOn(MARKS.stageSwap)).toBe(false)
  })

  it('turns the mask full-screen only when the doorway fills the view, and inside', () => {
    expect(maskFullScreen({ x: 8, y: 2.3, z: -52.6 }, false)).toBe(false)
    expect(maskFullScreen({ x: 4, y: 1.65, z: -59 }, false)).toBe(false)
    expect(maskFullScreen({ x: 4, y: 1.65, z: -59.8 }, false)).toBe(true)
    expect(maskFullScreen({ x: 4.1, y: 1.7, z: -60.2 }, false)).toBe(true)
    expect(maskFullScreen({ x: 5.2, y: 1.65, z: -59.8 }, false)).toBe(false)
    expect(maskFullScreen({ x: 4, y: 2.3, z: -80 }, true)).toBe(true)
  })

  it('answers hover and click only before the camera reaches the door', () => {
    expect(doorInteractive(262, false)).toBe(true)
    expect(doorInteractive(MARKS.doorClickTarget, false)).toBe(false)
    expect(doorInteractive(300, true)).toBe(false)
  })

  it('hangs the leaf in the opening with a 2 cm gap under it', () => {
    expect(DOOR_LEAF.hinge[0]).toBeCloseTo(door.centre[0] - door.width / 2)
    expect(DOOR_LEAF.hinge[1] - floorY).toBeCloseTo(0.02)
    expect(DOOR_LEAF.hinge[1] + DOOR_LEAF.height).toBeLessThan(floorY + door.height)
    expect(DOOR_LEAF.hinge[2]).toBeLessThan(door.planeZ)
  })
})

describe('the plank shell', () => {
  const planks = wallPlanks()
  const courses = plankCourses()

  it('runs 0.22 m courses with 6–10 mm gaps from the floor', () => {
    expect(courses[0]?.y0).toBe(floorY)
    for (let i = 1; i < courses.length; i++) {
      const prev = courses[i - 1]
      const cur = courses[i]
      if (!prev || !cur) continue
      const gap = cur.y0 - (prev.y0 + prev.h)
      expect(gap).toBeGreaterThanOrEqual(PLANK.gapMin - 1e-9)
      expect(gap).toBeLessThanOrEqual(PLANK.gapMax + 1e-9)
    }
  })

  it('keeps every plank on the footprint, pushed out at most 1 cm', () => {
    expect(planks.length).toBeGreaterThan(80)
    expect(planks.length).toBeLessThan(300)
    for (const p of planks) {
      const [x, , z] = p.centre
      const half = p.size[2] / 2
      expect(x).toBeGreaterThanOrEqual(footprint.x0 - PLANK.maxOffset - half - 1e-6)
      expect(x).toBeLessThanOrEqual(footprint.x1 + PLANK.maxOffset + half + 1e-6)
      expect(z).toBeLessThanOrEqual(footprint.zNorth + PLANK.maxOffset + half + 1e-6)
      expect(z).toBeGreaterThanOrEqual(footprint.zSouth - PLANK.maxOffset - half - 1e-6)
    }
  })

  it('stops the side walls at the eaves and cuts the gables to the roof line', () => {
    for (const p of planks) {
      const top = p.centre[1] + p.size[1] / 2
      if (p.wall === 'east' || p.wall === 'west') expect(top).toBeLessThanOrEqual(eavesY + 1e-6)
      else expect(p.size[0] / 2).toBeLessThanOrEqual(gableHalfWidth(p.centre[1]) + 1e-6)
    }
  })

  it('leaves the door and the window open, with no hole beside their frames', () => {
    const north = planks.filter((p) => p.wall === 'north')
    const [north0] = WALLS
    for (const o of north0?.openings ?? []) {
      const x0 = footprint.x0 + o.s0
      const x1 = footprint.x0 + o.s1
      for (const p of north) {
        const px0 = p.centre[0] - p.size[0] / 2
        const px1 = p.centre[0] + p.size[0] / 2
        const py0 = p.centre[1] - p.size[1] / 2
        const py1 = p.centre[1] + p.size[1] / 2
        const overlaps = px0 < x1 - 1e-6 && px1 > x0 + 1e-6 && py0 < o.y1 - 1e-6 && py1 > o.y0 + 1e-6
        expect(overlaps).toBe(false)
      }
      // Just above the frame there is plank again.
      const above = north.some((p) => p.centre[0] > x0 && p.centre[0] < x1 && p.centre[1] - p.size[1] / 2 >= o.y1 - 1e-6 && p.centre[1] - p.size[1] / 2 < o.y1 + PLANK.height)
      expect(above).toBe(true)
    }
  })

  it('pitches the roof at 40° to the ridge layout.ts records', () => {
    expect(RIDGE_Y).toBeCloseTo(cabin.ridgeY, 1)
    expect(Math.abs(RIDGE_Y - cabin.ridgeY)).toBeLessThan(0.01)
  })

  it('fits the 步步锦 lattice inside the window, mirror-symmetric', () => {
    const bars = latticeBars()
    const h = latticeWindow.size / 2
    for (const [x, y, w, bh] of bars) {
      expect(Math.abs(x) + w / 2).toBeLessThanOrEqual(h + 1e-9)
      expect(Math.abs(y) + bh / 2).toBeLessThanOrEqual(h + 1e-9)
      expect(bars.some(([x2, y2, w2, h2]) => Math.abs(x2 + x) < 1e-9 && Math.abs(y2 - y) < 1e-9 && w2 === w && h2 === bh)).toBe(true)
    }
  })
})

describe('the light', () => {
  it("finds its anchors in env's ink shader, so the plank-edge leak lines compile in", () => {
    expect(inkFrag.split(PLANK_RIM_ANCHORS.main)).toHaveLength(2)
    expect(inkFrag.split(PLANK_RIM_ANCHORS.out)).toHaveLength(2)
  })

  it('puts the leak box inside the shell, behind the door leaf, on the floor', () => {
    const box = new Box3(new Vector3(-0.5, -0.5, -0.5), new Vector3(0.5, 0.5, 0.5)).applyMatrix4(leakBoxMatrix())
    const inner = PLANK.thickness
    expect(box.min.x).toBeGreaterThan(footprint.x0 + inner)
    expect(box.max.x).toBeLessThan(footprint.x1 - inner)
    expect(box.min.z).toBeGreaterThan(footprint.zSouth + inner)
    expect(box.max.z).toBeLessThan(DOOR_LEAF.hinge[2] - DOOR_LEAF.thickness / 2)
    expect(box.min.y).toBeGreaterThan(floorY)
    expect(box.min.y - floorY).toBeLessThan(0.005)
    expect(box.max.y).toBeLessThanOrEqual(eavesY)
    expect(box.getSize(new Vector3()).toArray()).toEqual(cabin.leakBox.size.map((v) => expect.closeTo(v, 6)))
  })

  it('lays the floor spill outside the door plane, over the sill, the steps and the ground', () => {
    const g = buildSpillStrip()
    g.computeBoundingBox()
    const bb = g.boundingBox
    expect(bb?.max.z).toBeCloseTo(door.planeZ + 4.5)
    expect(bb?.min.z).toBeGreaterThanOrEqual(door.planeZ)
    expect(bb?.min.y).toBeGreaterThanOrEqual(0)
    expect(bb?.max.y).toBeLessThan(floorY + 0.01)
  })
})
