import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { journey } from '../../core/store/journey'
import { layout, motion } from '../../theme/tokens'
import type { GlossDetail } from './detail'

/**
 * The one gloss tooltip (design.md §4.3, WCAG 1.4.13). DOM triggers are `[data-gloss]` spans
 * (see Zh.tsx) or `[data-gloss-host]` controls wrapping one. Opens after 120 ms of hover or at once
 * on focus, toggles on tap, closes on Esc, stays open while hovered, and flips above or below so it
 * never covers what it explains.
 *
 * 3D glyphs open it with `openGlossAt(glyphId, { x, y })` or by writing `journey.gloss`.
 */

type Anchor = { kind: 'rect'; rect: DOMRect } | { kind: 'point'; x: number; y: number }

interface Open {
  detail: GlossDetail
  anchor: Anchor
  /** What opened it; the matching close only closes its own tooltip. */
  source: 'dom' | 'api'
}

type Controller = { open: (o: Open) => void; close: (source?: Open['source']) => void }
let controller: Controller | null = null

const GAP = 8

/**
 * Open the tooltip for a 3D glyph at a screen point (CSS px, viewport coordinates).
 * `glyphId` is the glyph's Chinese text, optionally with an `@suffix` (ignored).
 */
export function openGlossAt(glyphId: string, point: { x: number; y: number }): void {
  void import('./detail').then(({ glossDetail }) => {
    const detail = glossDetail(glyphId)
    if (detail) controller?.open({ detail, anchor: { kind: 'point', ...point }, source: 'api' })
  })
}

function triggerOf(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null
  const hit = target.closest<HTMLElement>('[data-gloss], [data-gloss-host]')
  return hit
}

function glossElement(trigger: HTMLElement): HTMLElement | null {
  return trigger.hasAttribute('data-gloss') ? trigger : trigger.querySelector<HTMLElement>('[data-gloss]')
}

function detailFromDom(trigger: HTMLElement): GlossDetail | null {
  const el = glossElement(trigger)
  if (!el) return null
  const d = el.dataset
  if (!d.py || !d.en) return null
  return { zh: el.textContent ?? '', pinyin: d.py, en: d.en, meaning: d.meaning ?? '' }
}

export function GlossLayer() {
  const [open, setOpen] = useState<Open | null>(null)
  const [pos, setPos] = useState<{ left: number; top: number; side: 'above' | 'below' } | null>(null)
  const tipRef = useRef<HTMLDivElement>(null)
  const current = useRef<Open | null>(null)
  useLayoutEffect(() => {
    current.current = open
  }, [open])

  useEffect(() => {
    let openTimer = 0
    let closeTimer = 0
    /** The DOM trigger the tooltip is anchored to, if any. */
    let anchorEl: HTMLElement | null = null
    let hovered: HTMLElement | null = null
    let lastPointer = ''
    let lastPointerAt = 0

    const show = (o: Open) => {
      window.clearTimeout(closeTimer)
      if (o.source === 'api') anchorEl = null
      setOpen(o)
    }
    const hide = (source?: Open['source']) => {
      window.clearTimeout(openTimer)
      window.clearTimeout(closeTimer)
      if (source && current.current && current.current.source !== source) return
      anchorEl = null
      setOpen(null)
    }
    controller = { open: show, close: hide }

    const openFor = (trigger: HTMLElement) => {
      const detail = detailFromDom(trigger)
      if (!detail) return
      anchorEl = trigger
      show({ detail, anchor: { kind: 'rect', rect: trigger.getBoundingClientRect() }, source: 'dom' })
    }
    const lingerClose = () => {
      window.clearTimeout(closeTimer)
      closeTimer = window.setTimeout(() => hide('dom'), motion.tooltipLinger)
    }

    const onPointerOver = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return
      if (tipRef.current?.contains(e.target as Node)) {
        window.clearTimeout(closeTimer)
        return
      }
      const trigger = triggerOf(e.target)
      if (!trigger || trigger === hovered) return
      hovered = trigger
      window.clearTimeout(openTimer)
      window.clearTimeout(closeTimer)
      if (trigger === anchorEl) return
      openTimer = window.setTimeout(() => openFor(trigger), motion.tooltipDelay)
    }
    const onPointerOut = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return
      const from = e.target as Node
      const to = e.relatedTarget as Node | null
      const tip = tipRef.current
      const fromTip = !!tip?.contains(from)
      const fromTrigger = fromTip ? null : triggerOf(from)
      if (!fromTip && !fromTrigger) return
      if (to && (tip?.contains(to) || hovered?.contains(to) || fromTrigger?.contains(to))) return
      hovered = null
      window.clearTimeout(openTimer)
      if (current.current?.source !== 'dom') return
      // Keyboard focus keeps it open; only hover ended.
      if (anchorEl && anchorEl.contains(document.activeElement)) return
      lingerClose()
    }
    const onPointerDown = (e: PointerEvent) => {
      lastPointer = e.pointerType
      lastPointerAt = performance.now()
      if (current.current && !triggerOf(e.target) && !tipRef.current?.contains(e.target as Node)) hide()
    }
    const onFocusIn = (e: FocusEvent) => {
      const trigger = triggerOf(e.target)
      if (!trigger) return
      // A tap focuses the span too; the click handler toggles instead.
      if (lastPointer === 'touch' && performance.now() - lastPointerAt < 600) return
      window.clearTimeout(openTimer)
      openFor(trigger)
    }
    const onFocusOut = (e: FocusEvent) => {
      const trigger = triggerOf(e.target)
      if (!trigger || trigger !== anchorEl || current.current?.source !== 'dom') return
      if (hovered === trigger) return
      hide('dom')
    }
    const onClick = (e: MouseEvent) => {
      const trigger = triggerOf(e.target)
      if (!trigger || !trigger.hasAttribute('data-gloss')) return
      if (lastPointer !== 'touch' || performance.now() - lastPointerAt > 1500) return
      if (anchorEl === trigger) hide()
      else openFor(trigger)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && current.current) hide()
    }
    const onScroll = () => {
      if (current.current?.source === 'dom') hide('dom')
    }

    document.addEventListener('pointerover', onPointerOver)
    document.addEventListener('pointerout', onPointerOut)
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('focusin', onFocusIn)
    document.addEventListener('focusout', onFocusOut)
    document.addEventListener('click', onClick)
    document.addEventListener('keydown', onKey)
    addEventListener('scroll', onScroll, { passive: true })

    // 3D glyph hovers arrive through the store as well as through openGlossAt().
    const unsub = journey.subscribe((s, prev) => {
      if (s.gloss === prev.gloss) return
      if (s.gloss) openGlossAt(s.gloss.zh, { x: s.gloss.x, y: s.gloss.y })
      else hide('api')
    })

    return () => {
      controller = null
      unsub()
      window.clearTimeout(openTimer)
      window.clearTimeout(closeTimer)
      document.removeEventListener('pointerover', onPointerOver)
      document.removeEventListener('pointerout', onPointerOut)
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('focusin', onFocusIn)
      document.removeEventListener('focusout', onFocusOut)
      document.removeEventListener('click', onClick)
      document.removeEventListener('keydown', onKey)
      removeEventListener('scroll', onScroll)
    }
  }, [])

  useLayoutEffect(() => {
    const tip = tipRef.current
    if (!open || !tip) {
      setPos(null)
      return
    }
    // The header grows with the reader's text size (chrome.css --header-block), so measure it.
    const header = document.querySelector('.site-header')?.getBoundingClientRect().bottom ?? 0
    const minTop = Math.max(layout.headerHeight, header) + GAP
    setPos(placeTooltip(open.anchor, tip.offsetWidth, tip.offsetHeight, innerWidth, innerHeight, minTop))
  }, [open])

  const d = open?.detail
  return (
    <div
      ref={tipRef}
      id="gloss-tooltip"
      role="tooltip"
      className="gloss-tip"
      data-open={open && pos ? '' : undefined}
      data-side={pos?.side}
      style={pos ? { left: pos.left, top: pos.top } : undefined}
      hidden={!open}
    >
      {d && (
        <>
          <p className="gloss-tip-head">
            <span className="gloss-tip-zh" lang="zh-Hans">
              {d.zh}
            </span>{' '}
            <span className="gloss-tip-py">{d.pinyin}</span> · <span className="gloss-tip-en">{d.en}</span>
            {d.note ? <span className="gloss-tip-note"> · {d.note}</span> : null}
          </p>
          {d.meaning && <p className="gloss-tip-meaning">{d.meaning}</p>}
        </>
      )}
    </div>
  )
}

/**
 * Above the anchor if it fits under the header (`minTop`, the header's bottom plus a gap), else
 * below; clamped to the viewport. Pure.
 */
export function placeTooltip(
  anchor: Anchor,
  width: number,
  height: number,
  vw: number,
  vh: number,
  minTop: number = layout.headerHeight + GAP,
): { left: number; top: number; side: 'above' | 'below' } {
  const top0 = anchor.kind === 'rect' ? anchor.rect.top : anchor.y
  const bottom0 = anchor.kind === 'rect' ? anchor.rect.bottom : anchor.y
  const cx = anchor.kind === 'rect' ? anchor.rect.left + anchor.rect.width / 2 : anchor.x
  const above = top0 - GAP - height
  const side: 'above' | 'below' = above >= minTop || bottom0 + GAP + height > vh ? 'above' : 'below'
  const top = side === 'above' ? Math.max(GAP, above) : bottom0 + GAP
  const left = Math.min(Math.max(GAP, cx - width / 2), Math.max(GAP, vw - width - GAP))
  return { left: Math.round(left), top: Math.round(top), side }
}
