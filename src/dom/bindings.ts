import { NEAR_JUMP_JVH, scrollToJvh } from '../core/scroll'
import { lastModality } from '../core/scroll/modality'
import { journey, type JourneyState } from '../core/store/journey'
import { MARKS, beatSpanAt, type BeatId } from '../core/world/beats'
import { color } from '../theme/tokens'
import { CARDS, cardByBeat, cardOpacity, focusJvh, rollProgress } from './cards'

/**
 * Imperative store → DOM bindings for things that change every scroll frame. None of them go through
 * React state (store rule: React never selects u, jvh or dive.amount). Each returns a stop function.
 */

const html = () => document.documentElement

function setAttr(el: HTMLElement, name: string, value: string | null) {
  if (value === null) {
    if (el.hasAttribute(name)) el.removeAttribute(name)
  } else if (el.getAttribute(name) !== value) el.setAttribute(name, value)
}

/**
 * The DOM fog overlay mirrors dive.amount whenever the WebGL post pass isn't drawing the dive
 * (album, stage loading, context lost). The ink pass owns the dive once the stage is live, except
 * under reduced motion, where design.md §11.1 wants a plain crossfade through paper, not the dissolve.
 * index.html raises the veil before first paint for a deep link (`html[data-veil]`); from here on
 * this binding owns it, so the head script's failsafe never has to lift it.
 */
export function bindVeil(): () => void {
  const veil = document.getElementById('veil')
  if (!veil) return () => {}
  const apply = (s: JourneyState) => {
    const amount = s.stage === 'live' && !s.reducedMotion ? 0 : s.dive.amount
    veil.style.opacity = amount > 0 ? amount.toFixed(3) : ''
  }
  apply(journey.getState())
  delete html().dataset.veil
  return journey.subscribe((s, prev) => {
    if (s.dive.amount !== prev.dive.amount || s.stage !== prev.stage || s.reducedMotion !== prev.reducedMotion) apply(s)
  })
}

/**
 * Chrome palette: night inside the cabin (design.md §4). The rig writes insideCabin while the stage
 * is live; before that the scroll position stands in, so the chrome still inverts at the door.
 * Also mirrors the tier on <html data-tier> (the header blur is medium and high only).
 */
export function isNight(s: JourneyState): boolean {
  if (s.mode !== 'immersive') return false
  if (s.stage === 'live') return s.insideCabin
  return s.jvh >= MARKS.doorPlane && s.jvh < MARKS.stageSwap
}

export function bindPalette(): () => void {
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
  let night: boolean | null = null
  const apply = (s: JourneyState) => {
    setAttr(html(), 'data-tier', s.mode === 'immersive' ? s.tier : null)
    const n = isNight(s)
    if (n === night) return
    night = n
    setAttr(html(), 'data-palette', n ? 'night' : null)
    meta?.setAttribute('content', n ? color.night : color.paper)
  }
  apply(journey.getState())
  return journey.subscribe(apply)
}

/**
 * Per-frame card state in the walk: opacity from cards.ts, the credits roll, and `html[data-beat]`
 * (the finale layout keys off it). Also `html[data-dive]` while a fog-dive covers the screen, which
 * fades the cards out over 200 ms (design.md §11.1).
 */
export function bindCards(): () => void {
  const els = new Map<string, HTMLElement[]>()
  for (const el of document.querySelectorAll<HTMLElement>('[data-card]')) {
    const id = el.dataset.card as string
    els.set(id, [...(els.get(id) ?? []), el])
  }
  let lastBeat = ''
  const apply = (s: JourneyState) => {
    const walk = s.mode === 'immersive'
    for (const spec of CARDS) {
      const list = els.get(spec.beat)
      if (!list) continue
      const o = walk ? cardOpacity(spec, s.jvh) : 1
      for (const el of list) {
        el.style.opacity = walk ? o.toFixed(3) : ''
        setAttr(el, 'data-off', walk && o === 0 ? '' : null)
        if (spec.roll) el.style.setProperty('--roll', walk ? rollProgress(spec, s.jvh).toFixed(4) : '0')
      }
    }
    const beat = walk ? beatSpanAt(s.jvh).id : ''
    if (beat !== lastBeat) {
      lastBeat = beat
      setAttr(html(), 'data-beat', beat || null)
    }
    setAttr(html(), 'data-dive', s.dive.phase === 'in' || s.dive.phase === 'hold' ? s.dive.phase : null)
  }
  apply(journey.getState())
  return journey.subscribe((s, prev) => {
    if (s.jvh !== prev.jvh || s.mode !== prev.mode || s.dive.phase !== prev.dive.phase) apply(s)
  })
}

/**
 * Keyboard focus walks the walk (design.md §15: visible focus, tab order follows reading order).
 * A card shows only inside its jvh window, so when Tab or Shift+Tab lands in a card the walk isn't
 * showing (Tab from the last I2d link into the terminal, "Read the chart" reached from G0 or back from
 * the G3 panel), the walk glides to the nearest point where that card shows whole, and the camera
 * comes along. The card then fades in with the scroll, as it would for a reader: `html[data-focus-glide]`
 * holds walk.css's focus reveal back until the glide lands, so it never floats over the card being
 * left. A jump's heading focus (tabindex -1) and pointer focus never move the walk.
 */
export function bindFocusFollow(): () => void {
  let glide = 0
  const onFocusIn = (e: FocusEvent) => {
    const s = journey.getState()
    const el = e.target
    if (s.mode !== 'immersive' || s.dive.phase !== 'idle' || lastModality() !== 'keyboard') return
    if (!(el instanceof HTMLElement) || el.getAttribute('tabindex') === '-1') return
    const card = el.closest<HTMLElement>('.card[data-card]')
    const spec = card ? cardByBeat(card.dataset.card as BeatId) : undefined
    const to = spec ? focusJvh(spec, s.jvh) : null
    if (to === null) return
    const my = ++glide
    html().setAttribute('data-focus-glide', '')
    void scrollToJvh(to, { smooth: Math.abs(to - s.jvh) <= NEAR_JUMP_JVH }).then(() => {
      if (my === glide) html().removeAttribute('data-focus-glide')
    })
  }
  document.addEventListener('focusin', onFocusIn)
  return () => {
    document.removeEventListener('focusin', onFocusIn)
    html().removeAttribute('data-focus-glide')
  }
}

/**
 * A glide control (`[data-scroll-jvh]`: "Open the door", "Read the chart") has nothing to do once the
 * walk is at or past where it glides to, so it leaves the tab order there. Otherwise the first Tab
 * after the Work jump (which lands inside the cabin, focus on the C1 heading) would reach "Open the
 * door" and walk the visitor back out through it. Back in front of the target it is a tab stop again.
 */
export function bindGlideControls(): () => void {
  const controls = [...document.querySelectorAll<HTMLElement>('[data-scroll-jvh]')]
  const apply = (s: JourneyState) => {
    for (const el of controls) {
      const past = s.mode === 'immersive' && s.jvh >= Number(el.dataset.scrollJvh) - 0.5
      setAttr(el, 'tabindex', past ? '-1' : null)
    }
  }
  apply(journey.getState())
  return journey.subscribe((s, prev) => {
    if (s.jvh !== prev.jvh || s.mode !== prev.mode) apply(s)
  })
}
