import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { journey, nowMs, useJourney, type JourneyState, type ScreenRect, type TerminalLine } from '../../core/store/journey'
import { jumpTo } from '../../core/scroll'
import { CY_EVENT, emit } from '../../core/events'
import { holdOf } from '../../core/world/beats'
import { sectionFromHash } from '../../core/sections/ids'
import { cabin, terminal } from '../../content'
import { motion } from '../../theme/tokens'
import { castAt } from '../chart/chartSource'
import { inscriptionBand, qimenVars } from '../chart/format'
import { MOBILE_QUERY, useMediaQuery } from '../hooks'
import { CloseIcon } from '../icons'
import { appendLines, clearLines, getHistory, loadBuffer, pushHistory } from './buffer'
import { interruptLines, runCommand, tabCompletion, type NavigateHash, type RunContext } from './commands'
import { QimenGrid } from './QimenGrid'
import { PromptLine, TermText } from './StaticTranscript'

const I3_HOLD = holdOf('I3')

const ctx: RunContext = {
  now: () => nowMs(),
  random: Math.random,
  qimen: (ms) => {
    const chart = castAt(ms)
    return chart ? { vars: qimenVars(chart), band: inscriptionBand(chart) } : null
  },
}

const inI3Hold = (s: Pick<JourneyState, 'jvh' | 'mode'>) => s.mode === 'immersive' && s.jvh >= I3_HOLD[0] && s.jvh <= I3_HOLD[1]

/**
 * How long the I3 hold waits for the cabin scene's projected pane before the terminal shows in its
 * card instead (a stub scene, a lost context).
 */
const PANE_GRACE_MS = 600

const MODIFIERS = new Set(['Shift', 'Control', 'Alt', 'Meta', 'CapsLock'])

function placeOver(el: HTMLElement, r: ScreenRect | null) {
  for (const [prop, v] of [
    ['left', r?.x],
    ['top', r?.y],
    ['width', r?.width],
    ['height', r?.height],
  ] as const) {
    if (v === undefined) el.style.removeProperty(prop)
    else el.style.setProperty(prop, `${v}px`)
  }
}

/**
 * `grove` and its aliases: a fog-dive in the walk, a plain jump to the leaf in the album
 * (design.md §10.3). jumpTo handles both, focuses the heading and announces the arrival.
 */
function navigate(hash: NavigateHash) {
  void jumpTo(sectionFromHash(hash))
}

function Line({ line }: { line: TerminalLine }) {
  switch (line.kind) {
    case 'input':
      return <PromptLine input={line.text} />
    case 'qimen':
      return line.chartAtMs === undefined ? null : <QimenGrid atMs={line.chartAtMs} />
    case 'hint':
      return (
        <p className="term-line term-hint">
          <TermText text={line.text} />
        </p>
      )
    default:
      return (
        <p className="term-line">
          <TermText text={line.text} />
        </p>
      )
  }
}

/**
 * The cabin terminal (design.md §10). A labelled input and a role=log output. It never steals focus:
 * it takes focus on click or tap, or on ` or / during the I3 hold. On desktop in the walk it sits
 * fixed over the 3D pane's projected rectangle (`journey.pane`); on phones it opens as a bottom sheet
 * sized to the visual viewport so the keyboard never covers the input, with command chips above it.
 */
export default function Terminal() {
  const lines = useJourney((s) => s.terminal.lines)
  const mode = useJourney((s) => s.mode)
  const mobile = useMediaQuery(MOBILE_QUERY)
  const sheet = mobile && mode === 'immersive'
  const [value, setValue] = useState('')
  const [open, setOpen] = useState(false)
  const histIdx = useRef<number | null>(null)
  const draft = useRef('')
  /** The input Tab last listed completions for, so it lists them once and then lets focus move. */
  const listedFor = useRef<string | null>(null)
  const root = useRef<HTMLDivElement>(null)
  const log = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const opener = useRef<HTMLButtonElement>(null)
  /** What takes focus once the sheet has opened (it moves into a portal, so its nodes are new). */
  const pendingFocus = useRef<'input' | 'log' | null>(null)

  const close = useCallback(() => {
    setOpen(false)
    opener.current?.focus()
  }, [])

  const openSheet = useCallback(
    (target: 'input' | 'log') => {
      if (open) (target === 'input' ? input.current : log.current)?.focus({ preventScroll: true })
      else {
        pendingFocus.current = target
        setOpen(true)
      }
    },
    [open],
  )

  useEffect(() => {
    const target = pendingFocus.current
    if (!open || !target) return
    pendingFocus.current = null
    ;(target === 'input' ? input.current : log.current)?.focus({ preventScroll: true })
  }, [open])

  useEffect(() => {
    loadBuffer()
  }, [])

  // Keep the newest output in view.
  useLayoutEffect(() => {
    const el = log.current
    if (el && lines.length > 0) el.scrollTop = el.scrollHeight
  }, [lines])

  // ` or / during the I3 hold focuses the input; default prevented only then (design.md §10.3).
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== '`' && e.key !== '/') return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const t = e.target as HTMLElement | null
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return
      if (!inI3Hold(journey.getState())) return
      e.preventDefault()
      if (sheet) openSheet('input')
      else input.current?.focus({ preventScroll: true })
    }
    // The cabin's 3D pane asks for the terminal with this event when tapped: the input takes focus,
    // in the phone sheet too (it sits on the visual viewport, so the keyboard never covers it).
    const onOpen = () => {
      if (sheet) openSheet('input')
      else input.current?.focus({ preventScroll: true })
    }
    document.addEventListener('keydown', onKey)
    addEventListener(CY_EVENT.terminalOpen, onOpen)
    return () => {
      document.removeEventListener('keydown', onKey)
      removeEventListener(CY_EVENT.terminalOpen, onOpen)
    }
  }, [sheet, openSheet])

  /*
   * Desktop walk (design.md §10.2): during the I3 hold the terminal sits fixed over the 3D pane's
   * projected rectangle (`journey.pane`), fading in when the hold begins and out where it stood when
   * the hold ends; the 3D mirror shows it the rest of the time. While the cabin scene is live the card
   * copy stays out of sight so it never flashes before the pane arrives. `data-pane` drives walk.css.
   */
  useEffect(() => {
    const el = root.current
    if (!el || sheet) return
    let leaving = 0
    let grace = 0
    let graceOver = false
    const setState = (v: 'over' | 'leaving' | 'await' | null) => {
      if (v === null) delete el.dataset.pane
      else if (el.dataset.pane !== v) el.dataset.pane = v
    }
    const apply = (s: JourneyState) => {
      const hold = inI3Hold(s)
      if (!hold) {
        window.clearTimeout(grace)
        grace = 0
        graceOver = false
      }
      if (hold && s.pane) {
        window.clearTimeout(leaving)
        leaving = 0
        el.classList.add('term-over-pane')
        placeOver(el, s.pane)
        setState('over')
        return
      }
      if (el.dataset.pane === 'over') {
        setState('leaving')
        leaving = window.setTimeout(() => {
          leaving = 0
          el.classList.remove('term-over-pane')
          placeOver(el, null)
          apply(journey.getState())
        }, motion.chromeCrossfade)
        return
      }
      if (leaving) return
      if (hold && !grace && !graceOver) {
        grace = window.setTimeout(() => {
          graceOver = true
          apply(journey.getState())
        }, PANE_GRACE_MS)
      }
      const scene = s.mode === 'immersive' && s.stage === 'live' && s.ready.cabin === true
      setState(scene && !graceOver ? 'await' : null)
    }
    apply(journey.getState())
    const unsub = journey.subscribe((s, prev) => {
      if (s.pane !== prev.pane || s.jvh !== prev.jvh || s.mode !== prev.mode || s.stage !== prev.stage || s.ready !== prev.ready) apply(s)
    })
    return () => {
      unsub()
      window.clearTimeout(leaving)
      window.clearTimeout(grace)
      el.classList.remove('term-over-pane')
      placeOver(el, null)
      delete el.dataset.pane
    }
  }, [sheet])

  // Phone sheet: 60% of the visual viewport, bottom-aligned to it.
  useEffect(() => {
    const el = root.current
    if (!el || !sheet || !open) return
    const vv = window.visualViewport
    const place = () => {
      const h = vv?.height ?? innerHeight
      const top = vv?.offsetTop ?? 0
      el.style.top = `${top + h * 0.4}px`
      el.style.height = `${h * 0.6}px`
    }
    place()
    vv?.addEventListener('resize', place)
    vv?.addEventListener('scroll', place)
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      vv?.removeEventListener('resize', place)
      vv?.removeEventListener('scroll', place)
      document.removeEventListener('keydown', onKey)
      el.style.removeProperty('top')
      el.style.removeProperty('height')
    }
  }, [sheet, open, close])

  const run = (text: string) => {
    const r = runCommand(text, ctx)
    if (r.history) pushHistory(r.history)
    appendLines(r.lines, { clear: r.clear })
    histIdx.current = null
    if (r.navigate) {
      const hash = r.navigate
      window.setTimeout(() => {
        setOpen(false)
        navigate(hash)
      }, terminal.navigateDelayMs)
    }
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    run(value)
    setValue('')
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    // Each key typed, for the key-click cue (design.md §12).
    if (!MODIFIERS.has(e.key)) emit(CY_EVENT.key, { key: e.key })
    const hist = getHistory()
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      if (hist.length === 0) return
      e.preventDefault()
      if (histIdx.current === null) draft.current = value
      const i = histIdx.current ?? hist.length
      const next = e.key === 'ArrowUp' ? Math.max(0, i - 1) : i + 1
      if (next >= hist.length) {
        histIdx.current = null
        setValue(draft.current)
      } else {
        histIdx.current = next
        setValue(hist[next] ?? '')
      }
      return
    }
    if (e.key === 'Tab' && !e.shiftKey) {
      // Completes, or lists an ambiguous prefix's matches once; after that Tab moves on (§10.3).
      const c = tabCompletion(value, listedFor.current)
      if (!c) return
      e.preventDefault()
      setValue(c.value)
      if (c.options.length > 1) {
        listedFor.current = c.value
        appendLines([{ kind: 'input', text: value }, { kind: 'hint', text: c.options.join('  ') }])
      }
      return
    }
    if (e.ctrlKey && (e.key === 'l' || e.key === 'L')) {
      e.preventDefault()
      clearLines()
      return
    }
    if (e.ctrlKey && (e.key === 'c' || e.key === 'C') && input.current?.selectionStart === input.current?.selectionEnd) {
      e.preventDefault()
      appendLines(interruptLines(value))
      setValue('')
      histIdx.current = null
      return
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      if (sheet && open) close()
      else input.current?.blur()
    }
  }

  const screen = (
    <div
      ref={root}
      className="term-screen term-live"
      data-sheet={sheet ? '' : undefined}
      data-open={sheet && open ? '' : undefined}
      onClick={(e) => {
        if (e.target === e.currentTarget || (e.target as Element).closest('.term-log')) {
          if (!window.getSelection()?.toString()) input.current?.focus({ preventScroll: true })
        }
      }}
    >
      {sheet && (
        <button type="button" className="term-close" aria-label={terminal.closeSheet} onClick={close}>
          <CloseIcon />
        </button>
      )}
      <div ref={log} className="term-log" role="log" aria-live="polite" aria-label={terminal.logLabel} tabIndex={0} data-lenis-prevent="">
        {lines.map((l) => (
          <div key={l.id} className="term-entry">
            <Line line={l} />
          </div>
        ))}
      </div>
      {mobile && (
        <div className="term-chips" role="group" aria-label={terminal.chipsLabel}>
          {terminal.chips.map((c) => (
            <button key={c} type="button" onClick={() => run(c)}>
              {c}
            </button>
          ))}
        </div>
      )}
      <form className="term-form" onSubmit={onSubmit}>
        <label htmlFor="terminal-input" className="visually-hidden">
          {terminal.inputAriaLabel}
        </label>
        <span className="term-prompt" aria-hidden="true">
          {terminal.prompt}
        </span>
        <input
          ref={input}
          id="terminal-input"
          type="text"
          value={value}
          onChange={(e) => {
            setValue(e.target.value)
            histIdx.current = null
            listedFor.current = null
          }}
          onKeyDown={onKeyDown}
          placeholder={terminal.placeholder}
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="send"
        />
      </form>
    </div>
  )

  if (!sheet) return screen
  // The open sheet sits above the bottom bar, so it leaves the card (whose frame would clip and fade
  // it) for the end of main: still inside a landmark, above the bar in #root's stacking order.
  return (
    <>
      <button ref={opener} type="button" className="term-open" aria-expanded={open} onClick={() => openSheet('log')}>
        {cabin.openTerminal}
      </button>
      {open ? createPortal(screen, document.getElementById('content') ?? document.body) : screen}
    </>
  )
}
