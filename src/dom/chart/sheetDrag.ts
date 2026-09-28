import { useEffect } from 'react'

/** The phone chart sheet's two rest heights, as fractions of the viewport (tokens `sheetPeek`, `sheetOpen`). */
export const SHEET_PEEK = 0.3
export const SHEET_OPEN = 0.85

/** Movement before a press on the bar becomes a drag; less than this is a tap on a tab or the handle. */
const DRAG_SLOP = 6
/** A flick faster than this (px per ms) snaps in its direction whatever the height. */
const FLICK = 0.5
/** Velocity comes from the moves in this window before release; a finger that paused longer has none. */
const FLICK_WINDOW_MS = 150

type Sample = { y: number; t: number }

/** Release velocity in px per ms from the recent moves; 0 if the finger stopped before letting go. */
export function releaseVelocity(samples: readonly Sample[], releaseT: number): number {
  const last = samples[samples.length - 1]
  if (!last || releaseT - last.t > FLICK_WINDOW_MS) return 0
  const first = samples.find((s) => releaseT - s.t <= FLICK_WINDOW_MS) ?? last
  const from = first === last ? samples[samples.length - 2] : first
  return from && last.t > from.t ? (last.y - from.y) / (last.t - from.t) : 0
}

/** Where a released drag settles: flicks follow their direction, otherwise the nearer rest height. */
export function snapSheet(height: number, velocity: number, vh: number): 'peek' | 'open' {
  if (Math.abs(velocity) > FLICK) return velocity < 0 ? 'open' : 'peek'
  return height > ((SHEET_PEEK + SHEET_OPEN) / 2) * vh ? 'open' : 'peek'
}

/**
 * Drag the sheet by its bar (design.md §8.6: the chart sheet peeks at 30% and opens to 85%). While
 * the finger is down the card follows it through `--sheet-drag`; on release it snaps. Taps still
 * reach the tabs and the handle button: the drag only starts past a few pixels, and the click that
 * ends a drag is swallowed.
 */
export function useSheetDrag(el: HTMLElement | null, onSnap: (open: boolean) => void): void {
  useEffect(() => {
    const card = el?.closest<HTMLElement>('.card-panel')
    if (!el || !card) return
    let id: number | null = null
    let startY = 0
    let startH = 0
    let dragging = false
    let samples: Sample[] = []

    const heightAt = (y: number) => {
      const vh = innerHeight
      return Math.min(Math.max(startH - (y - startY), SHEET_PEEK * vh), SHEET_OPEN * vh)
    }
    // Moves and the release are followed on the window: a quick flick leaves the bar within a frame.
    const onDown = (e: PointerEvent) => {
      if (!e.isPrimary || e.button !== 0) return
      id = e.pointerId
      startY = e.clientY
      startH = card.getBoundingClientRect().height
      dragging = false
      samples = [{ y: e.clientY, t: e.timeStamp }]
      addEventListener('pointermove', onMove)
      addEventListener('pointerup', onUp)
      addEventListener('pointercancel', onUp)
    }
    const onMove = (e: PointerEvent) => {
      if (e.pointerId !== id) return
      if (!dragging) {
        if (Math.abs(e.clientY - startY) < DRAG_SLOP) return
        dragging = true
        card.dataset.dragging = ''
      }
      samples = [...samples.slice(-5), { y: e.clientY, t: e.timeStamp }]
      card.style.setProperty('--sheet-drag', `${heightAt(e.clientY).toFixed(0)}px`)
    }
    const onUp = (e: PointerEvent) => {
      if (e.pointerId !== id) return
      id = null
      removeEventListener('pointermove', onMove)
      removeEventListener('pointerup', onUp)
      removeEventListener('pointercancel', onUp)
      if (!dragging) return
      const velocity = releaseVelocity(samples, e.timeStamp)
      delete card.dataset.dragging
      card.style.removeProperty('--sheet-drag')
      onSnap(snapSheet(heightAt(e.clientY), velocity, innerHeight) === 'open')
    }
    const onClick = (e: MouseEvent) => {
      if (!dragging) return
      dragging = false
      e.preventDefault()
      e.stopPropagation()
    }
    el.addEventListener('pointerdown', onDown)
    el.addEventListener('click', onClick, true)
    return () => {
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('click', onClick, true)
      removeEventListener('pointermove', onMove)
      removeEventListener('pointerup', onUp)
      removeEventListener('pointercancel', onUp)
      delete card.dataset.dragging
      card.style.removeProperty('--sheet-drag')
    }
  }, [el, onSnap])
}
