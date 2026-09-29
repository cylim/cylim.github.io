import { Suspense, lazy, useEffect } from 'react'
import { journey, useJourney } from '../core/store/journey'
import { contact } from '../content/site'
import { ui } from '../content/ui'
import { bindCards, bindFocusFollow, bindGlideControls, bindPalette, bindVeil } from './bindings'
import { AlbumBanner } from './chrome/AlbumBanner'
import { Cluster } from './chrome/Cluster'
import { Header } from './chrome/Header'
import { Progress } from './chrome/Progress'
import { Client } from './Client'
import { LiveRegion } from './live'
import { CabinSection } from './leaves/Cabin'
import { ContactSection } from './leaves/Contact'
import { ThresholdSection } from './leaves/Threshold'
import { Toasts } from './toast'

// Not on the first screen, so out of the boot chunk (wave1-status H1).
const GlossLayer = lazy(() => import('./gloss/GlossLayer').then((m) => ({ default: m.GlossLayer })))
const WalkChrome = lazy(() => import('./chrome/WalkChrome'))

/**
 * The grove's leaf (copy, chart, glossary) is its own chunk: it is off the first screen, and as a
 * detour it only mounts when a dive joins the grove walk. The server renders it in place; hydration
 * keeps that markup until the chunk arrives. A dive heading for the grove starts the fetch while it
 * goes into paper, and the join waits for the section to appear (core/scroll/dive.ts).
 */
const loadGroveLeaf = () => import('./leaves/Grove')
const GroveSection = lazy(() => loadGroveLeaf().then((m) => ({ default: m.GroveSection })))

function PrefetchGroveLeaf() {
  useEffect(
    () =>
      journey.subscribe((s, prev) => {
        if (s.dive.to === 'grove' && prev.dive.to !== 'grove') void loadGroveLeaf()
      }),
    [],
  )
  return null
}

/**
 * The DOM bindings (cards, glide controls, focus follow and the rest). They query the track once, so
 * ContentLayer keys this on the walk: a detour joining the grove walk binds the grove's cards and
 * "Read the chart" too.
 */
function Bindings() {
  useEffect(() => {
    // Arrivals ("Now at Work") are announced by core/scroll through `cy:announce` when a jump settles.
    const stops = [bindVeil(), bindPalette(), bindCards(), bindGlideControls(), bindFocusFollow()]
    return () => {
      for (const stop of stops) stop()
    }
  }, [])
  return null
}

function WalkOnly() {
  const walk = useJourney((s) => s.mode === 'immersive')
  return walk ? (
    <Client>
      <WalkChrome />
    </Client>
  ) : null
}

/**
 * The content layer: the real document, prerendered by entry-server.tsx and hydrated by main.tsx.
 * Every sentence the 3D draws also lives here (design.md §1 rule 4). It renders identically on the
 * server and the hydrating client; anything that depends on the visitor (the chart, the colophon, the
 * interactive terminal, the album banner) mounts client-only after hydration, and so does chrome that
 * isn't on the first screen (the gloss tooltip, and the walk's inscriptions, title card and finale).
 *
 * Contract (docs/plan/contracts.md): #root holds this tree and is the R3F event source; #content is
 * the skip-link target; each section is section#<id>[aria-labelledby=<id>-heading] and its heading has
 * tabindex -1; every beat is div.beat[data-beat] of its jvh length; `a[data-jump]` fog-dives and
 * `[data-scroll-jvh]` scrolls locally. <html data-mode> picks the walk or the album; static is the
 * CSS default.
 *
 * The grove section is there while the grove is on the walk (core/world/walk.ts). As a detour it is
 * rendered client-side when a dive joins the grove walk: the store's `groveWalk` flips under paper,
 * the sections re-render onto the new walk (beats and heights), and the bindings run again so the
 * grove's cards and "Read the chart" are wired.
 */
export function ContentLayer() {
  const groveWalk = useJourney((s) => s.groveWalk)

  return (
    <>
      <Bindings key={groveWalk ? 'grove-walk' : 'walk'} />
      {!groveWalk && <PrefetchGroveLeaf />}
      <a className="skip-link" href="#content">
        {ui.skipLink}
      </a>
      <Header />
      <Cluster />
      <Progress />
      <main id="content">
        <AlbumBanner />
        <ThresholdSection />
        <CabinSection />
        {/* Off the walk (content/features.ts): no #grove section, copy, chart or glossary until a detour joins it. */}
        {groveWalk && (
          <Suspense fallback={null}>
            <GroveSection />
          </Suspense>
        )}
        <ContactSection />
        {/* The gloss tooltip: fixed, but inside main, so it sits in a landmark like everything else. */}
        <Client>
          <GlossLayer />
        </Client>
      </main>
      <footer className="site-footer">
        <p>
          {contact.footer} <a href={contact.source.href}>{contact.source.label}</a>
        </p>
      </footer>
      <WalkOnly />
      <Toasts />
      <LiveRegion />
    </>
  )
}
