import { journey } from '../../core/store/journey'
import type { PalaceNo } from '../../lib/qimen/types'

/**
 * Palace selection is shared with the grove scene (`journey.selectedPalace`, design.md §9.7): focusing
 * a palace in the DOM grid selects it in 3D, and clicking one in 3D selects it here. The grid remembers
 * what it selected itself so it can tell the scene's selections apart and open their details.
 */
let fromGrid: PalaceNo | null = null

export function selectFromGrid(n: PalaceNo): void {
  fromGrid = n
  if (journey.getState().selectedPalace !== n) journey.setState({ selectedPalace: n })
}

/** True when this selection came from the scene rather than the grid. */
export function selectedInScene(n: PalaceNo | null): n is PalaceNo {
  if (n === null || n === fromGrid) return false
  fromGrid = null
  return true
}

/**
 * Scroll `el` into view inside the panel that scrolls it (the walk's chart card or the phone sheet),
 * never the page: in the walk the page scroll is the camera.
 */
export function revealInPanel(el: HTMLElement, margin = 8): void {
  const box = el.closest<HTMLElement>('.sheet-panel, .card-panel')
  if (!box || box.scrollHeight <= box.clientHeight) return
  const r = el.getBoundingClientRect()
  const b = box.getBoundingClientRect()
  if (r.top < b.top) box.scrollTop += r.top - b.top - margin
  else if (r.bottom > b.bottom) box.scrollTop += Math.min(r.bottom - b.bottom + margin, r.top - b.top - margin)
}
