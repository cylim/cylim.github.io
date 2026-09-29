import { lazy } from 'react'
import { jvhToU } from '../world/beats'
import type { SectionDefinition, SectionDefinitionInput, SectionSceneModule } from './types'

/**
 * Build a section definition: derive u values, memoise `load`, and wrap it in one React.lazy.
 *
 * A scene chunk that fails to load stays missing until a reload (QM-11). `load` forgets a rejection,
 * but that is no retry: browsers keep a failed module fetch in their module map for the session
 * (Chromium answers the next import() of the same URL from it, without a request), and React.lazy
 * rethrows its first rejection forever. SectionHost's boundary logs the failure and counts the
 * section ready, so dives and the fog never wait on it, and the DOM layer still has the content.
 */
/** The walk-dependent fields of a definition: where its scene draws, where a jump lands, its height. */
export type SectionWalkSpans = Pick<SectionDefinition, 'spanJvh' | 'arrivalJvh' | 'heightSvh'>

const derivedSpans = (w: SectionWalkSpans) => ({
  ...w,
  span: [jvhToU(w.spanJvh[0]), jvhToU(w.spanJvh[1])] as const,
  arrivalU: jvhToU(w.arrivalJvh),
})

/**
 * Move a definition onto the walk as it is now, in place, when a detour joins the grove walk
 * (core/world/walk.ts). `load` and the lazy `Scene` stay the same objects, so nothing refetches.
 */
export function refreshSpans(def: SectionDefinition, w: SectionWalkSpans): void {
  Object.assign(def, derivedSpans(w))
}

export function defineSection(input: SectionDefinitionInput): SectionDefinition {
  let pending: Promise<SectionSceneModule> | null = null
  const load = () => {
    pending ??= input.load().catch((err: unknown) => {
      pending = null
      throw err
    })
    return pending
  }
  return {
    ...input,
    ...derivedSpans(input),
    load,
    Scene: lazy(load),
  }
}
