import { createRoot, type Root } from 'react-dom/client'
import { journey, type RenderMode, type StaticReason } from '../store/journey'
import { motion } from '../../theme/tokens'
import { ui } from '../../content/ui'
import Stage from './Stage'
import type { RevealKind, StartupMode } from './QualityController'
import { cancelReveal } from './reveal'
import { showToast } from './toast'
import { pinnedTier } from './tierPin'
import { prepareEnvironment } from '../../env/prepare'

/** Mirrors boot: the store and `<html data-mode>` / `data-static-reason` change together. */
function setMode(mode: RenderMode, reason: StaticReason | null): void {
  const html = document.documentElement
  html.dataset.mode = mode
  if (reason) html.dataset.staticReason = reason
  else delete html.dataset.staticReason
  journey.setState({ mode, staticReason: reason })
}

/**
 * Entry of the stage chunk. main.tsx imports this lazily (idle, after load) in immersive mode,
 * so three, R3F and the scenes never block first paint. Returns an unmount function.
 *
 * Lifecycle (store `stage`): 'loading' → 'benchmark' (hidden, opacity 0) → 'live' (faded in).
 * Two exits (design.md §13.2–13.3):
 * - the benchmark is too slow on low: unmount, switch to the album (`mode: 'static'`) and toast
 *   "Walk the forest anyway", which remounts without the benchmark;
 * - webglcontextlost: unmount, `stage: 'lost'` (the DOM shows the section still), toast "Tap to
 *   restart", which rebuilds the renderer; only the sections near the camera mount again.
 */
export function mountStage(container: HTMLElement, eventSource: HTMLElement): () => void {
  let root: Root | null = null
  let alive = true
  // Each mount is a session. Callbacks from an older session are ignored: unmounting a Canvas makes
  // R3F call forceContextLoss(), whose webglcontextlost must not read as the GPU dropping us.
  let session = 0

  const unmountRoot = () => {
    session++
    root?.unmount()
    root = null
    cancelReveal()
  }

  const reveal = (kind: RevealKind) => {
    const ms = kind === 'fade' ? motion.canvas.revealReduced : motion.canvas.fadeIn
    container.style.transition = kind === 'instant' ? 'none' : `opacity ${ms}ms linear`
    container.style.opacity = '1'
  }

  // Only the current session may act, and unmounting a root from inside its own render or frame
  // callback is not allowed, so step out first.
  const later = (mine: number, fn: () => void) => () => {
    if (mine === session) setTimeout(() => alive && mine === session && fn(), 0)
  }

  const slow = () => {
    unmountRoot()
    journey.setState({ stage: 'none' })
    setMode('static', 'slow')
    showToast({
      message: ui.slowDevice,
      actionLabel: ui.slowDeviceAction,
      onAction: () => {
        if (!alive) return
        setMode('immersive', null)
        mount('skip')
      },
    })
  }

  const lost = () => {
    unmountRoot()
    container.style.transition = 'none'
    container.style.opacity = '0'
    journey.setState({ stage: 'lost' })
    showToast({ message: ui.contextLost, onAction: () => alive && mount('skip') })
  }

  function mount(startup: StartupMode) {
    unmountRoot()
    const { tier, reducedMotion } = journey.getState()
    container.style.transition = 'none'
    container.style.opacity = '0'
    journey.setState({ stage: 'loading' })
    const mine = session
    root = createRoot(container)
    root.render(
      <Stage
        eventSource={eventSource}
        initialTier={tier}
        reducedMotion={reducedMotion}
        startup={startup}
        onReveal={reveal}
        onSlow={later(mine, slow)}
        onContextLost={later(mine, lost)}
      />,
    )
  }

  // The forest plan, needle atlas and paper grain are built in workers first, so the stage's first
  // render doesn't block the main thread for them (QM-P3). The page stays interactive meanwhile.
  journey.setState({ stage: 'loading' })
  void prepareEnvironment().then(() => {
    if (alive && root === null) mount(journey.getState().e2e ? 'e2e' : pinnedTier() ? 'skip' : 'benchmark')
  })

  return () => {
    alive = false
    unmountRoot()
    container.style.opacity = ''
    container.style.transition = ''
    journey.setState({ stage: 'none' })
  }
}
