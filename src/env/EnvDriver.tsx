import { useFrame } from '@react-three/fiber'
import { useEffect } from 'react'
import { TIERS } from '../core/render/quality'
import { shaderTime } from '../core/render/time'
import { useJourney } from '../core/store/journey'
import { worldUniforms } from './materials/uniforms'

const CUN_LEVEL = { hero: 0, stone: 1, all: 2 } as const

/**
 * Writes the shared world uniforms: the shader clock every frame (frozen under e2e), and the motion
 * switch and 皴 level when they change. Reduced motion zeroes uMotion, which stills sway, grass and
 * mist drift while uTime keeps running for anything that must not freeze.
 */
export function EnvDriver() {
  const reducedMotion = useJourney((s) => s.reducedMotion)
  const tier = useJourney((s) => s.tier)

  useEffect(() => {
    worldUniforms.uMotion.value = reducedMotion ? 0 : 1
  }, [reducedMotion])

  useEffect(() => {
    worldUniforms.uCunLevel.value = CUN_LEVEL[TIERS[tier].cunStrokes]
  }, [tier])

  useFrame((state) => {
    worldUniforms.uTime.value = shaderTime(state.clock.elapsedTime)
  })
  return null
}
