/**
 * The four sections. The only place core/ reaches into src/sections/, and only through dynamic
 * imports, so each scene is its own chunk. After day 1 nobody edits this file except to tune
 * spans and arrivals, which live in core/world/journey.ts anyway.
 */

import { defineSection } from './defineSection'
import { SECTION_HASH, SECTION_IDS, type SectionId } from './ids'
import type { SectionDefinition } from './types'
import { SECTION_SPANS } from '../world/beats'
import { nav, inscriptions } from '../../content/site'

const labelOf = (id: SectionId) => nav.find((n) => n.id === id)?.label ?? id

const common = (id: SectionId) => ({
  id,
  hash: SECTION_HASH[id],
  label: labelOf(id),
  zh: inscriptions[id].accent.zh,
  spanJvh: SECTION_SPANS[id].jvh,
  arrivalJvh: SECTION_SPANS[id].arrivalJvh,
  heightSvh: SECTION_SPANS[id].heightSvh,
})

export const registry = {
  threshold: defineSection({ ...common('threshold'), post: 'ink', load: () => import('../../sections/threshold/Scene') }),
  cabin: defineSection({ ...common('cabin'), post: 'cabin', load: () => import('../../sections/cabin/Scene') }),
  grove: defineSection({ ...common('grove'), post: 'ink', load: () => import('../../sections/grove/Scene') }),
  contact: defineSection({ ...common('contact'), post: 'ink', load: () => import('../../sections/contact/Scene') }),
} as const satisfies Record<SectionId, SectionDefinition>

/** Definitions in walk order. */
export const sections: readonly SectionDefinition[] = SECTION_IDS.map((id) => registry[id])

/** Distance in u from a point to a span; 0 inside it. */
export function distanceToSpan(u: number, span: readonly [number, number]): number {
  if (u < span[0]) return span[0] - u
  if (u >= span[1]) return u - span[1]
  return 0
}
