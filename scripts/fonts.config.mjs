// Font faces, sources and character sets. Shared by subset-fonts, check-glyphs and check-budget.
// Output file names must match src/theme/tokens.ts `fontFiles`; subset-fonts checks that they do.
// Owner: tooling.

import { CHART_GLYPHS, CJK_ASCII, CJK_PUNCT, DISPLAY_GLYPHS } from './collect-cjk.mjs'

/** Where the OFL sources live (git-ignored). Override with FONTS_SRC. */
export const FONTS_SRC = process.env.FONTS_SRC ?? '.fonts-src'
export const FONTS_OUT = 'public/fonts'

const range = (from, to) => {
  let s = ''
  for (let cp = from; cp <= to; cp++) s += String.fromCodePoint(cp)
  return s
}

/** Pinyin tone vowels, both cases, plus ü and the rare syllabic n. */
export const PINYIN = 'āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜüĀÁǍÀĒÉĚÈĪÍǏÌŌÓǑÒŪÚǓÙǕǗǙǛÜńňǹ'

/** Latin-1 letters (U+00C0–00FF) without the multiplication and division signs. */
const LATIN1_LETTERS = [...range(0xc0, 0xff)].filter((c) => c !== '×' && c !== '÷').join('')

/** Basic Latin, Latin-1 letters and common signs, pinyin, and the typographic punctuation copy uses. */
export const LATIN = [
  range(0x20, 0x7e),
  LATIN1_LETTERS,
  '\u00a0¡£¥§©«®°±·»¿×÷€',
  PINYIN,
  'Œœ',
  '‘’‚“”„–—…•‹›′″‐‑−→←↑↓',
  '\u2009\u200a\u202f', // thin, hair and narrow no-break spaces
].join('')

/**
 * Cormorant only sets the name, section titles and scroll titles, never below 24 px (design.md §3),
 * so it gets ASCII, the Latin-1 letters and the punctuation titles use. No pinyin, no figures styles.
 */
export const DISPLAY_LATIN = [
  range(0x20, 0x7e),
  '\u00a0©·×àáâäçèéêëìíîïñòóôöùúûüÀÁÂÄÇÈÉÊËÌÍÎÏÑÒÓÔÖÙÚÛÜ',
  '‘’“”–—…',
].join('')

/** The terminal and stack tags also draw simple box and block characters. */
export const MONO = [LATIN, '─│┌┐└┘├┤┬┴┼╭╮╯╰', '█▌▐░▒▓', '▸▶◀▲▼✓✕'].join('')

// Pinyin is precomposed in the cmap, so mark positioning is not needed. `tnum` keeps timeline years aligned.
const latinFeatures = ['kern', 'liga', 'ccmp', 'tnum']

/**
 * One entry per output face. `key` matches tokens.fontFiles. `extras: true` adds the non-ASCII,
 * non-CJK characters found in the sources (collect-cjk) so new punctuation in content is covered.
 */
export const FACES = [
  {
    key: 'display600',
    out: 'cormorant-garamond-600',
    src: 'CormorantGaramond-SemiBold.otf',
    family: 'Cormorant Garamond',
    weight: 600,
    group: 'latin',
    text: DISPLAY_LATIN,
    extras: false,
    features: ['kern', 'liga'],
    licence: 'OFL-Cormorant.txt',
    upstream: 'https://github.com/CatharsisFonts/Cormorant/releases/tag/v4.002 (Cormorant_Install_v4.002.zip)',
  },
  {
    key: 'body400',
    out: 'source-serif-4-400',
    src: 'SourceSerif4-Regular.ttf',
    family: 'Source Serif 4',
    weight: 400,
    group: 'latin',
    text: LATIN,
    extras: true,
    features: latinFeatures,
    licence: 'OFL-SourceSerif4.txt',
    upstream: 'https://github.com/adobe-fonts/source-serif/releases/tag/4.005R (source-serif-4.005_Desktop.zip, TTF/)',
  },
  {
    key: 'body600',
    out: 'source-serif-4-600',
    src: 'SourceSerif4-Semibold.ttf',
    family: 'Source Serif 4',
    weight: 600,
    group: 'latin',
    text: LATIN,
    extras: true,
    // Labels are 600 all-small-caps (design.md §3.1), so this face keeps the small caps.
    features: ['kern', 'liga', 'ccmp', 'smcp', 'c2sc'],
    licence: 'OFL-SourceSerif4.txt',
    upstream: 'https://github.com/adobe-fonts/source-serif/releases/tag/4.005R (source-serif-4.005_Desktop.zip, TTF/)',
  },
  {
    key: 'mono',
    out: 'jetbrains-mono-400',
    src: 'JetBrainsMono-Regular.ttf',
    family: 'JetBrains Mono',
    weight: 400,
    group: 'mono',
    text: MONO,
    extras: true,
    // No `calt`: code ligatures would turn `->` in terminal output into arrows, and they triple the size.
    features: ['ccmp', 'locl', 'mark', 'mkmk', 'case'],
    licence: 'OFL-JetBrainsMono.txt',
    upstream: 'https://github.com/JetBrains/JetBrainsMono/releases/tag/v2.304 (fonts/ttf/)',
  },
  {
    key: 'cjk',
    out: 'wenkai-subset',
    src: 'LXGWWenKai-Regular.ttf',
    family: 'LXGW WenKai',
    weight: 400,
    group: 'cjk',
    text: null, // collectCjk() + CJK_ASCII, filled in by subset-fonts
    extras: false,
    // `vert` swaps punctuation for the vertical inscriptions and the colophon.
    features: ['ccmp', 'locl', 'vert', 'kern'],
    glyphList: true,
    licence: 'OFL-LXGWWenKai.txt',
    upstream: 'https://github.com/lxgw/LxgwWenKai/releases/tag/v1.522 (LXGWWenKai-Regular.ttf)',
  },
  {
    key: 'cjkDisplay',
    out: 'mashanzheng-subset',
    src: 'MaShanZheng-Regular.ttf',
    family: 'Ma Shan Zheng',
    weight: 400,
    group: 'cjk',
    text: DISPLAY_GLYPHS,
    extras: false,
    features: ['ccmp', 'locl', 'vert'],
    glyphList: true,
    licence: 'OFL-MaShanZheng.txt',
    upstream: 'https://github.com/google/fonts/tree/main/ofl/mashanzheng (MaShanZheng-Regular.ttf)',
  },
]

export { CHART_GLYPHS, CJK_ASCII, CJK_PUNCT, DISPLAY_GLYPHS }

/** Transfer budgets from stack.md §4 in bytes (woff2 for the DOM, woff for troika). */
export const FONT_BUDGET = {
  latinWoff2Total: 60 * 1024, // Cormorant 600 + Source Serif 4 400 + 600
  cjkWoff: 60 * 1024,
}
