import { use, useRef } from 'react'
import type { Group } from 'three'
import { useJourney } from '../../../core/store/journey'
import { useInsideCabin } from '../shared/portal'
import { Pane } from '../terminal/Pane'
import { traceTexture } from './circuit/traceTexture'
import { Desk, sealTexture } from './Desk'
import { useHallDriver } from './driver'
import { Halos } from './Halos'
import { MoonGate } from './MoonGate'
import { Scrolls, preloadScrollText } from './scroll/Scrolls'
import { Shell } from './Shell'
import { Timber } from './Timber'

/**
 * Started when the cabin chunk loads (prefetched from u 0.12), so the trace texture, the seal and
 * the scroll glyphs are ready long before the door opens. The scene suspends on them, and
 * SectionHost prewarms only after, so nothing pops in through the door.
 */
const assets = Promise.all([traceTexture(), sealTexture(), preloadScrollText()])

/**
 * The cabin interior (design.md §8.4): a scholar's study drawn in light, inside an ink painting
 * turned inside out. The honest near room, the dissolve zone, the lit floor and the timber frame
 * with its bracket sets, the night shell, four hanging scrolls, the desk and the terminal pane, and
 * the moon gate out. Seen through the door (stencil twins) until the camera crosses the door plane,
 * then drawn everywhere.
 */
export function Interior() {
  const [trace, seal] = use(assets)
  const inside = useInsideCabin()
  const tier = useJourney((s) => s.tier)
  const root = useRef<Group>(null)
  useHallDriver(root)
  return (
    <group ref={root} name="cabin-interior">
      <Shell inside={inside} tier={tier} />
      <Timber trace={trace} inside={inside} />
      <MoonGate inside={inside} />
      <Scrolls inside={inside} tier={tier} />
      <Desk inside={inside} sealMap={seal} />
      <Pane inside={inside} />
      <Halos inside={inside} tier={tier} />
    </group>
  )
}

export default Interior
