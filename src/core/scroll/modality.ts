/**
 * How the visitor last reached for the page: keys or a pointer. A jump moves focus to its section
 * heading (design.md §11.1 settle), but the focus ring should follow how the jump started, not the
 * browser's :focus-visible guess for programmatic focus, which lights the ring after a mouse click
 * in some browsers and on a fresh page in all of them (design.md §15, WCAG 2.4.7 for keyboard users).
 */

export type Modality = 'keyboard' | 'pointer'

const MODIFIERS = new Set(['Shift', 'Control', 'Alt', 'Meta', 'CapsLock'])

let last: Modality | null = null
let watching = false

const onKey = (e: KeyboardEvent) => {
  if (!MODIFIERS.has(e.key)) last = 'keyboard'
}

const onPointer = () => {
  last = 'pointer'
}

/** Start listening (idempotent). Capture phase, so handlers that stop propagation can't hide input. */
export function watchModality(): void {
  if (watching) return
  watching = true
  const opts = { capture: true, passive: true } as const
  addEventListener('keydown', onKey, opts)
  addEventListener('pointerdown', onPointer, opts)
}

/** The last input, or null before any. */
export const lastModality = (): Modality | null => last
