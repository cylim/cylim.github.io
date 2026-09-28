import type { SectionSceneProps } from '../../core/sections/types'
import { Exterior } from './exterior'
import { Interior } from './interior'

/**
 * The cabin (design.md §8.3–8.4): the exterior with its door portal, and the hall the portal shows.
 * The exterior hides itself once the camera crosses the door plane; the interior then switches to
 * its no-stencil material twins (shared/portal.ts).
 */
export default function CabinScene(_props: SectionSceneProps) {
  return (
    <group name="cabin">
      <Exterior />
      <Interior />
    </group>
  )
}
