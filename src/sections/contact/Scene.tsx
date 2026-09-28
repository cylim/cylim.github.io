import type { SectionSceneProps } from '../../core/sections/types'
import { FinaleDriver } from './FinaleDriver'
import { FinaleProxies } from './FinaleProxies'
import { Lantern } from './Lantern'
import { Stele } from './Stele'

/**
 * The exit and the finale (design.md §8.7, signature moment 3 in §16): the stone lantern, the only
 * warm light in the ink world; the Han stele with the four carved rows; and, from E2, the scene
 * side of "the painting signs itself". The Stele suspends until its carved face is drawn, so
 * SectionHost prewarms with the texture in place.
 */
export default function ContactScene(_props: SectionSceneProps) {
  return (
    <group name="contact">
      <Lantern />
      <Stele />
      <FinaleProxies />
      <FinaleDriver />
    </group>
  )
}
