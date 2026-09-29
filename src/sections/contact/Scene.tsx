import type { SectionSceneProps } from '../../core/sections/types'
import { FinaleDriver } from './FinaleDriver'
import { FinaleProxies } from './FinaleProxies'
import { Lantern } from './Lantern'
import { Signpost } from './Signpost'

/**
 * The exit and the finale (design.md §8.7, signature moment 3 in §16): the stone lantern, the only
 * warm light in the ink world; the wooden signpost with a finger board per social link; and, from
 * E2, the scene side of "the painting signs itself". The Signpost suspends until its board faces
 * are drawn, so SectionHost prewarms with the texture in place.
 */
export default function ContactScene(_props: SectionSceneProps) {
  return (
    <group name="contact">
      <Lantern />
      <Signpost />
      <FinaleProxies />
      <FinaleDriver />
    </group>
  )
}
