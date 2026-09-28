/**
 * Starts device-compass mode (stack.md §8). Call it from inside the button's click handler:
 * iOS only grants DeviceOrientationEvent.requestPermission() during a user gesture, so the
 * permission request is the first thing this does. The DOM compass button writes the result to
 * the store's `compass.status`.
 */

import { headingFromEvent, type OrientationReading } from './heading'

export type CompassResult = 'active' | 'denied' | 'unsupported' | 'no-data'

export interface CompassSession {
  status: CompassResult
  /** Removes the listener. Safe to call more than once, and on a failed session. */
  stop(): void
}

type Listener = (e: Event) => void

/** The browser surface this touches, injectable for tests. */
export interface CompassEnv {
  readonly secure: boolean
  readonly orientationEvent: { requestPermission?: (absolute?: boolean) => Promise<string> } | undefined
  /** Chromium's `deviceorientationabsolute` exists. */
  readonly hasAbsoluteEvent: boolean
  addEventListener(type: string, listener: Listener): void
  removeEventListener(type: string, listener: Listener): void
  screenAngle(): number
  wait(ms: number): Promise<void>
}

export function browserCompassEnv(): CompassEnv | null {
  if (typeof window === 'undefined') return null
  const DOE = (window as Window & { DeviceOrientationEvent?: CompassEnv['orientationEvent'] }).DeviceOrientationEvent
  return {
    secure: window.isSecureContext,
    orientationEvent: DOE,
    hasAbsoluteEvent: 'ondeviceorientationabsolute' in window,
    addEventListener: (type, l) => window.addEventListener(type, l),
    removeEventListener: (type, l) => window.removeEventListener(type, l),
    screenAngle: () => window.screen?.orientation?.angle ?? 0,
    wait: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  }
}

/** Show the compass button only where this can work (design.md §9.9 adds `(pointer: coarse)`). */
export function compassAvailable(env: CompassEnv | null = browserCompassEnv()): boolean {
  return !!env && env.secure && !!env.orientationEvent
}

const failed = (status: CompassResult): CompassSession => ({ status, stop: () => {} })

/**
 * Requests permission where needed, listens, and waits `waitMs` for a first absolute reading.
 * Desktop Chrome fires a single null event, hence 'no-data'.
 */
export async function enableCompass(
  onHeading: (deg: number) => void,
  { env = browserCompassEnv(), waitMs = 1500 }: { env?: CompassEnv | null; waitMs?: number } = {},
): Promise<CompassSession> {
  if (!env || !compassAvailable(env)) return failed('unsupported')
  const request = env.orientationEvent?.requestPermission
  if (typeof request === 'function') {
    const res = await request.call(env.orientationEvent, true).catch(() => 'denied')
    if (res !== 'granted') return failed('denied')
  }
  const type = env.hasAbsoluteEvent ? 'deviceorientationabsolute' : 'deviceorientation'
  let got = false
  const listener: Listener = (e) => {
    const h = headingFromEvent(e as unknown as OrientationReading, env.screenAngle())
    if (h == null) return
    got = true
    onHeading(h)
  }
  let stopped = false
  const stop = () => {
    if (stopped) return
    stopped = true
    env.removeEventListener(type, listener)
  }
  env.addEventListener(type, listener)
  await env.wait(waitMs)
  if (!got) {
    stop()
    return { status: 'no-data', stop }
  }
  return { status: 'active', stop }
}
