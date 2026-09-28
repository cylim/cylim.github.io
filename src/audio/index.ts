/**
 * Sound for the walk (design.md §12). Muted by default: main.tsx imports this chunk the first time
 * the visitor turns sound on in the walk and calls `startAudio()`. Everything is synthesised; there
 * is nothing to fetch.
 *
 * The session follows the store through `journey.subscribe` (never React):
 * - `soundOn` fades the output in or out over 2 s; the context suspends once it is silent.
 * - Scroll position, `insideCabin`, `dive`, `paper`, `ringSpeed` and `finale` drive the mix and the
 *   one-shot cues (mix.ts, triggers.ts).
 * - A hidden tab suspends the context; coming back resumes it if sound is on.
 *
 * Page events it listens for:
 * - CY_EVENT.key (core/events.ts): one terminal keystroke (the DOM terminal emits it per input).
 * - CY_EVENT.recast: the live chart turned to a new 时辰; chimes when the grove is on screen.
 */

import { CY_EVENT } from '../core/events'
import { journey, type JourneyState } from '../core/store/journey'
import { CHIME_MIN_GAP_S, FADE_IN_S, FADE_OUT_S, KEYS_MAX_PER_SECOND } from './cues'
import { Engine } from './engine'
import { renderSamples, type SampleSet } from './samples'
import { createDetents, createRateGate, createTriggers, groveOnScreen } from './triggers'

interface Session {
  readonly ready: Promise<void>
  close(): Promise<void>
}

let session: Session | null = null

/**
 * Start the sound. Call it from the gesture that turned sound on: the AudioContext is created
 * synchronously, before the first await, so the gesture counts. If the browser still holds the
 * context suspended, the next tap or key resumes it. Idempotent: later calls return the same
 * promise, which resolves once the beds are running. It never rejects; a failure logs a warning
 * and leaves the site silent.
 */
export function startAudio(): Promise<void> {
  session ??= open()
  return session.ready
}

const GESTURES = ['pointerdown', 'keydown', 'touchend'] as const

/**
 * Render the samples in a worker: over a second of synthesis on a mid-range phone, which would
 * otherwise stall the scroll right after the tap. If a worker can't start, render them here.
 */
function loadSamples(sampleRate: number, seed: number): Promise<SampleSet> {
  return new Promise<SampleSet>((resolve, reject) => {
    const worker = new Worker(new URL('./samples.worker.ts', import.meta.url), { type: 'module' })
    worker.addEventListener('message', (e: MessageEvent<SampleSet>) => {
      worker.terminate()
      resolve(e.data)
    })
    worker.addEventListener('error', (e) => {
      worker.terminate()
      reject(e instanceof ErrorEvent ? e.error : e)
    })
    worker.postMessage({ sampleRate, seed }, [])
  }).catch((error: unknown) => {
    console.warn('Sound worker failed; rendering on the main thread:', error)
    return renderSamples(sampleRate, seed)
  })
}

const audible = () => journey.getState().soundOn && document.visibilityState === 'visible'

/** Did anything the mix or the cues read change? Most store writes (pins, lag fog, hovers) are not for us. */
const heard = (s: JourneyState, prev: JourneyState) =>
  s.jvh !== prev.jvh ||
  s.insideCabin !== prev.insideCabin ||
  s.dive !== prev.dive ||
  s.paper !== prev.paper ||
  s.ringSpeed !== prev.ringSpeed ||
  s.ignitionPlayed !== prev.ignitionPlayed ||
  s.finale !== prev.finale

function open(): Session {
  let ctx: AudioContext
  try {
    ctx = new AudioContext({ latencyHint: 'interactive' })
  } catch (error) {
    console.warn('Sound is unavailable:', error)
    return { ready: Promise.resolve(), close: async () => {} }
  }
  const engine = new Engine(ctx)
  const triggers = createTriggers(journey.getState())
  const detents = createDetents()
  const keyGate = createRateGate(KEYS_MAX_PER_SECOND)
  const chimeGate = createRateGate(1 / CHIME_MIN_GAP_S)
  let suspendTimer: ReturnType<typeof setTimeout> | undefined
  let spinRaf = 0
  let spinAt = 0
  let warned = false

  // If autoplay rules hold the context (no gesture yet, or the chunk arrived after it expired), the
  // next tap or key in the page resumes it. Browsers may leave resume()'s promise pending until then.
  const onGesture = () => {
    if (audible()) void ctx.resume().catch(() => {})
  }
  const disarm = () => {
    for (const type of GESTURES) removeEventListener(type, onGesture, true)
  }
  ctx.addEventListener('statechange', () => {
    if (ctx.state === 'running') disarm()
  })
  const resume = () => {
    if (ctx.state === 'running' || ctx.state === 'closed') return
    void ctx.resume().catch(() => {})
    for (const type of GESTURES) addEventListener(type, onGesture, { capture: true, passive: true })
  }
  if (audible()) resume()

  const setSound = (on: boolean) => {
    clearTimeout(suspendTimer)
    if (on) {
      if (document.visibilityState === 'visible') resume()
      engine.fade(1, FADE_IN_S)
    } else {
      engine.fade(0, FADE_OUT_S)
      suspendTimer = setTimeout(() => {
        if (!journey.getState().soundOn && ctx.state === 'running') void ctx.suspend()
      }, FADE_OUT_S * 1000 + 100)
    }
  }

  // Detents come from integrating ring speed, which the grove writes only when it changes, so a
  // frame loop runs while the rings turn and stops with them.
  const spin = (t: number) => {
    const speed = journey.getState().ringSpeed
    if (detents.step(speed, t / 1000, (t - spinAt) / 1000) && audible()) engine.detent()
    spinAt = t
    spinRaf = speed > 0 ? requestAnimationFrame(spin) : 0
  }

  const onState = (s: JourneyState, prev: JourneyState) => {
    // This runs inside other modules' setState calls (the scroll driver, the rig); it must never throw into them.
    try {
      if (s.soundOn !== prev.soundOn) setSound(s.soundOn)
      if (!engine.built || !heard(s, prev)) return
      for (const cue of triggers.step(prev, s)) engine.play(cue)
      engine.apply(s)
      if (s.ringSpeed > 0 && !spinRaf) {
        spinAt = performance.now()
        spinRaf = requestAnimationFrame(spin)
      }
    } catch (error) {
      if (!warned) console.warn('Sound update failed:', error)
      warned = true
    }
  }

  const onVisibility = () => {
    if (document.visibilityState === 'hidden') void ctx.suspend()
    else if (journey.getState().soundOn) resume()
  }
  const onKey = () => {
    if (engine.built && audible() && keyGate(performance.now() / 1000)) engine.key()
  }
  const onRecast = () => {
    if (engine.built && audible() && groveOnScreen(journey.getState()) && chimeGate(performance.now() / 1000)) engine.chime()
  }

  const unsubscribe = journey.subscribe(onState)
  document.addEventListener('visibilitychange', onVisibility)
  addEventListener(CY_EVENT.key, onKey)
  addEventListener(CY_EVENT.recast, onRecast)

  const ready = (async () => {
    try {
      await engine.build(() => loadSamples(ctx.sampleRate, engine.seed))
      engine.apply(journey.getState(), true)
      if (journey.getState().soundOn) setSound(true)
      else void ctx.suspend()
    } catch (error) {
      console.warn('Sound failed to start:', error)
    }
  })()

  return {
    ready,
    async close() {
      unsubscribe()
      document.removeEventListener('visibilitychange', onVisibility)
      removeEventListener(CY_EVENT.key, onKey)
      removeEventListener(CY_EVENT.recast, onRecast)
      disarm()
      cancelAnimationFrame(spinRaf)
      clearTimeout(suspendTimer)
      await ready
      engine.fade(0, 0.15)
      await new Promise((resolve) => setTimeout(resolve, 200))
      engine.dispose()
      await ctx.close().catch(() => {})
    },
  }
}
