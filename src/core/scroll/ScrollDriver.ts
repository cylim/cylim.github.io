/**
 * The scroll driver (stack.md §3, design.md §0, §6.2): native document scroll → u, jvh and active
 * section in the store. The camera follows the scrollbar, never the reverse.
 *
 * - The jvh mapping is measured from the DOM section tops with a ResizeObserver, piecewise-linear
 *   between them, so a jump lands exactly on its arrival whatever the viewport does to the layout.
 *   Beats are not measured: they are fixed fractions of their section (design.md §6.2), and a
 *   mis-sized beat must not bend the camera's pacing.
 * - Lenis smooths the wheel on desktop only. Touch stays native (syncTouch off), and reduced motion,
 *   e2e and the album skip Lenis entirely. Lenis is imported lazily so it stays out of the boot chunk.
 *   Its frames run only while it animates (a wheel's inertia, a glide), not forever: an idle-stopped
 *   stage then costs no main-thread time at all (QM-P9).
 * - While a fog-dive is going in or holding, the driver leaves u alone: the dive owns the position.
 * - The hash follows the active section with replaceState, debounced; it never pushes.
 */

import type Lenis from 'lenis'
import { journey } from '../store/journey'
import { J, SECTION_SPANS, sectionAtJvh } from '../world/beats'
import { SECTION_HASH, WALK_SECTION_IDS } from '../sections/ids'
import { easing, motion } from '../../theme/tokens'
import { buildScrollMap, jvhAtScroll, linearScrollMap, reanchorScrollY, scrollAtJvh, type ScrollAnchor, type ScrollMap } from './progress'

const ARRIVALS = WALK_SECTION_IDS.map((id) => SECTION_SPANS[id].arrivalJvh)

/** Scrollable height in CSS px (design.md §0: documentHeight − innerHeight). */
export const scrollRange = () => Math.max(1, document.documentElement.scrollHeight - window.innerHeight)

let map: ScrollMap = linearScrollMap(1, J, ARRIVALS)
let lenis: Lenis | null = null
/** rAF id of the Lenis pump; 0 while Lenis rests. */
let lenisFrame = 0

/** One Lenis frame; keeps going while Lenis animates, then stops. */
function pumpLenis(time: number): void {
  lenisFrame = 0
  if (!lenis) return
  lenis.raf(time)
  if (lenis.isScrolling === 'smooth') lenisFrame = requestAnimationFrame(pumpLenis)
}

/**
 * Run Lenis's frames from now until it rests. Call it after anything that may start a Lenis
 * animation: a wheel event, a programmatic glide. Lenis measures each frame's delta from its last
 * frame, so the first frame after a rest is zeroed; otherwise the idle gap would snap the inertia.
 */
function wakeLenis(): void {
  if (!lenis || lenisFrame) return
  lenis.time = 0
  lenisFrame = requestAnimationFrame(pumpLenis)
}
/** The running driver's store update, so a programmatic jump can publish its position at once. */
let syncStore: (() => void) | null = null
/**
 * Album only: the section under this line (px below the viewport top) is the active one. A leaf
 * lands with its top just under the fixed header (scroll-margin-top), so probing at the viewport top
 * would still report the leaf before it.
 */
let albumProbe = 0

const top = (el: Element) => el.getBoundingClientRect().top + window.scrollY

/** The section's scroll-margin-top (the album keeps leaves clear of the fixed header). */
export const scrollMargin = (el: Element) => parseFloat(getComputedStyle(el).scrollMarginTop) || 0

/** Where the album lands a jump to this section: its top, just below the header. */
export const albumTopY = (el: Element) => Math.max(0, top(el) - scrollMargin(el))

/**
 * Album: a leaf a jump just reached (dive.ts holds it for a moment). Every re-measure puts it back
 * under the header before the active section is recomputed, so late layout never reports the leaf
 * above it, not even for a frame.
 */
let pinnedLeaf: Element | null = null
export function pinAlbumLeaf(el: Element | null): void {
  pinnedLeaf = el
}

function measure(): ScrollMap {
  const anchors: ScrollAnchor[] = []
  let margin = 0
  for (const id of WALK_SECTION_IDS) {
    const el = document.getElementById(id)
    if (el && el.offsetHeight > 0) {
      anchors.push({ y: top(el), jvh: SECTION_SPANS[id].jvh[0] })
      margin = Math.max(margin, scrollMargin(el))
    }
  }
  albumProbe = Math.max(margin + 8, window.innerHeight / 4)
  return buildScrollMap(anchors, scrollRange(), J, ARRIVALS)
}

/** Journey position of a document scroll offset, from the measured DOM. */
export const jvhAtScrollY = (y: number) => jvhAtScroll(map, y)

/** Document scroll offset of a journey position, from the measured DOM. */
export const scrollYAtJvh = (jvh: number) => scrollAtJvh(map, jvh)

// ---------------------------------------------------------------------------- programmatic scrolling

let smooth: { cancel: () => void } | null = null

/** Jump without animation. Kills Lenis inertia and any smooth scroll in flight. */
export function scrollToYInstant(y: number): void {
  smooth?.cancel()
  if (lenis) lenis.scrollTo(y, { immediate: true, force: true })
  else window.scrollTo({ top: y, behavior: 'instant' })
}

/**
 * Glide to `y` over `ms` with an in-out cubic. Resolves true on arrival and false if the visitor
 * scrolls, or a newer programmatic scroll takes over.
 */
export function smoothScrollToY(y: number, ms: number = motion.nearJump.duration): Promise<boolean> {
  smooth?.cancel()
  return new Promise((resolve) => {
    let done = false
    let raf = 0
    const finish = (arrived: boolean) => {
      if (done) return
      done = true
      cancelAnimationFrame(raf)
      stopWatch()
      if (smooth === handle) smooth = null
      if (arrived) syncStore?.()
      resolve(arrived)
    }
    const handle = { cancel: () => finish(false) }
    smooth = handle
    const stopWatch = watchScrollIntent(() => finish(false))
    if (lenis) {
      lenis.scrollTo(y, { duration: ms / 1000, easing: easing.inOutCubic, force: true, onComplete: () => finish(true) })
      wakeLenis()
      return
    }
    const from = window.scrollY
    const t0 = performance.now()
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / ms)
      window.scrollTo({ top: from + (y - from) * easing.inOutCubic(t), behavior: 'instant' })
      if (t < 1) raf = requestAnimationFrame(step)
      else finish(true)
    }
    raf = requestAnimationFrame(step)
  })
}

/**
 * Scroll to a journey position. `smooth` glides for 1.2 s (the door click, "Read the chart");
 * reduced motion and e2e always jump. Resolves true once there, with the store (u, jvh, active)
 * already at the new position: the scroll event would only publish it a frame later, and
 * `__cy.scrollToJvh` callers read `settled` straight after (QM-10).
 */
export function scrollToJvh(jvh: number, opts: { smooth?: boolean } = {}): Promise<boolean> {
  const { reducedMotion, e2e } = journey.getState()
  const y = scrollAtJvh(map, jvh)
  if (!opts.smooth || reducedMotion || e2e) {
    scrollToYInstant(y)
    syncStore?.()
    return Promise.resolve(true)
  }
  return smoothScrollToY(y)
}

const SCROLL_KEYS = new Set(['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '])

function isEditable(t: EventTarget | null): boolean {
  return t instanceof HTMLElement && (t.isContentEditable || t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')
}

/**
 * Calls `cb` when the visitor starts scrolling by hand: wheel, touch drag, scroll keys or a press on
 * the scrollbar. Programmatic scrolls and Lenis inertia don't count. Returns a stop function.
 */
export function watchScrollIntent(cb: () => void): () => void {
  const onKey = (e: KeyboardEvent) => {
    if (SCROLL_KEYS.has(e.key) && !isEditable(e.target)) cb()
  }
  const onPointer = (e: PointerEvent) => {
    if (e.clientX >= document.documentElement.clientWidth) cb()
  }
  const opts = { passive: true, capture: true } as const
  addEventListener('wheel', cb, opts)
  addEventListener('touchmove', cb, opts)
  addEventListener('keydown', onKey, opts)
  addEventListener('pointerdown', onPointer, opts)
  return () => {
    removeEventListener('wheel', cb, opts)
    removeEventListener('touchmove', cb, opts)
    removeEventListener('keydown', onKey, opts)
    removeEventListener('pointerdown', onPointer, opts)
  }
}

/**
 * The walk after a resize or rotation (QM-P2): stay at the journey position the visitor was at.
 * walk.css turns off the browser's scroll anchoring, and every section is a multiple of svh, so
 * the old scrollY would now be another beat or section. The store's jvh was read with `prev`.
 * A dive or a glide owns the position and re-aims itself; the album keeps browser anchoring.
 */
function keepJourneyPosition(prev: ScrollMap): void {
  const s = journey.getState()
  if (s.mode !== 'immersive' || s.dive.phase !== 'idle' || smooth) return
  const y = reanchorScrollY(prev, map, s.jvh, window.scrollY)
  if (y !== null) scrollToYInstant(y)
}

// ---------------------------------------------------------------------------- the driver

/** URL for a section: its hash, or the bare path (keeping the query) for the threshold. */
export const sectionUrl = (hash: string) => hash || location.pathname + location.search

export interface ScrollDriverOptions {
  /** Smooth the wheel with Lenis. Boot passes true on desktop immersive, false for touch, reduced motion, e2e and the album. */
  smoothWheel: boolean
}

/** Start the driver. Returns a stop function. */
export function startScrollDriver(opts: ScrollDriverOptions = { smoothWheel: false }): () => void {
  let hashTimer = 0
  let stopped = false

  const update = () => {
    const s = journey.getState()
    // The dive owns the position while it goes in and holds; the scroll it makes is its own.
    if (s.dive.phase === 'in' || s.dive.phase === 'hold') return
    const jvh = jvhAtScroll(map, window.scrollY)
    const active = sectionAtJvh(s.mode === 'static' ? jvhAtScroll(map, window.scrollY + albumProbe) : jvh)
    if (jvh !== s.jvh || active !== s.active) journey.setState({ u: jvh / J, jvh, active })
    if (active !== s.active) {
      window.clearTimeout(hashTimer)
      hashTimer = window.setTimeout(() => {
        const now = journey.getState()
        if (now.dive.phase !== 'idle' || now.active !== active) return
        const hash = SECTION_HASH[active]
        if (location.hash !== hash) history.replaceState(history.state, '', sectionUrl(hash))
      }, motion.hashDebounce)
    }
  }

  // The viewport the map was last measured at; null before the first measure.
  let viewport: { w: number; h: number } | null = null
  const remeasure = () => {
    const prev = map
    const was = viewport
    viewport = { w: window.innerWidth, h: window.innerHeight }
    map = measure()
    if (pinnedLeaf) {
      const y = albumTopY(pinnedLeaf)
      if (Math.abs(window.scrollY - y) > 1) scrollToYInstant(y)
    } else if (was && (was.w !== viewport.w || was.h !== viewport.h)) keepJourneyPosition(prev)
    update()
  }
  remeasure()
  syncStore = update

  const ro = new ResizeObserver(remeasure)
  const content = document.getElementById('content')
  if (content) ro.observe(content)
  ro.observe(document.documentElement)
  addEventListener('scroll', update, { passive: true })
  addEventListener('resize', remeasure)

  if (opts.smoothWheel) {
    void import('lenis').then(({ default: LenisCtor }) => {
      if (stopped) return
      lenis = new LenisCtor({
        // Driven by wakeLenis(): a wheel starts Lenis's inertia, and the pump runs until it rests.
        autoRaf: false,
        smoothWheel: true,
        syncTouch: false,
        anchors: false,
        stopInertiaOnNavigate: true,
        lerp: 0.1,
      })
      addEventListener('wheel', wakeLenis, { passive: true })
    })
  }

  return () => {
    stopped = true
    if (syncStore === update) syncStore = null
    ro.disconnect()
    removeEventListener('scroll', update)
    removeEventListener('resize', remeasure)
    window.clearTimeout(hashTimer)
    smooth?.cancel()
    removeEventListener('wheel', wakeLenis)
    cancelAnimationFrame(lenisFrame)
    lenisFrame = 0
    lenis?.destroy()
    lenis = null
  }
}
