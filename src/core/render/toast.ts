import { CY_EVENT, emit, type ToastDetail } from '../events'

/**
 * Stage → DOM toasts. The stage never renders DOM; it dispatches `cy:toast` (core/events.ts) on
 * window and the DOM layer shows it (design.md §13.2 slow device, §13.3 context lost).
 *
 * `onAction` is a closure owned by the stage: the DOM calls it when the visitor presses the button.
 * Without `actionLabel`, the whole toast is the tap target ("3D paused. Tap to restart.").
 */
export function showToast(detail: ToastDetail): void {
  emit(CY_EVENT.toast, detail)
}
