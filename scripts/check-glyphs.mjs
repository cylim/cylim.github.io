#!/usr/bin/env node
// Fails when the site can draw a character its self-hosted subsets do not contain (design.md §3).
// A missing CJK glyph would make troika fetch its Noto fallback from jsDelivr, and the DOM would
// fall back to a system Kai or Song face, so CI stops here instead. Fix: `npm run gen:fonts`
// (needs `node scripts/fetch-fonts.mjs` once), then commit public/fonts/.
//
// Checks, reading the real cmaps of the committed files:
//   1. every CJK character in the scanned sources and the chart vocabulary is in wenkai-subset (woff2 and woff)
//   2. every section inscription, nav accent and the hero accent (evaluated from src/content) is in mashanzheng-subset
//   3. every non-ASCII Latin-side character in the sources, and all pinyin, is in the Source Serif 4 subsets
//      (or, for symbols, in JetBrains Mono)
//   4. the .glyphs.txt lists agree with the fonts
//   5. (warning) WenKai holds no CJK the sources stopped using: a dropped string's characters (the
//      dropped name seal's characters, CP-8) would otherwise ship until someone reran gen:fonts
// Owner: tooling.

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { runnerImport } from 'vite'
import { CHART_GLYPHS, collectCjk, collectNonCjkExtras, cjkOrigins, ROOT } from './collect-cjk.mjs'
import { FACES, FONTS_OUT, PINYIN } from './fonts.config.mjs'
import { loadFace } from './lib/font-face.mjs'

const errors = []
const warnings = []
const face = (key) => FACES.find((f) => f.key === key)
const load = async (key, ext) => loadFace(await readFile(join(ROOT, FONTS_OUT, `${face(key).out}.${ext}`)))
const missingFrom = (font, chars) => [...new Set(chars)].filter((ch) => ch.trim() && !font.has(ch.codePointAt(0)))

// 1. WenKai
const cjk = await collectCjk()
const origins = await cjkOrigins()
for (const ext of ['woff2', 'woff']) {
  const wenkai = await load('cjk', ext)
  const miss = missingFrom(wenkai, cjk)
  if (miss.length) {
    const where = miss.map((ch) => `${ch} (${origins.get(ch) ?? (CHART_GLYPHS.includes(ch) ? 'chart list' : 'punctuation')})`)
    errors.push(`wenkai-subset.${ext} is missing ${miss.length}: ${where.join(', ')}`)
  }
}

// 2. Ma Shan Zheng: evaluate the content modules so computed accents are covered too.
const { module: content } = await runnerImport('/src/content/index.ts', { root: ROOT, configFile: false, logLevel: 'error' })
const display = [
  content.hero?.accent?.zh,
  ...Object.values(content.inscriptions ?? {}).map((i) => i.accent?.zh),
  ...(content.nav ?? []).map((n) => n.accent?.zh),
]
  .filter(Boolean)
  .join('')
if (!display) errors.push('could not read hero, inscriptions or nav accents from src/content')
for (const ext of ['woff2', 'woff']) {
  const msz = await load('cjkDisplay', ext)
  const miss = missingFrom(msz, display)
  if (miss.length) errors.push(`mashanzheng-subset.${ext} is missing display accents: ${miss.join(' ')}`)
}

// 3. Latin side. Body text must be in both Source Serif subsets. Symbols Source Serif lacks
//    (arrows, box drawing) pass if JetBrains Mono has them, with a note to set the mono face there.
const extras = await collectNonCjkExtras()
const body400 = await load('body400', 'woff2')
const body600 = await load('body600', 'woff2')
const mono = await load('mono', 'woff2')
const inBody = (ch) => body400.has(ch.codePointAt(0)) && body600.has(ch.codePointAt(0))
const monoOnly = [...extras].filter((ch) => !inBody(ch) && mono.has(ch.codePointAt(0)))
const nowhere = [...extras + PINYIN].filter((ch) => !inBody(ch) && !mono.has(ch.codePointAt(0)))
if (monoOnly.length) warnings.push(`${monoOnly.join(' ')} exist only in jetbrains-mono-400; draw them in var(--font-mono) or as SVG icons`)
if (nowhere.length) errors.push(`no self-hosted Latin face has ${nowhere.join(' ')}; use an SVG icon, or add it to scripts/fonts.config.mjs and rerun gen:fonts`)

// 4. glyph lists
for (const key of ['cjk', 'cjkDisplay']) {
  const list = (await readFile(join(ROOT, FONTS_OUT, `${face(key).out}.glyphs.txt`), 'utf8')).trim()
  const font = await load(key, 'woff2')
  const miss = missingFrom(font, list)
  if (miss.length) errors.push(`${face(key).out}.glyphs.txt lists glyphs the font lacks: ${miss.join('')}`)
}

// 5. stale CJK in the WenKai subset
{
  const list = (await readFile(join(ROOT, FONTS_OUT, `${face('cjk').out}.glyphs.txt`), 'utf8')).trim()
  const wanted = new Set(cjk)
  const stale = [...new Set(list)].filter((ch) => /\p{Script=Han}/u.test(ch) && !wanted.has(ch))
  if (stale.length) warnings.push(`wenkai-subset holds ${stale.length} CJK no source uses any more: ${stale.join('')}. Run \`npm run gen:fonts\` to drop them`)
}

for (const w of warnings) console.warn(`warn: ${w}`)
if (errors.length) {
  for (const e of errors) console.error(`error: ${e}`)
  console.error('Run `npm run gen:fonts` and commit public/fonts/.')
  process.exit(1)
}
console.log(`glyphs ok: ${[...cjk].length} CJK in WenKai, ${new Set(display).size} display accents in Ma Shan Zheng, ${[...extras].length} Latin extras`)
