import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { postFx } from '../../core/render'
import { dynamicKeepOuts } from '../../env/keepOuts'
import { initialJourneyState, journey } from '../../core/store/journey'
import { MARKS } from '../../core/world/journey'
import { FINALE } from './finale'
import { FinaleFlags } from './finaleFlags'

// The full walk, grove included: these tests pin the design tables and the grove's code, whatever
// content/features.ts says (the live, groveless walk is covered by core/world/groveOff.test.ts).
vi.mock('../../content/features', () => ({ features: { grove: true } }))

const at = (jvh: number) => journey.setState({ jvh, u: jvh / 1000 })

describe('FinaleFlags', () => {
  let flags: FinaleFlags

  beforeEach(() => {
    vi.useFakeTimers()
    journey.setState(initialJourneyState())
    journey.setState({ mode: 'immersive' })
    flags = new FinaleFlags()
    flags.resize(1280, 800)
    flags.start()
  })

  afterEach(() => {
    flags.stop()
    vi.useRealTimers()
  })

  it('opens the mounts from mountOpenAt, and scissors only once they have slid in', () => {
    at(FINALE.mountOpenAt - 1)
    expect(journey.getState().finale.mountOpen).toBe(false)
    at(FINALE.mountOpenAt)
    expect(journey.getState().finale.mountOpen).toBe(true)
    expect(postFx.scissor).toBeNull()
    vi.advanceTimersByTime(FINALE.mountSlideMs)
    expect(postFx.scissor).toEqual({ x: 340, y: 0, w: 600, h: 800 })
    flags.resize(1440, 900)
    expect(postFx.scissor).toEqual({ x: 382, y: 0, w: 676, h: 900 })
    at(FINALE.mountOpenAt - 5)
    expect(journey.getState().finale.mountOpen).toBe(false)
    expect(postFx.scissor).toBeNull()
  })

  it('never scissors a phone', () => {
    flags.resize(390, 844)
    at(1000)
    vi.advanceTimersByTime(5000)
    expect(journey.getState().finale.mountOpen).toBe(true)
    expect(postFx.scissor).toBeNull()
  })

  it('writes the colophon, then stamps the seal, once the camera has arrived', () => {
    journey.setState({ lagFog: 1 })
    at(1000)
    vi.advanceTimersByTime(FINALE.sealAfterMs + 100)
    expect(journey.getState().finale.colophonShown).toBe(false)
    journey.setState({ lagFog: 0 })
    vi.advanceTimersByTime(FINALE.colophonAfterMs)
    expect(journey.getState().finale).toMatchObject({ colophonShown: true, sealStamped: false })
    vi.advanceTimersByTime(FINALE.sealAfterMs - FINALE.colophonAfterMs)
    expect(journey.getState().finale.sealStamped).toBe(true)
  })

  it('pauses when the visitor leaves before the seal and resumes on return; never unstamps', () => {
    at(MARKS.sealStamp)
    vi.advanceTimersByTime(FINALE.colophonAfterMs)
    at(960)
    vi.advanceTimersByTime(10_000)
    expect(journey.getState().finale).toMatchObject({ colophonShown: true, sealStamped: false })
    at(1000)
    vi.advanceTimersByTime(FINALE.sealAfterMs - FINALE.colophonAfterMs)
    expect(journey.getState().finale.sealStamped).toBe(true)
    at(900)
    expect(journey.getState().finale).toMatchObject({ colophonShown: true, sealStamped: true, mountOpen: false })
  })

  it('signs at once under e2e and reduced motion', () => {
    journey.setState({ e2e: true })
    at(1000)
    expect(journey.getState().finale).toMatchObject({ colophonShown: true, sealStamped: true, mountOpen: true })
  })

  it('opens the view to the grove from E2, and closes it again before E2', () => {
    at(MARKS.finaleStart - 1)
    expect(dynamicKeepOuts().some((k) => k.id === 'finale-opening')).toBe(false)
    at(MARKS.finaleStart)
    expect(dynamicKeepOuts().some((k) => k.id === 'finale-opening')).toBe(true)
    at(900)
    expect(dynamicKeepOuts().some((k) => k.id === 'finale-opening')).toBe(false)
  })

  it('clears the mounts, the scissor and the pins when it stops', () => {
    at(1000)
    vi.advanceTimersByTime(FINALE.mountSlideMs)
    journey.setState({ pins: { grove: { x: 1, y: 2, visible: true } } })
    flags.stop()
    expect(journey.getState().finale.mountOpen).toBe(false)
    expect(journey.getState().pins).toEqual({})
    expect(postFx.scissor).toBeNull()
  })
})
