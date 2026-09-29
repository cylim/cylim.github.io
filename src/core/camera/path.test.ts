import { describe, expect, it, vi } from 'vitest'
import { Vector3 } from 'three'
import { buildCameraPath, sampleUnit, vecKeys } from './path'
import { BEATS, PORTRAIT, beatById, channelKeys, type BeatId } from '../world/journey'
import { dirToBearing, exit, type Vec3 } from '../world/layout'

// The full walk, grove included: these tests pin the design tables and the grove's code, whatever
// content/features.ts says (the live, groveless walk is covered by core/world/groveOff.test.ts).
vi.mock('../../content/features', () => ({ features: { grove: 'walk' } }))

const landscape = buildCameraPath({ portrait: false, hFit: 34 })
const at = (path: typeof landscape, jvh: number) => ({
  pos: path.pos.sample(jvh, new Vector3()),
  look: path.look.sample(jvh, new Vector3()),
})
const expectVec = (v: Vector3, e: Vec3, digits = 6) => {
  expect(v.x).toBeCloseTo(e[0], digits)
  expect(v.y).toBeCloseTo(e[1], digits)
  expect(v.z).toBeCloseTo(e[2], digits)
}
const beat = (id: BeatId) => BEATS.find((b) => b.id === id)!

describe('camera path', () => {
  it('lands on the design poses at the hash arrivals (design.md §6.1, §6.2)', () => {
    expectVec(at(landscape, 0).pos, [0, 1.6, 24])
    expectVec(at(landscape, 345).pos, [4, 2.3, -65])
    expectVec(at(landscape, 345).look, [4, 3.8, -96])
    expectVec(at(landscape, 666).pos, [0, 8.5, -134])
    expectVec(at(landscape, 886).pos, [0.3, 1.2, -179.8])
    expectVec(at(landscape, 1000).pos, [3, 30, -240])
  })

  it('stands still through stationary holds', () => {
    for (const id of ['C3', 'I2a', 'I2b', 'I2c', 'I2d', 'G3', 'E3'] as const) {
      const [h0, h1] = beat(id).hold!
      const a = at(landscape, h0)
      for (let j = h0; j <= h1; j += 0.5) {
        const b = at(landscape, j)
        expect(b.pos.distanceTo(a.pos), `${id} pos @${j}`).toBeLessThan(1e-9)
        expect(b.look.distanceTo(a.look), `${id} look @${j}`).toBeLessThan(1e-9)
      }
    }
  })

  it('drifts along the chord through moving holds, without bowing out', () => {
    for (const id of ['T0', 'C1', 'I1', 'G1', 'E1'] as const) {
      const [h0, h1] = beat(id).hold!
      const a = at(landscape, h0).pos
      const b = at(landscape, h1).pos
      const chord = b.clone().sub(a)
      for (let j = h0; j <= h1; j += 1) {
        const p = at(landscape, j).pos.sub(a)
        const off = p.clone().sub(chord.clone().multiplyScalar(p.dot(chord) / chord.lengthSq())).length()
        expect(off, `${id} @${j}`).toBeLessThan(0.1)
      }
    }
  })

  it('moves continuously everywhere except the moon-gate cut at 572', () => {
    expect(landscape.pos.cuts).toEqual([572])
    const prev = at(landscape, 0).pos
    for (let j = 0.25; j <= 1000; j += 0.25) {
      const p = at(landscape, j).pos
      if (j !== 572) expect(p.distanceTo(prev), `step to ${j}`).toBeLessThan(0.6)
      prev.copy(p)
    }
    const lastI4 = beatById('I4').pos.at(-1)
    const firstP0 = beatById('P0').pos[0]
    expect(at(landscape, 571.99).pos.distanceTo(new Vector3(...(lastI4?.v ?? [0, 0, 0])))).toBeLessThan(0.05)
    expectVec(at(landscape, 572).pos, firstP0?.v ?? [0, 0, 0])
  })

  it('swings round the east side in E2 without wobbling (design.md §6.1 check)', () => {
    const [cx, , cz] = exit.orbitCentre
    let prev = -Infinity
    for (let j = 936; j <= 985; j += 0.5) {
      const p = at(landscape, j).pos
      // Bearing measured the long way round (east is 90°), so 0° → 180° is monotonic.
      const b = (dirToBearing(p.x - cx, p.z - cz) + 90) % 360
      expect(b, `bearing @${j}`).toBeGreaterThanOrEqual(prev - 1e-6)
      prev = b
    }
  })

  it('tilts out of the plan view toward the lantern, never looking back north', () => {
    for (let j = 835; j <= 880; j += 1) {
      const { pos, look } = at(landscape, j)
      // Straight down is fine; any northward component must stay under a degree.
      const dir = look.sub(pos).normalize()
      expect(dir.z, `@${j}`).toBeLessThan(Math.sin(Math.PI / 180))
    }
  })

  it('puts the plan view at h_fit', () => {
    const tall = buildCameraPath({ portrait: false, hFit: 41 })
    expectVec(at(tall, 780).pos, [0, 41, -150.001])
    expect(vecKeys('pos', { portrait: false, hFit: 41 }).filter((k) => k.fit).every((k) => k.v[1] === 41)).toBe(true)
  })
})

describe('portrait overrides (design.md §6.4)', () => {
  const portrait = buildCameraPath({ portrait: true, hFit: 40 })

  // Poses come from the table, so the section engineers can retune them without touching this.
  it('pulls T0 back, narrows the nudge and steepens the seat', () => {
    const o = PORTRAIT.overrides
    expectVec(at(portrait, 0).pos, o.T0.pos[0]?.v ?? [0, 0, 0])
    expectVec(at(portrait, 300).pos, o.C3.pos[0]?.v ?? [0, 0, 0])
    expectVec(at(portrait, 690).pos, o.G1.pos[0]?.v ?? [0, 0, 0])
    expect(o.T0.pos[0]?.v[2]).toBeGreaterThan(beat('T0').pos[0]?.v[2] ?? Infinity)
    expect(o.G1.pos[0]?.v[1]).toBeGreaterThan(beat('G1').pos[0]?.v[1] ?? Infinity)
  })

  it('puts the camera on the hall centre line for the scrolls', () => {
    for (const id of ['I2a', 'I2b', 'I2c', 'I2d'] as const) expect(at(portrait, beat(id).hold![0]).pos.x).toBeCloseTo(4, 9)
  })

  it('lifts ground-level look targets by 1.5 m, not the tilt-downs', () => {
    const [x, y, z] = beat('T0').look[0]?.v ?? [0, 0, 0]
    expectVec(at(portrait, 10).look, [x, y + PORTRAIT.lookLift, z])
    // The seat's look target is not lifted (it is a tilt-down).
    expectVec(at(portrait, 690).look, PORTRAIT.overrides.G1.look[0]?.v ?? [0, 0, 0])
  })
})

describe('camera.up', () => {
  const keys = channelKeys('up')
  it('turns south to the top of the screen for the plan view and back again', () => {
    expectVec(sampleUnit(keys, 700, new Vector3()), [0, 1, 0])
    expectVec(sampleUnit(keys, 780, new Vector3()), [0, 0, -1])
    expectVec(sampleUnit(keys, 900, new Vector3()), [0, 1, 0])
    const mid = sampleUnit(keys, 727.5, new Vector3())
    expect(mid.length()).toBeCloseTo(1, 9)
    expect(mid.y).toBeGreaterThan(0)
    expect(mid.z).toBeLessThan(0)
  })
})

describe('the approach to the cabin (L6)', () => {
  it('keeps one speed from the F3 hold into C1 instead of braking at the F4 key', () => {
    for (const portrait of [false, true]) {
      const path = buildCameraPath({ portrait, hFit: 34 })
      const f3End = beat('F3').hold![1]
      const c1Start = beat('C1').hold![0]
      // Speed in metres per jvh over short windows along the approach.
      const speeds: number[] = []
      for (let j = f3End + 2; j < c1Start - 1; j += 2) speeds.push(at(path, j + 1).pos.distanceTo(at(path, j).pos))
      const lo = Math.min(...speeds)
      const hi = Math.max(...speeds)
      expect(hi / lo, portrait ? 'portrait' : 'landscape').toBeLessThan(1.35)
    }
  })
})
