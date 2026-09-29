import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type RefObject } from 'react'
import { journey, useJourney } from '../../core/store/journey'
import { grove } from '../../content'
import type { QimenChart } from '../../lib/qimen/types'
import { MOBILE_QUERY, useMediaQuery } from '../hooks'
import { announce } from '../live'
import { useChart } from './chartSource'
import { ChartControls, stepChart } from './ChartControls'
import { CompassControls } from './CompassControls'
import { recastAnnouncement } from './format'
import { QimenFigure } from './QimenFigure'
import { selectedInScene } from './selection'
import { useSheetDrag } from './sheetDrag'

type Tab = 'chart' | 'time' | 'compass'
const TABS: readonly Tab[] = ['chart', 'time', 'compass']

/**
 * Announce recasts (design.md §9.8) when the visitor can see or is using the chart: the figure is on
 * screen, or focus is inside the panel. The first chart after mount is not announced.
 */
function useRecastAnnouncements(chart: QimenChart | null, root: RefObject<HTMLElement | null>) {
  const last = useRef<string | null>(null)
  const visible = useRef(false)
  useEffect(() => {
    const el = root.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => {
      visible.current = !!e?.isIntersecting
    })
    io.observe(el)
    return () => io.disconnect()
  }, [root])
  useEffect(() => {
    if (!chart) return
    const key = `${chart.basis.local.slice(0, 10)} ${chart.pillars.hour.name}`
    const prev = last.current
    last.current = key
    if (prev === null || prev === key) return
    // The hour chime (design.md §12) has one source: the grove director emits CY_EVENT.recast for a
    // live 时辰 change the visitor can see (QM-7). The panel only announces.
    if (visible.current || root.current?.contains(document.activeElement)) announce(recastAnnouncement(chart))
  }, [chart, root])
}

/** `[` and `]` step the chart while focus is anywhere in the panel (design.md §9.6). */
function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
  if (e.key !== '[' && e.key !== ']') return
  if (e.target instanceof HTMLInputElement && e.target.type !== 'range') return
  e.preventDefault()
  stepChart(e.key === '[' ? -1 : 1)
}

/**
 * The grove's chart panel (design.md §8.6 G3, §9.6–9.9): figure, time controls and compass. Loaded
 * client-only after hydration; the prerendered card carries the explanation and a <noscript> line.
 * Phones in the walk get three tabs (Chart, Time, Compass) in a sheet that peeks and expands.
 */
export default function ChartPanel() {
  const snap = useChart()
  const mode = useJourney((s) => s.mode)
  const mobile = useMediaQuery(MOBILE_QUERY)
  const tabbed = mobile && mode === 'immersive'
  const [tab, setTab] = useState<Tab>('chart')
  const [expanded, setExpanded] = useState(false)
  const [bar, setBar] = useState<HTMLDivElement | null>(null)
  const root = useRef<HTMLDivElement>(null)
  const ids = useId()
  const chart = snap?.chart ?? null
  useRecastAnnouncements(chart, root)
  useSheetDrag(bar, useCallback((open: boolean) => setExpanded(open), []))

  // A palace tapped in 3D fills the palace details (design.md §9.7): on phones that is the chart tab
  // of the sheet. The sheet stays at its peek, because the same tap zooms the plan view onto that
  // palace above it (core/camera/planZoom.ts); dragging the sheet open shows the details.
  useEffect(() => {
    if (!tabbed) return
    return journey.subscribe((s, prev) => {
      if (s.selectedPalace === prev.selectedPalace || !selectedInScene(s.selectedPalace)) return
      setTab('chart')
    })
  }, [tabbed])

  const time = <ChartControls chart={chart} />
  const compass = <CompassControls chart={chart} />

  // Desktop and the album: the controls sit under the chart header, above the grid (design.md §9.6).
  if (!tabbed) {
    return (
      <div ref={root} className="chart-panel" onKeyDown={onKeyDown}>
        {chart ? (
          <QimenFigure chart={chart} controls={time} />
        ) : (
          <>
            <p className="qm-note">{grove.chartUnavailable}</p>
            {time}
          </>
        )}
        {compass}
      </div>
    )
  }

  const figure = chart ? <QimenFigure chart={chart} /> : <p className="qm-note">{grove.chartUnavailable}</p>

  const panelId = (t: Tab) => `${ids}-panel-${t}`
  const tabId = (t: Tab) => `${ids}-tab-${t}`
  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    const i = TABS.indexOf(tab)
    const next = e.key === 'ArrowRight' ? TABS[(i + 1) % TABS.length] : e.key === 'ArrowLeft' ? TABS[(i + TABS.length - 1) % TABS.length] : null
    if (!next) return
    e.preventDefault()
    setTab(next)
    document.getElementById(tabId(next))?.focus()
  }

  return (
    <div ref={root} className="chart-panel chart-sheet" data-expanded={expanded ? '' : undefined} onKeyDown={onKeyDown}>
      <div ref={setBar} className="sheet-bar">
        <div role="tablist" aria-label={grove.palaceDetails}>
          {TABS.map((t) => (
            <button
              key={t}
              id={tabId(t)}
              type="button"
              role="tab"
              aria-selected={tab === t}
              aria-controls={panelId(t)}
              tabIndex={tab === t ? 0 : -1}
              onKeyDown={onTabKey}
              onClick={() => {
                setTab(t)
                setExpanded(true)
              }}
            >
              {grove.tabs[t]}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="sheet-toggle"
          aria-expanded={expanded}
          aria-label={expanded ? grove.sheetCollapse : grove.sheetExpand}
          onClick={() => setExpanded((x) => !x)}
        >
          <span aria-hidden="true" />
        </button>
      </div>
      {TABS.map((t) => (
        <div key={t} id={panelId(t)} role="tabpanel" aria-labelledby={tabId(t)} hidden={tab !== t} className="sheet-panel" data-lenis-prevent="">
          {t === 'chart' ? figure : t === 'time' ? time : compass}
        </div>
      ))}
    </div>
  )
}
