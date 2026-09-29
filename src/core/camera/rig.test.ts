import { afterEach, describe, expect, it, vi } from 'vitest'
import { PerspectiveCamera, Vector2, Vector3 } from 'three'
import { Rig, compassAction, type RigFrame } from './rig'
import { setPlanFocus } from './planZoom'
import { planViewport } from './framing'
import { initialJourneyState, journey, type JourneyState } from '../store/journey'
import { RIG, beatById, type BeatId } from '../world/journey'
import { cabin, grove, hall } from '../world/layout'

// The full walk, grove included: these tests pin the design tables and the grove's code, whatever
// content/features.ts says (the live, groveless walk is covered by core/world/groveOff.test.ts).
vi.mock('../../content/features', () => ({ features: { grove: 'walk' } }))

const camera = new PerspectiveCamera(40, 1280 / 800, 0.1, 600)
const frame = (delta = 1 / 60, over: Partial<RigFrame> = {}): RigFrame => ({
  camera,
  width: 1280,
  height: 800,
  delta,
  elapsed: 0,
  pointer: new Vector2(),
  ...over,
})
const set = (patch: Partial<JourneyState>) => journey.setState(patch)
const run = (rig: Rig, seconds: number) => {
  for (let t = 0; t < seconds; t += 1 / 60) rig.update(frame())
}
const at = (jvh: number) => ({ jvh, u: jvh / 1000 })
/** Three seconds of frames starting 2.5 s into the clock; returns where the camera ends up. */
const settle = (rig: Rig) => {
  for (let t = 0; t < 3; t += 1 / 60) rig.update(frame(1 / 60, { elapsed: 2.5 + t }))
  return camera.position.clone()
}

afterEach(() => {
  journey.setState(initialJourneyState(), true)
  setPlanFocus(null)
})

/** A beat's first or last pos key, so the section engineers can retune poses without touching these tests. */
const pose = (id: BeatId, which: 'first' | 'last' = 'first') => {
  const keys = beatById(id).pos
  const k = which === 'first' ? keys[0] : keys[keys.length - 1]
  if (!k) throw new Error(`${id} has no pos keys`)
  return new Vector3(...k.v)
}

describe('Rig', () => {
  it('snaps on the first frame and writes the beat fog', () => {
    const rig = new Rig()
    set({ ...at(0), mode: 'immersive' })
    rig.update(frame())
    expect(camera.position.toArray()).toEqual(pose('T0').toArray())
    expect(journey.getState().fogBase).toBeCloseTo(0.04, 9)
    expect(journey.getState().snap).toBe(false)
  })

  it('shifts the principal point for zone L and keeps the visible FOV', () => {
    const rig = new Rig()
    set(at(20))
    rig.update(frame())
    expect(camera.view?.enabled).toBe(true)
    // Subject 20% right of centre: the view window starts at the left edge of a wider image.
    expect(camera.view?.offsetX).toBe(0)
    expect(camera.view?.fullWidth).toBeCloseTo(1280 * 1.4, 6)
    expect(camera.fov).toBeCloseTo(40, 6)
  })

  it('follows with damping, and raises lag fog only when far behind', () => {
    const rig = new Rig()
    set(at(100))
    rig.update(frame())
    set(at(130))
    run(rig, 0.1)
    expect(journey.getState().lagFog).toBe(0)
    // A scrollbar drag to the cabin door: ~55 m in one frame.
    set(at(300))
    run(rig, 0.3)
    expect(journey.getState().lagFog).toBeGreaterThan(0.9)
    run(rig, 4)
    expect(journey.getState().lagFog).toBe(0)
    expect(camera.position.distanceTo(pose('C3'))).toBeLessThan(0.05)
  })

  it('covers a jump across the moon-gate cut with a flash of catch-up fog', () => {
    const rig = new Rig()
    set(at(130))
    rig.update(frame())
    // End key.
    set(at(1000))
    rig.update(frame())
    expect(camera.position.distanceTo(pose('E3', 'last'))).toBeLessThan(1e-6)
    expect(journey.getState().lagFog).toBe(1)
    run(rig, 3)
    expect(journey.getState().lagFog).toBe(0)
  })

  it('crosses the door plane into the hall: insideCabin, the cabin post group and a 400 ms crossfade', () => {
    const rig = new Rig()
    set(at(300))
    rig.update(frame())
    expect(journey.getState().insideCabin).toBe(false)
    set(at(345))
    run(rig, 0.05)
    // The camera has not reached the door yet.
    expect(journey.getState().insideCabin).toBe(false)
    run(rig, 1.5)
    const s = journey.getState()
    expect(s.insideCabin).toBe(true)
    expect(s.post).toBe('cabin')
    expect(s.postBlend).toBe(1)
  })

  it('teleports at the moon gate instead of flying through the hall', () => {
    const rig = new Rig()
    set(at(570))
    rig.update(frame())
    set(at(575))
    rig.update(frame())
    // On the path behind the cabin, 3 jvh past the emerge point, under the paper.
    expect(camera.position.x).toBeCloseTo(2.9, 1)
    expect(camera.position.z).toBeLessThan(-69)
    expect(camera.position.z).toBeGreaterThan(-71)
    expect(journey.getState().insideCabin).toBe(false)
    expect(journey.getState().lagFog).toBe(0)
    expect(journey.getState().paper).toBeGreaterThan(0.5)
  })

  it('dollies forward going into a dive and holds the emerge pose under full paper', () => {
    const rig = new Rig()
    set(at(0))
    rig.update(frame())
    set({ dive: { phase: 'in', amount: 1, to: 'grove', waiting: false } })
    run(rig, 3)
    expect(camera.position.z).toBeCloseTo(24 - 2.5 * (44 / Math.hypot(0.8, 1.2, 44)), 1)
    set({ ...at(666), snap: true, dive: { phase: 'hold', amount: 1, to: 'grove', waiting: true } })
    rig.update(frame())
    expect(camera.position.toArray()).toEqual([0, 40, -140])
    set({ dive: { phase: 'out', amount: 0.5, to: 'grove', waiting: false } })
    run(rig, 0.2)
    // Gliding down onto the seat, not there yet.
    expect(camera.position.y).toBeLessThan(40)
    expect(camera.position.y).toBeGreaterThan(8.5)
    expect(journey.getState().lagFog).toBe(0)
  })

  it('holds the mist wall at its peak past the reveal until the grove is ready', () => {
    const rig = new Rig()
    set({ ...at(620), ready: { ...journey.getState().ready, grove: false } })
    rig.update(frame())
    const wall = journey.getState().fogBase
    set(at(645))
    run(rig, 1)
    // The beat fog has cleared to 0.012 by 645 (P3), but the mist waits for the grove.
    expect(journey.getState().fogBase).toBeCloseTo(0.14, 3)
    expect(wall).toBeLessThanOrEqual(0.14)
    set({ ready: { ...journey.getState().ready, grove: true } })
    run(rig, 0.1)
    expect(journey.getState().fogBase).toBeGreaterThan(0.05)
    run(rig, 3)
    expect(journey.getState().fogBase).toBeCloseTo(0.012, 6)
  })

  it('pulls the threshold emerge pose 3 m back along the view', () => {
    const rig = new Rig()
    set({ ...at(0), snap: true, dive: { phase: 'hold', amount: 1, to: 'threshold', waiting: false } })
    rig.update(frame())
    expect(camera.position.distanceTo(pose('T0'))).toBeCloseTo(3, 6)
    expect(camera.position.z).toBeGreaterThan(pose('T0').z)
  })

  it('looks straight down with south at the top in the plan view', () => {
    const rig = new Rig()
    set(at(780))
    rig.update(frame())
    const forward = camera.getWorldDirection(new Vector3())
    expect(forward.y).toBeLessThan(-0.999)
    const up = new Vector3(0, 1, 0).applyQuaternion(camera.quaternion)
    expect(up.z).toBeLessThan(-0.999) // screen-up points south (−Z)
  })

  it('leans 1.5° right through F1', () => {
    const rig = new Rig()
    set(at(120))
    rig.update(frame())
    const right = new Vector3(1, 0, 0).applyQuaternion(camera.quaternion)
    // Leaning right: the camera's right side dips.
    expect(right.y).toBeLessThan(0)
    expect(Math.asin(-right.y) * (180 / Math.PI)).toBeCloseTo(1.5, 1)
  })

  it('uses the portrait overrides and vFOV on a phone', () => {
    const rig = new Rig()
    set(at(0))
    rig.update(frame(1 / 60, { width: 390, height: 844 }))
    expect(camera.position.toArray()).toEqual([0, 1.6, 28])
    // 68° visible, lifted into the top 55%: the full frustum is taller.
    expect(camera.view?.offsetY).toBeCloseTo(844 * 0.45, 6)
  })

  it('breathes on holds but not in e2e or with reduced motion', () => {
    set({ ...at(20), reducedMotion: true })
    const still = settle(new Rig())
    set({ reducedMotion: false })
    const breathing = settle(new Rig())
    // 2 cm at 0.1 Hz, five and a half seconds in.
    expect(Math.abs(breathing.y - still.y)).toBeGreaterThan(0.005)
    expect(Math.abs(breathing.y - still.y)).toBeLessThanOrEqual(0.02)
    set({ e2e: true })
    expect(settle(new Rig()).y).toBeCloseTo(still.y, 9)
  })
})

describe('touch zoom on the plan view (design.md §9.7)', () => {
  const phone = { width: 390, height: 844 }
  const palace9 = grove.palaceCentre[9]
  const focus = { x: palace9[0], y: palace9[1], z: palace9[2], size: grove.platform.slab }
  /** Screen px (top-left origin) of a world point through the camera as the rig left it. */
  const onScreen = (p: readonly [number, number, number], w = phone.width, h = phone.height) => {
    camera.updateMatrixWorld()
    const v = new Vector3(...p).project(camera)
    return { x: ((v.x + 1) / 2) * w, y: ((1 - v.y) / 2) * h }
  }

  it('brings a tapped palace to the chart viewport centre, 70% of the width wide, without moving the camera', () => {
    const rig = new Rig()
    set({ ...at(790), e2e: true })
    rig.update(frame(1 / 60, phone))
    const home = camera.position.clone()
    setPlanFocus(focus)
    rig.update(frame(1 / 60, phone))
    expect(camera.position.distanceTo(home)).toBeLessThan(1e-9)
    const view = planViewport({ ...phone, header: 0 }, true)
    const c = onScreen(palace9)
    expect(c.x).toBeCloseTo(phone.width * (0.5 + view.shiftX), 3)
    expect(c.y).toBeCloseTo(phone.height * (0.5 + view.shiftY), 3)
    const west = onScreen([palace9[0] + 1.5, palace9[1], palace9[2]])
    const east = onScreen([palace9[0] - 1.5, palace9[1], palace9[2]])
    expect(west.x - east.x).toBeCloseTo(RIG.planZoom.fill * phone.width, 1)
  })

  it('eases in and back out when the focus goes, and only in the plan view', () => {
    const rig = new Rig()
    set(at(790))
    rig.update(frame(1 / 60, phone))
    const fov = camera.fov
    setPlanFocus(focus)
    rig.update(frame(1 / 60, phone))
    // One frame in: on its way, not there.
    expect(camera.fov).toBeLessThan(fov)
    for (let t = 0; t < 3; t += 1 / 60) rig.update(frame(1 / 60, phone))
    expect(onScreen(palace9).x).toBeCloseTo(phone.width / 2, 1)
    setPlanFocus(null)
    for (let t = 0; t < 3; t += 1 / 60) rig.update(frame(1 / 60, phone))
    expect(camera.fov).toBeCloseTo(fov, 4)
    // At the seat the focus is ignored.
    setPlanFocus(focus)
    set({ ...at(690), e2e: true })
    rig.update(frame(1 / 60, phone))
    const seatFov = camera.fov
    setPlanFocus(null)
    rig.update(frame(1 / 60, phone))
    expect(camera.fov).toBeCloseTo(seatFov, 9)
  })

  it('jumps straight to the zoom with reduced motion', () => {
    const rig = new Rig()
    set({ ...at(790), reducedMotion: true })
    rig.update(frame(1 / 60, phone))
    setPlanFocus(focus)
    rig.update(frame(1 / 60, phone))
    expect(onScreen(palace9).x).toBeCloseTo(phone.width / 2, 3)
  })
})

describe('compass mode (design.md §9.9)', () => {
  const base = { ...initialJourneyState(), mode: 'immersive' as const, active: 'grove' as const }
  const on = { status: 'active' as const, heading: 120 }
  const g3 = beatById('G3').hold!

  it('glides into the plan view when it switches on elsewhere in the grove', () => {
    expect(compassAction({ ...base, jvh: 690, compass: on }, { ...base, jvh: 690 })).toEqual({ glideTo: g3[0] + RIG.compass.holdMargin, off: false })
    expect(compassAction({ ...base, jvh: 850, compass: on }, { ...base, jvh: 850 })).toEqual({ glideTo: g3[1] - RIG.compass.holdMargin, off: false })
  })

  it('stays put in the plan view, on later headings, in the album and during a dive', () => {
    const none = { glideTo: null, off: false }
    expect(compassAction({ ...base, jvh: 790, compass: on }, { ...base, jvh: 790 })).toEqual(none)
    expect(compassAction({ ...base, jvh: 690, compass: on }, { ...base, jvh: 690, compass: { status: 'active', heading: 100 } })).toEqual(none)
    expect(compassAction({ ...base, mode: 'static', jvh: 690, compass: on }, { ...base, jvh: 690 })).toEqual(none)
    const diving = { phase: 'in' as const, amount: 0.5, to: 'contact' as const, waiting: false }
    expect(compassAction({ ...base, jvh: 690, compass: on, dive: diving }, { ...base, jvh: 690 })).toEqual(none)
  })

  it('switches off once the walk leaves the grove', () => {
    expect(compassAction({ ...base, active: 'contact', jvh: 880, compass: on }, { ...base, jvh: 860, compass: on })).toEqual({ glideTo: null, off: true })
    expect(compassAction({ ...base, active: 'contact', jvh: 880 }, { ...base, jvh: 860 })).toEqual({ glideTo: null, off: false })
  })
})

/** Fraction of the height from the top where a world point lands through the shared camera. */
const yOf = (p: readonly [number, number, number]) => (1 - new Vector3(...p).project(camera).y) / 2

describe('portrait framing on a 390 × 844 phone (design.md §6.4, §8.3, §8.4)', () => {
  const phone = { width: 390, height: 844 }
  const shoot = (jvh: number) => {
    const rig = new Rig()
    set({ ...at(jvh), e2e: true })
    rig.update(frame(1 / 60, phone))
    camera.updateMatrixWorld()
  }

  it('C1: the door fills over a fifth of the height, the gable above it and its foot above the card', () => {
    for (const jvh of [250, 262, 272]) {
      shoot(jvh)
      const [dx, dy, dz] = cabin.door.centre
      const door = yOf([dx, dy, dz]) - yOf([dx, dy + cabin.door.height, dz])
      expect(door, `door @${jvh}`).toBeGreaterThan(0.2)
      expect(door, `door @${jvh}`).toBeLessThan(0.32)
      expect(yOf([dx, cabin.ridgeY, cabin.footprint.zNorth + cabin.overhang]), `ridge @${jvh}`).toBeGreaterThan(0)
      // The C1 card's top sits at 60% (360 px wide) to 66% (390 px) of the height.
      expect(yOf([dx, dy, dz]), `door foot @${jvh}`).toBeLessThan(0.59)
    }
  })

  it('I2: each scroll, rods and cords included, sits inside the top edge and above the card', () => {
    const scrollBeats = ['I2a', 'I2b', 'I2c', 'I2d'] as const
    scrollBeats.forEach((id, i) => {
      const [a, z] = beatById(id).hold!
      shoot((a + z) / 2)
      const { centre } = hall.scrolls[i]!
      const { height, topMargin } = hall.scrollSize
      expect(yOf([centre[0], centre[1] + height / 2 + topMargin, centre[2]]), `${id} cords`).toBeGreaterThan(0.02)
      expect(yOf([centre[0], centre[1] - height / 2, centre[2]]), `${id} foot`).toBeLessThan(0.55)
    })
  })

  it('P3: the reveal puts the rings in the middle band, not the top quarter', () => {
    shoot(642)
    const y = yOf(grove.centre)
    expect(y).toBeGreaterThan(0.35)
    expect(y).toBeLessThan(0.65)
  })
})
