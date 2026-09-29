import { useEffect, useRef, useState } from 'react'
import { useJourney } from '../../core/store/journey'
import { WALK_SECTION_IDS, type SectionId } from '../../core/sections/ids'
import { homeMark, nav } from '../../content/site'
import { ui } from '../../content/ui'
import { layout, sealSize } from '../../theme/tokens'
import { Seal } from '../Seal'
import { accentGloss } from '../gloss/lookup'
import { ZhAccent } from '../gloss/Zh'

/** A dry-brush stroke: two streaky passes with gaps where the brush ran dry. Revealed by clip-path. */
function Underline() {
  return (
    <svg className="nav-underline" viewBox="0 0 64 8" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <path d="M2 4.6C16 3.2 34 5.4 62 3.4" strokeWidth="2.2" strokeDasharray="22 1.6 9 1.2 30" />
      <path d="M4 5.4C20 4.4 38 5.8 60 4.4" strokeWidth="0.9" strokeDasharray="6 2 14 1 20 3 12" />
    </svg>
  )
}

/**
 * In the album the page is not the walk, so the scroll driver's `active` means nothing there; the
 * section filling most of the viewport is the current place instead.
 */
function useAlbumActive(enabled: boolean): SectionId | null {
  const [id, setId] = useState<SectionId | null>(null)
  useEffect(() => {
    if (!enabled) return
    const ratios = new Map<SectionId, number>()
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) ratios.set(e.target.id as SectionId, e.intersectionRect.height)
        let best: SectionId | null = null
        let most = 0
        for (const [k, v] of ratios) if (v > most) [best, most] = [k, v]
        setId(best)
      },
      { threshold: [0, 0.1, 0.25, 0.5, 0.75, 1] },
    )
    for (const sid of WALK_SECTION_IDS) {
      const el = document.getElementById(sid)
      if (el) io.observe(el)
    }
    return () => io.disconnect()
  }, [enabled])
  return enabled ? id : null
}

/**
 * Header (design.md §4.1): home mark top-left, jump nav top-right. Under 768 px the same nav becomes
 * the fixed bottom bar (§4.2) with "Top" first; the home mark hides. One nav element either way, so
 * screen readers never meet the links twice.
 */
export function Header() {
  const walkActive = useJourney((s) => s.active)
  const album = useJourney((s) => s.mode === 'static')
  const albumActive = useAlbumActive(album)
  const active = album ? albumActive : walkActive
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    let raf = 0
    const update = () => {
      raf = 0
      const on = scrollY > layout.headerScrimAfter
      if ((el.dataset.scrolled === '') !== on) {
        if (on) el.dataset.scrolled = ''
        else delete el.dataset.scrolled
      }
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update)
    }
    update()
    addEventListener('scroll', onScroll, { passive: true })
    return () => {
      removeEventListener('scroll', onScroll)
      cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <header ref={ref} className="site-header">
      <a className="home-mark" href={homeMark.href} data-jump="" aria-label={homeMark.ariaLabel}>
        <Seal placement="nav" size={sealSize.nav} />
        <span className="home-name">{homeMark.name}</span>
      </a>
      <nav className="jump-nav" aria-label={ui.jumpNavLabel}>
        <ul>
          {nav.map((item) => (
            <li key={item.id} className={`nav-item nav-${item.id}`}>
              <a
                href={item.href}
                data-jump=""
                data-gloss-host=""
                aria-label={item.ariaLabel}
                aria-current={active === item.id ? 'location' : undefined}
              >
                {item.id === 'threshold' ? (
                  <span className="nav-zh nav-seal" aria-hidden="true">
                    <Seal placement="nav" size={18} />
                    <ZhAccent term={accentGloss(item.accent)} className="visually-hidden" />
                  </span>
                ) : (
                  <ZhAccent term={accentGloss(item.accent)} className="nav-zh" />
                )}
                <span className="nav-label">
                  <span className="nav-marker" aria-hidden="true" />
                  {item.label}
                </span>
                <Underline />
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  )
}
