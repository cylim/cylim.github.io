import { use } from 'react'
import type { SectionSceneProps } from '../../core/sections/types'
import { GroveChart } from './chart/GroveChart'
import { GroundMist } from './chart/GroundMist'
import { chartGlyphsReady } from './chart/glyphs'
import { GrovePath } from './path'

// Start building the glyphs as soon as the chunk arrives (prefetched on entering the cabin), not
// when the scene first mounts at the moon gate: the path and the mist-wall hold live inside this
// suspension, so the SDFs must be ready well before P0 (572).
if (typeof window !== 'undefined') void chartGlyphsReady()

/**
 * The grove section, 572–862 jvh (design.md §8.5–8.6, §9): the path from the moon gate through the
 * mist wall, then the clearing with the live Qimen chart in stone. Suspends until the chart's
 * glyphs are built, so the prewarm and the fog-dive hold wait for them.
 */
export default function GroveScene(_props: SectionSceneProps) {
  use(chartGlyphsReady())
  return (
    <group name="grove">
      <GrovePath />
      <GroveChart />
      <GroundMist />
    </group>
  )
}
