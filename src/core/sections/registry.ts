/**
 * The four sections. The only place core/ reaches into src/sections/, and only through dynamic
 * imports, so each scene is its own chunk. After day 1 nobody edits this file except to tune
 * spans and arrivals, which live in core/world/journey.ts anyway.
 *
 * `spanJvh` is where the scene draws (SCENE_SPANS); arrival and height are the DOM section's. With
 * the grove off the walk (core/world/walk.ts) the grove entry stays: its chunk draws the path from
 * the moon gate to the mist wall. When a detour joins the grove walk, every entry's spans are
 * refreshed in place.
 */

import { defineSection, refreshSpans, type SectionWalkSpans } from './defineSection'
import { SECTION_HASH, SECTION_IDS, type SectionId } from './ids'
import type { SectionDefinition } from './types'
import { SCENE_SPANS, SECTION_SPANS, sectionHeightSvh } from '../world/beats'
import { onWalkChange } from '../world/walk'
import { nav, inscriptions } from '../../content/site'

const labelOf = (id: SectionId) => nav.find((n) => n.id === id)?.label ?? id

const walkSpans = (id: SectionId): SectionWalkSpans => ({
  spanJvh: SCENE_SPANS[id],
  arrivalJvh: SECTION_SPANS[id].arrivalJvh,
  heightSvh: sectionHeightSvh(id),
})

const common = (id: SectionId) => ({
  id,
  hash: SECTION_HASH[id],
  label: labelOf(id),
  zh: inscriptions[id].accent.zh,
  ...walkSpans(id),
})

export const registry = {
  threshold: defineSection({ ...common('threshold'), post: 'ink', load: () => import('../../sections/threshold/Scene') }),
  cabin: defineSection({ ...common('cabin'), post: 'cabin', load: () => import('../../sections/cabin/Scene') }),
  grove: defineSection({ ...common('grove'), post: 'ink', load: () => import('../../sections/grove/Scene') }),
  contact: defineSection({ ...common('contact'), post: 'ink', load: () => import('../../sections/contact/Scene') }),
} as const satisfies Record<SectionId, SectionDefinition>

onWalkChange(() => {
  for (const id of SECTION_IDS) refreshSpans(registry[id], walkSpans(id))
})

/** Definitions in walk order. */
export const sections: readonly SectionDefinition[] = SECTION_IDS.map((id) => registry[id])

/** Distance in u from a point to a span; 0 inside it. */
export function distanceToSpan(u: number, span: readonly [number, number]): number {
  if (u < span[0]) return span[0] - u
  if (u >= span[1]) return u - span[1]
  return 0
}
