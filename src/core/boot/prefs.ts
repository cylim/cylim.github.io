import type { RenderMode, Tier } from '../store/journey'

/**
 * Saved visitor choices, JSON in localStorage under `cy.prefs` (design.md §4.1).
 * index.html's inline head script reads `mode` before first paint, so keep the key and shape stable.
 */
export interface Prefs {
  /** "Still version" / "Walk the forest" choice. */
  mode?: RenderMode
  quality?: 'auto' | Tier
  sound?: boolean
}

export const PREFS_KEY = 'cy.prefs'

export function readPrefs(storage: Pick<Storage, 'getItem'> | undefined = globalThis.localStorage): Prefs {
  try {
    const raw = storage?.getItem(PREFS_KEY)
    const v: unknown = raw ? JSON.parse(raw) : {}
    return typeof v === 'object' && v !== null ? (v as Prefs) : {}
  } catch {
    return {}
  }
}

export function writePrefs(patch: Prefs, storage: Pick<Storage, 'getItem' | 'setItem'> | undefined = globalThis.localStorage): void {
  try {
    storage?.setItem(PREFS_KEY, JSON.stringify({ ...readPrefs(storage), ...patch }))
  } catch {
    // private mode or quota: preferences are a nicety
  }
}
