/**
 * The fog-dive (design.md §11.1, stack.md §3): into paper, jump, let the target mount, out of paper.
 * Used by nav clicks, the home mark, map pins, "Walk again", the terminal's `grove`, popstate and
 * deep links. Three-free; ships in the boot chunk.
 *
 * Phases on `journey.dive`: in (0 → 1, ease-in cubic) → hold (scroll jumps to the arrival, the
 * camera snaps to the emerge pose, wait for the section, give up after 5 s) → out (1 → 0, ease-out
 * cubic; the camera glides onto the arrival) → idle, then focus the heading and announce.
 *
 * - A newer jump cancels an older one (token). Scrolling by hand while going in aborts back to
 *   where you were; during the hold it emerges at once.
 * - Within 100 jvh there is no dive: the page glides along the path for 1.2 s.
 * - Reduced motion: a short crossfade through paper, no dolly. e2e: 50 ms each way.
 * - The album (static mode) has no dives: plain jumps to the leaf top, just under the header.
 */

import { CY_EVENT, emit } from '../events'
import { journey, type DiveState, type JourneyState } from '../store/journey'
import { J, SECTION_SPANS } from '../world/beats'
import { SECTION_HASH, walkSection, type SectionId } from '../sections/ids'
import { registry } from '../sections/registry'
import { prefetchSection } from '../sections/prefetch'
import { easing, motion } from '../../theme/tokens'
import { ui } from '../../content/ui'
import { fill } from '../../content/format'
import { lastModality } from './modality'
import { albumTopY, pinAlbumLeaf, scrollToYInstant, scrollYAtJvh, sectionUrl, smoothScrollToY, watchScrollIntent } from './ScrollDriver'

/** Jumps closer than this glide instead of diving (§11.1). */
export const NEAR_JUMP_JVH = 100

let token = 0
let raf = 0
/** Ends the current hold early (a hand scroll during the hold). */
let interruptHold: (() => void) | null = null

const setDive = (patch: Partial<DiveState>) => journey.setState((s) => ({ dive: { ...s.dive, ...patch } }))

function durations(s: JourneyState, to: SectionId) {
  if (s.e2e) return { in: motion.dive.e2e, out: motion.dive.e2e }
  if (s.reducedMotion) return { in: motion.dive.reduced / 2, out: motion.dive.reduced / 2 }
  return { in: motion.dive.in, out: to === 'cabin' ? motion.dive.outCabin : motion.dive.out }
}

/** Animate dive.amount toward `to`. Resolves false if a newer dive took over. */
function tween(to: number, ms: number, ease: (t: number) => number, my: number): Promise<boolean> {
  cancelAnimationFrame(raf)
  const from = journey.getState().dive.amount
  // Continuing from part-way (a jump during an emerge) keeps the same speed.
  const span = Math.abs(to - from)
  const duration = ms * span
  return new Promise((resolve) => {
    if (duration <= 0) {
      setDive({ amount: to })
      resolve(my === token)
      return
    }
    const t0 = performance.now()
    const step = (now: number) => {
      if (my !== token) return resolve(false)
      const t = Math.min(1, (now - t0) / duration)
      setDive({ amount: from + (to - from) * ease(t) })
      if (t < 1) raf = requestAnimationFrame(step)
      else resolve(true)
    }
    raf = requestAnimationFrame(step)
  })
}

/** Wait until the target section is mounted and prewarmed, if a stage is there to mount it. */
function waitReady(id: SectionId, my: number): Promise<void> {
  const s = journey.getState()
  const staged = s.mode === 'immersive' && (s.stage === 'loading' || s.stage === 'benchmark' || s.stage === 'live')
  if (!staged || s.ready[id] === true) return Promise.resolve()
  return new Promise((resolve) => {
    let settled = false
    const done = () => {
      if (settled) return
      settled = true
      unsubscribe()
      window.clearTimeout(timer)
      interruptHold = null
      if (my === token) setDive({ waiting: false })
      resolve()
    }
    setDive({ waiting: true })
    const unsubscribe = journey.subscribe((st) => {
      if (my !== token || st.ready[id] === true || st.stage === 'lost' || st.stage === 'none') done()
    })
    const timer = window.setTimeout(done, motion.dive.giveUp)
    interruptHold = done
  })
}

/** How long an album jump keeps its leaf in place while late content lays out. */
const ALBUM_HOLD_MS = 2500

/**
 * Album leaves change height after hydration (the chart, the live terminal and the colophon mount
 * client-only), which can push a freshly reached leaf out of view. The scroll driver keeps it under
 * the header on every re-measure until the layout settles, the visitor scrolls, or another jump starts.
 */
function holdAlbumLeaf(section: HTMLElement, my: number): void {
  pinAlbumLeaf(section)
  let timer = 0
  const stop = () => {
    stopWatch()
    window.clearTimeout(timer)
    if (my === token) pinAlbumLeaf(null)
  }
  const stopWatch = watchScrollIntent(stop)
  timer = window.setTimeout(stop, ALBUM_HOLD_MS)
}

/**
 * Move focus to the section heading. `data-jump-focus` tells base.css whether to draw the ring: only
 * when the jump came from the keyboard, whatever the browser's :focus-visible heuristic says.
 */
function focusHeading(id: SectionId): void {
  const h = document.getElementById(`${id}-heading`)
  if (!h) return
  h.dataset.jumpFocus = lastModality() === 'keyboard' ? 'keyboard' : 'pointer'
  h.addEventListener('blur', () => delete h.dataset.jumpFocus, { once: true })
  h.focus({ preventScroll: true })
}

/**
 * Settle a jump (design.md §11.1, §4.3): focus the section heading and announce it. A deep link on
 * first load leaves focus alone: the browser's own fragment handling and the announcement suffice,
 * and the visitor hasn't asked to move anywhere yet.
 */
function settle(id: SectionId, fromLoad = false): void {
  if (!fromLoad) focusHeading(id)
  announce(fill(ui.nowAt, { label: registry[id].label }))
}

/**
 * Ask the DOM live region to speak. core/ can't import the DOM layer, so this is an event:
 * `cy:announce` (core/events.ts) with the message as its detail.
 */
function announce(message: string): void {
  emit(CY_EVENT.announce, message)
}

/** Put the URL back on the section we are actually in (after an aborted dive). */
function restoreHash(): void {
  const hash = SECTION_HASH[journey.getState().active]
  if (location.hash !== hash) history.replaceState(history.state, '', sectionUrl(hash))
}

/** Abort a dive that is still going in: fade back out where we were. */
function abort(): void {
  const my = ++token
  interruptHold = null
  restoreHash()
  setDive({ phase: 'out', to: null, waiting: false })
  void tween(0, motion.dive.reduced, easing.outCubic, my).then((ok) => {
    if (ok) setDive({ phase: 'idle', amount: 0 })
  })
}

function onHandScroll(): void {
  const { phase } = journey.getState().dive
  if (phase === 'in') abort()
  else if (phase === 'hold') interruptHold?.()
}

export interface DiveOptions {
  /** First load with a deep link: start in full paper and run only the emerge (§6.2). */
  fromLoad?: boolean
}

/** Fog-dive to a section's arrival. Resolves when it has settled or was superseded. History is the caller's job. */
export async function diveTo(target: SectionId, opts: DiveOptions = {}): Promise<void> {
  // A paused section (the grove) lands where its links do.
  const id = walkSection(target)
  const my = ++token
  interruptHold?.()
  const s = journey.getState()
  const arrival = SECTION_SPANS[id].arrivalJvh

  if (s.mode === 'static') {
    cancelAnimationFrame(raf)
    if (s.dive.phase !== 'idle') setDive({ phase: 'idle', amount: 0, to: null, waiting: false })
    const section = document.getElementById(id)
    if (section) {
      const y = albumTopY(section)
      if (opts.fromLoad || s.reducedMotion || s.e2e) scrollToYInstant(y)
      else if (!(await smoothScrollToY(y)) || my !== token) return
      holdAlbumLeaf(section, my)
    }
    // The scroll event that recomputes it lands a frame later; the arrival is already known.
    journey.setState({ active: id })
    settle(id, opts.fromLoad)
    return
  }

  prefetchSection(id)
  if (!opts.fromLoad && s.dive.phase === 'idle' && Math.abs(s.jvh - arrival) < NEAR_JUMP_JVH) {
    const y = scrollYAtJvh(arrival)
    if (s.reducedMotion || s.e2e) scrollToYInstant(y)
    else if (!(await smoothScrollToY(y)) || my !== token) return
    settle(id)
    return
  }

  const d = durations(s, id)
  const stopWatch = watchScrollIntent(onHandScroll)
  try {
    if (opts.fromLoad) {
      cancelAnimationFrame(raf)
      setDive({ phase: 'hold', amount: 1, to: id, waiting: false })
    } else {
      setDive({ phase: 'in', to: id, waiting: false })
      if (!(await tween(1, d.in, easing.inCubic, my))) return
    }

    // Swap under full paper: jump the scroll, place the camera on the emerge pose.
    setDive({ phase: 'hold', amount: 1 })
    scrollToYInstant(scrollYAtJvh(arrival))
    journey.setState({ u: arrival / J, jvh: arrival, active: id, snap: true })
    await waitReady(id, my)
    if (my !== token) return

    setDive({ phase: 'out' })
    if (!(await tween(0, d.out, easing.outCubic, my))) return
    setDive({ phase: 'idle', amount: 0, to: null, waiting: false })
    settle(id, opts.fromLoad)
  } finally {
    stopWatch()
  }
}

