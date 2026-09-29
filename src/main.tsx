import './theme/tokens.css'
import './styles/base.css'

import { StrictMode } from 'react'
import { flushSync } from 'react-dom'
import { createRoot, hydrateRoot } from 'react-dom/client'
import { ContentLayer } from './dom/ContentLayer'
import { journey } from './core/store/journey'
import { parseBootParams } from './core/boot/params'
import { readPrefs } from './core/boot/prefs'
import { decideBoot } from './core/boot/mode'
import { probeWebgl2 } from './core/boot/webgl'
import { startViewportWatch } from './core/boot/viewport'
import { exposeE2E } from './core/boot/e2e'
import { initHashNav, scrollToJvh, startScrollDriver } from './core/scroll'
import { startIntro } from './dom/intro'
import { startSectionPrefetch } from './core/sections/prefetch'
import { stillJvh } from './core/world/beats'

/**
 * Boot (stack.md §2, design.md §13.2): decide the render mode, hydrate the prerendered content,
 * wire scroll, dives and hash navigation, then idle-import the stage. three never loads in the album.
 */

const root = document.getElementById('root')
const stageEl = document.getElementById('stage')
if (!root || !stageEl) throw new Error('index.html is missing #root or #stage')

const html = document.documentElement
const params = parseBootParams(location.search)
const prefs = readPrefs()
const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } }
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches
const coarsePointer = matchMedia('(pointer: coarse)').matches

// Same rules as the inline head script, plus a real WebGL2 context (only created when the cheap checks pass).
const decision = decideBoot(params, prefs, {
  hasWebgl2: 'WebGL2RenderingContext' in window,
  reducedMotion,
  saveData: nav.connection?.saveData === true,
  deviceMemory: nav.deviceMemory,
  cores: nav.hardwareConcurrency,
  coarsePointer,
  probe: probeWebgl2,
})
html.dataset.mode = decision.mode
// The head script records its reason; boot may overturn it (a failed WebGL2 probe), so it restates it.
if (decision.staticReason) html.dataset.staticReason = decision.staticReason
else delete html.dataset.staticReason
const deterministic = params.e2e || params.still !== null
if (params.still) {
  // Stills are the painting alone (album leaves, og.png).
  html.dataset.still = params.still
  root.style.visibility = 'hidden'
}

journey.setState({
  mode: decision.mode,
  staticReason: decision.staticReason,
  tier: decision.tier,
  reducedMotion,
  e2e: deterministic,
  clock: { frozen: deterministic, time: 0 },
  nowOverride: params.now,
  soundOn: prefs.sound ?? false,
  portrait: innerWidth < innerHeight,
  showEnglish: coarsePointer,
})

// Prerendered HTML is hydrated; the dev server serves the empty <!--content--> slot, so render fresh
// and synchronously, so the scroll length and anchors exist before the scroll driver measures them.
const app = (
  <StrictMode>
    <ContentLayer />
  </StrictMode>
)
if (root.firstElementChild) hydrateRoot(root, app)
else {
  const fresh = createRoot(root)
  flushSync(() => fresh.render(app))
}

const immersive = decision.mode === 'immersive'
// The head script raised the loading screen; boot's probe may have overturned the walk since.
if (immersive && !deterministic) startIntro()
else delete html.dataset.intro
// Wheel smoothing on desktop only; touch stays native, and motion-sensitive and test runs get plain scroll.
startScrollDriver({ smoothWheel: immersive && !reducedMotion && !deterministic && matchMedia('(pointer: fine)').matches })
startViewportWatch()
if (deterministic) exposeE2E()
initHashNav()
if (immersive) startSectionPrefetch()
if (params.still) void scrollToJvh(stillJvh(params.still))

// Production only, and never for test or still runs: see scripts/sw/sw.js.
if (import.meta.env.PROD && !deterministic && 'serviceWorker' in navigator) {
  addEventListener('load', () => void navigator.serviceWorker.register('/sw.js').catch(() => {}), { once: true })
}

if (immersive) {
  const mount = () => {
    void import('./core/render/mountStage').then(({ mountStage }) => mountStage(stageEl, root))
  }
  const idle = () => (typeof requestIdleCallback === 'function' ? requestIdleCallback(mount, { timeout: 2000 }) : setTimeout(mount, 1))
  if (document.readyState === 'complete') idle()
  else addEventListener('load', idle, { once: true })
  mountAudioOnSound()
}

/**
 * Sound (design.md §12): src/audio loads the first time the visitor turns sound on, and that click is
 * the gesture an AudioContext needs. A saved "on" waits for the first press or key instead. After
 * startAudio the module follows `soundOn` itself. Walk only: the album has no sound toggle.
 */
function mountAudioOnSound(): void {
  let started = false
  const start = () => {
    if (started) return
    started = true
    // A failed chunk or a refused AudioContext costs the sound only, never the walk.
    import('./audio')
      .then((m) => m.startAudio())
      .catch((err: unknown) => console.warn('Sound failed to start', err))
  }
  const unsubscribe = journey.subscribe((s, prev) => {
    if (s.soundOn && !prev.soundOn) {
      unsubscribe()
      start()
    }
  })
  if (journey.getState().soundOn) {
    const onGesture = () => {
      removeEventListener('pointerdown', onGesture, true)
      removeEventListener('keydown', onGesture, true)
      if (journey.getState().soundOn) start()
    }
    addEventListener('pointerdown', onGesture, true)
    addEventListener('keydown', onGesture, true)
  }
}
