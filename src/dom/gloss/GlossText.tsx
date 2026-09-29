import { Fragment } from 'react'
import type { GlossaryTerm } from '../../content/types'
import { segmentCopy, type GlossSegment } from './lookup'
import { Zh } from './Zh'

/**
 * Copy that spells a term's English right after it, "奇门遁甲 (Qimen Dunjia) is…": sighted readers keep
 * the parenthesis, but the gloss already says "(qí mén dùn jiǎ, Qimen Dunjia)" to screen readers,
 * which would then hear the name twice (CP-11). The echo is hidden from them instead.
 */
function echoOf(prev: GlossSegment | undefined, text: string): string | null {
  if (prev?.kind !== 'term') return null
  const echo = ` (${prev.term.en})`
  return text.startsWith(echo) ? echo : null
}

/** Copy with every known Chinese term glossed and every other Chinese run marked `lang="zh-Hans"`. */
export function GlossText({
  text,
  lookup,
  focusable = true,
}: {
  text: string
  lookup?: (zh: string) => GlossaryTerm | undefined
  focusable?: boolean
}) {
  return (
    <>
      {segmentCopy(text, lookup).map((s, i, all) => {
        if (s.kind === 'text') {
          const echo = echoOf(all[i - 1], s.text)
          return echo ? (
            <Fragment key={i}>
              <span aria-hidden="true">{echo}</span>
              {s.text.slice(echo.length)}
            </Fragment>
          ) : (
            s.text
          )
        }
        if (s.kind === 'zh')
          return (
            <span key={i} lang="zh-Hans">
              {s.text}
            </span>
          )
        return <Zh key={i} term={s.term} focusable={focusable} />
      })}
    </>
  )
}
