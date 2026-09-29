import { Vector3 } from 'three'
import { describe, expect, it, vi } from 'vitest'
import { buildCameraPath } from '../../../core/camera/path'
import { beatById, MARKS, SECTION_SPANS } from '../../../core/world/journey'
import { KEEP_OUTS, inKeepOut, pathZone, type Vec3 } from '../../../core/world/layout'
import { buildRock, pathCentreX } from '../../../env'
import {
  BAMBOO_BOUNDS,
  bambooPlan,
  curtainLift,
  mistHoldBoost,
  standingStones,
  steppingStones,
  STROKE,
  VEIL_SPAN,
  veilOpacity,
  VEILS,
} from './plan'

// The full walk, grove included: these tests pin the design tables and the grove's code, whatever
// content/features.ts says (the live, groveless walk is covered by core/world/groveOff.test.ts).
vi.mock('../../../content/features', () => ({ features: { grove: 'walk' } }))

const { centreZ, width } = pathZone.stream
const bankZ = centreZ - width / 2

describe('stepping stones (design §5.1, §8.5 P1)', () => {
  const stones = steppingStones()

  it('puts five flattened stones across the stream between x 1.3 and 2.1', () => {
    expect(stones).toHaveLength(pathZone.steppingStones.count)
    for (const s of stones) {
      expect(s.pos[0]).toBeGreaterThanOrEqual(pathZone.steppingStones.x0)
      expect(s.pos[0]).toBeLessThanOrEqual(pathZone.steppingStones.x1)
      expect(Math.abs(s.pos[2] - centreZ)).toBeLessThan(width / 2)
      expect(s.size[1]).toBeLessThan(s.size[0] / 2)
    }
  })

  it('steps from the north bank to the south bank, zigzagging about the path', () => {
    const zs = stones.map((s) => s.pos[2])
    expect(zs).toEqual(zs.toSorted((a, b) => b - a))
    const mid = pathCentreX(centreZ) ?? 1.7
    const sides = stones.map((s) => Math.sign(s.pos[0] - (pathZone.steppingStones.x0 + pathZone.steppingStones.x1) / 2))
    for (let i = 1; i < sides.length; i++) expect(sides[i]).not.toBe(sides[i - 1])
    expect(Math.abs(mid - 1.7)).toBeLessThan(0.3)
  })

  it('is the same on every load', () => {
    expect(steppingStones()).toEqual(stones)
  })
})

describe('standing stones (design §5.1)', () => {
  it('stand at (−3, 0, −131) and (3, 0, −131), 1.8 m above the ground', () => {
    const stones = standingStones()
    expect(stones.map((s) => [s.pos[0], s.pos[2]])).toEqual(pathZone.standingStones.map((p) => [p[0], p[2]]))
    for (const s of stones) {
      const g = buildRock(s.seed, s.size, 4)
      g.computeBoundingBox()
      expect(g.boundingBox?.max.y ?? 0).toBeCloseTo(pathZone.standingStoneHeight, 1)
    }
  })
})

describe('bamboo clump (design §5.1, §8.5 P1)', () => {
  const { culms, strokes } = bambooPlan()

  it('rises from the south bank near (−3.5, 0, −86), clear of the water and the path', () => {
    expect(culms.length).toBeGreaterThanOrEqual(5)
    for (const c of culms) {
      expect(c.base[2]).toBeLessThan(bankZ - 0.1)
      expect(Math.hypot(c.base[0] - pathZone.bamboo[0], c.base[2] - pathZone.bamboo[2])).toBeLessThan(2)
      // Inside env's bamboo keep-out, so no pine grows through it; outside the path corridor.
      const bambooOnly = KEEP_OUTS.filter((k) => k.id === 'bamboo')
      expect(inKeepOut(c.base[0], c.base[2], bambooOnly)).toBe(true)
      expect(inKeepOut(c.base[0], c.base[2], KEEP_OUTS.filter((k) => k.id === 'path-to-grove'))).toBe(false)
    }
  })

  const count = (kind: number) => strokes.filter((s) => s.kind === kind).length

  it('draws segmented stems with node marks, twigs and leaves', () => {
    expect(count(STROKE.stem)).toBeGreaterThan(culms.length * 8)
    expect(count(STROKE.node)).toBe(count(STROKE.stem) - culms.length)
    expect(count(STROKE.twig)).toBeGreaterThan(10)
    expect(count(STROKE.leaf)).toBeGreaterThan(80)
  })

  it('groups leaves as 个 (three from a point) and 介 (four)', () => {
    const groups = new Map<string, number>()
    for (const s of strokes) if (s.kind === STROKE.leaf) groups.set(s.a.join(','), (groups.get(s.a.join(',')) ?? 0) + 1)
    const sizes = [...groups.values()]
    expect(sizes.filter((n) => n === 3).length).toBeGreaterThan(5)
    expect(sizes.filter((n) => n === 4).length).toBeGreaterThan(3)
  })

  it('keeps every stroke inside the culling sphere, sway included', () => {
    const c = new Vector3(...BAMBOO_BOUNDS.centre)
    for (const s of strokes) {
      for (const p of [s.a, [s.a[0] + s.axis[0], s.a[1] + s.axis[1], s.a[2] + s.axis[2]] as Vec3]) {
        expect(new Vector3(...p).distanceTo(c) + s.width + 0.1).toBeLessThan(BAMBOO_BOUNDS.radius)
      }
    }
  })
})

describe('the mist wall (design §8.5 P2–P3, §11.2)', () => {
  const peak = pathZone.mistWall.fogPeak

  it('holds the fog at its peak from the reveal while the grove is not ready', () => {
    expect(mistHoldBoost(620, 0.1, 1, false)).toBe(0)
    expect(mistHoldBoost(640, 0.03, 1, false)).toBeCloseTo(peak - 0.03)
    expect(mistHoldBoost(700, 0.012, 1.3, false)).toBeCloseTo((peak - 0.012) * 1.3)
    expect(mistHoldBoost(640, 0.03, 1, true)).toBe(0)
    expect(mistHoldBoost(SECTION_SPANS.grove.jvh[1], 0.02, 1, false)).toBe(0)
  })

  it('gathers the veils with the rising fog and clears them by the end of the reveal', () => {
    for (const v of VEILS) {
      expect(veilOpacity(MARKS.mistWall[0] - 5, v)).toBe(0)
      expect(veilOpacity(622, v)).toBeGreaterThan(0.4)
      expect(veilOpacity(MARKS.reveal[1], v)).toBe(0)
    }
    expect(VEIL_SPAN[1]).toBe(MARKS.reveal[1])
  })

  it('stands the wall sheets in the wall and the curtains past the crest', () => {
    for (const v of VEILS) {
      if (v.curtain) expect(v.z).toBeLessThan(pathZone.crest.zSouth)
      else {
        expect(v.z).toBeLessThanOrEqual(pathZone.mistWall.zNorth + 3)
        expect(v.z).toBeGreaterThanOrEqual(pathZone.mistWall.zSouth)
      }
    }
  })

  it('lifts the curtains across the reveal, never back down', () => {
    let last = -1
    for (let j = MARKS.reveal[0]; j <= MARKS.reveal[1]; j += 0.5) {
      const l = curtainLift(j)
      expect(l).toBeGreaterThanOrEqual(last)
      last = l
    }
    expect(curtainLift(MARKS.reveal[0])).toBe(0)
    expect(curtainLift(MARKS.reveal[1])).toBe(1)
  })
})

describe('camera rows P0–P3 (design §6.1, §8.5)', () => {
  const path = buildCameraPath({ portrait: false, hFit: 34 })
  const angleTo = (jvh: number, target: Vec3) => {
    const pos = path.pos.sample(jvh, new Vector3())
    const look = path.look.sample(jvh, new Vector3()).sub(pos).normalize()
    return (look.angleTo(new Vector3(...target).sub(pos).normalize()) * 180) / Math.PI
  }

  it('keeps the stepping stones in the frame through the P1 hold', () => {
    const [h0, h1] = beatById('P1').hold ?? [0, 0]
    const stones: Vec3 = [1.7, 0.1, centreZ]
    for (let j = h0; j <= h1; j += 1) expect(angleTo(j, stones), `@${j}`).toBeLessThan(20)
  })

  it('never looks back at the cabin after the moon gate', () => {
    for (let j = MARKS.stageSwap; j <= MARKS.reveal[1]; j += 1) expect(angleTo(j, [4, 2.5, -63])).toBeGreaterThan(90)
  })

  it('ends P3 looking down onto the platform, with the lantern glint in the frame', () => {
    expect(angleTo(MARKS.reveal[1], [0, 0.45, -150])).toBeLessThan(1)
    expect(angleTo(MARKS.reveal[1], [1, 1.35, -186.5])).toBeLessThan(20)
  })
})
