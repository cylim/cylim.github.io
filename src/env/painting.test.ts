import { AlwaysStencilFunc, MeshBasicMaterial, NotEqualStencilFunc } from 'three'
import { describe, expect, it } from 'vitest'
import { cabin, grove, mountains, threshold } from '../core/world/layout'
import { envMaterial, portalExclusion, setPortalExclusion } from './materials/portal'
import { buildRing, RING_LAYERS, ringStretch } from './mountains/mountainGeometry'
import { groupTone, planForest } from './pines/forest'
import { FIELD_HEIGHTS } from './pines/pineHeights'

describe('portal exclusion (design §8.3, wave-2 M6)', () => {
  it('keeps every env material out of the door while the portal is on, including ones made later', () => {
    const early = envMaterial(new MeshBasicMaterial())
    expect(early.stencilWrite).toBe(false)
    setPortalExclusion(1)
    expect(portalExclusion()).toBe(1)
    expect(early.stencilWrite).toBe(true)
    expect(early.stencilFunc).toBe(NotEqualStencilFunc)
    expect(early.stencilRef).toBe(1)
    const late = envMaterial(new MeshBasicMaterial())
    expect(late.stencilFunc).toBe(NotEqualStencilFunc)
    setPortalExclusion(null)
    for (const m of [early, late]) {
      expect(m.stencilWrite).toBe(false)
      expect(m.stencilFunc).toBe(AlwaysStencilFunc)
    }
  })

  it('forgets a material once it is disposed', () => {
    const m = envMaterial(new MeshBasicMaterial())
    m.dispose()
    setPortalExclusion(1)
    expect(m.stencilWrite).toBe(false)
    setPortalExclusion(null)
  })
})

describe('ridge ring (wave-2 M7)', () => {
  const [kx, ky, kz] = threshold.k0
  const [cx, , cz] = mountains.ridgeRing.centre

  it('stands further out in the south only', () => {
    for (const layer of RING_LAYERS) {
      expect(ringStretch(layer, Math.PI / 2)).toBe(1)
      expect(ringStretch(layer, 0)).toBe(1)
      expect(ringStretch(layer, -Math.PI / 2)).toBeCloseTo(1 + layer.southPush)
    }
    // From the stele the nearest southern crest is well past the ledge, not 60 m off.
    const near = RING_LAYERS[0]!
    expect(cz - near.radius * ringStretch(near, -Math.PI / 2)).toBeLessThan(-300)
  })

  it('keeps the threshold crests at the elevation K0 saw before the push', () => {
    const near = RING_LAYERS[0]!
    const g = buildRing(near)
    const pos = g.getAttribute('position')
    const ridge = g.getAttribute('ridge')
    // The column due south of the centre: its top over its distance from K0 should match the
    // unpushed ring's to within the south dip's change.
    let best = -1
    for (let i = 0; i < pos.count; i += 2) if (best < 0 || pos.getZ(i) < pos.getZ(best)) best = i
    const d = Math.hypot(pos.getX(best) - kx, pos.getZ(best) - kz)
    const d0 = Math.hypot(cx - kx, cz - near.radius - kz)
    const elevation = (ridge.getX(best) - ky) / d
    expect(elevation).toBeGreaterThan(Math.tan((1.5 * Math.PI) / 180))
    expect(elevation).toBeLessThan(Math.tan((7 * Math.PI) / 180))
    expect(d / d0).toBeCloseTo(1 + (344 - 274) / 274, 1)
  })
})

describe('forest composition', () => {
  const pines = planForest().pines

  it('alternates dark and pale groups (浓淡相间) without touching the ones that frame the walk', () => {
    const tones = pines.map((p) => groupTone(p.x, p.z))
    expect(Math.min(...tones)).toBeGreaterThanOrEqual(0.64)
    expect(Math.max(...tones)).toBeLessThanOrEqual(1)
    expect(tones.filter((t) => t < 0.8).length).toBeGreaterThan(pines.length * 0.15)
    expect(tones.filter((t) => t > 0.95).length).toBeGreaterThan(pines.length * 0.15)
  })

  it('keeps the pines behind the cabin under the C1 roofline, so the peak rises over it', () => {
    const eye = [4, 1.7, -47] as const
    const roofApex = Math.atan2(cabin.ridgeY - eye[1], eye[2] - cabin.footprint.zNorth)
    for (const p of pines) {
      const ahead = eye[2] - p.z
      if (p.variant === 3 || ahead < 16 || Math.abs(Math.atan2(p.x - eye[0], ahead)) > (18 * Math.PI) / 180) continue
      const top = p.y + FIELD_HEIGHTS[p.variant] * p.scale
      expect(Math.atan2(top - eye[1], Math.hypot(p.x - eye[0], ahead))).toBeLessThan(roofApex)
    }
  })

  it('leaves the cabin peak on its own stretch of the walk, south of the cabin', () => {
    const { centre, gate } = mountains.cabinPeak
    expect(centre[2]).toBeLessThan(grove.centre[2] - 100)
    expect(gate[0]).toBeGreaterThan(gate[1])
    expect(gate[2]).toBeGreaterThan(gate[3])
    // Condensed by C1 (camera z about −47), gone before the path behind the cabin (z −69).
    expect(gate[1]).toBeGreaterThan(-47)
    expect(gate[3]).toBeGreaterThan(-69)
  })
})
