import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { journey, useJourney } from '../../core/store/journey'
import { FRAMING, beatSpanById } from '../../core/world/beats'
import { grove } from '../../content'
import { angleDelta, compassAvailable, createJumpWatch, enableCompass, type CompassSession } from '../../lib/compass'
import type { QimenChart } from '../../lib/qimen/types'
import { COARSE_QUERY, useMediaQuery } from '../hooks'
import { compassReadout } from './format'

/** Denied or unsupported hides the button for the rest of the session (design.md §9.9). */
const HIDE_KEY = 'cy.compass.off'
const SOUTH_KEY = 'cy.compass.south'

const session = {
  get: (k: string) => {
    try {
      return sessionStorage.getItem(k)
    } catch {
      return null
    }
  },
  set: (k: string) => {
    try {
      sessionStorage.setItem(k, '1')
    } catch {
      // private mode: the flag lasts until reload
    }
  },
}

/** The plan view, where the dial turns under the threads: the G3 beat. */
const PLAN = beatSpanById('G3').jvh

/**
 * 天心十道 (design.md §9.9): the screen is the luopan's square base, with two fixed cinnabar hairlines
 * crossing through the chart centre and a small pointer at the top edge, "you face this way". Only
 * while the plan view is up. The centre and the plan area follow the rig's framing: landscape keeps
 * the right third for the chart panel, portrait centres the rings 30% down above the sheet.
 */
function Threads() {
  const plan = useJourney((s) => s.jvh >= PLAN[0] && s.jvh < PLAN[1])
  const portrait = useJourney((s) => s.portrait)
  if (!plan) return null
  const frame = portrait
    ? { '--cx': 0.5, '--cy': FRAMING.planPortraitCentreY, '--plan-w': 1, '--plan-h': FRAMING.planPortraitHeight }
    : { '--cx': 0.5 + FRAMING.zoneShiftX.panel, '--cy': 0.5, '--plan-w': 1 - FRAMING.chartPanelFraction, '--plan-h': 1 }
  // Into #root, under the cards: the chart panel and the phone sheet lie on top of the base.
  return createPortal(
    <div className="compass-threads" style={frame as CSSProperties} aria-hidden="true">
      <span className="thread thread-v" />
      <span className="thread thread-h" />
      <span className="thread-pointer" />
    </div>,
    document.getElementById('root') ?? document.body,
  )
}

/**
 * Compass mode (design.md §9.9) and manual rotation. "Follow compass" shows only on coarse pointers
 * where the orientation API exists; the "Rotate luopan" range works everywhere. Both write the store
 * (`compass`, `dialDeg`) for the grove scene and the album SVG. Leaving #grove, or "Read the chart"
 * setting `compass.status` to 'off', stops the listener.
 */
export function CompassControls({ chart }: { chart: QimenChart | null }) {
  const coarse = useMediaQuery(COARSE_QUERY)
  const mode = useJourney((s) => s.mode)
  const status = useJourney((s) => s.compass.status)
  const heading = useJourney((s) => (s.compass.heading === null ? null : Math.round(s.compass.heading)))
  const dialDeg = useJourney((s) => s.dialDeg)
  const [hidden, setHidden] = useState(() => session.get(HIDE_KEY) === '1')
  const [unsettled, setUnsettled] = useState(false)
  const [south, setSouth] = useState(false)
  const live = useRef<CompassSession | null>(null)
  const c = grove.compass

  const stop = useCallback(() => {
    live.current?.stop()
    live.current = null
    if (journey.getState().compass.status !== 'off') journey.setState({ compass: { status: 'off', heading: null } })
  }, [])

  useEffect(() => {
    const unsub = journey.subscribe((s) => {
      if (live.current && (s.active !== 'grove' || s.compass.status === 'off')) stop()
    })
    return () => {
      unsub()
      stop()
    }
  }, [stop])

  const start = async () => {
    journey.setState({ compass: { status: 'requesting', heading: null } })
    const watch = createJumpWatch()
    const result = await enableCompass((h) => {
      setUnsettled(watch(h, performance.now()))
      if (Math.abs(angleDelta(h, 180)) < 10 && session.get(SOUTH_KEY) !== '1') {
        session.set(SOUTH_KEY)
        setSouth(true)
      }
      if (live.current || journey.getState().compass.status === 'requesting') journey.setState({ compass: { status: 'active', heading: h } })
    })
    if (result.status === 'active') {
      live.current = result
      return
    }
    result.stop()
    journey.setState({ compass: { status: result.status, heading: null } })
    if (result.status === 'denied' || result.status === 'unsupported') {
      session.set(HIDE_KEY)
      setHidden(true)
    }
  }

  const supported = coarse && compassAvailable()
  const active = status === 'active'
  const note =
    status === 'denied' ? c.denied : status === 'unsupported' || status === 'no-data' ? c.unsupported : active && unsettled ? c.hold : null

  return (
    <div className="qm-compass">
      {supported && !hidden && (
        <button
          type="button"
          className="qm-toggle"
          aria-pressed={active}
          disabled={status === 'requesting'}
          onClick={() => (active ? stop() : void start())}
        >
          {active ? c.stop : c.button}
        </button>
      )}
      {note && <p className="qm-note">{note}</p>}
      {active && south && <p className="qm-note">{c.facingSouth}</p>}
      {active && chart && heading !== null && <p className="qm-readout">{compassReadout(chart, heading)}</p>}
      {active && <p className="qm-note">{c.counterRotateNote}</p>}
      <label className="qm-rotate">
        <span className="qm-pick-label">{grove.controls.rotateLuopan}</span>
        <input
          type="range"
          min={0}
          max={345}
          step={15}
          value={((dialDeg % 360) + 360) % 360}
          disabled={active}
          aria-valuetext={`${((dialDeg % 360) + 360) % 360}°`}
          onChange={(e) => journey.setState({ dialDeg: Number(e.target.value) })}
        />
      </label>
      {active && mode === 'immersive' && <Threads />}
    </div>
  )
}
