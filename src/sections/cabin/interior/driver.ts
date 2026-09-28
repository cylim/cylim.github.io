import { useFrame } from '@react-three/fiber'
import { useEffect, useState, type RefObject } from 'react'
import type { Group, Object3D } from 'three'
import { TIERS, holdAwake, motionTime } from '../../../core/render'
import { journey, type JourneyState } from '../../../core/store/journey'
import { MARKS } from '../../../core/world/journey'
import { hall } from '../../../core/world/layout'
import { IGNITE_DONE, IGNITE_FULL_S, IGNITE_NONE, IGNITE_REPLAY_S, NIGHT_GRADED, NIGHT_RAW, hallUniforms as u } from './hallUniforms'

/** Focus eases in and out over about this long (s), like the DOM card's hover. */
const FOCUS_TIME = 0.18

/** The hall draws only between the door portal opening and the moon-gate cut. */
export const hallShown = (s: Pick<JourneyState, 'jvh'>) => s.jvh >= MARKS.doorPortalOn && s.jvh < MARKS.stageSwap

/**
 * Per-frame upkeep of the shared hall uniforms (design.md §8.4): time, night fade, the night
 * colour's grade compensation, tier pulses, scroll focus, and I0 ignition.
 *
 * Ignition plays the first time the camera crosses the door plane: 2.5 s, lighting the traces
 * from under the camera along the grain, floor first, walls 300 ms later, brackets last. Later
 * crossings replay it in 0.8 s. It is time-based, never runs backwards, and shows its end state
 * under reduced motion and e2e. `ignitionPlayed` is written when the full run ends.
 */
class HallDriver {
  private start: number | null = null
  private seconds = IGNITE_FULL_S
  private full = false
  private release: (() => void) | null = null
  private originPending = false

  /** Listen for door crossings; returns the cleanup. */
  attach(): () => void {
    const s = journey.getState()
    u.uIgnite.value = s.ignitionPlayed ? IGNITE_DONE : IGNITE_NONE
    if (s.insideCabin) this.begin()
    const unsubscribe = journey.subscribe((next, prev) => {
      if (next.insideCabin && !prev.insideCabin) this.begin()
    })
    return () => {
      unsubscribe()
      if (this.start !== null) this.finish()
    }
  }

  private begin(): void {
    const s = journey.getState()
    this.full = !s.ignitionPlayed
    if (s.e2e || s.reducedMotion) {
      this.finish()
      return
    }
    this.seconds = this.full ? IGNITE_FULL_S : IGNITE_REPLAY_S
    this.start = performance.now()
    this.release ??= holdAwake()
    this.originPending = true
    u.uIgnite.value = 0
  }

  private finish(): void {
    this.start = null
    this.release?.()
    this.release = null
    u.uIgnite.value = IGNITE_DONE
    if (this.full && !journey.getState().ignitionPlayed) journey.setState({ ignitionPlayed: true })
  }

  frame(elapsed: number, dt: number, camera: Object3D, group: Group | null): void {
    const s = journey.getState()
    const shown = hallShown(s)
    if (group && group.visible !== shown) group.visible = shown
    if (!shown) return

    u.uMotionTime.value = motionTime(elapsed, s)
    u.uFogDensity.value = s.insideCabin ? s.fogBase : hall.nightFogDensity
    u.uPulseOn.value = TIERS[s.tier].tracePulses ? 1 : 0
    // Through the door the ink group shows the hall ungraded; inside, AgX grades it.
    u.uNight.value.copy(NIGHT_RAW).lerp(NIGHT_GRADED, s.postBlend)

    if (this.start !== null) {
      if (this.originPending) {
        // The traces light from the threshold under the camera.
        u.uIgniteOrigin.value.set(camera.position.x, hall.floor.y, camera.position.z)
        this.originPending = false
      }
      const p = (performance.now() - this.start) / (this.seconds * 1000)
      if (p >= 1) this.finish()
      else u.uIgnite.value = p * IGNITE_FULL_S
    }

    const f = u.uFocus.value
    const k = 1 - Math.exp(-dt / FOCUS_TIME)
    for (let n = 0; n < 4; n++) {
      const target = s.cabinFocus === n ? 1 : 0
      const cur = f.getComponent(n)
      if (cur === target) continue
      f.setComponent(n, Math.abs(target - cur) < 0.002 || s.reducedMotion ? target : cur + (target - cur) * k)
    }
  }
}

/** Runs after the camera rig (priority −1) and before the hall's own frame callbacks. */
export function useHallDriver(root: RefObject<Group | null>): void {
  const [driver] = useState(() => new HallDriver())
  useEffect(() => driver.attach(), [driver])
  useFrame((state, dt) => driver.frame(state.clock.elapsedTime, dt, state.camera, root.current), -0.5)
}
