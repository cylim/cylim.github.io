// The album SVG puts the cinnabar 值符 plate under the 值符 star, as the panel, terminal and 3D chart do.
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { castPenang, fixtureA } from '../test/fixtures'
import type { QimenChart } from '../../lib/qimen/types'
import { AlbumChartSvg } from './AlbumChart'

/** Text of every glyph a star plate sits under, in the 值符 palace (the deity plate is left out). */
function platedStars(chart: QimenChart): string[] {
  const html = renderToStaticMarkup(<AlbumChartSvg chart={chart} dial={0} selected={null} hourBranch={chart.pillars.hour.branch} />)
  const doc = new DOMParser().parseFromString(html, 'image/svg+xml')
  const palace = doc.querySelector(`[data-palace="${chart.zhiFu.palace}"]`)
  if (!palace) throw new Error('no 值符 palace')
  const texts = [...palace.querySelectorAll('text')]
  const out: string[] = []
  for (const plate of palace.querySelectorAll('rect.ac-plate')) {
    const n = (a: string) => Number(plate.getAttribute(a))
    const [cx, cy] = [n('x') + n('width') / 2, n('y') + n('height') / 2]
    const under = texts.find((t) => Math.abs(Number(t.getAttribute('x')) - cx) < 0.01 && Math.abs(Number(t.getAttribute('y')) - cy) < 0.01)
    if (under?.textContent && under.textContent !== chart.palaces[chart.zhiFu.palace].deity) out.push(under.textContent)
  }
  return out
}

describe('album 值符 plate', () => {
  it('plates 天芮 when 天芮 is the 值符 (fixture A)', () => {
    expect(platedStars(fixtureA())).toEqual(['天芮'])
  })

  it('plates the small 禽, not 天芮, when 天禽 is the 值符', () => {
    const chart = castPenang(Date.parse('2026-01-07T14:30:00+08:00'))
    expect(chart.zhiFu.star).toBe('天禽')
    expect(platedStars(chart)).toEqual(['禽'])
  })
})
