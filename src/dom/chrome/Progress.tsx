import { useEffect, useRef } from 'react'
import { journey, useJourney } from '../../core/store/journey'
import { SECTION_SPANS, jvhToU } from '../../core/world/beats'
import { WALK_SECTION_IDS } from '../../core/sections/ids'

/** Ticks at this walk's arrivals. Per render: a detour joining the grove walk adds one and moves the rest. */
const arrivals = () => WALK_SECTION_IDS.map((id) => jvhToU(SECTION_SPANS[id].arrivalJvh))

/**
 * Progress (design.md §4.1, §4.2): a hairline on the right edge that fills with ink as u grows, ticks
 * at the walk's arrivals and a tiny cinnabar seal for "you are here"; on phones a 2 px line along the
 * top of the bottom bar. aria-hidden and not clickable: the nav does that job.
 * Written straight to the elements from the store, never through React state.
 */
export function Progress() {
  const rail = useRef<HTMLDivElement>(null)
  const bar = useRef<HTMLDivElement>(null)
  // Re-render the ticks when a detour joins the grove walk; the fill is written straight from the store.
  useJourney((s) => s.groveWalk)

  useEffect(() => {
    const set = (u: number) => {
      const v = u.toFixed(4)
      rail.current?.style.setProperty('--u', v)
      bar.current?.style.setProperty('--u', v)
    }
    set(journey.getState().u)
    return journey.subscribe((s, prev) => {
      if (s.u !== prev.u) set(s.u)
    })
  }, [])

  return (
    <>
      <div ref={rail} className="progress-rail" aria-hidden="true">
        <span className="progress-fill" />
        {arrivals().map((u) => (
          <span key={u} className="progress-tick" style={{ ['--at' as string]: u }} />
        ))}
        <span className="progress-mark" />
      </div>
      <div ref={bar} className="progress-bar" aria-hidden="true">
        <span className="progress-fill" />
        <span className="progress-mark" />
      </div>
    </>
  )
}
