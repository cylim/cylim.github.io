import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import { PerspectiveCamera } from 'three'
import { journey } from '../store/journey'
import { scrollToJvh } from '../scroll'
import { breakpoint, layout } from '../../theme/tokens'
import { Rig, compassAction } from './rig'

/**
 * The journey camera (design.md §6.3). Mount once inside the stage's <Canvas>; it drives the default
 * camera from the scroll position at useFrame priority −1, before scenes read the camera. It writes
 * fogBase, paper, lagFog, insideCabin, post and postBlend to the store and clears `snap`.
 *
 * Works with frameloop "always" and "demand" (reduced motion): it asks for frames while the camera
 * is still settling and whenever the scroll position or a dive changes.
 *
 * Compass mode (design.md §9.9): switching it on glides the scroll into the G3 plan view, and
 * leaving the grove switches it off (the DOM compass stops its listener when it sees 'off').
 */
export function CameraRig() {
  const invalidate = useThree((s) => s.invalidate)
  const rig = useMemo(() => new Rig(), [])

  useEffect(() => {
    // Desktop chrome is a fixed header; the plan view fits the chart below it (§6.1 h_fit).
    const mq = matchMedia(`(min-width: ${breakpoint.desktop}px)`)
    const apply = () => rig.setHeader(mq.matches ? layout.headerHeight : 0)
    apply()
    mq.addEventListener('change', apply)
    const unsubscribe = journey.subscribe((s, p) => {
      if (s.jvh !== p.jvh || s.dive !== p.dive || s.snap !== p.snap || s.tier !== p.tier) invalidate()
      if (s.compass === p.compass && s.active === p.active) return
      const act = compassAction(s, p)
      if (act.off) journey.setState({ compass: { status: 'off', heading: null } })
      else if (act.glideTo !== null) void scrollToJvh(act.glideTo, { smooth: true })
    })
    return () => {
      mq.removeEventListener('change', apply)
      unsubscribe()
    }
  }, [rig, invalidate])

  useFrame((state, delta) => {
    const { camera, size, pointer, clock } = state
    if (!(camera instanceof PerspectiveCamera)) return
    const moving = rig.update({
      camera,
      width: size.width,
      height: size.height,
      delta,
      elapsed: clock.elapsedTime,
      pointer,
    })
    if (moving) state.invalidate()
  }, -1)

  return null
}
