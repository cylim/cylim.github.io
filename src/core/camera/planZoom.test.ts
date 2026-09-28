import { describe, expect, it } from 'vitest'
import { zoomLens, zoomToFill, type Lens } from './planZoom'

const DEG = Math.PI / 180
const W = 390
const H = 844

/** Screen point (px, top-left origin) of an image-plane offset (focal lengths, y up) through a lens. */
function screenOf(lens: Lens, off: { x: number; y: number }) {
  const f = H / 2 / Math.tan((lens.fov * DEG) / 2)
  return { x: W / 2 + lens.sx * W + off.x * f, y: H / 2 + lens.sy * H - off.y * f, f }
}

describe('zoomToFill', () => {
  it('is the factor that makes `size` at `depth` span the fill width', () => {
    const zoom = zoomToFill(H, 68, 40, 3, 0.7 * W)
    const f = (H / 2 / Math.tan(34 * DEG)) * zoom
    expect((3 * f) / 40).toBeCloseTo(0.7 * W, 6)
  })
})

describe('zoomLens (design.md §9.7 touch zoom)', () => {
  const base: Lens = { fov: 68, sx: 0, sy: -0.2 }
  // A palace up and to the left of the plan centre, as a 3 m slab 3 m off-axis at 40 m.
  const off = { x: -3 / 40, y: 3 / 40 }
  const centre = { x: W / 2, y: 0.3 * H }
  const zoom = zoomToFill(H, base.fov, 40, 3, 0.7 * W)

  it('is the base lens at t = 0', () => {
    expect(zoomLens(W, H, base, off, zoom, centre, 0)).toEqual(base)
  })

  it('puts the focus at the chart viewport centre, filling 70% of the width, at t = 1', () => {
    const lens = zoomLens(W, H, base, off, zoom, centre, 1)
    const p = screenOf(lens, off)
    expect(p.x).toBeCloseTo(centre.x, 6)
    expect(p.y).toBeCloseTo(centre.y, 6)
    expect((3 / 40) * p.f).toBeCloseTo(0.7 * W, 6)
    expect(lens.fov).toBeLessThan(base.fov)
  })

  it('slides the focus straight toward the centre while the zoom grows', () => {
    const start = screenOf(base, off)
    let lastScale = 0
    for (let t = 0.1; t < 1; t += 0.1) {
      const p = screenOf(zoomLens(W, H, base, off, zoom, centre, t), off)
      expect(p.x).toBeCloseTo(start.x + (centre.x - start.x) * t, 6)
      expect(p.y).toBeCloseTo(start.y + (centre.y - start.y) * t, 6)
      expect(p.f).toBeGreaterThan(lastScale)
      lastScale = p.f
    }
  })

  it('keeps the base shift in the landscape plan view (panel on the right third)', () => {
    const land: Lens = { fov: 40, sx: -1 / 6, sy: 0 }
    const lens = zoomLens(1280, 800, land, { x: 0, y: 0 }, 1, { x: 1280 * (0.5 - 1 / 6), y: 400 }, 1)
    expect(lens.fov).toBeCloseTo(40, 9)
    expect(lens.sx).toBeCloseTo(-1 / 6, 9)
    expect(lens.sy).toBeCloseTo(0, 9)
  })
})
