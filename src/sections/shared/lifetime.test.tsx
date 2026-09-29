// @vitest-environment jsdom
// GPU lifetime across SectionHost's <Activity> (stack.md §4), with the real React and R3F reconcilers:
// hiding keeps resources, a real unmount frees them once, even when the section was hidden first.
import { act, createRoot, extend, type ReconcilerRoot } from '@react-three/fiber'
import { Activity, useMemo, useRef } from 'react'
import { Group } from 'three'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { onDetached, useDisposeOnUnmount } from './lifetime'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
extend({ Group })

const noop = () => undefined

/** Just enough of a WebGLRenderer for R3F to mount a tree it never draws. */
function stubRenderer(canvas: HTMLCanvasElement) {
  return {
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
  }
}

type Counter = { dispose: () => void; count: number }
const counter = (): Counter => {
  const c = { count: 0, dispose: () => void c.count++ }
  return c
}

/** Anchored on a JSX group, as the cabin and contact scenes do. */
function GroupAnchored({ res }: { res: Counter }) {
  const anchor = useRef<Group>(null)
  useDisposeOnUnmount(anchor, () => [res])
  return <group ref={anchor} />
}

/** Anchored on an object built once in a memo and mounted as a primitive, as the grove chart does. */
function PrimitiveAnchored({ res }: { res: Counter }) {
  const root = useMemo(() => new Group(), [])
  useDisposeOnUnmount(root, () => [res])
  return <primitive object={root} />
}

function Section({ visible, children }: { visible: boolean; children: React.ReactNode }) {
  return (
    <Activity mode={visible ? 'visible' : 'hidden'}>
      <group name="section">{children}</group>
    </Activity>
  )
}

let root: ReconcilerRoot<HTMLCanvasElement>
beforeEach(async () => {
  const canvas = document.createElement('canvas')
  root = createRoot(canvas)
  await act(async () => {
    await root.configure({ gl: () => stubRenderer(canvas) as never, frameloop: 'never', size: { width: 10, height: 10, top: 0, left: 0 }, events: undefined })
  })
})
afterEach(async () => {
  await act(async () => root.unmount())
})

const render = async (node: React.ReactNode) => {
  await act(async () => {
    root.render(node)
  })
  // The release waits a microtask past the commit.
  await Promise.resolve()
}

describe.each([
  ['a <group ref> anchor', GroupAnchored],
  ['a <primitive object> anchor', PrimitiveAnchored],
])('useDisposeOnUnmount with %s', (_, Scene) => {
  it('keeps resources while <Activity> hides and shows the section', async () => {
    const res = counter()
    await render(<Section visible><Scene res={res} /></Section>)
    await render(<Section visible={false}><Scene res={res} /></Section>)
    await render(<Section visible><Scene res={res} /></Section>)
    await render(<Section visible={false}><Scene res={res} /></Section>)
    expect(res.count).toBe(0)
  })

  it('disposes once when the section unmounts while visible', async () => {
    const res = counter()
    await render(<Section visible><Scene res={res} /></Section>)
    await render(null)
    expect(res.count).toBe(1)
  })

  it('disposes once when a hidden section unmounts (React skips the cleanups then)', async () => {
    const res = counter()
    await render(<Section visible><Scene res={res} /></Section>)
    await render(<Section visible={false}><Scene res={res} /></Section>)
    await render(null)
    expect(res.count).toBe(1)
  })
})

describe('onDetached', () => {
  it('ignores a node that is removed and re-added in the same task', async () => {
    const parent = new Group()
    const other = new Group()
    const node = new Group()
    parent.add(node)
    let released = 0
    onDetached(node, () => released++)
    other.add(node)
    await Promise.resolve()
    expect(released).toBe(0)
    other.remove(node)
    await Promise.resolve()
    expect(released).toBe(1)
    parent.add(node)
    parent.remove(node)
    await Promise.resolve()
    expect(released).toBe(1)
  })
})
