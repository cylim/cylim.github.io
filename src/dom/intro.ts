import { journey, visibleSections, type JourneyState } from '../core/store/journey'
import { motion } from '../theme/tokens'

/**
 * First-load loading screen (index.html #intro, src/styles/intro.css). The head script raises it on a
 * plain first load of the walk; this claims it (data-intro="app", so the head script's failsafe
 * stands down), fills its ink line from the real stage phase and lifts it once the forest is live
 * and every section the camera can see is ready, the benchmark sends the visitor to the album, or the
 * context is lost. It is a gate: past it, the trees and the scene around the camera are drawn.
 * `motion.intro.max` is only a guard against a load that hangs.
 */

const SEEN_KEY = 'cy.introSeen'

type IntroState = Pick<JourneyState, 'mode' | 'stage' | 'u' | 'ready'>

/** Every section the stage shows at this position has loaded and compiled. */
const scenesReady = (s: IntroState) => visibleSections(s.u).every((id) => s.ready[id] === true)

/** How full the ink line is for a stage phase. */
export function introProgress(s: IntroState): number {
  if (s.mode === 'static') return 1
  switch (s.stage) {
    case 'none':
      return 0.15
    case 'loading':
      return 0.45
    case 'benchmark':
      return 0.8
    case 'live':
      return scenesReady(s) ? 1 : 0.9
    default:
      return 1
  }
}

/** The forest and the scenes in view are showing (or never will): time to lift. */
export function introDone(s: IntroState): boolean {
  return s.mode === 'static' || s.stage === 'lost' || (s.stage === 'live' && scenesReady(s))
}

/**
 * Starts the controller when the head script raised the screen. `now` is ms since navigation start
 * (the screen has been up since first paint). The brushwork gets its full `min` on the first load in
 * a tab only; later loads lift as soon as the stage is live. Returns a stop function.
 */
export function startIntro(html: HTMLElement = document.documentElement, now: () => number = () => performance.now()): () => void {
  const el = document.getElementById('intro')
  if (!el || !html.hasAttribute('data-intro')) return () => {}
  html.setAttribute('data-intro', 'app')

  let firstInTab = true
  try {
    firstInTab = sessionStorage.getItem(SEEN_KEY) === null
    sessionStorage.setItem(SEEN_KEY, '1')
  } catch {
    // Storage blocked: treat every load as the first.
  }
  const minAt = firstInTab && !journey.getState().reducedMotion ? motion.intro.min : 0
  const timers: ReturnType<typeof setTimeout>[] = []
  let lifted = false
  let scheduled = false

  const lift = () => {
    if (lifted) return
    lifted = true
    unsubscribe()
    el.style.setProperty('--p', '1')
    html.setAttribute('data-intro', 'out')
    timers.push(setTimeout(() => html.removeAttribute('data-intro'), motion.intro.out))
  }
  const liftAfterMin = () => {
    if (scheduled) return
    scheduled = true
    const wait = minAt - now()
    if (wait <= 0) lift()
    else timers.push(setTimeout(lift, wait))
  }

  const sync = (s: JourneyState) => {
    el.style.setProperty('--p', String(introProgress(s)))
    if (introDone(s)) liftAfterMin()
  }
  const unsubscribe = journey.subscribe(sync)
  timers.push(setTimeout(lift, Math.max(0, motion.intro.max - now())))
  sync(journey.getState())

  return () => {
    unsubscribe()
    for (const t of timers) clearTimeout(t)
    html.removeAttribute('data-intro')
  }
}
