import { use } from 'react'
import type { SectionSceneProps } from '../../core/sections/types'
import { journey, useJourney } from '../../core/store/journey'
import { groveOnWalk, groveReachable } from '../../core/world/walk'
import { GroveChart } from './chart/GroveChart'
import { GroundMist } from './chart/GroundMist'
import { chartGlyphsReady } from './chart/glyphs'
import { GrovePath } from './path'

// Start building the glyphs as soon as the chunk arrives (prefetched on entering the cabin), not
// when the scene first mounts at the moon gate: the path and the mist-wall hold live inside this
// suspension, so the SDFs must be ready well before P0 (572). As a detour, start them as soon as a
// dive heads for the grove, while it goes into paper: the join under the paper waits for them.
if (typeof window !== 'undefined') {
  if (groveOnWalk()) void chartGlyphsReady()
  else if (groveReachable()) {
    const unsubscribe = journey.subscribe((s) => {
      if (s.dive.to !== 'grove' && !s.groveWalk) return
      unsubscribe()
      void chartGlyphsReady()
    })
  }
}

/**
 * The grove section, 572–862 jvh (design.md §8.5–8.6, §9): the path from the moon gate through the
 * mist wall, then the clearing with the live Qimen chart in stone. Suspends until the chart's
 * glyphs are built, so the prewarm and the fog-dive hold wait for them.
 *
 * With the grove off the walk (core/world/walk.ts) this chunk draws the path only, 572–628: no
 * board, no ground mist, no glyphs to wait for, no casting or recast timers. A detour joining the
 * grove walk remounts it (SectionHost keys the grove's scene on `groveWalk`) with the chart.
 */
export default function GroveScene(props: SectionSceneProps) {
  const groveWalk = useJourney((s) => s.groveWalk)
  return groveWalk ? <GroveWithChart {...props} /> : <GrovePathOnly />
}

function GrovePathOnly() {
  return (
    <group name="grove">
      <GrovePath />
    </group>
  )
}

function GroveWithChart(_props: SectionSceneProps) {
  use(chartGlyphsReady())
  return (
    <group name="grove">
      <GrovePath />
      <GroveChart />
      <GroundMist />
    </group>
  )
}
