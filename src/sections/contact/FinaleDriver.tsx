import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import { Matrix4, PerspectiveCamera, Vector3, type Camera } from 'three'
import { glintSlots, setGlint } from '../../core/render'
import { journey, type JourneyState } from '../../core/store/journey'
import { exit, glints } from '../../core/world/layout'
import { FINALE, albumWindow, finaleShowing, insideRect, pinMoved, type Pin } from './finale'
import { FinaleFlags } from './finaleFlags'

type PinId = keyof JourneyState['pins']
const PIN_IDS: readonly PinId[] = ['threshold', 'cabin', 'grove']
/** The pins keep their place for this long after the scroll moves, while the camera damps in. */
const PRECISE_MS = 2000
/** A pin this close to the window's edge hides rather than hang half over the mount. */
const PIN_MARGIN = 8
/** Distance from the camera at which the cabin glint is placed; see CabinGlint. */
const GLINT_NEAR = 30

/**
 * Projects the three E3 map pins into `journey.pins` (CSS px) while the finale shows. While the
 * scroll moves and the camera damps in, pins follow to half a pixel; once it only breathes they
 * move in steps of FINALE.pinSlop, so the store goes quiet and the frame governor can idle.
 */
class PinProjector {
  private readonly v = new Vector3()
  private readonly view = new Matrix4()
  private lastJvh = Number.NaN
  private movedAt = 0

  frame(camera: Camera, width: number, height: number): void {
    const s = journey.getState()
    if (!finaleShowing(s.jvh)) {
      if (Object.keys(s.pins).length > 0) journey.setState({ pins: {} })
      return
    }
    const now = performance.now()
    if (s.jvh !== this.lastJvh) {
      this.lastJvh = s.jvh
      this.movedAt = now
    }
    const slop = now - this.movedAt < PRECISE_MS ? 0.5 : FINALE.pinSlop
    // The rig moved the camera this frame; its world matrix updates only at render.
    camera.updateMatrixWorld()
    this.view.copy(camera.matrixWorld).invert()
    const near = camera instanceof PerspectiveCamera ? camera.near : 0
    const win = albumWindow(width, height)
    let next: JourneyState['pins'] | null = null
    for (const id of PIN_IDS) {
      const v = this.v.set(...exit.mapPins[id]).applyMatrix4(this.view)
      const inFront = v.z < -near
      v.applyMatrix4(camera.projectionMatrix)
      const x = Math.round(((v.x + 1) / 2) * width * 10) / 10
      const y = Math.round(((1 - v.y) / 2) * height * 10) / 10
      const pin: Pin = { x, y, visible: inFront && insideRect(win, x, y, PIN_MARGIN) }
      if (pinMoved(s.pins[id], pin, slop)) (next ??= { ...s.pins })[id] = pin
    }
    if (next) journey.setState({ pins: next })
  }
}

/**
 * Glint slot 1, the cabin's speck of cyan. From the finale camera the cabin stands behind the forest,
 * and the glint hides wherever the scene is nearer than it (one depth tap in the ink pass). So the
 * glint rides the camera's line of sight to the cabin, GLINT_NEAR metres out: it lands on the
 * cabin's pixel, as a painter's dot would, and only the lantern, the stele and the exit pines, which
 * really do stand in front of it, can still hide it.
 */
class CabinGlint {
  private readonly target = new Vector3(...exit.finaleCabinGlint)
  private readonly d = new Vector3()
  private placed = false

  frame(camera: Camera, jvh: number): void {
    if (!finaleShowing(jvh)) return this.reset()
    const d = this.d.subVectors(this.target, camera.position)
    glintSlots[1].pos.copy(camera.position).addScaledVector(d, Math.min(1, GLINT_NEAR / d.length()))
    this.placed = true
  }

  reset(): void {
    if (!this.placed) return
    this.placed = false
    setGlint(1, { pos: glints.cabin })
  }
}

/**
 * The scene side of the finale (design.md §8.7 E2–E3). The rig flies the orbit, env fades in the
 * three mist belts and the ink pass flattens on its own from 935 to 985; this drives the rest:
 *
 * - glint slot 1 marks the cabin through the forest (CabinGlint);
 * - `finale.mountOpen`, `postFx.scissor`, and E3's `finale.colophonShown` then `finale.sealStamped`,
 *   once per visit (FinaleFlags);
 * - `pins`: the three map pins projected every frame while the finale shows, hidden outside the
 *   window. Writes only when a pin moves, so the stage can still idle on the signed painting.
 */
export function FinaleDriver() {
  const size = useThree((s) => s.size)
  const flags = useMemo(() => new FinaleFlags(), [])
  const pins = useMemo(() => new PinProjector(), [])
  const glint = useMemo(() => new CabinGlint(), [])

  useEffect(() => () => glint.reset(), [glint])

  useEffect(() => flags.resize(size.width, size.height), [flags, size])

  useEffect(() => {
    flags.start()
    return () => flags.stop()
  }, [flags])

  useFrame((state) => {
    glint.frame(state.camera, journey.getState().jvh)
    pins.frame(state.camera, state.size.width, state.size.height)
  })

  return null
}
