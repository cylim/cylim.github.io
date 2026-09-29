import { doors, glossFor, glossForMountain, mountains, palaces, stars } from '../../content/glossary'

/** Tooltip content: line one `{zh} {pinyin} · {en}` (+ note), line two the meaning. */
export interface GlossDetail {
  zh: string
  pinyin: string
  en: string
  meaning: string
  /** e.g. "home palace 9, 离 Li, south" for stars and doors (design.md §9.7). */
  note?: string
}

/** 'kǎn' → 'Kan': pinyin without tone marks, capitalised, for English palace labels. */
export const romanize = (pinyin: string) => {
  const plain = pinyin.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ü/g, 'u')
  return plain.charAt(0).toUpperCase() + plain.slice(1)
}

/**
 * Full gloss for a 3D glyph id. The id is the Chinese text, optionally with an `@suffix` the scene
 * uses to tell instances apart (e.g. `天英@9`). The suffix `@r4` marks a glyph on the luopan's
 * mountain ring: 甲 there is the Mountain 75°, not the stem's plate role (CD-3). Any other suffix is
 * ignored. Loaded lazily: it pulls in the whole glossary.
 */
export function glossDetail(glyphId: string): GlossDetail | null {
  const [zh = '', tag] = glyphId.split('@')
  if (tag === 'r4') {
    const m = glossForMountain(zh)
    return m ? { zh: m.zh, pinyin: m.pinyin, en: m.en, meaning: m.meaning } : null
  }
  const t = glossFor(zh)
  if (!t) return null
  const homed = stars.find((s) => s.zh === zh) ?? doors.find((d) => d.zh === zh)
  const palace = homed ? palaces.find((p) => p.number === homed.home) : undefined
  const mountain = mountains.find((m) => m.zh === zh)
  let note: string | undefined
  if (homed && palace) note = `home palace ${palace.number}, ${palace.zh} ${romanize(palace.pinyin)}, ${palace.directionEn.toLowerCase()}`
  else if (mountain && !t.meaning) note = `mountain at ${mountain.bearing}°`
  return { zh: t.zh, pinyin: t.pinyin, en: t.en, meaning: t.meaning, note }
}
