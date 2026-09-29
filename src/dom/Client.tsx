import { Suspense, type ReactNode } from 'react'
import { useHydrated } from './hooks'

/**
 * Client-only children (usually a lazy chunk). The server and the hydrating client both render
 * `fallback`, so hydration matches; the children mount right after.
 */
export function Client({ children, fallback = null }: { children: ReactNode; fallback?: ReactNode }) {
  const hydrated = useHydrated()
  return hydrated ? <Suspense fallback={fallback}>{children}</Suspense> : fallback
}
