/**
 * The window CustomEvents that cross layers (QM-7). core/ is the one layer every other layer may
 * import (dom, sections, audio), so each event's name and its one payload live here, and the
 * WindowEventMap augmentation below types `addEventListener` for all of them. A rename is then a
 * compile error, not a listener that silently never fires.
 *
 * Dispatch with `emit()`; listen with `addEventListener(CY_EVENT.x, (e) => e.detail …)`.
 */

export const CY_EVENT = {
  /** Polite live-region message (design.md §4.3). The DOM's LiveRegion speaks it. */
  announce: 'cy:announce',
  /** A toast (design.md §4.3); the DOM's Toasts shows it. The stage uses it for slow device and context loss. */
  toast: 'cy:toast',
  /** Settings → Quality changed; prefs are already written. The stage's QualityController listens. */
  quality: 'cy:quality',
  /** The live chart moved to a new 时辰 while the grove is on screen: the hour chime (design.md §12). */
  recast: 'cy:recast',
  /** A key typed in the terminal, for the key-click cue (design.md §12). */
  key: 'cy:key',
  /** The cabin's 3D pane was clicked: open the DOM terminal over it. */
  terminalOpen: 'cy:terminal-open',
} as const

export type CyEventName = (typeof CY_EVENT)[keyof typeof CY_EVENT]

/** The message to speak. */
export type AnnounceDetail = string

export interface ToastDetail {
  message: string
  /** Button inside the toast, e.g. "Walk the forest anyway". Without it, `onAction` is the whole toast. */
  actionLabel?: string
  onAction?: () => void
  /** Default motion.toast (4 s). Toasts with an action stay twice as long. */
  durationMs?: number
}

/** Settings → Quality. Low and High pin the tier; Auto hands it back to the runtime monitor. */
export type QualityChoice = 'auto' | 'low' | 'high'

export interface RecastDetail {
  /** Epoch ms of the new chart's instant. */
  chartAtMs: number
}

export interface KeyDetail {
  key: string
}

export interface CyEventDetail {
  'cy:announce': AnnounceDetail
  'cy:toast': ToastDetail
  'cy:quality': QualityChoice
  'cy:recast': RecastDetail
  'cy:key': KeyDetail
  'cy:terminal-open': null
}

declare global {
  interface WindowEventMap {
    'cy:announce': CustomEvent<AnnounceDetail>
    'cy:toast': CustomEvent<ToastDetail>
    'cy:quality': CustomEvent<QualityChoice>
    'cy:recast': CustomEvent<RecastDetail>
    'cy:key': CustomEvent<KeyDetail>
    'cy:terminal-open': CustomEvent<null>
  }
}

/** Dispatch one of the events above on window, with its payload. */
export function emit<K extends CyEventName>(name: K, detail: CyEventDetail[K]): void {
  window.dispatchEvent(new CustomEvent(name, { detail }))
}
