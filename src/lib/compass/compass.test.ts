import { describe, expect, it } from 'vitest'
import { enableCompass, type CompassEnv } from './enable'
import { angleDelta, createJumpWatch, headingFromEuler, headingFromEvent, mountainAt, palaceAt, withScreen, wrap360 } from './heading'

/** The W3C DeviceOrientation example (stack.md §8): heading of the back of the device. */
function w3cBackHeading(alpha: number, beta: number, gamma: number): number {
  const d = Math.PI / 180
  const [x, y, z] = [beta * d, gamma * d, alpha * d]
  const Vx = -Math.cos(z) * Math.sin(y) - Math.sin(z) * Math.sin(x) * Math.cos(y)
  const Vy = -Math.sin(z) * Math.sin(y) + Math.cos(z) * Math.sin(x) * Math.cos(y)
  let h = Math.atan(Vx / Vy)
  if (Vy < 0) h += Math.PI
  else if (Vx < 0) h += 2 * Math.PI
  return h / d
}

const close = (a: number, b: number, tol = 1e-6) => Math.abs(angleDelta(a, b)) < tol

describe('headingFromEuler', () => {
  it('reads the top edge of a flat phone: heading = 360 − alpha', () => {
    for (const alpha of [0, 10, 90, 180, 270, 359]) expect(close(headingFromEuler(alpha, 0, 0), wrap360(360 - alpha))).toBe(true)
    expect(Number.isNaN(w3cBackHeading(270, 0, 0))).toBe(true)
  })

  it('stays put under small tilts of a flat phone', () => {
    for (const [b, g] of [[5, 0], [-8, 3], [0, 10], [12, -12]] as const) {
      expect(Math.abs(angleDelta(headingFromEuler(100, b, g), 260))).toBeLessThan(13)
    }
  })

  it('agrees with the W3C back-of-device heading whenever the phone is tilted up without roll', () => {
    for (let alpha = 0; alpha < 360; alpha += 17) {
      for (const beta of [20, 45, 70, 90]) expect(close(headingFromEuler(alpha, beta, 0), w3cBackHeading(alpha, beta, 0), 1e-6)).toBe(true)
    }
  })

  it('reads the back of an upright phone facing east', () => {
    expect(close(headingFromEuler(270, 90, 0), 90)).toBe(true)
  })
})

describe('screen and events', () => {
  it('adds the screen angle and wraps', () => {
    expect(withScreen(350, 90)).toBe(80)
    expect(withScreen(10, 0)).toBe(10)
  })

  it('prefers webkitCompassHeading, falls back to absolute alpha, ignores relative events', () => {
    expect(headingFromEvent({ alpha: 10, beta: 0, gamma: 0, absolute: false, webkitCompassHeading: 123 })).toBe(123)
    expect(headingFromEvent({ alpha: 10, beta: 0, gamma: 0, absolute: false, webkitCompassHeading: 123 }, 90)).toBe(213)
    expect(close(headingFromEvent({ alpha: 90, beta: 0, gamma: 0, absolute: true }) as number, 270)).toBe(true)
    expect(headingFromEvent({ alpha: 90, beta: 0, gamma: 0, absolute: false })).toBeNull()
    expect(headingFromEvent({ alpha: null, beta: null, gamma: null, absolute: true })).toBeNull()
    expect(headingFromEvent({ alpha: 1, beta: 0, gamma: 0, absolute: false, webkitCompassHeading: -1 })).toBeNull()
  })
})

describe('luopan lookups', () => {
  it('names the mountain and palace under a heading', () => {
    expect(mountainAt(165)).toEqual({ index: 11, zh: '丙', centre: 165 })
    expect(mountainAt(359)).toMatchObject({ zh: '子' })
    expect(mountainAt(352.4)).toMatchObject({ zh: '壬' })
    expect(mountainAt(352.6)).toMatchObject({ zh: '子' })
    expect(mountainAt(351)).toMatchObject({ zh: '壬' })
    expect(mountainAt(-15)).toMatchObject({ zh: '壬' })
    expect([0, 44, 46, 90, 135, 165, 200, 225, 270, 315, 338].map(palaceAt)).toEqual([1, 8, 8, 3, 4, 9, 9, 2, 7, 6, 1])
  })

  it('angleDelta takes the short way round', () => {
    expect([angleDelta(350, 10), angleDelta(10, 350), angleDelta(0, 180), angleDelta(90, 90)]).toEqual([20, -20, 180, 0])
  })
})

describe('createJumpWatch', () => {
  it('flags repeated jumps over 30° inside the window only', () => {
    const watch = createJumpWatch()
    expect(watch(0, 0)).toBe(false)
    expect(watch(40, 100)).toBe(false)
    expect(watch(0, 200)).toBe(false)
    expect(watch(45, 300)).toBe(true)
    expect(watch(46, 9000)).toBe(false)
  })

  it('ignores steady turning', () => {
    const watch = createJumpWatch()
    let flagged = false
    for (let i = 0; i < 100; i++) flagged ||= watch(i * 10, i * 50)
    expect(flagged).toBe(false)
  })
})

function fakeEnv(opts: { secure?: boolean; permission?: string | 'throw' | null; absolute?: boolean; events?: object[] } = {}) {
  const listeners = new Map<string, (e: Event) => void>()
  const calls: string[] = []
  const env: CompassEnv = {
    secure: opts.secure ?? true,
    orientationEvent:
      opts.permission === null || opts.permission === undefined
        ? {}
        : {
            requestPermission: async () => {
              calls.push('request')
              if (opts.permission === 'throw') throw new Error('NotAllowedError')
              return opts.permission as string
            },
          },
    hasAbsoluteEvent: opts.absolute ?? true,
    addEventListener: (type, l) => {
      calls.push(`add ${type}`)
      listeners.set(type, l)
    },
    removeEventListener: (type) => {
      calls.push(`remove ${type}`)
      listeners.delete(type)
    },
    screenAngle: () => 0,
    wait: async () => {
      for (const e of opts.events ?? []) for (const l of listeners.values()) l(e as Event)
    },
  }
  return { env, calls, listeners }
}

describe('enableCompass', () => {
  it('is unsupported without a secure context or the API', async () => {
    expect((await enableCompass(() => {}, { env: fakeEnv({ secure: false }).env })).status).toBe('unsupported')
    expect((await enableCompass(() => {}, { env: null })).status).toBe('unsupported')
  })

  it('asks iOS for permission first and reports a refusal', async () => {
    const denied = fakeEnv({ permission: 'denied' })
    expect((await enableCompass(() => {}, { env: denied.env })).status).toBe('denied')
    expect(denied.calls).toEqual(['request'])
    const threw = fakeEnv({ permission: 'throw' })
    expect((await enableCompass(() => {}, { env: threw.env })).status).toBe('denied')
  })

  it('goes active on the first absolute reading and stops cleanly', async () => {
    const headings: number[] = []
    const f = fakeEnv({ permission: 'granted', absolute: false, events: [{ alpha: 0, beta: 0, gamma: 0, absolute: false, webkitCompassHeading: 42 }] })
    const s = await enableCompass((h) => headings.push(h), { env: f.env })
    expect(s.status).toBe('active')
    expect(headings).toEqual([42])
    expect(f.calls).toEqual(['request', 'add deviceorientation'])
    s.stop()
    s.stop()
    expect(f.calls).toEqual(['request', 'add deviceorientation', 'remove deviceorientation'])
  })

  it("reports no-data when only null events arrive (desktop Chrome) and removes its listener", async () => {
    const f = fakeEnv({ events: [{ alpha: null, beta: null, gamma: null, absolute: true }] })
    const s = await enableCompass(() => {}, { env: f.env })
    expect(s.status).toBe('no-data')
    expect(f.calls).toEqual(['add deviceorientationabsolute', 'remove deviceorientationabsolute'])
    expect(f.listeners.size).toBe(0)
  })
})
