import { useEffect, useState } from 'react'
import { useJourney } from '../../core/store/journey'
import { BEAT_SPANS, MARKS, MIST_WAIT } from '../../core/world/beats'
import { WALK_SECTION_IDS, type SectionId } from '../../core/sections/ids'
import { inscriptions, nav } from '../../content/site'
import { ui } from '../../content/ui'
import { motion, sealSize } from '../../theme/tokens'
import { Seal } from '../Seal'

/** Sections that get a 题款. The threshold has the hero instead; a paused section has none. */
const INSCRIBED = (['cabin', 'grove', 'contact'] as const satisfies readonly SectionId[]).filter((id) => WALK_SECTION_IDS.includes(id))
type Inscribed = (typeof INSCRIBED)[number]

/**
 * From the section's first card hold start to its last card hold end (design.md §4.1). Holds
 * without copy don't count: with the grove paused the path's stream pause belongs to contact, and the
 * lantern's inscription must still wait for the lantern.
 */
export const INSCRIPTION_WINDOWS: Partial<Record<Inscribed, readonly [number, number]>> = Object.fromEntries(
  INSCRIBED.map((id) => {
    const holds = BEAT_SPANS.filter((b) => b.section === id && b.hold && b.zone).map((b) => b.hold as readonly [number, number])
    return [id, [Math.min(...holds.map((h) => h[0])), Math.max(...holds.map((h) => h[1]))] as const]
  }),
) as Record<Inscribed, readonly [number, number]>

export function inscriptionAt(jvh: number): Inscribed | null {
  // The finale's colophon takes the upper left once the seal stamps.
  if (jvh >= MARKS.sealStamp) return null
  for (const id of INSCRIBED) {
    const w = INSCRIPTION_WINDOWS[id]
    if (w && jvh >= w[0] && jvh <= w[1]) return id
  }
  return null
}

const navLabel = (id: SectionId) => nav.find((n) => n.id === id)?.label ?? ''

/**
 * Section inscriptions (design.md §4.1): a vertical column top-left in Ma Shan Zheng with the English
 * name beside it, inked in top to bottom. On phones a horizontal chip instead (§4.2). aria-hidden: the
 * h2 says the same thing. Also carries the P2 "Grinding ink…" wait (§8.5) when the grove (with the
 * grove paused, the lantern) is late.
 */
export function Inscriptions() {
  const at = useJourney((s) => (s.mode === 'immersive' ? inscriptionAt(s.jvh) : null))
  const inMistWall = useJourney(
    (s) =>
      s.mode === 'immersive' &&
      s.stage === 'live' &&
      s.jvh >= MARKS.mistWall[0] &&
      s.jvh < MARKS.reveal[1] &&
      s.ready[MIST_WAIT.section] !== true,
  )
  const [waiting, setWaiting] = useState(false)

  useEffect(() => {
    if (!inMistWall) return
    const id = window.setTimeout(() => setWaiting(true), motion.mistWaitHint)
    return () => {
      window.clearTimeout(id)
      setWaiting(false)
    }
  }, [inMistWall])

  return (
    <div className="inscriptions" aria-hidden="true">
      {INSCRIBED.map((id) => (
        <div key={id} className={`inscription inscription-${id}`} data-shown={at === id ? '' : undefined}>
          <span className="inscription-zh" lang="zh-Hans">
            {inscriptions[id].accent.zh}
          </span>
          <span className="inscription-name">{inscriptions[id].name}</span>
        </div>
      ))}
      {INSCRIBED.map((id) => (
        <div key={id} className="section-chip" data-shown={at === id && !waiting ? '' : undefined}>
          <span lang="zh-Hans">{inscriptions[id].accent.zh}</span> · {navLabel(id)}
        </div>
      ))}
      <div className="section-chip section-chip-wait" data-shown={waiting ? '' : undefined}>
        <Seal placement="plain" size={sealSize.nav - 8} className="seal-breathe" />
        {ui.loading}
      </div>
    </div>
  )
}
