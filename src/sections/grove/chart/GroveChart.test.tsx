// @vitest-environment jsdom
// QM-1 / QM-P1: the live chart keeps every glyph batch when SectionHost's <Activity> hides and shows the
// grove (Grove → Work → Grove, G3 → finale → G3), and frees its GPU side only when it really unmounts.
import { act, createRoot, extend, type ReconcilerRoot } from '@react-three/fiber'
import * as THREE from 'three'
import { Activity, type ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GroveChart } from './GroveChart'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
extend(THREE as never)

const noop = () => undefined

/** Just enough of a WebGLRenderer for R3F to mount a tree it never draws. */
const stubRenderer = (canvas: HTMLCanvasElement) => ({
  domElement: canvas,
  render: noop,
  setSize: noop,
  setPixelRatio: noop,
  getPixelRatio: () => 1,
  dispose: noop,
  forceContextLoss: noop,
  shadowMap: { enabled: false, type: 0, needsUpdate: false },
  xr: { enabled: false, isPresenting: false, addEventListener: noop, removeEventListener: noop, setAnimationLoop: noop },
  info: { autoReset: true, reset: noop },
  outputColorSpace: 'srgb',
  toneMapping: 0,
})

let root: ReconcilerRoot<HTMLCanvasElement>
beforeEach(async () => {
  const canvas = document.createElement('canvas')
  root = createRoot(canvas)
  await act(async () => {
    await root.configure({ gl: () => stubRenderer(canvas) as never, frameloop: 'never', size: { width: 800, height: 600, top: 0, left: 0 }, events: undefined })
  })
})
afterEach(async () => {
  await act(async () => root.unmount())
})

const render = async (node: ReactNode) => {
  await act(async () => {
    root.render(node)
  })
  // useDisposeOnUnmount releases a microtask after the commit.
  await Promise.resolve()
}

/** Hands out the scene R3F renders into. */
const sceneRef: { current: THREE.Object3D | null } = { current: null }
const Anchor = () => <group ref={(g: THREE.Group | null) => void (g && (sceneRef.current = g.parent))} />

const Grove = ({ visible }: { visible: boolean }) => (
  <Activity mode={visible ? 'visible' : 'hidden'}>
    <group name="section:grove">
      <GroveChart />
    </group>
  </Activity>
)

/** The glyph batches on the dial; empty once the board is gone. */
function batches(from: THREE.Object3D): string[] {
  let dial: THREE.Object3D | undefined
  from.traverse((o) => {
    if (o.name === 'grove-dial') dial = o
  })
  return (dial?.children ?? []).filter((o) => o.name.startsWith('glyphs-')).map((b) => b.name)
}

describe('GroveChart across <Activity>', () => {
  it('keeps its glyph batches through hide → show, and disposes the board once on unmount', async () => {
    await render(
      <>
        <Anchor />
        <Grove visible />
      </>,
    )
    const top = sceneRef.current as THREE.Object3D
    expect(top).toBeTruthy()
    const first = batches(top)
    expect(first).toEqual(['glyphs-carve', 'glyphs-lit', 'glyphs-thin', 'glyphs-latin'])

    // Hiding must free nothing: the memoised board is shown again as it is.
    const disposed = vi.spyOn(THREE.BufferGeometry.prototype, 'dispose')
    for (const visible of [false, true, false, true]) {
      await render(
        <>
          <Anchor />
          <Grove visible={visible} />
        </>,
      )
    }
    expect(batches(top)).toEqual(first)
    expect(disposed).not.toHaveBeenCalled()

    await render(<Anchor />)
    expect(batches(top)).toEqual([])
    expect(disposed).toHaveBeenCalled()
    disposed.mockRestore()
  })
})
