import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { journey, useJourney, type JourneyState } from '../../core/store/journey'
import { MARKS } from '../../core/world/beats'
import { contact } from '../../content/site'
import { features } from '../../content/features'
import { breakpoint } from '../../theme/tokens'
import { leaderOf, placePins, speckKeepOut, type PinPoint, type PinSize, type Rect } from './pins'
import { finaleWindow, insideWindow } from './window'

type PinId = keyof JourneyState['pins']
/** The grove has a pin while it is on the map, on the walk or a detour; not while it is off (content/features.ts). */
const onMap = (id: PinId) => id !== 'grove' || features.grove !== 'off'
/** Walk order, which is also the tab order. */
const PINS: readonly { id: PinId; href: string }[] = [
  { id: 'threshold', href: '/' },
  { id: 'cabin', href: '#cabin' },
  { id: 'grove', href: '#grove' },
].filter((p) => onMap(p.id as PinId)) as { id: PinId; href: string }[]
/** Who gets the clear spot when labels collide: Work, then Grove, then Start ("Walk again" also goes there). */
const PRIORITY: readonly PinId[] = (['cabin', 'grove', 'threshold'] as const).filter(onMap)
/** What holds the paper at the top of a phone's painting at E3 (walk.css). */
const TOP_BLOCK = ['.card-finale', '.card-contact .socials'] as const

/**
 * The contact scene signs the painting by time once E3 is reached and the catch-up fog has cleared
 * (`finale.colophonShown`, then `finale.sealStamped` 2.2 s later). If nothing has signed it this long
 * after E3, the DOM signs it anyway so the finale always completes: soon when there is no live
 * contact scene (still loading, or a lost context), much later when there is one, so the
 * scene's colophon-then-seal order wins even after an End-key jump whose fog takes seconds to clear.
 */
const SIGN_FALLBACK_MS = { noScene: 1200, scene: 8000 } as const

const setFlag = (name: string, on: boolean) => {
  const html = document.documentElement
  if (on && !html.hasAttribute(name)) html.setAttribute(name, '')
}

/**
 * The finale's DOM layer (design.md §8.7 E2–E3, §4.4). Walk only; loaded after hydration.
 * - Paper-mount panels slide in from both sides and leave a centred 3:4 window on landscape screens,
 *   a 12 px border on portrait ones (walk.css). Open once the scene says so (`finale.mountOpen`) and at
 *   the latest at E3, never before E2.
 * - The seal and the colophon live in the E3 card; this marks `html[data-seal]` and
 *   `html[data-colophon]` once per visit, and walk.css stamps and writes them.
 * - Map pins (three; two with the grove off) float over their projected world points
 *   (`journey.pins`, written by the scene every frame): real links that fog-dive, shown at E3 while the point is inside the window. Each
 *   is a dot on the point and a label beside it, tied by a hairline leader; pins.ts keeps the labels
 *   off each other, off the other dots and off the cabin's cyan speck, lifting one when it has to,
 *   and hides the lesser pin when nothing fits.
 */
export function Finale() {
  const inFinale = useJourney((s) => s.jvh >= MARKS.finaleStart)
  const signed = useJourney((s) => s.jvh >= MARKS.sealStamp)
  const mountOpen = useJourney((s) => s.finale.mountOpen)
  const sealStamped = useJourney((s) => s.finale.sealStamped)
  const colophonShown = useJourney((s) => s.finale.colophonShown)
  const [fallback, setFallback] = useState(false)
  const pins = useRef(new Map<PinId, HTMLAnchorElement>())
  // The pins are links, so they belong in the document: the E3 card holds a fixed, full-screen slot
  // for them (Contact.tsx), which puts them inside main and before the footer in the tab order.
  const [slot] = useState(() => document.querySelector<HTMLElement>('.map-pins'))

  useEffect(() => {
    if (!signed || fallback) return
    const s = journey.getState()
    const sceneLive = s.stage === 'live' && s.ready.contact === true
    const id = window.setTimeout(() => setFallback(true), sceneLive ? SIGN_FALLBACK_MS.scene : SIGN_FALLBACK_MS.noScene)
    return () => window.clearTimeout(id)
  }, [signed, fallback])

  const open = inFinale && (mountOpen || signed)
  // The contact card moves onto the right mount with the mounts, not at E3 (walk.css).
  useEffect(() => {
    document.documentElement.toggleAttribute('data-mounts', open)
    return () => document.documentElement.removeAttribute('data-mounts')
  }, [open])

  // The contact card on the right mount stops above the footer, however tall a large text size makes
  // it (walk.css reads --footer-h).
  useEffect(() => {
    const footer = document.querySelector<HTMLElement>('.site-footer')
    if (!footer) return
    const html = document.documentElement
    const set = () => html.style.setProperty('--footer-h', `${footer.offsetHeight}px`)
    set()
    const ro = new ResizeObserver(set)
    ro.observe(footer)
    return () => {
      ro.disconnect()
      html.style.removeProperty('--footer-h')
    }
  }, [])

  useEffect(() => setFlag('data-seal', sealStamped || fallback), [sealStamped, fallback])
  useEffect(() => setFlag('data-colophon', colophonShown || fallback), [colophonShown, fallback])

  useEffect(() => {
    let w = finaleWindow(innerWidth, innerHeight)
    let obstacles: Rect[] = []
    let shown = false
    let stale = true
    const sizes: Record<string, PinSize> = {}
    // On phones the colophon, the link icons, "Walk again" and the footer hold the paper at the top
    // of the painting at E3, and the seal sits at the bottom: pins stay clear of all of them.
    const measure = () => {
      stale = false
      w = finaleWindow(innerWidth, innerHeight)
      obstacles = []
      for (const k of Object.keys(sizes)) delete sizes[k]
      if (innerWidth >= breakpoint.desktop) {
        // The header grows with a large text size (chrome.css --header-block); pins stay below it.
        const header = document.querySelector('.site-header')?.getBoundingClientRect()
        if (header && header.height > 0) w.top = Math.max(w.top, header.bottom)
        return
      }
      for (const sel of TOP_BLOCK) {
        const r = document.querySelector(sel)?.getBoundingClientRect()
        if (r && r.height > 0 && r.top < innerHeight / 2) w.top = Math.max(w.top, r.bottom)
      }
      // The footer sits under "Walk again" where anchor positioning works, else bottom-left.
      const footer = document.querySelector('.site-footer')?.getBoundingClientRect()
      if (footer && footer.height > 0) {
        if (footer.top < innerHeight / 2) w.top = Math.max(w.top, footer.bottom)
        else w.bottom = Math.min(w.bottom, footer.top)
      }
      const seal = document.querySelector('.card-finale .finale-seal')?.getBoundingClientRect()
      if (seal && seal.height > 0) obstacles.push(seal)
    }
    const apply = (s: JourneyState) => {
      const show = s.jvh >= MARKS.sealStamp
      if (show && (!shown || stale)) measure()
      shown = show
      const points: PinPoint[] = []
      for (const id of PRIORITY) {
        const p = s.pins[id]
        if (show && p?.visible && insideWindow(p, w)) points.push({ id, x: p.x, y: p.y })
      }
      // Show the candidates first so their labels can be measured, then place them.
      for (const [id, el] of pins.current) {
        const p = points.find((q) => q.id === id)
        if (!p) {
          if (el.dataset.visible !== undefined) delete el.dataset.visible
          continue
        }
        el.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px)`
        el.dataset.visible = ''
        const label = el.querySelector<HTMLElement>('.map-pin-label')
        if (!sizes[id] && label) sizes[id] = { w: label.offsetWidth, h: label.offsetHeight }
      }
      const cabin = points.find((p) => p.id === 'cabin')
      const placed = placePins(points, sizes, w, cabin ? [...obstacles, speckKeepOut(cabin)] : obstacles)
      for (const p of points) {
        const el = pins.current.get(p.id as PinId)
        const size = sizes[p.id]
        if (!el || !size) continue
        const pl = placed.find((q) => q.id === p.id)
        if (!pl) {
          delete el.dataset.visible
          continue
        }
        el.dataset.side = pl.side
        el.style.setProperty('--dx', `${pl.dx}px`)
        el.style.setProperty('--dy', `${pl.dy}px`)
        // A hairline ties every label to its dot, so two pins close together still read apart.
        const leader = leaderOf(pl, size)
        el.style.setProperty('--leader', `${leader.length.toFixed(1)}px`)
        el.style.setProperty('--leader-angle', `${leader.angle.toFixed(1)}deg`)
      }
    }
    const remeasure = () => {
      stale = true
      apply(journey.getState())
    }
    apply(journey.getState())
    addEventListener('resize', remeasure)
    // The E3 card lays out late (the colophon is its own chunk) and the web fonts swap in.
    const ro = new ResizeObserver(() => {
      if (shown) remeasure()
      else stale = true
    })
    for (const sel of [...TOP_BLOCK, '.site-footer']) {
      const el = document.querySelector(sel)
      if (el) ro.observe(el)
    }
    const unsub = journey.subscribe((s, prev) => {
      if (s.pins !== prev.pins || s.jvh !== prev.jvh) apply(s)
    })
    return () => {
      unsub()
      ro.disconnect()
      removeEventListener('resize', remeasure)
    }
  }, [])

  const pinLinks = PINS.map((p) => (
    <a
      key={p.id}
      ref={(el) => {
        if (el) pins.current.set(p.id, el)
        else pins.current.delete(p.id)
      }}
      className="map-pin"
      data-pin={p.id}
      href={p.href}
      data-jump=""
    >
      <span className="map-pin-dot" aria-hidden="true" />
      <span className="map-pin-leader" aria-hidden="true" />
      <span className="map-pin-label">{contact.mapPins[p.id]}</span>
    </a>
  ))

  return (
    <div className="finale" data-open={open ? '' : undefined}>
      <div className="mount mount-l" aria-hidden="true" />
      <div className="mount mount-r" aria-hidden="true" />
      {slot ? createPortal(pinLinks, slot) : pinLinks}
    </div>
  )
}
