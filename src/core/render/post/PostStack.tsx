import { useFrame, useThree } from '@react-three/fiber'
import { EffectComposer, EffectGroup } from '@react-three/postprocessing'
import type { EffectComposer as EffectComposerImpl } from 'postprocessing'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useJourney, type Tier } from '../../store/journey'
import { TIERS } from '../quality'
import { registerComposer } from '../precompile'
import { PostRig } from './PostRig'

/** Frames both groups run at startup so their programs compile while the canvas is still hidden. */
const WARM_FRAMES = 2

/**
 * Post stack (stack.md §6, design.md §7): the ink group outdoors, Bloom + AgX + Finish in the cabin.
 * Groups are toggled with EffectGroup.enabled and crossfade on `postBlend`; they are never rebuilt.
 * MSAA and bloom levels are startup-only, so Stage remounts this component (keyed by tier) only
 * while the canvas is still hidden during the benchmark.
 */
export function PostStack({ tier }: { tier: Tier }) {
  const camera = useThree((s) => s.camera)
  const rig = useMemo(() => new PostRig(camera, tier), [camera, tier])
  useEffect(() => () => rig.dispose(), [rig])

  const post = useJourney((s) => s.post)
  const crossing = useJourney((s) => s.postBlend > 0 && s.postBlend < 1)
  const [warm, setWarm] = useState(true)
  const frames = useRef(0)
  const composer = useRef<EffectComposerImpl>(null)
  // The stage compiles the post programs before the first frame (precompile.ts).
  const setComposer = useCallback((c: EffectComposerImpl | null) => {
    composer.current = c
    registerComposer(c)
  }, [])

  useFrame((state) => {
    rig.frame(state)
    rig.scissor(state, composer.current)
    if (warm && ++frames.current >= WARM_FRAMES) setWarm(false)
  })

  return (
    <EffectComposer ref={setComposer} multisampling={TIERS[tier].msaa} stencilBuffer enableNormalPass={false}>
      <EffectGroup enabled={post === 'ink' || crossing || warm}>
        <primitive object={rig.ink} dispose={null} />
      </EffectGroup>
      <EffectGroup enabled={post === 'cabin' || crossing || warm}>
        {rig.bloom ? <primitive object={rig.bloom} dispose={null} /> : null}
        <primitive object={rig.tone} dispose={null} />
        <primitive object={rig.finish} dispose={null} />
      </EffectGroup>
    </EffectComposer>
  )
}
