import { useId, type ReactNode } from 'react'
import { useHydrated } from '../hooks'
import { LangText } from './LangText'

/** What a gloss needs. `Accent` from content satisfies it; `GlossaryTerm` adds the meaning. */
export interface GlossSource {
  readonly zh: string
  readonly pinyin: string
  readonly en: string
  readonly meaning?: string
}

interface ZhProps {
  term: GlossSource
  children?: ReactNode
  /** false inside composite widgets (the chart grid is one tab stop). Hover and tap still work. */
  focusable?: boolean
  className?: string
}

/**
 * A Chinese accent with its gloss (design.md §4.3). The visually hidden text next to it gives
 * screen readers the pinyin and English inline; the tooltip (GlossLayer) reads the data-* attributes,
 * so the gloss text lives once in content and never in components. It becomes a tab stop once the
 * page has hydrated: the tooltip needs JavaScript, and without it a focusable span that shows nothing
 * is a dead stop for sighted keyboard users (A11Y-11). Screen readers have the inline gloss either way.
 */
export function Zh({ term, children, focusable = true, className }: ZhProps) {
  const id = `g${useId().replace(/[^\w-]/g, '')}`
  const hydrated = useHydrated()
  return (
    <>
      <span
        className={className ? `zh ${className}` : 'zh'}
        lang="zh-Hans"
        tabIndex={!focusable ? -1 : hydrated ? 0 : undefined}
        aria-describedby={id}
        data-gloss=""
        data-py={term.pinyin}
        data-en={term.en}
        data-meaning={term.meaning || undefined}
      >
        {children ?? term.zh}
      </span>
      <span id={id} className="visually-hidden">
        {` (${term.pinyin}, `}
        <LangText text={term.en} />
        {')'}
      </span>
    </>
  )
}

/**
 * A decorative accent inside a control that already has its own accessible name (the nav items).
 * aria-hidden, not focusable; the host control opens the tooltip for it on hover and focus.
 */
export function ZhAccent({ term, className }: { term: GlossSource; className?: string }) {
  return (
    <span
      className={className}
      lang="zh-Hans"
      aria-hidden="true"
      data-gloss=""
      data-py={term.pinyin}
      data-en={term.en}
      data-meaning={term.meaning || undefined}
    >
      {term.zh}
    </span>
  )
}
