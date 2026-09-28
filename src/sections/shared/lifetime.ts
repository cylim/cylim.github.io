import { useEffect, useRef, type RefObject } from 'react'
import type { Object3D } from 'three'

/**
 * GPU lifetime for section scenes (stack.md §4). Shared by every section; not a section itself, so
 * any section folder may import it.
 *
 * SectionHost keeps a passed section in a hidden <Activity>: its objects are hidden, its effects are
 * cleaned up, and its GPU resources and programs must stay warm so scrolling back does not hitch
 * (or, for objects built once in a useMemo, come back empty). A plain `useEffect(() => () =>
 * x.dispose())` frees them on every hide. Only a real unmount (low tier dropping a far section, or
 * the stage going away) may free them.
 *
 * A real unmount is recognised by R3F detaching the scene's objects: its removeChild calls
 * `parent.remove(child)` for every instance in the deleted subtree, which three announces with a
 * `removed` event. Hiding never detaches (R3F's hideInstance only clears `visible`). Effect cleanups
 * cannot tell the two apart on their own: when React deletes a subtree that is already hidden, it
 * does not run the effect cleanups again, so a cleanup that skipped disposal on the hide would
 * never get a second chance and the resources would leak.
 */

export interface Disposable {
  dispose(): void
}

/**
 * Calls `release` once, after `node` has been detached from its parent for good. The check waits a
 * microtask so a node that is only moved (removed and re-added in the same commit) is kept. Returns
 * a function that stops watching without releasing.
 */
export function onDetached(node: Object3D, release: () => void): () => void {
  let done = false
  const stop = () => {
    done = true
    node.removeEventListener('removed', onRemoved)
  }
  const check = () => {
    if (done || node.parent !== null) return
    stop()
    release()
  }
  function onRemoved() {
    queueMicrotask(check)
  }
  node.addEventListener('removed', onRemoved)
  return stop
}

/** Disposes each resource once; nulls are skipped. */
export function disposeAll(resources: readonly (Disposable | null | undefined)[]): void {
  for (const r of resources) r?.dispose()
}

const isObject3D = (a: RefObject<Object3D | null> | Object3D): a is Object3D => (a as Object3D).isObject3D === true

/**
 * Disposes `resources()` when the scene really unmounts, never when SectionHost's <Activity> only
 * hides it. `anchor` is an object R3F manages in this component's tree (a `<group ref>` or a
 * `<primitive object>`); the list is read when the anchor is detached, so build the resources once
 * per mount (useMemo / useState).
 *
 * Behaviour that must also stop on a hide (timers, store writes, shared uniforms) belongs in an
 * ordinary effect cleanup, not here.
 */
export function useDisposeOnUnmount(anchor: RefObject<Object3D | null> | Object3D, resources: () => readonly (Disposable | null | undefined)[]): void {
  const watching = useRef<Object3D | null>(null)
  useEffect(() => {
    const node = isObject3D(anchor) ? anchor : anchor.current
    // Effects run again each time the section is shown: watch each anchor once.
    if (!node || watching.current === node) return
    watching.current = node
    onDetached(node, () => disposeAll(resources()))
    // Resources are created once per mount; the list is read at release.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
