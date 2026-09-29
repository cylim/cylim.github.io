import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react'
import { journey, useJourney } from '../../core/store/journey'
import { chartYearRange, grove, predictionFromYear } from '../../content'
import type { QimenChart } from '../../lib/qimen/types'
import { motion } from '../../theme/tokens'
import { chartClock } from './chartSource'
import { branchIndex, hourValueText, turnNotice, wall } from './format'

/** Step the chart `steps` 时辰 (design.md §9.6), DST nights included. Leaves live mode. */
export function stepChart(steps: number): void {
  chartClock.step(steps)
}

export const backToLive = () => journey.setState({ chartInstantMs: null })

interface Timers {
  delay: number
  repeat: number
}

function stopTimers(t: Timers) {
  window.clearTimeout(t.delay)
  window.clearInterval(t.repeat)
}

/**
 * One 时辰 per press; a long press repeats at 4 per second after 400 ms. Pointer presses step on
 * pointerdown, so the click that follows is swallowed; keyboard activation steps on click.
 */
function useStepButton(steps: number) {
  const timers = useRef<Timers>({ delay: 0, repeat: 0 })
  const pressed = useRef(false)
  const stop = () => stopTimers(timers.current)
  useEffect(() => {
    const t = timers.current
    return () => stopTimers(t)
  }, [])
  return {
    onPointerDown: (e: ReactPointerEvent<HTMLButtonElement>) => {
      if (e.button !== 0) return
      pressed.current = true
      stepChart(steps)
      stop()
      timers.current.delay = window.setTimeout(() => {
        timers.current.repeat = window.setInterval(() => stepChart(steps), motion.longPress.interval)
      }, motion.longPress.delay)
    },
    onPointerUp: stop,
    onPointerLeave: stop,
    onPointerCancel: stop,
    onClick: () => {
      if (pressed.current) pressed.current = false
      else stepChart(steps)
    },
    onContextMenu: (e: { preventDefault: () => void }) => e.preventDefault(),
  }
}

const pad = (n: number) => String(n).padStart(2, '0')
const MIN = `${chartYearRange[0]}-01-01T00:00`
const MAX = `${chartYearRange[1]}-12-31T23:59`

/** datetime-local value → instant on the device clock, which is the chart's clock (timeBasis civil). */
function parseLocal(v: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(v)
  if (!m) return null
  const [y, mo, d, h, mi] = m.slice(1).map(Number) as [number, number, number, number, number]
  if (y < chartYearRange[0] || y > chartYearRange[1]) return null
  const t = new Date(y, mo - 1, d, h, mi).getTime()
  return Number.isFinite(t) ? t : null
}

/**
 * Time controls (design.md §9.6): Live, Earlier and Later, the hour slider (the DOM twin of the R4 hour
 * marker), a moment picker from 1930 to 2100, Back to now and Show English. All write the store; the
 * grove and the album read the same chart.
 */
export function ChartControls({ chart }: { chart: QimenChart | null }) {
  const live = useJourney((s) => s.chartInstantMs === null)
  const showEnglish = useJourney((s) => s.showEnglish)
  const earlier = useStepButton(-1)
  const later = useStepButton(1)
  const c = grove.controls
  const w = chart ? wall(chart) : null
  const local = w ? `${w.y}-${pad(w.mo)}-${pad(w.d)}T${pad(w.h)}:${pad(w.mi)}` : ''
  const current = chart ? branchIndex(chart.pillars.hour.branch) : 0

  return (
    <div className="qm-controls" role="group" aria-label={grove.tabs.time}>
      <div className="qm-live">
        <button type="button" className="qm-toggle" aria-pressed={live} onClick={backToLive}>
          {c.live}
        </button>
        {live && chart && <p className="qm-turn">{turnNotice(chart)}</p>}
        {!live && (
          <button type="button" className="qm-now" onClick={backToLive}>
            {c.backToNow}
          </button>
        )}
      </div>
      <div className="qm-step">
        <button type="button" className="qm-step-btn" aria-label={c.earlier} {...earlier}>
          <span aria-hidden="true">◀</span>
        </button>
        <label className="qm-hour">
          <span className="visually-hidden">{c.hourSlider}</span>
          <input
            type="range"
            min={0}
            max={11}
            step={1}
            value={current}
            aria-valuetext={chart ? hourValueText(chart) : undefined}
            onChange={(e) => {
              if (chart) stepChart(Number(e.target.value) - current)
            }}
          />
        </label>
        <button type="button" className="qm-step-btn" aria-label={c.later} {...later}>
          <span aria-hidden="true">▶</span>
        </button>
      </div>
      <label className="qm-pick">
        <span className="qm-pick-label">{c.pickMoment}</span>
        <input
          type="datetime-local"
          min={MIN}
          max={MAX}
          value={local}
          onChange={(e) => {
            const t = parseLocal(e.target.value)
            if (t !== null) journey.setState({ chartInstantMs: t })
          }}
        />
      </label>
      {w && w.y > predictionFromYear && <p className="qm-note">{c.predictionNote}</p>}
      <button
        type="button"
        className="qm-toggle"
        aria-pressed={showEnglish}
        onClick={() => journey.setState({ showEnglish: !showEnglish })}
      >
        {c.showEnglish}
      </button>
    </div>
  )
}
