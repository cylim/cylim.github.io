import { useThree } from '@react-three/fiber'
import { Activity, Component, Suspense, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import type { Group } from 'three'
import { journey, underFogCover, useJourney, type JourneyState } from '../store/journey'
import { RIG, sectionAtJvh } from '../world/journey'
import { distanceToSpan } from './registry'
import { SECTION_IDS, type SectionId } from './ids'
import type { SectionDefinition } from './types'

const setReady = (id: SectionId, ready: boolean) =>
  journey.setState((s) => (s.ready[id] === ready ? s : { ready: { ...s.ready, [id]: ready } }))

/**
 * Compiles the section's programs before it is shown (gl.compileAsync, KHR_parallel_shader_compile
 * where available), then marks it ready. Rendered after the scene inside the same Suspense, so it
 * mounts only once the chunk and anything the scene suspends on (fonts, textures) have resolved.
 */
function Prewarm({ id, target }: { id: SectionId; target: RefObject<Group | null> }) {
  const gl = useThree((s) => s.gl)
  const camera = useThree((s) => s.camera)
  const scene = useThree((s) => s.scene)
  useEffect(() => {
    let alive = true
    const done = () => alive && setReady(id, true)
    const group = target.current
    if (group) gl.compileAsync(group, camera, scene).then(done, done)
    else done()
    return () => {
      alive = false
    }
  }, [id, gl, camera, scene, target])
  return null
}

/**
 * A section that fails to load must not take the stage down: log it, count it as ready, draw nothing.
 * It does not retry: the failed chunk stays failed for the session (defineSection).
 */
class SceneBoundary extends Component<{ id: SectionId; children: ReactNode }, { failed: boolean }> {
  override state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  override componentDidCatch(error: unknown) {
    console.error(`section ${this.props.id} failed`, error)
    setReady(this.props.id, true)
  }
  override render() {
    return this.state.failed ? null : this.props.children
  }
}

const near = (s: JourneyState, def: SectionDefinition) => distanceToSpan(s.u, def.span) < RIG.preloadU

/** Low tier only: this section is more than one section behind the camera and may be unmounted (§11.3). */
const farBehind = (s: JourneyState, def: SectionDefinition) =>
  s.tier === 'low' && SECTION_IDS.indexOf(sectionAtJvh(s.jvh)) - SECTION_IDS.indexOf(def.id) > 1

/**
 * Mounts a section scene once the camera comes within RIG.preloadU of its span, prewarms it, and
 * keeps it afterwards in a hidden <Activity> (objects hidden, effects and useFrame paused, GPU
 * resources and programs kept warm).
 *
 * Low tier: a section more than one section behind the camera is unmounted, which disposes its GPU
 * resources. Unmounting waits for fog cover (density above 0.12, a dive or the moon-gate paper) so
 * nothing pops. Mounting never waits: a section the camera needs mounts at once, and until it is
 * ready `ready[id]` is false, which the ink pass reads as "raise the fog".
 */
export function SectionHost({ def }: { def: SectionDefinition }) {
  const isNear = useJourney((s) => near(s, def))
  const canDrop = useJourney((s) => !near(s, def) && farBehind(s, def) && underFogCover(s))
  // "Has been near and not dropped since" is derived from previous renders, so it is set during render.
  const [mounted, setMounted] = useState(isNear)
  if (isNear && !mounted) setMounted(true)
  if (mounted && canDrop) setMounted(false)

  // The grove scene is a different scene on each walk (the path alone, or the path and the chart). A
  // detour joining the grove walk remounts it, so it suspends on the chart and prewarms again; the
  // join has already dropped ready.grove (core/scroll/dive.ts).
  const generation = useJourney((s) => (def.id === 'grove' && s.groveWalk ? 'walk' : 'base'))

  const group = useRef<Group>(null)
  useEffect(() => {
    if (!mounted) return
    if (journey.getState().ready[def.id] !== true) setReady(def.id, false)
    return () => setReady(def.id, false)
  }, [mounted, def.id])

  if (!mounted) return null
  return (
    <Activity mode={isNear ? 'visible' : 'hidden'}>
      <group ref={group} name={`section:${def.id}`}>
        <SceneBoundary key={generation} id={def.id}>
          <Suspense fallback={null}>
            <def.Scene id={def.id} />
            <Prewarm id={def.id} target={group} />
          </Suspense>
        </SceneBoundary>
      </group>
    </Activity>
  )
}
