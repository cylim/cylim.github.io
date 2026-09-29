import { lazy, useEffect, useSyncExternalStore } from 'react'
import { journey, useJourney } from '../../core/store/journey'
import { MARKS } from '../../core/world/beats'
import { features } from '../../content/features'
import { grove } from '../../content/grove'
import { groveHeading } from '../../content/site'
import { GlossText } from '../gloss/GlossText'
import { Client } from '../Client'
import { GlossaryList } from './GlossaryList'
import { Leaf, LeafInscription, type Cards } from './Leaf'

const ChartPanel = lazy(() => import('../chart/ChartPanel'))
const CastLabel = lazy(() => import('../chart/CastLabel'))
const AlbumChart = lazy(() => import('../chart/AlbumChart'))

const HINT_KEY = 'cy.glossHint'

/** Read once per page: whether this is the visitor's first visit to the grove copy. */
let firstVisit: boolean | null = null
function isFirstVisit(): boolean {
  if (firstVisit === null) {
    try {
      firstVisit = !localStorage.getItem(HINT_KEY)
    } catch {
      firstVisit = true
    }
  }
  return firstVisit
}

const noopSubscribe = () => () => {}

/** "Hover or tap any character for its meaning." on the first visit only (design.md §8.6). */
function GlossHint() {
  const show = useSyncExternalStore(noopSubscribe, isFirstVisit, () => false)
  useEffect(() => {
    try {
      localStorage.setItem(HINT_KEY, '1')
    } catch {
      // private mode: it shows again next time
    }
  }, [])
  return show ? <p className="gloss-hint">{grove.glossHint}</p> : null
}

/**
 * The glossary ships as prerendered HTML only: the server renders it, and the production client keeps
 * that markup as-is instead of carrying the whole glossary in the boot bundle. The dev server has no
 * prerender, so it renders the list on the client. Neither is a grove that isn't on the walk at load
 * (a detour): the client mounts it when a dive joins the grove walk, and the list comes with this
 * leaf's own chunk (dom/ContentLayer.tsx loads it lazily).
 */
function GlossaryIsland() {
  if (import.meta.env.SSR || import.meta.env.DEV || features.grove !== 'walk') {
    return (
      <div className="glossary-island">
        <GlossaryList />
      </div>
    )
  }
  return <div className="glossary-island" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: '' }} />
}

function AlbumArt() {
  const mode = useJourney((s) => s.mode)
  return (
    <>
      <LeafInscription id="grove" />
      <div className="album-chart-frame">{mode === 'static' && <Client>{<AlbumChart />}</Client>}</div>
    </>
  )
}

const cards: Cards = {
  // The intro sits by the stream (P1) but belongs under the h2; screen readers get it there (G1).
  P1: {
    body: (
      <div aria-hidden="true">
        {grove.intro.map((p) => (
          <p key={p}>{p}</p>
        ))}
      </div>
    ),
  },
  G1: {
    body: (
      <>
        <h2 id="grove-heading" tabIndex={-1}>
          {groveHeading.heading}
        </h2>
        <div className="visually-hidden">
          {grove.intro.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>
        <p>
          <GlossText text={grove.chartLead} />
        </p>
        <p>
          <GlossText text={grove.whatIsAChart} />
        </p>
        <p className="cast-label">
          <Client>
            <CastLabel />
          </Client>
        </p>
        <button
          type="button"
          className="read-chart"
          data-scroll-jvh={MARKS.readChart}
          onClick={() => journey.setState({ dialDeg: 0, compass: { status: 'off', heading: null } })}
        >
          {grove.readChart}
        </button>
        <GlossHint />
        <noscript>
          <p>{grove.noscript}</p>
        </noscript>
      </>
    ),
  },
  G3: {
    className: 'card-panel',
    scrollable: true,
    body: (
      <>
        <h3 className="panel-heading">{grove.panelHeading}</h3>
        <Client>
          <ChartPanel />
        </Client>
        <noscript>
          <p className="qm-note">{grove.noscript}</p>
        </noscript>
        <p className="qm-honesty">{grove.honesty}</p>
        <p className="board-note">{grove.luopan}</p>
        <p className="board-note">{grove.boardNote}</p>
        <p className="qm-method">
          <GlossText text={grove.methodNote} />
        </p>
        <p className="qm-disclaimer">{grove.disclaimer}</p>
        <GlossaryIsland />
      </>
    ),
  },
}

export function GroveSection() {
  return <Leaf id="grove" art={<AlbumArt />} cards={cards} />
}
