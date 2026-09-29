import { useEffect, useState } from 'react'
import { useJourney } from '../../core/store/journey'
import type { SectionId } from '../../core/sections/ids'
import { inscriptions } from '../../content/site'
import { ui } from '../../content/ui'
import { motion } from '../../theme/tokens'

/**
 * Fog-dive title card (design.md §4.3, §11.1): the destination accent in Ma Shan Zheng with the
 * English name under it, fading in 250 ms into the dive. "Grinding ink…" appears once the hold has
 * waited 400 ms for the target section (core/scroll sets `dive.waiting`). On emergence it dissolves
 * (blur, fade, scale) over 500 ms.
 * aria-hidden: the live region announces arrivals.
 */
export function TitleCard() {
  const phase = useJourney((s) => s.dive.phase)
  const to = useJourney((s) => s.dive.to)
  const waiting = useJourney((s) => s.dive.waiting)
  const [target, setTarget] = useState<SectionId | null>(null)
  const [hint, setHint] = useState(false)

  // Keep the last destination through the dissolve, after the dive has cleared `to`.
  if (to && to !== target) setTarget(to)

  useEffect(() => {
    if (!waiting) return
    const id = window.setTimeout(() => setHint(true), motion.dive.loadingHint)
    return () => {
      window.clearTimeout(id)
      setHint(false)
    }
  }, [waiting])

  useEffect(() => {
    if (phase !== 'idle') return
    const id = window.setTimeout(() => setTarget(null), motion.dive.titleCardOut)
    return () => window.clearTimeout(id)
  }, [phase])

  const state = phase === 'in' || phase === 'hold' ? 'in' : phase === 'out' ? 'out' : target ? 'out' : undefined
  const t = target ? inscriptions[target] : null
  return (
    <div className="title-card" data-state={state} aria-hidden="true">
      {t && (
        <>
          <span className="title-card-zh" lang="zh-Hans">
            {t.accent.zh}
          </span>
          <span className="title-card-name">{t.name}</span>
          <span className="title-card-hint" data-shown={hint ? '' : undefined}>
            {ui.loading}
          </span>
        </>
      )}
    </div>
  )
}
