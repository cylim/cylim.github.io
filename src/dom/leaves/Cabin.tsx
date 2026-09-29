import { lazy } from 'react'
import { journey, useJourney } from '../../core/store/journey'
import { MARKS } from '../../core/world/beats'
import { fill } from '../../content/format'
import { cabin } from '../../content/site'
import { ui } from '../../content/ui'
import { stack } from '../../content/stack'
import { timeline, timelineCaption, yearsLabel } from '../../content/timeline'
import { alsoWork, featuredWork, type WorkItem } from '../../content/work'
import { Still } from '../album/Still'
import { Client } from '../Client'
import { StaticTranscript } from '../terminal/StaticTranscript'
import { InlineCode } from './bits'
import { Leaf, LeafInscription, type Cards } from './Leaf'

const Terminal = lazy(() => import('../terminal/Terminal'))

const pad2 = (n: number) => String(n).padStart(2, '0')

/**
 * One hanging scroll's DOM twin (design.md §8.4 I2). Hover or focus steps the 3D scroll forward
 * (`cabinFocus`); hovering the 3D scroll lights this card in turn.
 */
function WorkCard({ item, index }: { item: WorkItem; index: number }) {
  const lit = useJourney((s) => s.cabinFocus === index)
  const focus = () => {
    if (journey.getState().cabinFocus !== index) journey.setState({ cabinFocus: index })
  }
  const blur = () => {
    if (journey.getState().cabinFocus === index) journey.setState({ cabinFocus: null })
  }
  return (
    <article
      className="work-card"
      data-focus={lit ? '' : undefined}
      onPointerEnter={focus}
      onPointerLeave={blur}
      onFocus={focus}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) blur()
      }}
    >
      <p className="label work-index">{fill(cabin.scrollIndex, { n: pad2(index + 1), total: pad2(featuredWork.length) })}</p>
      <h3>{item.title}</h3>
      <p className="work-meta">
        {item.context} · {item.role}
        {item.years ? ` · ${item.years}` : ''}
      </p>
      <p className="work-summary">{item.summary}</p>
      <ul className="tags" aria-label={cabin.tagsLabel}>
        {item.tags.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
      {item.links.length > 0 && (
        <p className="work-links">
          {item.links.map((l) => (
            <a key={l.href} href={l.href}>
              {l.label}
            </a>
          ))}
        </p>
      )}
      {item.writeup && (
        <details className="work-more">
          <summary>{cabin.more}</summary>
          {item.writeup.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </details>
      )}
    </article>
  )
}

function AlsoList() {
  return (
    <div className="also">
      <h3>{cabin.alsoHeading}</h3>
      <ul>
        {alsoWork.map((w) => (
          <li key={w.id}>
            <span className="also-title">{w.title}</span>
            {w.years && <span className="also-years"> · {w.years}</span>}
            <span className="also-summary"> · {w.oneLine ?? w.summary}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * The DOM terminal is the terminal; the 3D pane is a picture of it (design.md §10.2). The static
 * transcript prerenders and stays until the interactive terminal's chunk arrives.
 */
function TerminalBlock() {
  return (
    <section className="terminal-section" aria-labelledby="terminal-heading">
      <h3 id="terminal-heading">{cabin.terminalHeading}</h3>
      <Client fallback={<StaticTranscript />}>
        <Terminal />
      </Client>
    </section>
  )
}

/** The compact timeline rolls past like end credits (design.md §8.4 I4), then the tools. */
function Credits() {
  const cols = cabin.timelineColumns
  return (
    <div className="credits">
      <table className="timeline">
        <caption>{timelineCaption}</caption>
        <thead className="visually-hidden">
          <tr>
            <th scope="col">{cols.years}</th>
            <th scope="col">{cols.where}</th>
            <th scope="col">{cols.role}</th>
          </tr>
        </thead>
        <tbody>
          {timeline.map((e) => (
            <tr key={`${e.org}-${e.start}`}>
              <td className="timeline-years">{yearsLabel(e)}</td>
              <th scope="row">{e.org}</th>
              <td>
                {e.role}
                {e.note && <span className="timeline-note">{e.note}</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <h3>{cabin.stackHeading}</h3>
      <dl className="stack">
        {stack.map((g) => (
          <div key={g.id}>
            <dt>{g.label}</dt>
            <dd>{g.items.join(', ')}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

const work = (i: number) => {
  const item = featuredWork[i]
  return item ? <WorkCard item={item} index={i} /> : null
}

const cards: Cards = {
  C1: {
    body: (
      <>
        <p className="label">{cabin.label}</p>
        <h2 id="cabin-heading" tabIndex={-1}>
          {cabin.heading}
        </h2>
        <p>{cabin.bridge}</p>
        {/* The DOM twin of the door and lattice click (design.md §15): the same glide to the doorway. */}
        <button type="button" className="open-door" data-scroll-jvh={MARKS.doorClickTarget}>
          {ui.openDoor}
        </button>
      </>
    ),
  },
  I1: {
    className: 'card-night',
    body: (
      <>
        <div className="album-only">
          <Still id="I1" />
        </div>
        {cabin.intro.map((p) => (
          <p key={p}>
            <InlineCode text={p} />
          </p>
        ))}
      </>
    ),
  },
  I2a: { className: 'card-night', body: work(0) },
  I2b: { className: 'card-night', body: work(1) },
  I2c: { className: 'card-night', body: work(2) },
  I2d: {
    className: 'card-night',
    // The last scroll plus the Also list can outgrow a laptop's frame (it holds eight links, each a
    // 44 px target): the wheel scrolls the card to its end before the walk moves on.
    scrollable: true,
    body: (
      <>
        {work(3)}
        <AlsoList />
      </>
    ),
  },
  I3: { className: 'card-night card-terminal', body: <TerminalBlock /> },
  I4: { className: 'card-night card-credits', body: <Credits /> },
}

export function CabinSection() {
  return (
    <Leaf
      id="cabin"
      art={
        <>
          <LeafInscription id="cabin" />
          <Still id="C3" />
        </>
      }
      cards={cards}
    />
  )
}
