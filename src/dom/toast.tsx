import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { CY_EVENT, emit, type ToastDetail } from '../core/events'
import { motion } from '../theme/tokens'
import { ui } from '../content/ui'

/**
 * Toasts (design.md §4.3): one at a time, bottom-centre above the bar or the cluster, 4 s.
 * Call `toast()`; code that can't import the DOM layer emits CY_EVENT.toast (core/events.ts) with
 * the same `{ message, actionLabel?, onAction?, durationMs? }` (core/render/toast.ts does, for the
 * slow-device and context-lost toasts). An action without a label makes the whole toast the tap
 * target ("3D paused. Tap to restart.").
 */
export type ToastInput = ToastDetail

export function toast(input: ToastInput | string): void {
  emit(CY_EVENT.toast, typeof input === 'string' ? { message: input } : input)
}

function parse(e: CustomEvent<ToastDetail>): ToastInput | null {
  const d = e.detail
  return d && typeof d.message === 'string' ? d : null
}

/**
 * How long a toast stays, in ms; null while it waits for the visitor. A toast that is itself the
 * control ("3D paused. Tap to restart.": an action without a label) stays until it is tapped or
 * dismissed: it is the only way back to the walk, and a context lost in a background tab would
 * otherwise time out before anyone saw it (QM-3). So does one asked to (`durationMs: Infinity`).
 */
export function toastLifetime(t: ToastInput): number | null {
  if (t.durationMs !== undefined) return Number.isFinite(t.durationMs) && t.durationMs > 0 ? t.durationMs : null
  if (t.onAction && !t.actionLabel) return null
  return t.onAction ? motion.toast * 2 : motion.toast
}

/**
 * The last tap-to-act toast's action, until it runs: dismissing the toast doesn't lose it, and
 * Settings offers it again (a lost WebGL context's restart) for as long as it applies.
 */
type Pending = { message: string; run: () => void }
let pending: Pending | null = null
const pendingListeners = new Set<() => void>()
const setPending = (p: Pending | null) => {
  pending = p
  for (const l of pendingListeners) l()
}
const subscribePending = (l: () => void) => {
  pendingListeners.add(l)
  return () => void pendingListeners.delete(l)
}

export const usePendingToastAction = (): Pending | null =>
  useSyncExternalStore(
    subscribePending,
    () => pending,
    () => null,
  )

export function Toasts() {
  const [current, setCurrent] = useState<(ToastInput & { key: number }) | null>(null)
  const seq = useRef(0)

  useEffect(() => {
    const onToast = (e: CustomEvent<ToastDetail>) => {
      const t = parse(e)
      if (!t) return
      setCurrent({ ...t, key: ++seq.current })
      const run = t.onAction
      if (run && !t.actionLabel) setPending({ message: t.message, run: () => (setPending(null), run()) })
    }
    addEventListener(CY_EVENT.toast, onToast)
    return () => removeEventListener(CY_EVENT.toast, onToast)
  }, [])

  useEffect(() => {
    const ms = current ? toastLifetime(current) : null
    if (ms === null) return
    const id = window.setTimeout(() => setCurrent(null), ms)
    return () => window.clearTimeout(id)
  }, [current])

  const act = () => {
    if (current?.onAction && !current.actionLabel && pending) pending.run()
    else current?.onAction?.()
    setCurrent(null)
  }

  return (
    <div className="toast-host" role="status" aria-live="polite">
      {current && (
        <div className="toast" key={current.key}>
          {current.onAction && !current.actionLabel ? (
            <button type="button" className="toast-tap" onClick={act}>
              {current.message}
            </button>
          ) : (
            <p>{current.message}</p>
          )}
          {current.actionLabel && (
            <button
              type="button"
              className="toast-action"
              onClick={act}
            >
              {current.actionLabel}
            </button>
          )}
          <button type="button" className="toast-close" aria-label={ui.dismiss} onClick={() => setCurrent(null)}>
            <span aria-hidden="true">×</span>
          </button>
        </div>
      )}
    </div>
  )
}
