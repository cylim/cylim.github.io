import { advance, invalidate, type RootState } from '@react-three/fiber'
import { journey } from '../store/journey'
import { motion } from '../../theme/tokens'

/**
 * Frame pacing for the live stage (design.md §13.3): the tier frame cap, idle throttling (20 fps
 * after 5 s with no input and no animation, stopped after 30 s) and hidden tabs.
 *
 * R3F keeps the `frameloop` the Canvas was given ('always', or 'demand' under reduced motion).
 * Switching frameloop at runtime would reset `clock.elapsedTime` and jump every time-based
 * shader, so throttling instead parks R3F's own loop (`internal.active = false`) and drives
 * frames with `advance()` from a paced rAF loop. Waking hands the loop back to R3F.
 *
 * Anything that animates on its own time (ignition, casting, the seal, a live-hour change while
 * the grove is on screen) must call `wake(ms)` or hold `holdAwake()` so the stage keeps its
 * full rate; a stopped stage runs no useFrame, so time-based triggers need their own timer.
 */

type Mode = { kind: 'native' } | { kind: 'paced'; fps: number } | { kind: 'stopped' }

const IDLE_FPS = 20

let getRoot: (() => RootState) | null = null
let mode: Mode = { kind: 'native' }
let lastActivity = 0
let awakeUntil = 0
let holds = 0
let cap: number | null = null
let raf = 0
let lastPaced = 0
let timer: ReturnType<typeof setTimeout> | null = null

const now = () => performance.now()

function setActive(active: boolean): void {
  const state = getRoot?.()
  if (!state) return
  if (active && !state.internal.active) {
    state.internal.active = true
    invalidate(state)
  } else if (!active) state.internal.active = false
}

function pacedTick(t: number): void {
  raf = 0
  if (mode.kind !== 'paced' || !getRoot) return
  raf = requestAnimationFrame(pacedTick)
  if (t - lastPaced >= 1000 / mode.fps - 1.5) {
    lastPaced = t
    advance(t, true, getRoot())
  }
}

function apply(next: Mode): void {
  const same = next.kind === mode.kind && (next.kind !== 'paced' || (mode.kind === 'paced' && mode.fps === next.fps))
  mode = next
  if (same) return
  if (next.kind === 'native') {
    if (raf) cancelAnimationFrame(raf)
    raf = 0
    setActive(true)
  } else if (next.kind === 'paced') {
    setActive(false)
    if (!raf) raf = requestAnimationFrame(pacedTick)
  } else {
    if (raf) cancelAnimationFrame(raf)
    raf = 0
    setActive(false)
  }
}

function evaluate(): void {
  if (timer) clearTimeout(timer)
  timer = null
  if (!getRoot) return
  const t = now()
  const idle = t - lastActivity
  const awake = holds > 0 || t < awakeUntil
  const { throttleAfter, stopAfter } = motion.idle
  if (document.visibilityState === 'hidden') apply({ kind: 'stopped' })
  else if (!awake && idle >= stopAfter) apply({ kind: 'stopped' })
  else if (!awake && idle >= throttleAfter) apply({ kind: 'paced', fps: Math.min(IDLE_FPS, cap ?? IDLE_FPS) })
  else apply(cap ? { kind: 'paced', fps: cap } : { kind: 'native' })

  if (mode.kind === 'stopped' || holds > 0) return
  const due = awake ? Math.max(awakeUntil, t + 250) : idle < throttleAfter ? lastActivity + throttleAfter : lastActivity + stopAfter
  timer = setTimeout(evaluate, Math.max(16, due - t))
}

/** Input or a state change: back to full rate at once if throttled, else just restart the idle clock. */
function activity(): void {
  lastActivity = now()
  if (!getRoot) return
  const full = cap ? mode.kind === 'paced' && mode.fps === cap : mode.kind === 'native'
  if (!full || !timer) evaluate()
}

/** Keep the stage at full rate for at least `ms` (a time-based animation starting). */
export function wake(ms = 0): void {
  awakeUntil = Math.max(awakeUntil, now() + ms)
  activity()
}

/** Keep the stage at full rate until the returned release is called. */
export function holdAwake(): () => void {
  holds++
  activity()
  let released = false
  return () => {
    if (released) return
    released = true
    holds = Math.max(0, holds - 1)
    activity()
  }
}

/** The tier frame cap (30 or 60 fps), or null for the display rate. QualityController sets it. */
export function setFrameCap(fps: number | null): void {
  if (cap === fps) return
  cap = fps
  if (getRoot) evaluate()
}

/** True when frames are paced for idleness or stopped, so frame times say nothing about the GPU. */
export function isThrottled(): boolean {
  if (mode.kind === 'stopped') return true
  return mode.kind === 'paced' && mode.fps !== cap
}

/** Coming back to a tab counts as activity; leaving it stops the stage. */
function onVisibility(): void {
  if (document.visibilityState === 'visible') lastActivity = now()
  evaluate()
}

const INPUT_EVENTS = ['scroll', 'wheel', 'pointermove', 'pointerdown', 'keydown', 'touchstart', 'touchmove', 'resize', 'focusin'] as const

/** Start pacing a live root. Returns the stop function, which hands the loop back to R3F. */
export function startFrameGovernor(get: () => RootState): () => void {
  getRoot = get
  mode = { kind: 'native' }
  lastActivity = now()
  const opts: AddEventListenerOptions = { passive: true, capture: true }
  for (const e of INPUT_EVENTS) window.addEventListener(e, activity, opts)
  document.addEventListener('visibilitychange', onVisibility)
  const unsubscribe = journey.subscribe(activity)
  evaluate()
  return () => {
    for (const e of INPUT_EVENTS) window.removeEventListener(e, activity, opts)
    document.removeEventListener('visibilitychange', onVisibility)
    unsubscribe()
    if (timer) clearTimeout(timer)
    timer = null
    apply({ kind: 'native' })
    getRoot = null
  }
}
