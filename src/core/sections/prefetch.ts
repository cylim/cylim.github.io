/**
 * Section chunk prefetch (design.md §11.3). Three-free: it only calls the registry's memoised
 * dynamic imports, so it can run from the boot chunk. Immersive mode only; the album never loads 3D.
 *
 * | Chunk   | Prefetch when                                                                  |
 * | cabin   | 3 s after the stage goes live (on idle), u ≥ 0.12, or intent on Work            |
 * | grove   | on entering the cabin (u ≥ 0.245), intent on Grove, or 15 s after the stage     |
 * | contact | with grove                                                                     |
 *
 * Intent (pointerdown, touchstart or hover on a `data-jump` link) is wired in core/scroll/hashNav.
 */

import { journey } from '../store/journey'
import { MARKS, jvhToU } from '../world/beats'
import { registry } from './registry'
import type { SectionId } from './ids'

/** Start fetching a section's scene chunk (grove brings contact). Safe to call repeatedly. */
export function prefetchSection(id: SectionId): void {
  if (journey.getState().mode !== 'immersive') return
  registry[id].load().then(
    () => {
      if (id === 'grove') prefetchSection('contact')
    },
    // The mount then fails the same way (the browser caches the failed fetch; see defineSection),
    // and SectionHost logs it there.
    () => undefined,
  )
}

const onIdle = (fn: () => void) =>
  typeof requestIdleCallback === 'function' ? requestIdleCallback(fn, { timeout: 2000 }) : setTimeout(fn, 1)

/** Timed and positional prefetch rules. Returns a stop function. */
export function startSectionPrefetch(): () => void {
  const timers: number[] = []
  let timed = false
  const check = () => {
    const s = journey.getState()
    if (s.mode !== 'immersive') return
    if (s.u >= jvhToU(MARKS.prefetchCabin)) prefetchSection('cabin')
    if (s.u >= jvhToU(MARKS.prefetchGrove)) prefetchSection('grove')
    if (!timed && s.stage === 'live') {
      timed = true
      timers.push(window.setTimeout(() => onIdle(() => prefetchSection('cabin')), 3000))
      timers.push(window.setTimeout(() => onIdle(() => prefetchSection('grove')), 15000))
    }
  }
  check()
  const unsubscribe = journey.subscribe((s, prev) => {
    if (s.u !== prev.u || s.stage !== prev.stage || s.mode !== prev.mode) check()
  })
  return () => {
    unsubscribe()
    for (const t of timers) window.clearTimeout(t)
  }
}
