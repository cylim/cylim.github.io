import { useEffect, useRef } from 'react'
import { CY_EVENT, emit } from '../core/events'
import { writeLangText } from './gloss/LangText'

/**
 * The one polite live region (design.md §4.3): jump arrivals ("Now at Work") and chart recasts.
 * Any module can call `announce()`; code that must not import the DOM layer emits
 * CY_EVENT.announce (core/events.ts) with the message as its detail instead.
 */
export function announce(message: string): void {
  emit(CY_EVENT.announce, message)
}

export function LiveRegion() {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let raf = 0
    const onAnnounce = (e: CustomEvent<string>) => {
      const el = ref.current
      const msg = typeof e.detail === 'string' ? e.detail : null
      if (!el || !msg) return
      // Clear first so a repeated message is announced again.
      el.textContent = ''
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => writeLangText(el, msg))
    }
    addEventListener(CY_EVENT.announce, onAnnounce)
    return () => {
      removeEventListener(CY_EVENT.announce, onAnnounce)
      cancelAnimationFrame(raf)
    }
  }, [])
  return <div ref={ref} id="live-region" className="visually-hidden" aria-live="polite" aria-atomic="true" />
}
