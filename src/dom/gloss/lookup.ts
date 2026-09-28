import { chartTerms, methodTerms, siteAccents } from '../../content/accents'
import type { GlossaryTerm } from '../../content/types'

/**
 * Glosses for Chinese inside boot-time copy (site accents, method and chart terms in the grove copy).
 * Only these three lists ship in the boot chunk; the chart chunk carries the full glossary.
 */
let boot: Map<string, GlossaryTerm> | null = null

export function bootGloss(zh: string): GlossaryTerm | undefined {
  if (!boot) {
    boot = new Map()
    for (const list of [siteAccents, methodTerms, chartTerms]) for (const t of list) if (!boot.has(t.zh)) boot.set(t.zh, t)
  }
  return boot.get(zh)
}

/** A content accent with its glossary meaning attached, for the tooltip's second line. */
export function accentGloss<T extends { zh: string; pinyin: string; en: string }>(accent: T): T & { meaning?: string } {
  const meaning = bootGloss(accent.zh)?.meaning
  return meaning ? { ...accent, meaning } : accent
}

export type GlossSegment = { kind: 'text'; text: string } | { kind: 'term'; term: GlossaryTerm } | { kind: 'zh'; text: string }

const CJK_RUN = /[\u3400-\u4dbf\u4e00-\u9fff]+/g
const MAX_TERM = 4

/**
 * Split copy into plain text, glossed terms and unglossed Chinese. Inside a Chinese run the longest
 * known term wins, so 奇门遁甲 beats 奇门.
 */
export function segmentCopy(text: string, lookup: (zh: string) => GlossaryTerm | undefined = bootGloss): GlossSegment[] {
  const out: GlossSegment[] = []
  const pushZh = (s: string) => {
    const last = out.at(-1)
    if (last?.kind === 'zh') last.text += s
    else out.push({ kind: 'zh', text: s })
  }
  let cursor = 0
  for (const m of text.matchAll(CJK_RUN)) {
    const start = m.index
    if (start > cursor) out.push({ kind: 'text', text: text.slice(cursor, start) })
    const run = m[0]
    let i = 0
    while (i < run.length) {
      let matched = false
      for (let len = Math.min(MAX_TERM, run.length - i); len > 0; len--) {
        const term = lookup(run.slice(i, i + len))
        if (term) {
          out.push({ kind: 'term', term })
          i += len
          matched = true
          break
        }
      }
      if (!matched) {
        pushZh(run[i] as string)
        i++
      }
    }
    cursor = start + run.length
  }
  if (cursor < text.length) out.push({ kind: 'text', text: text.slice(cursor) })
  return out
}
