import { Fragment, useState, type CSSProperties } from 'react'
import { nowMs } from '../../core/store/journey'
import { chartOptions, colophon, glossFor } from '../../content'
import { colophonDate, formatColophon } from '../../lib/calendar'
import type { QimenOptions } from '../../lib/qimen/types'
import { LangText } from '../gloss/LangText'

/** The dated colophon for this visit, in the traditional calendar (design.md §8.7 E3). */
export function colophonFor(ms: number, options: QimenOptions = chartOptions): { zh: string; en: string } | null {
  try {
    return formatColophon(colophonDate(ms, options), colophon, glossFor)
  } catch {
    return null
  }
}

const vars = (v: Record<string, number>) => v as CSSProperties

/**
 * The colophon's columns break only between phrases (丙午年 · 秋分后五日 · 戌时 · the signature), never
 * inside one, the separator stays with the date, and the signature 林 is one unit: on a
 * narrow screen the column breaks before it, as a painter starts the name on a fresh column. `at` is
 * each phrase's first index in `chars`, which times the writing.
 */
export function colophonPhrases(chars: readonly string[]): { at: number; chars: string[] }[] {
  const words: { at: number; chars: string[] }[] = []
  chars.forEach((c, i) => {
    const last = words[words.length - 1]
    if (c === ' ') words.push({ at: i + 1, chars: [] })
    else if (!last) words.push({ at: i, chars: [c] })
    else last.chars.push(c)
  })
  const sep = words.findIndex((w) => w.chars.length === 1 && w.chars[0] === '·')
  if (sep <= 0) return words
  const date = words.slice(0, sep - 1)
  const withSep = { at: words[sep - 1]!.at, chars: [...words[sep - 1]!.chars, ' ', ...words[sep]!.chars] }
  const rest = words.slice(sep + 1)
  const signature = rest.length ? [{ at: rest[0]!.at, chars: rest.flatMap((w, k) => (k ? [' ', ...w.chars] : w.chars)) }] : []
  return [...date, withSep, ...signature]
}

/**
 * The colophon (题跋): vertical, in WenKai, then the English sentence under it. Dated once, for the
 * moment this visit began. Client-only: it depends on the visitor's clock. In the walk it writes
 * itself a character at a time once the finale marks `html[data-colophon]` (walk.css staggers the
 * characters by `--i` and starts the English after `--n`).
 */
export default function Colophon() {
  const [text] = useState(() => (colophon.enabled ? colophonFor(nowMs()) : null))
  if (!text) return null
  const chars = [...text.zh]
  const phrases = colophonPhrases(chars)
  return (
    <div className="colophon" style={vars({ '--n': chars.length })}>
      <p className="colophon-zh" lang="zh-Hans" aria-describedby="colophon-en">
        {phrases.map((p, k) => (
          <Fragment key={p.at}>
            {k > 0 && ' '}
            <span className="colophon-phrase">
              {p.chars.map((c, j) =>
                c === ' ' ? (
                  c
                ) : (
                  <span key={j} className="colophon-ch" style={vars({ '--i': p.at + j })}>
                    {c}
                  </span>
                ),
              )}
            </span>
          </Fragment>
        ))}
      </p>
      <p className="colophon-en" id="colophon-en">
        <LangText text={text.en} />
      </p>
    </div>
  )
}
