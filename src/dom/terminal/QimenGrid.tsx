import { useMemo } from 'react'
import type { PalaceNo, QimenChart } from '../../lib/qimen/types'
import { castAt } from '../chart/chartSource'
import { deityGloss, doorGloss, figcaption, palaceGloss, starGloss, stemGloss } from '../chart/format'
import { SOUTH_UP } from '../chart/grid'
import { Zh, type GlossSource } from '../gloss/Zh'

function Glyph({ zh, gloss, mark }: { zh: string | null | undefined; gloss: (zh: string) => GlossSource | undefined; mark?: boolean }) {
  if (!zh) return null
  const t = gloss(zh)
  const cls = mark ? 'qg-mark' : undefined
  return t ? <Zh term={t} focusable={false} className={cls} /> : <span lang="zh-Hans" className={cls}>{zh}</span>
}

function Cell({ chart, n }: { chart: QimenChart; n: PalaceNo }) {
  const p = chart.palaces[n]
  const pg = palaceGloss(n)
  return (
    <div className="qg-cell" style={{ gridArea: `p${n}` }}>
      <span className="qg-deity">
        <Glyph zh={p.deity} gloss={deityGloss} />
      </span>
      <span className="qg-row">
        {p.stars.map((s) => (
          <Glyph key={s} zh={s} gloss={starGloss} mark={p.flags.zhiFu && s === chart.zhiFu.star} />
        ))}
        {p.heaven.map((s) => (
          <Glyph key={s} zh={s} gloss={stemGloss} />
        ))}
      </span>
      <span className="qg-row">
        <Glyph zh={p.door} gloss={doorGloss} mark={p.flags.zhiShi} />
        <Glyph zh={p.earth} gloss={stemGloss} />
      </span>
      <span className="qg-palace">
        {pg && <Zh term={pg} focusable={false} />}
        {n}
      </span>
    </div>
  )
}

/**
 * The `qimen` command's chart: an HTML 3 × 3 grid, south up (design.md §10.3), from the same engine
 * as the grove, so the terminal and the stones always agree. 值符 and 值使 in inverse video.
 */
export function QimenGrid({ atMs }: { atMs: number }) {
  const chart = useMemo(() => castAt(atMs), [atMs])
  if (!chart) return null
  return (
    <div className="qg" role="group" aria-label={figcaption(chart)}>
      {SOUTH_UP.flat().map((n) => (
        <Cell key={n} chart={chart} n={n} />
      ))}
    </div>
  )
}
