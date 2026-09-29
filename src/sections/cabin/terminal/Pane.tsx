import { useFrame, type Size, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { type Camera, type Group, Mesh, PlaneGeometry, type ShaderMaterial, Vector3 } from 'three'
import { CY_EVENT, emit } from '../../../core/events'
import { journey, type JourneyState, type ScreenRect } from '../../../core/store/journey'
import { beatById } from '../../../core/world/journey'
import { hall } from '../../../core/world/layout'
import { breakpoint, motion } from '../../../theme/tokens'
import { useDisposeOnUnmount } from '../../shared/lifetime'
import { overDomContent } from '../shared/pointer'
import { makePortalTwins, pickTwin, type PortalTwins } from '../shared/portal'
import { paneMaterial } from '../interior/materials'
import { paneScreen } from './paneScreen'

const I3_HOLD = beatById('I3').hold ?? beatById('I3').jvh
const P = hall.terminalPane
const CORNERS = [
  [-1, -1],
  [1, -1],
  [1, 1],
  [-1, 1],
].map(([x = 0, y = 0]) => new Vector3((x * P.width) / 2, (y * P.height) / 2, 0))

/** Phones open the terminal as a sheet instead of over the pane: the DOM terminal's own query. */
const SHEET_QUERY = `(max-width: ${breakpoint.desktop - 0.02}px)`

const inHold = (s: Pick<JourneyState, 'jvh'>) => s.jvh >= I3_HOLD[0] && s.jvh <= I3_HOLD[1]

const same = (a: ScreenRect | null, b: ScreenRect) =>
  a !== null && Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5 && Math.abs(a.width - b.width) < 0.5 && Math.abs(a.height - b.height) < 0.5

/** A tap on the pane opens the DOM terminal (it focuses #terminal-input, or opens the phone sheet). */
function open(e: ThreeEvent<MouseEvent>) {
  if (!journey.getState().insideCabin || overDomContent(e)) return
  e.stopPropagation()
  emit(CY_EVENT.terminalOpen, null)
}

class PaneView {
  readonly mesh: Mesh
  private readonly glass: PortalTwins<ShaderMaterial>
  private readonly v = new Vector3()
  private readonly sheet = typeof matchMedia === 'function' ? matchMedia(SHEET_QUERY) : null
  private textOn = 1

  constructor() {
    const screen = paneScreen()
    this.glass = makePortalTwins(() => paneMaterial(screen.texture, screen.caret), 'blend')
    this.mesh = new Mesh(new PlaneGeometry(P.width, P.height), this.glass.outside)
  }

  setInside(inside: boolean): void {
    this.mesh.material = pickTwin(this.glass, inside)
  }

  frame(camera: Camera, size: Size, dt: number): void {
    const s = journey.getState()
    const hold = inHold(s)
    if (!hold) {
      if (s.pane !== null) journey.setState({ pane: null })
    } else this.publish(s, camera, size)

    // While the DOM terminal sits over the pane, the pane shows only its glass, so no line is
    // drawn twice; it fades as the DOM fades in.
    const covered = hold && s.pane !== null && !this.sheet?.matches
    const target = covered ? 0 : 1
    if (this.textOn !== target) {
      const step = dt / (motion.chromeCrossfade / 1000)
      this.textOn = target > this.textOn ? Math.min(1, this.textOn + step) : Math.max(0, this.textOn - step)
      const u = this.glass.outside.uniforms.uTextOn
      if (u) u.value = this.textOn
    }
  }

  /** The pane's projected bounding rectangle in CSS px, written only when it moves. */
  private publish(s: JourneyState, camera: Camera, size: Size): void {
    camera.updateMatrixWorld()
    this.mesh.updateWorldMatrix(true, false)
    let x0 = Infinity
    let y0 = Infinity
    let x1 = -Infinity
    let y1 = -Infinity
    for (const c of CORNERS) {
      const v = this.v.copy(c).applyMatrix4(this.mesh.matrixWorld).project(camera)
      const x = size.left + ((v.x + 1) / 2) * size.width
      const y = size.top + ((1 - v.y) / 2) * size.height
      x0 = Math.min(x0, x)
      x1 = Math.max(x1, x)
      y0 = Math.min(y0, y)
      y1 = Math.max(y1, y)
    }
    const rect = { x: x0, y: y0, width: x1 - x0, height: y1 - y0 }
    if (!same(s.pane, rect)) journey.setState({ pane: rect })
  }

  dispose(): void {
    this.mesh.geometry.dispose()
    this.glass.outside.dispose()
    this.glass.inside.dispose()
  }
}

/**
 * The terminal pane (design.md §10): 1.6 × 1.0 m over the desk, tilted back 8°, a picture of the
 * DOM terminal drawn from the same log. During the I3 hold it publishes its projected rectangle
 * (journey.pane, CSS px) so the DOM terminal can sit exactly over it; outside the hold it
 * publishes null. Tapping it asks the DOM to open the terminal (CY_EVENT.terminalOpen).
 */
export function Pane({ inside }: { inside: boolean }) {
  const anchor = useRef<Group>(null)
  const [view] = useState(() => new PaneView())
  useDisposeOnUnmount(anchor, () => [view])
  useLayoutEffect(() => view.setInside(inside), [view, inside])

  useEffect(() => {
    const screen = paneScreen()
    screen.retain()
    return () => {
      screen.release()
      if (journey.getState().pane !== null) journey.setState({ pane: null })
    }
  }, [])

  useFrame(({ camera, size }, dt) => view.frame(camera, size, dt))

  return (
    <group ref={anchor} name="hall-terminal-pane" position={P.centre} rotation-x={(-P.tiltBackDeg * Math.PI) / 180}>
      <primitive object={view.mesh} onClick={open} />
    </group>
  )
}
