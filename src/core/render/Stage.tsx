import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Suspense, lazy, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { color } from '../../theme/tokens'
import { Environment } from '../../env/Environment'
import { whenEnvironmentMounted } from '../../env/mountGate'
import { CameraRig } from '../camera/CameraRig'
import { SectionHost } from '../sections/SectionHost'
import { sections } from '../sections/registry'
import { journey, type Tier } from '../store/journey'
import { RIG } from '../world/journey'
import { PostStack } from './post/PostStack'
import { QualityController, type RevealKind, type StartupMode } from './QualityController'
import { RenderStats } from './RenderStats'
import { fillSceneDefaultAttributes } from './defaultAttributes'
import { startDpr } from './quality'
import { compileForComposer, precompileStage } from './precompile'

/**
 * Render-pipeline bench behind `?renderTest=1|door|cabin`, on the dev server only.
 * `import.meta.env.DEV` is false in a production build, so the import, the chunk and the switch
 * itself drop out, and cy.my/?renderTest=1 is just the forest.
 */
const RenderTest = import.meta.env.DEV ? lazy(() => import('./RenderTest')) : null
const renderTestVariant = (): string | null => (RenderTest ? new URLSearchParams(location.search).get('renderTest') || null : null)

export interface StageProps {
  /** DOM element that receives pointer events (the content layer sits above the canvas). */
  eventSource: HTMLElement
  initialTier: Tier
  reducedMotion: boolean
  /** Default 'benchmark'. mountStage picks 'e2e', or 'skip' for a pinned tier or a restart. */
  startup?: StartupMode
  /** The canvas may be shown: fade the container in (mountStage does the DOM part). */
  onReveal?: (kind: RevealKind) => void
  /** The benchmark failed on low: switch to the album. */
  onSlow?: () => void
  /** webglcontextlost fired. */
  onContextLost?: () => void
}

const noop = () => {}

/**
 * With frameloop="demand" (reduced motion), any store change (scroll, dive, hover) must request a
 * frame. Under 'always' this is a no-op.
 */
function InvalidateOnStore() {
  const invalidate = useThree((s) => s.invalidate)
  useEffect(() => journey.subscribe(() => invalidate()), [invalidate])
  return null
}

/** Before each frame renders: real attributes for materials' default ones (defaultAttributes.ts). */
function DefaultAttributes() {
  useFrame(({ scene }) => fillSceneDefaultAttributes(scene), -1000)
  return null
}

const screenPixels = () => {
  const d = window.devicePixelRatio || 1
  return screen.width * screen.height * d * d
}

/**
 * The 3D stage (stack.md §5 Canvas setup). Always mounted: camera rig, environment, post stack,
 * quality controller. Sections mount through SectionHost.
 *
 * DPR is React state passed to the Canvas prop, because R3F re-applies the `dpr` prop whenever
 * the Canvas re-renders (a resize, for example); a DPR set behind its back would snap back.
 */
export default function Stage({
  eventSource,
  initialTier,
  reducedMotion,
  startup = 'benchmark',
  onReveal = noop,
  onSlow = noop,
  onContextLost = noop,
}: StageProps) {
  const [dpr, setDpr] = useState(() => startDpr(initialTier, window.devicePixelRatio || 1, screenPixels()))
  const [postTier, setPostTier] = useState<Tier>(initialTier)
  const lost = useRef(onContextLost)
  useLayoutEffect(() => {
    lost.current = onContextLost
  }, [onContextLost])

  const renderTest = useMemo(() => renderTestVariant(), [])
  const e2e = useMemo(() => journey.getState().e2e, [])
  const world = useMemo(
    () =>
      RenderTest && renderTest ? (
        <Suspense fallback={null}>
          <RenderTest variant={renderTest} />
        </Suspense>
      ) : (
        <>
          <Environment />
          {sections.map((def) => (
            <SectionHost key={def.id} def={def} />
          ))}
        </>
      ),
    [renderTest],
  )

  return (
    <Canvas
      eventSource={eventSource}
      eventPrefix="client"
      dpr={dpr}
      gl={{ antialias: false, alpha: false, stencil: true, powerPreference: 'high-performance' }}
      camera={{ fov: 40, near: RIG.near, far: RIG.far, position: [0, 1.6, 24] }}
      shadows={false}
      frameloop={reducedMotion ? 'demand' : 'always'}
      onCreated={({ gl, scene, camera, get }) => {
        // Clear alpha 1 is half of the interior flag contract (post/interior.ts).
        gl.setClearColor(color.paper, 1)
        compileForComposer(gl)
        // Park R3F's loop until every program is compiled, so the first frame doesn't block the
        // main thread on shader links (QM-P3). The canvas is still hidden at this point.
        get().internal.active = false
        void precompileStage(gl, scene, camera, whenEnvironmentMounted()).then(() => {
          const state = get()
          state.internal.active = true
          state.invalidate()
        })
        // Fog is defined once, in the ink post pass; built-in materials must compile no fog code.
        scene.fog = null
        gl.domElement.addEventListener(
          'webglcontextlost',
          (e) => {
            e.preventDefault()
            lost.current()
          },
          { once: true },
        )
      }}
    >
      <InvalidateOnStore />
      <DefaultAttributes />
      <CameraRig />
      {world}
      <PostStack key={postTier} tier={postTier} />
      <QualityController startup={startup} dpr={dpr} setDpr={setDpr} setPostTier={setPostTier} onReveal={onReveal} onSlow={onSlow} />
      {e2e && <RenderStats />}
    </Canvas>
  )
}
