import { useSyncExternalStore } from 'react'
import { breakpoint } from '../theme/tokens'

const noopSubscribe = () => () => {}

/**
 * false on the server and during hydration, true afterwards. Gate client-only UI on it so the first
 * client render matches the prerendered HTML exactly.
 */
export const useHydrated = (): boolean =>
  useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  )

/** `matchMedia` as React state. false on the server and during hydration. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mq = matchMedia(query)
      mq.addEventListener('change', cb)
      return () => mq.removeEventListener('change', cb)
    },
    () => matchMedia(query).matches,
    () => false,
  )
}

/** The §4.2 mobile layout (bottom bar, zone B, sheets). */
export const MOBILE_QUERY = `(max-width: ${breakpoint.desktop - 0.02}px)`
export const COARSE_QUERY = '(pointer: coarse)'
