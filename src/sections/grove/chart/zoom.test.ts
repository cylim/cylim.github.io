import { describe, expect, it } from 'vitest'
import { afterTap, zoomForSelection, type Tap } from './zoom'

const touchPlan = (palace: Tap['palace'], slab = true): Tap => ({ palace, slab, touch: true, planView: true })

describe('touch zoom (design.md §9.7)', () => {
  it('zooms onto a palace tapped on a touch screen in the plan view, and selects it', () => {
    expect(afterTap({ zoom: null, selected: null }, touchPlan(9))).toEqual({ zoom: 9, selected: 9 })
    // The rings along a palace's bearing count as that palace.
    expect(afterTap({ zoom: null, selected: 4 }, touchPlan(2, false))).toEqual({ zoom: 2, selected: 2 })
  })

  it('keeps the zoom for a tap on the zoomed palace itself', () => {
    const s = { zoom: 9, selected: 9 } as const
    expect(afterTap(s, touchPlan(9))).toBe(s)
  })

  it('returns to the whole chart for a tap anywhere else, and clears the selection', () => {
    const s = { zoom: 9, selected: 9 } as const
    const back = { zoom: null, selected: null }
    expect(afterTap(s, touchPlan(4))).toEqual(back)
    expect(afterTap(s, touchPlan(null))).toEqual(back)
    // The floor and rings along the zoomed palace's own bearing are outside its slab.
    expect(afterTap(s, touchPlan(9, false))).toEqual(back)
    // A mouse click while zoomed (a touch laptop) returns too.
    expect(afterTap(s, { palace: 4, slab: true, touch: false, planView: true })).toEqual(back)
  })

  it('never zooms for a mouse click or away from the plan view: the selection toggles as before', () => {
    expect(afterTap({ zoom: null, selected: null }, { palace: 9, slab: true, touch: false, planView: true })).toEqual({ zoom: null, selected: 9 })
    expect(afterTap({ zoom: null, selected: 9 }, { palace: 9, slab: true, touch: false, planView: true })).toEqual({ zoom: null, selected: null })
    expect(afterTap({ zoom: null, selected: null }, { palace: 3, slab: true, touch: true, planView: false })).toEqual({ zoom: null, selected: 3 })
    const idle = { zoom: null, selected: 5 } as const
    expect(afterTap(idle, touchPlan(null))).toBe(idle)
  })

  it('follows the selection: Back returns, another palace from the DOM grid moves the zoom', () => {
    expect(zoomForSelection(9, null)).toBeNull()
    expect(zoomForSelection(9, 4)).toBe(4)
    expect(zoomForSelection(null, 4)).toBeNull()
  })
})
