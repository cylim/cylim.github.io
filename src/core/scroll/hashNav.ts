/**
 * Hash navigation (design.md §6.2, §11.1): nav clicks push the hash and fog-dive, back and forward
 * dive to wherever the hash points, and a deep link on first load starts in full paper and only
 * emerges. Hashes that are not sections (#content from the skip link, say) are left to the browser.
 */

import { journey } from '../store/journey'
import { SECTION_HASH, isSectionId, type SectionId } from '../sections/ids'
import { prefetchSection } from '../sections/prefetch'
import { diveTo } from './dive'
import { watchModality } from './modality'
import { scrollToJvh, scrollToYInstant, scrollYAtJvh, sectionUrl, watchScrollIntent } from './ScrollDriver'
import { SECTION_SPANS } from '../world/beats'

/** The section a hash names, or null for hashes that aren't sections. '' and '#threshold' are the threshold. */
export function sectionOfHash(hash: string): SectionId | null {
  const id = hash.replace(/^#/, '')
  if (id === '') return 'threshold'
  return isSectionId(id) ? id : null
}

/** Fog-dive to a section and record it in history (pushState, or replaceState with `replace`). */
export function jumpTo(id: SectionId, opts: { replace?: boolean } = {}): Promise<void> {
  const hash = SECTION_HASH[id]
  const url = sectionUrl(hash)
  if (opts.replace) history.replaceState(history.state, '', url)
  else if (location.hash !== hash) history.pushState(null, '', url)
  return diveTo(id)
}

const plainClick = (e: MouseEvent) => !(e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)

const jumpLink = (t: EventTarget | null) =>
  t instanceof Element ? t.closest<HTMLAnchorElement>('a[data-jump]') : null

function onClick(e: MouseEvent): void {
  if (!plainClick(e)) return
  const target = e.target instanceof Element ? e.target : null
  const a = jumpLink(target)
  if (a) {
    const id = sectionOfHash(a.hash)
    if (!id) return
    e.preventDefault()
    void jumpTo(id)
    return
  }
  const to = target?.closest<HTMLElement>('[data-scroll-jvh]')
  if (to) {
    e.preventDefault()
    void scrollToJvh(Number(to.dataset.scrollJvh), { smooth: true })
  }
}

/** Intent: start fetching the target chunk on press or hover, about 100 ms before the click lands. */
function onIntent(e: Event): void {
  const a = jumpLink(e.target)
  const id = a ? sectionOfHash(a.hash) : null
  if (id) prefetchSection(id)
}

function onPopState(): void {
  const id = sectionOfHash(location.hash)
  if (id) void diveTo(id)
}

/**
 * Wire delegated clicks on `a[data-jump]` and `[data-scroll-jvh]`, intent prefetch, back/forward and
 * the first-load deep link. Returns a stop function.
 */
export function initHashNav(): () => void {
  // Back and forward land on the arrival, not wherever the browser remembers.
  history.scrollRestoration = 'manual'
  watchModality()
  document.addEventListener('click', onClick)
  document.addEventListener('pointerdown', onIntent, { passive: true })
  document.addEventListener('touchstart', onIntent, { passive: true })
  document.addEventListener('pointerover', onIntent, { passive: true })
  addEventListener('popstate', onPopState)

  const stops = [
    () => {
      document.removeEventListener('click', onClick)
      document.removeEventListener('pointerdown', onIntent)
      document.removeEventListener('touchstart', onIntent)
      document.removeEventListener('pointerover', onIntent)
      removeEventListener('popstate', onPopState)
    },
  ]

  if (location.hash === '#threshold') history.replaceState(history.state, '', sectionUrl(''))
  const id = location.hash ? sectionOfHash(location.hash) : null
  if (id && id !== 'threshold') {
    journey.setState({ active: id })
    void diveTo(id, { fromLoad: true })
    // The browser may scroll to the fragment again at load (the dev server renders the content
    // after parsing). If the visitor hasn't scrolled by then, put the arrival back.
    if (document.readyState !== 'complete') {
      let touched = false
      const stopWatch = watchScrollIntent(() => (touched = true))
      const reassert = () => {
        stopWatch()
        requestAnimationFrame(() => {
          if (touched || journey.getState().dive.phase === 'in') return
          const y = scrollYAtJvh(SECTION_SPANS[id].arrivalJvh)
          if (journey.getState().mode === 'immersive' && Math.abs(window.scrollY - y) > 1) scrollToYInstant(y)
        })
      }
      addEventListener('load', reassert, { once: true })
      stops.push(() => {
        stopWatch()
        removeEventListener('load', reassert)
      })
    }
  }
  return () => {
    for (const stop of stops) stop()
  }
}
