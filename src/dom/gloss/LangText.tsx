import { Fragment } from 'react'
import { segmentCopy } from './lookup'

const noGloss = () => undefined

/**
 * English copy with Chinese inside it ("The 甲 or 己 day…", "林 is Lim"): each Chinese run marked
 * `lang="zh-Hans"` so screen readers voice it in Chinese and the CJK face draws it (design.md §3.1,
 * §15), without glossing it. For text that is itself a gloss or a meaning.
 */
export function LangText({ text }: { text: string }) {
  return (
    <>
      {segmentCopy(text, noGloss).map((s, i) =>
        s.kind === 'zh' ? (
          <span key={i} lang="zh-Hans">
            {s.text}
          </span>
        ) : (
          <Fragment key={i}>{s.kind === 'text' ? s.text : s.term.zh}</Fragment>
        ),
      )}
    </>
  )
}

/**
 * The same for a live-region message, which is written imperatively (live.tsx): `el` gets the text
 * with each Chinese run in a `lang="zh-Hans"` span, so "…, 酉 hour" is voiced right.
 */
export function writeLangText(el: HTMLElement, text: string): void {
  el.textContent = ''
  for (const s of segmentCopy(text, noGloss)) {
    if (s.kind === 'zh') {
      const span = document.createElement('span')
      span.lang = 'zh-Hans'
      span.textContent = s.text
      el.append(span)
    } else el.append(s.kind === 'text' ? s.text : s.term.zh)
  }
}
