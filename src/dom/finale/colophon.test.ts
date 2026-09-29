import { describe, expect, it } from 'vitest'
import { FIXTURE_A_MS, PENANG } from '../test/fixtures'
import { colophonFor, colophonPhrases } from './Colophon'

describe('colophon', () => {
  it('dates the visit in the traditional calendar, signed 林 (design.md §8.7 E3)', () => {
    expect(colophonFor(FIXTURE_A_MS, PENANG)).toEqual({
      zh: '丙午年 秋分后五日 戌时 · 林',
      en: 'Inscribed in Penang for your visit, five days after the autumn equinox, in the Bing-Wu year, at the hour of the Dog.',
    })
  })

  it('reads 秋分日 on the day of the term itself', () => {
    expect(colophonFor(Date.parse('2026-09-23T12:00:00+08:00'), PENANG)?.zh).toBe('丙午年 秋分日 午时 · 林')
  })

  it('breaks its columns between phrases only, and keeps the signature whole', () => {
    const zh = '丙午年 秋分后五日 戌时 · 林'
    const chars = [...zh]
    const phrases = colophonPhrases(chars)
    expect(phrases.map((p) => p.chars.join(''))).toEqual(['丙午年', '秋分后五日', '戌时 ·', '林'])
    // Each phrase's index is where it starts in the text, so the writing keeps its order and pace.
    for (const p of phrases) expect(chars.slice(p.at, p.at + p.chars.length).join('')).toBe(p.chars.join(''))
    expect(colophonPhrases([...'丙午年 秋分日']).map((p) => p.chars.join(''))).toEqual(['丙午年', '秋分日'])
  })
})
