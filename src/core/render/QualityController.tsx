import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useState } from 'react'
import { CY_EVENT } from '../events'
import { useJourney, type Tier } from '../store/journey'
import { setFrameCap, startFrameGovernor, wake } from './frameGovernor'
import { QualityRuntime, type RevealKind, type StartupMode } from './qualityRuntime'
import { watchDevicePixelRatio } from './dprWatch'

export type { RevealKind, StartupMode } from './qualityRuntime'

export interface QualityControllerProps {
  startup: StartupMode
  dpr: number
  setDpr: (dpr: number) => void
  setPostTier: (tier: Tier) => void
  onReveal: (kind: RevealKind) => void
  onSlow: () => void
}

/**
 * Mounts the QualityRuntime (benchmark, reveal, monitor, tier queue, frame cap) inside the Canvas
 * and hands frame pacing to the governor once the stage is visible. Reduced motion keeps R3F's
 * 'demand' loop and needs no governor.
 */
export function QualityController({ startup, dpr, setDpr, setPostTier, onReveal, onSlow }: QualityControllerProps) {
  const get = useThree((s) => s.get)
  const tier = useJourney((s) => s.tier)
  const reducedMotion = useJourney((s) => s.reducedMotion)
  const [live, setLive] = useState(false)
  const [runtime] = useState(() => new QualityRuntime(startup, dpr, { setDpr, setPostTier, onReveal, onSlow, onLive: () => setLive(true) }))

  useLayoutEffect(() => {
    runtime.setHooks({ setDpr, setPostTier, onReveal, onSlow, onLive: () => setLive(true) })
  }, [runtime, setDpr, setPostTier, onReveal, onSlow])
  useLayoutEffect(() => runtime.setDpr(dpr), [runtime, dpr])
  useEffect(() => runtime.tierChanged(tier), [runtime, tier])
  useEffect(() => () => setFrameCap(null), [])
  // The DOM's Settings → Quality writes prefs (and the tier for Low or High) before dispatching this.
  useEffect(() => {
    const onQuality = () => runtime.qualityChanged()
    addEventListener(CY_EVENT.quality, onQuality)
    return () => removeEventListener(CY_EVENT.quality, onQuality)
  }, [runtime])

  // A new devicePixelRatio resizes the canvas, which clears it: draw again even if the stage was idle.
  useEffect(
    () =>
      watchDevicePixelRatio((ratio) => {
        runtime.devicePixelRatioChanged(ratio)
        wake(250)
      }),
    [runtime],
  )

  useEffect(() => {
    if (!live || reducedMotion) return
    return startFrameGovernor(get)
  }, [live, reducedMotion, get])

  useFrame((state) => runtime.frame(state))

  return null
}
