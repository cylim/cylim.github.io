import type { CSSProperties, ReactNode } from 'react'
import { BEAT_SPANS, scrollSvhBetween, sectionHeightSvh, type BeatId, type BeatSpan } from '../../core/world/beats'
import type { SectionId } from '../../core/sections/ids'
import { inscriptions } from '../../content/site'
import { cardByBeat, trackSvh } from '../cards'

export interface CardContent {
  body: ReactNode
  /** Rendered in the sticky frame beside the card (e.g. the scroll cue). Shares the card's opacity. */
  extra?: ReactNode
  className?: string
  /** The card scrolls inside itself in the walk; smooth-scroll libraries must leave its wheel alone. */
  scrollable?: boolean
}

export type Cards = Partial<Record<BeatId, CardContent>>

const vars = (v: Record<string, number>) => v as CSSProperties

/**
 * One beat of the scroll track (design.md §6.2): a div of the beat's scroll length. In the walk its card
 * sits in a sticky one-viewport frame inside a track `trackSvh + 100` svh long (see cards.ts); in the
 * album the track and frame collapse and the card is ordinary flow.
 */
function BeatBlock({ beat, content }: { beat: BeatSpan; content: CardContent | undefined }) {
  const spec = cardByBeat(beat.id)
  return (
    <div className="beat" data-beat={beat.id} style={vars({ '--span': scrollSvhBetween(beat.jvh[0], beat.jvh[1]) })}>
      {spec && content && (
        <div className="card-track" style={vars({ '--track': trackSvh(spec) })}>
          <div className={`card-frame zone-${spec.zone}`} data-under={spec.underInscription ? '' : undefined}>
            <div
              className={content.className ? `card ${content.className}` : 'card'}
              data-card={beat.id}
              data-lenis-prevent={content.scrollable ? '' : undefined}
            >
              {content.body}
            </div>
            {content.extra && (
              <div className="card-extra" data-card={beat.id}>
                {content.extra}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/** The album leaf's opening inscription (design.md §14.1). aria-hidden: the h2 says it. */
export function LeafInscription({ id }: { id: SectionId }) {
  const t = inscriptions[id]
  return (
    <div className="leaf-inscription" aria-hidden="true">
      <span className="inscription-zh" lang="zh-Hans">
        {t.accent.zh}
      </span>
      <span className="inscription-name">{t.name}</span>
    </div>
  )
}

/**
 * A section: in the walk, a scroll track of its scroll length in svh (sectionHeightSvh); in the album, a leaf
 * with its painting (`art`) beside the text (design.md §14.1).
 */
export function Leaf({ id, art, cards }: { id: SectionId; art?: ReactNode; cards: Cards }) {
  return (
    <section
      id={id}
      className={`leaf leaf-${id}`}
      aria-labelledby={`${id}-heading`}
      style={vars({ '--h': sectionHeightSvh(id) })}
    >
      {art && <div className="leaf-art">{art}</div>}
      <div className="leaf-text">
        {BEAT_SPANS.filter((b) => b.section === id).map((b) => (
          <BeatBlock key={b.id} beat={b} content={cards[b.id]} />
        ))}
      </div>
    </section>
  )
}
