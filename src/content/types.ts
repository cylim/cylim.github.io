/**
 * Shared content types. Content modules are data only: no React, no three, no DOM.
 *
 * Conventions (content.md §1):
 * - British spelling. No em dashes in copy. Year ranges use an en dash (2019–2026).
 * - Terminal output stays ASCII apart from deliberate CJK.
 * - Chinese is Simplified. Every Chinese string shown on screen needs a gloss (zh, pinyin, en)
 *   for hover, focus and screen readers; see glossary.ts.
 * - Templates use {name} placeholders; fill them with `fill()` from ./format.
 */

/** A Chinese design accent with its hover gloss. */
export interface Accent {
  readonly zh: string
  readonly pinyin: string
  readonly en: string
}

export interface Link {
  readonly label: string
  readonly href: string
}

/** A glossary entry. The tooltip shows `{zh} {pinyin} · {en}`, then `meaning`. */
export interface GlossaryTerm {
  readonly zh: string
  readonly pinyin: string
  /** Short English gloss, shown after the pinyin. */
  readonly en: string
  /** Other common English translations, for search and the long tooltip. */
  readonly alt?: readonly string[]
  /** One line on what it means in the tradition. */
  readonly meaning: string
}
