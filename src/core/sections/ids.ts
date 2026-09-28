/** The four scroll sections, in walk order. Canonical; everything else imports from here. */
export const SECTION_IDS = ['threshold', 'cabin', 'grove', 'contact'] as const

export type SectionId = (typeof SECTION_IDS)[number]

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
 * `#threshold` is accepted as an alias (design.md §6.2).
 */
export function sectionFromHash(hash: string): SectionId {
  const id = hash.replace(/^#/, '')
  return isSectionId(id) ? id : 'threshold'
}
