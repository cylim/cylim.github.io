import { features } from '../../content/features'

/** The four scroll sections, in walk order. Canonical; everything else imports from here. */
export const SECTION_IDS = ['threshold', 'cabin', 'grove', 'contact'] as const

export type SectionId = (typeof SECTION_IDS)[number]

/**
 * The sections this walk has, in order: SECTION_IDS without a paused one (content/features.ts). The
 * DOM sections, nav, hashes, progress ticks and `active` use these. Scenes still load for all four:
 * with the grove paused its chunk draws the path through the mist wall.
 */
export const WALK_SECTION_IDS: readonly SectionId[] = SECTION_IDS.filter((id) => id !== 'grove' || features.grove)

/** Where a link to a paused section lands instead: the grove's hash goes on to the lantern. */
export const walkSection = (id: SectionId): SectionId => (WALK_SECTION_IDS.includes(id) ? id : 'contact')

/** URL hash per section. The threshold has none: its canonical URL is the bare path. */
export const SECTION_HASH = {
  threshold: '',
  cabin: '#cabin',
  grove: '#grove',
  contact: '#contact',
} as const satisfies Record<SectionId, '' | `#${string}`>

export type SectionHash = (typeof SECTION_HASH)[SectionId]

export function isSectionId(value: unknown): value is SectionId {
  return typeof value === 'string' && (SECTION_IDS as readonly string[]).includes(value)
}

/**
 * Map a location hash to a section. Unknown or empty hashes are the threshold;
 * `#threshold` is accepted as an alias (design.md §6.2). A paused section's hash lands on `walkSection`.
 */
export function sectionFromHash(hash: string): SectionId {
  const id = hash.replace(/^#/, '')
  return isSectionId(id) ? walkSection(id) : 'threshold'
}
