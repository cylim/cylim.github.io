import { use } from 'react'
import type { SectionSceneProps } from '../../core/sections/types'
import { features } from '../../content/features'
import { GroveChart } from './chart/GroveChart'
import { GroundMist } from './chart/GroundMist'
import { chartGlyphsReady } from './chart/glyphs'
import { GrovePath } from './path'

// Start building the glyphs as soon as the chunk arrives (prefetched on entering the cabin), not
// when the scene first mounts at the moon gate: the path and the mist-wall hold live inside this
// suspension, so the SDFs must be ready well before P0 (572).
if (typeof window !== 'undefined' && features.grove) void chartGlyphsReady()

/**
 * The grove section, 572–862 jvh (design.md §8.5–8.6, §9): the path from the moon gate through the
 * mist wall, then the clearing with the live Qimen chart in stone. Suspends until the chart's
 * glyphs are built, so the prewarm and the fog-dive hold wait for them.
 *
 * With the grove paused (content/features.ts) this chunk draws the path only, 572–628: no board,
 * no ground mist, no glyphs to wait for, no casting or recast timers.
 */
export default function GroveScene(props: SectionSceneProps) {
  return features.grove ? <GroveWithChart {...props} /> : <GrovePathOnly />
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
