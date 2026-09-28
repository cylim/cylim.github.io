import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { Plane, Raycaster, Vector2, Vector3 } from 'three'
import { setPlanFocus } from '../../../core/camera/planZoom'
import { TIERS, wake } from '../../../core/render'
import { chartInstant, journey } from '../../../core/store/journey'
import { MARKS, beatSpanById } from '../../../core/world/journey'
import { dirToBearing, grove, wrapDeg } from '../../../core/world/layout'
import { chartOptions } from '../../../content'
import { shichenAt } from '../../../lib/calendar'
import type { PalaceNo } from '../../../lib/qimen/types'
import { useDisposeOnUnmount } from '../../shared/lifetime'
import { Director, chartClock } from './director'
import { PLATFORM_Y, palaceLocal } from './layout'
import { afterTap, zoomForSelection } from './zoom'

/** DOM over the canvas that owns the pointer: cards, controls, chrome. The board ignores events there. */
const DOM_TARGETS = '.card, a, button, input, label, select, textarea, summary, header, nav, footer, [role="dialog"], [data-gloss], [data-gloss-host]'
const G3 = beatSpanById('G3')
/** Touch: long-press a glyph for its tooltip (design.md §9.7). */
const LONG_PRESS_MS = 500
const CLICK_SLOP_PX = 5

const [CX, , CZ] = grove.centre
/** Scratch objects for pointer maths (one grove at a time). */
const tools = { ray: new Raycaster(), ndc: new Vector2(), hit: new Vector3(), plane: new Plane(new Vector3(0, 1, 0), 0), point: new Vector3() }

function pointerFree(e: ThreeEvent<PointerEvent | MouseEvent>): boolean {
  const target = e.nativeEvent.target
  if (target instanceof Element && target.closest(DOM_TARGETS)) return false
  return journey.getState().dive.phase === 'idle'
}

const inPlanView = () => {
  const { jvh } = journey.getState()
  return jvh >= G3.jvh[0] && jvh < G3.jvh[1]
}

/** Zoom onto a palace or let go (the rig eases it over the next frames, so keep the stage awake). */
function setZoom(ref: { current: PalaceNo | null }, p: PalaceNo | null): void {
  if (ref.current === p) return
  ref.current = p
  wake(1500)
}

/**
 * R3F listens passively, so a drag can't preventDefault its pointerdown; it cancels the text
 * selection the page would start under the pointer instead.
 */
const noSelect = (ev: Event) => ev.preventDefault()

type Drag = { kind: 'dial'; startBearing: number; startDeg: number } | { kind: 'hour' }

/**
 * The live Qimen chart in stone (design.md §9): the Director runs the chart and its clock; this
 * component mounts the board, drives it every frame and turns pointer input into store writes:
 * glyph hover → `gloss`, palace click → `selectedPalace`, hour-marker drag (desktop, medium and high
 * tiers, 30° detents) → `chartInstantMs`, dial drag in the plan view (15° detents) → `dialDeg`.
 * A touch tap on a palace in the plan view also zooms onto it (§9.7, zoom.ts): this component keeps
 * the zoomed palace and publishes its world position for the rig every frame.
 */
export function GroveChart() {
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  const director = useMemo(() => new Director(), [])
  const board = director.board
  const hovered = useRef<number | null>(null)
  const press = useRef(0)
  const drag = useRef<Drag | null>(null)
  const endDrag = useRef<(() => void) | null>(null)
  /** Palace the plan view is zoomed onto (touch, §9.7), its last published focus, and the last press's pointer type. */
  const zoom = useRef<PalaceNo | null>(null)
  const focusAt = useRef({ x: NaN, z: NaN })
  const downType = useRef('')
  /** A touch long-press opened a gloss: the click that ends it is not a tap. */
  const pressFired = useRef(false)

  useEffect(() => director.start(), [director])
  // Frees the board on a real unmount only: after an <Activity> hide the memoised board is shown again as it is.
  useDisposeOnUnmount(board.root, () => [director])
  useEffect(
    () => () => {
      window.clearTimeout(press.current)
      endDrag.current?.()
      if (hovered.current !== null) journey.setState({ gloss: null })
    },
    [],
  )
  // The zoom follows the selection when something else changes it (the DOM grid, Back).
  useEffect(
    () =>
      journey.subscribe((s, p) => {
        if (s.selectedPalace !== p.selectedPalace) setZoom(zoom, zoomForSelection(zoom.current, s.selectedPalace))
      }),
    [],
  )
  useEffect(
    () => () => {
      zoom.current = null
      setPlanFocus(null)
    },
    [],
  )

  useFrame((state, dt) => {
    director.frame(state.clock.elapsedTime, dt)
    // Leaving the plan view (scroll or dive) lets go of the zoom; the selection stays.
    if (zoom.current !== null && (!inPlanView() || journey.getState().dive.phase !== 'idle')) setZoom(zoom, null)
    const p = zoom.current
    const f = focusAt.current
    if (p === null) {
      if (!Number.isNaN(f.x)) {
        f.x = f.z = NaN
        setPlanFocus(null)
        state.invalidate()
      }
      return
    }
    // The palace's slab centre on the dial, which may be turning (compass or manual rotation).
    const [lx, lz] = palaceLocal(p)
    board.dial.updateWorldMatrix(true, false)
    const w = board.dial.localToWorld(tools.point.set(lx, PLATFORM_Y, lz))
    if (Math.abs(w.x - f.x) < 1e-4 && Math.abs(w.z - f.z) < 1e-4) return
    f.x = w.x
    f.z = w.z
    setPlanFocus({ x: w.x, y: w.y, z: w.z, size: grove.platform.slab })
    state.invalidate()
  })

  /** A tap on the canvas at a world point (null: it missed the chart): select, zoom or return (zoom.ts). */
  const tap = (palace: PalaceNo | null, at: Vector3 | null) => {
    const s = journey.getState()
    const local = at ? board.dial.worldToLocal(tools.point.copy(at)) : null
    const half = grove.platform.size / 2
    const slab = local !== null && Math.abs(local.x) <= half && Math.abs(local.z) <= half && board.palaceAt(local) === palace
    const next = afterTap({ zoom: zoom.current, selected: s.selectedPalace }, { palace, slab, touch: downType.current === 'touch', planView: inPlanView() })
    setZoom(zoom, next.zoom)
    if (next.selected !== s.selectedPalace) journey.setState({ selectedPalace: next.selected })
  }

  /** World bearing (from the grove centre) under a client point, on the plane y = h. */
  const bearingAt = (clientX: number, clientY: number, h: number): number | null => {
    tools.ndc.set((clientX / size.width) * 2 - 1, -(clientY / size.height) * 2 + 1)
    tools.ray.setFromCamera(tools.ndc, camera)
    tools.plane.constant = -h
    if (!tools.ray.ray.intersectPlane(tools.plane, tools.hit)) return null
    return dirToBearing(tools.hit.x - CX, tools.hit.z - CZ)
  }

  const glossAt = (index: number) => {
    const g = board.hitGlyphs[index]
    if (!g) return
    const v = board.hitWorld(index, tools.point).project(camera)
    journey.setState({ gloss: { zh: g.zh, x: ((v.x + 1) / 2) * size.width, y: ((1 - v.y) / 2) * size.height } })
  }

  const clearGloss = () => {
    if (hovered.current === null) return
    hovered.current = null
    document.body.style.cursor = ''
    if (journey.getState().gloss) journey.setState({ gloss: null })
  }

  const startDrag = (e: ThreeEvent<PointerEvent>, d: Drag) => {
    drag.current = d
    e.stopPropagation()
    window.addEventListener('selectstart', noSelect)
    document.body.style.cursor = 'grabbing'
    const move = (ev: PointerEvent) => {
      const s = journey.getState()
      const cur = drag.current
      if (!cur) return
      if (cur.kind === 'hour') {
        const b = bearingAt(ev.clientX, ev.clientY, grove.rings.mountains.topY)
        if (b === null) return
        // The marker sits on the dial, which may be turned: read the bearing in dial space. 30° detents.
        const onDial = wrapDeg(b - s.dialDeg)
        const target = Math.round(onDial / 30) % 12
        const current = shichenAt(chartInstant(s), chartOptions).branchIndex
        // Step as the DOM's Earlier/Later do (the same chart clock); leaves live mode.
        chartClock.step((((target - current) % 12) + 18) % 12 - 6)
      } else {
        const b = bearingAt(ev.clientX, ev.clientY, grove.platform.topY)
        if (b === null) return
        const turned = cur.startDeg + (((b - cur.startBearing + 540) % 360) - 180)
        const deg = wrapDeg(Math.round(turned / 15) * 15)
        if (deg !== s.dialDeg) journey.setState({ dialDeg: deg })
      }
    }
    const up = () => {
      drag.current = null
      endDrag.current = null
      document.body.style.cursor = ''
      window.removeEventListener('selectstart', noSelect)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    endDrag.current = up
  }

  const cancelPress = () => window.clearTimeout(press.current)

  const onGlyphMove = (e: ThreeEvent<PointerEvent>) => {
    if (!pointerFree(e) || e.pointerType === 'touch' || drag.current) return
    e.stopPropagation()
    const id = e.instanceId
    if (id === undefined || id === hovered.current) return
    hovered.current = id
    document.body.style.cursor = 'pointer'
    glossAt(id)
  }

  const onGlyphDown = (e: ThreeEvent<PointerEvent>) => {
    downType.current = e.pointerType
    pressFired.current = false
    if (!pointerFree(e) || e.pointerType !== 'touch' || e.instanceId === undefined) return
    const id = e.instanceId
    window.clearTimeout(press.current)
    press.current = window.setTimeout(() => {
      pressFired.current = true
      hovered.current = id
      glossAt(id)
    }, LONG_PRESS_MS)
  }

  const onGlyphClick = (e: ThreeEvent<MouseEvent>) => {
    cancelPress()
    if (!pointerFree(e) || e.delta > CLICK_SLOP_PX || e.instanceId === undefined) return
    e.stopPropagation()
    // The click that ends a long-press only closes the gloss's gesture; it is not a tap.
    if (pressFired.current) {
      pressFired.current = false
      return
    }
    tap(board.hitGlyphs[e.instanceId]?.palace ?? null, e.point)
  }

  const onStoneClick = (e: ThreeEvent<MouseEvent>) => {
    if (!pointerFree(e) || e.delta > CLICK_SLOP_PX) return
    e.stopPropagation()
    tap(board.palaceAt(board.dial.worldToLocal(tools.point.copy(e.point))), e.point)
  }

  /** A tap that hit nothing of the chart: while zoomed, it returns to the whole chart (§9.7). */
  const onMissed = (ev: MouseEvent) => {
    if (zoom.current === null) return
    const target = ev.target
    if (target instanceof Element && target.closest(DOM_TARGETS)) return
    if (journey.getState().dive.phase !== 'idle') return
    tap(null, null)
  }

  const onStoneDown = (e: ThreeEvent<PointerEvent>) => {
    downType.current = e.pointerType
    const s = journey.getState()
    // Dial drag: plan view, mouse or pen (a touch drag scrolls the page; touch has the DOM range input).
    if (!pointerFree(e) || e.pointerType === 'touch' || e.button !== 0 || !inPlanView() || s.compass.status === 'active') return
    const b = dirToBearing(e.point.x - CX, e.point.z - CZ)
    startDrag(e, { kind: 'dial', startBearing: b, startDeg: s.dialDeg })
  }

  const onHourDown = (e: ThreeEvent<PointerEvent>) => {
    const s = journey.getState()
    if (!pointerFree(e) || e.pointerType === 'touch' || e.button !== 0 || !TIERS[s.tier].hourMarkerDrag || s.jvh < MARKS.castStart) return
    startDrag(e, { kind: 'hour' })
  }

  return (
    <primitive object={board.root} onPointerMissed={onMissed}>
      <primitive object={board.dial}>
        <primitive
          object={board.hits}
          onPointerMove={onGlyphMove}
          onPointerOut={clearGloss}
          onPointerDown={onGlyphDown}
          onPointerUp={cancelPress}
          onPointerCancel={cancelPress}
          onPointerLeave={cancelPress}
          onClick={onGlyphClick}
        />
        <primitive object={board.hourWedge} onPointerDown={onHourDown} />
        {board.stone.map((mesh) => (
          <primitive key={mesh.uuid} object={mesh} onClick={onStoneClick} onPointerDown={onStoneDown} />
        ))}
      </primitive>
    </primitive>
  )
}
