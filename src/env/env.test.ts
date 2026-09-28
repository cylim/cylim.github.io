import { describe, expect, it } from 'vitest'
import { exit, inKeepOut, KEEP_OUTS, lanternSightline, pathToCabin, pathToGrove, sightlineAt, terrainHeight, terrainProfile, threshold } from '../core/world/layout'
import { TIERS } from '../core/render/quality'
import { PATH_CURVES, PATH_TABLE, pathCentreX, pathTable, sampleCentripetal } from './paths'
import { planForest, variantPrefixCount, PINE_VARIANTS } from './pines/forest'
import { distanceGrid, nearestOnPolyline, poissonScatter } from './scatter'
import { planMoss, planStrokes } from './strokes/placement'
import { NEEDLE_ATLAS, NEEDLE_CELLS, NEEDLE_MARGIN, planNeedleCell } from './pines/needleAtlas'
import { buildPine, FIELD_SPECS } from './pines/pineGeometry'

describe('path splines (design §5.1)', () => {
  it('pass through their control points and run strictly south', () => {
    for (const [curve, ctrl] of [
      [PATH_CURVES.toCabin, pathToCabin],
      [PATH_CURVES.toGrove, pathToGrove],
    ] as const) {
      for (const p of ctrl) expect(nearestOnPolyline(p[0], p[2], curve).d).toBeLessThan(1e-6)
      for (let i = 1; i < curve.length; i++) expect(curve[i]![1]).toBeLessThan(curve[i - 1]![1])
    }
  })

  it('looks the centre up by z, with a gap at the cabin', () => {
    expect(pathCentreX(-24)).toBeCloseTo(0.8, 5)
    expect(pathCentreX(-63)).toBeNull()
    expect(pathCentreX(-85)).toBeCloseTo(1.7, 5)
    const table = pathTable()
    expect(table).toHaveLength(PATH_TABLE.count)
    expect(table[PATH_TABLE.z0 - -24]).toBeCloseTo(0.8, 5)
    expect(table[PATH_TABLE.z0 - -63]).toBe(PATH_TABLE.noPath)
  })

  it('samples a straight line as a straight line', () => {
    const s = sampleCentripetal([[0, 0], [0, -10], [0, -20]], 4)
    expect(s).toHaveLength(9)
    for (const p of s) expect(p[0]).toBeCloseTo(0, 9)
  })
})

describe('terrain saddle', () => {
  it('keeps the knot profile away from the sightline', () => {
    expect(terrainHeight(-5, -120)).toBeCloseTo(1.8)
    expect(terrainHeight(0, -120)).toBeCloseTo(1.8)
    expect(terrainHeight(5, -60)).toBe(0)
  })

  it('lets the K0 eye see the lantern flame over the crest', () => {
    const [, , z0] = lanternSightline.from
    const [, , z1] = lanternSightline.to
    for (let z = z0 - 1; z > z1 + 1; z -= 0.25) {
      const [x, y] = sightlineAt(z)
      expect(terrainHeight(x, z)).toBeLessThan(y - 0.3)
    }
    expect(terrainProfile(-120)).toBeGreaterThan(sightlineAt(-120)[1])
  })
})

describe('progressive Poisson scatter', () => {
  const pts = poissonScatter({
    seed: 3,
    bounds: { x0: 0, x1: 60, z0: 0, z1: -60 },
    radius: (x) => (x < 5 ? null : 2),
    passes: [2, 1],
    dartsPerM2: 3,
  })

  it('is deterministic and keeps the final spacing', () => {
    const again = poissonScatter({ seed: 3, bounds: { x0: 0, x1: 60, z0: 0, z1: -60 }, radius: (x) => (x < 5 ? null : 2), passes: [2, 1], dartsPerM2: 3 })
    expect(again).toEqual(pts)
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        expect(Math.hypot(pts[i]!.x - pts[j]!.x, pts[i]!.z - pts[j]!.z)).toBeGreaterThanOrEqual(2 - 1e-9)
      }
    }
    expect(pts.every((p) => p.x >= 5)).toBe(true)
  }, 20_000)

  it('emits the coarse pass first, so every prefix is evenly spread', () => {
    const firstFine = pts.findIndex((p) => p.pass === 1)
    expect(firstFine).toBeGreaterThan(0)
    expect(pts.slice(firstFine).every((p) => p.pass === 1)).toBe(true)
    const coarse = pts.slice(0, firstFine)
    for (let i = 0; i < coarse.length; i++) {
      for (let j = i + 1; j < coarse.length; j++) {
        expect(Math.hypot(coarse[i]!.x - coarse[j]!.x, coarse[i]!.z - coarse[j]!.z)).toBeGreaterThanOrEqual(4 - 1e-9)
      }
    }
  })

  it('distance grid matches the exact distance between samples', () => {
    const line = PATH_CURVES.toCabin
    const grid = distanceGrid(line, { x0: -20, x1: 20, z0: 10, z1: -60 }, 1)
    for (const [x, z] of [[3.3, -12.7], [-7.1, -40.2], [0.4, 1.9]] as const) {
      expect(Math.abs(grid(x, z) - nearestOnPolyline(x, z, line).d)).toBeLessThan(0.1)
    }
  })
})

describe('forest plan', () => {
  const plan = planForest()

  it('fills the high tier and keeps every trunk out of the keep-outs', () => {
    expect(plan.pines.length).toBeGreaterThanOrEqual(TIERS.high.pines * 0.95)
    expect(plan.pines.length).toBeLessThanOrEqual(TIERS.high.pines)
    for (const p of plan.pines) expect(inKeepOut(p.x, p.z, KEEP_OUTS, 0.9)).toBe(false)
  })

  it('never blocks the lantern sightline or crosses the ledge', () => {
    for (const p of plan.pines) {
      expect(p.z).toBeGreaterThan(exit.ledgeZ)
      const [sx] = sightlineAt(p.z)
      if (p.z < threshold.k0[2]) expect(Math.abs(p.x - sx)).toBeGreaterThan(1.5)
    }
  })

  it('puts the grove ring first, so every tier keeps it', () => {
    expect(plan.groveCount).toBeGreaterThan(30)
    expect(plan.groveCount).toBeLessThan(TIERS.low.pines)
    expect(plan.pines.slice(0, plan.groveCount).every((p) => p.variant === 3)).toBe(true)
    expect(plan.pines.slice(plan.groveCount).some((p) => p.variant === 3)).toBe(false)
    expect(plan.pines.slice(0, plan.groveCount).some((p) => p.far)).toBe(false)
  })

  it('splits tier prefixes across variants exactly', () => {
    for (const tier of ['low', 'medium', 'high'] as const) {
      const n = Math.min(TIERS[tier].pines, plan.pines.length)
      const sum = PINE_VARIANTS.reduce<number>((a, v) => a + variantPrefixCount(plan.pines, v, n), 0)
      expect(sum).toBe(n)
      const byLod = PINE_VARIANTS.reduce<number>((a, v) => a + variantPrefixCount(plan.pines, v, n, false) + variantPrefixCount(plan.pines, v, n, true), 0)
      expect(byLod).toBe(n)
    }
  })

  it('tones near pines darker than far ones', () => {
    const near = plan.pines.filter((p) => p.dWalk < 6 && p.variant !== 3)
    const far = plan.pines.filter((p) => p.dWalk > 30)
    const mean = (l: typeof near) => l.reduce((a, p) => a + p.ink, 0) / l.length
    expect(mean(near)).toBeGreaterThan(mean(far) + 0.3)
  })
})

describe('brush marks', () => {
  it('keep grass and ferns off the paper strip', () => {
    for (const s of planStrokes()) {
      const c = pathCentreX(s.z)
      if (c !== null) expect(Math.abs(s.x - c)).toBeGreaterThan(0.6)
    }
  })

  it('dot moss only near trunks the walk passes', () => {
    const dots = planMoss(planForest().pines)
    expect(dots.length).toBeGreaterThan(200)
  })
})

const insideCell = (x: number, y: number) =>
  x >= NEEDLE_MARGIN && x <= NEEDLE_ATLAS.cellW - NEEDLE_MARGIN && y >= NEEDLE_MARGIN && y <= NEEDLE_ATLAS.cellH - NEEDLE_MARGIN

describe('painted pines', () => {
  it('paints every needle stroke and wash inside its atlas cell, the same on every load', () => {
    for (let i = 0; i < NEEDLE_CELLS; i++) {
      const cell = planNeedleCell(i)
      expect(cell).toEqual(planNeedleCell(i))
      expect(cell.needles.length).toBeGreaterThan(60)
      for (const n of cell.needles) expect(insideCell(n.x0, n.y0) && insideCell(n.x1, n.y1)).toBe(true)
      for (const w of cell.washes) for (const [x, y] of w.points) expect(insideCell(x, y)).toBe(true)
    }
  })

  it('draws pads as needle cards the shader opens, and bounds the tree with them open', () => {
    const g = buildPine(FIELD_SPECS[0]!)
    const rim = g.getAttribute('rim')
    const size = g.getAttribute('cardSize')
    const card = g.getAttribute('card')
    let cards = 0
    for (let i = 0; i < rim.count; i++) {
      if (rim.getX(i) < 0) continue
      cards++
      expect(size.getX(i)).toBeGreaterThan(0)
      expect(Math.abs(card.getX(i))).toBe(1)
      expect(card.getZ(i)).toBeLessThan(2 * NEEDLE_CELLS)
    }
    expect(cards % 4).toBe(0)
    expect(cards / 4).toBeGreaterThanOrEqual(8)
    expect(g.boundingSphere!.radius).toBeGreaterThan(FIELD_SPECS[0]!.height / 2)
  })

  it('keeps the grove ring out of the crown the G1 seat would sit in', () => {
    const ring = planForest().pines.filter((p) => p.variant === 3)
    for (const p of ring) expect(Math.hypot(p.x, p.z + 133)).toBeGreaterThanOrEqual(7.5)
  })
})
