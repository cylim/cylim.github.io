/**
 * Keep-outs sections add at runtime (a prop the static list in layout.ts doesn't know about).
 * The pine field hides instances inside them; it never re-scatters, so tier prefixes stay stable.
 */

import { useEffect } from 'react'
import { inKeepOut, type KeepOut } from '../core/world/layout'

const dynamic = new Map<string, KeepOut>()
const listeners = new Set<() => void>()

const emit = () => listeners.forEach((fn) => fn())

/** Add a keep-out; returns its removal. A later registration with the same id replaces it. */
export function registerKeepOut(k: KeepOut): () => void {
  dynamic.set(k.id, k)
  emit()
  return () => {
    if (dynamic.get(k.id) !== k) return
    dynamic.delete(k.id)
    emit()
  }
}

export function dynamicKeepOuts(): readonly KeepOut[] {
  return [...dynamic.values()]
}

export function subscribeKeepOuts(fn: () => void): () => void {
  listeners.add(fn)
  return () => void listeners.delete(fn)
}

/** True if (x, z) falls in a runtime keep-out, padded by `margin`. */
export function inDynamicKeepOut(x: number, z: number, margin = 0): boolean {
  return dynamic.size > 0 && inKeepOut(x, z, dynamicKeepOuts(), margin)
}

/**
 * Keep pines out of a spot while the calling component is mounted, e.g.
 * `useKeepOut({ id: 'grove-bench', kind: 'circle', centre: [4, -140], r: 2 })`.
 * The object may be recreated each render; it re-registers only when its contents change.
 */
export function useKeepOut(k: KeepOut | null): void {
  const key = k ? JSON.stringify(k) : ''
  useEffect(() => {
    if (!key) return
    return registerKeepOut(JSON.parse(key) as KeepOut)
  }, [key])
}
