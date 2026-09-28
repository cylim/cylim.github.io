#!/usr/bin/env node
// Subsets the self-hosted fonts into public/fonts/ (design.md §3, stack.md §7).
//
//   node scripts/fetch-fonts.mjs      once, downloads the OFL sources into .fonts-src/ (git-ignored)
//   node scripts/subset-fonts.mjs     rerun whenever copy adds a character; commit public/fonts/
//
// Each face ships twice: .woff2 for CSS @font-face, .woff for troika (which cannot read woff2).
// The two CJK faces also get a .glyphs.txt that check-glyphs compares against the sources.
// Ma Shan Zheng is additionally outlined to SVG for the hero 入林, so first paint needs no CJK font.
// Owner: tooling.

import { mkdir, readFile, stat, writeFile, copyFile } from 'node:fs/promises'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'
import subsetFont from 'subset-font'
import { collectCjk, collectNonCjkExtras, ROOT } from './collect-cjk.mjs'
import { CJK_ASCII, DISPLAY_GLYPHS, FACES, FONT_BUDGET, FONTS_OUT, FONTS_SRC } from './fonts.config.mjs'
import { loadFace } from './lib/font-face.mjs'

const src = (file) => join(ROOT, FONTS_SRC, file)
const out = (file) => join(ROOT, FONTS_OUT, file)
const kb = (n) => `${(n / 1024).toFixed(1)} KB`

async function exists(path) {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

const missing = []
for (const face of FACES) if (!(await exists(src(face.src)))) missing.push(face.src)
if (missing.length) {
  console.error(`Missing font sources in ${FONTS_SRC}/: ${missing.join(', ')}`)
  console.error('Run `node scripts/fetch-fonts.mjs` first.')
  process.exit(1)
}

// Names must agree with the tokens the DOM and troika read.
const { fontFiles } = await import('../src/theme/tokens.ts')
for (const face of FACES) {
  const expected = fontFiles[face.key]
  if (!expected || expected.woff2 !== `/fonts/${face.out}.woff2` || expected.woff !== `/fonts/${face.out}.woff`) {
    console.error(`tokens.fontFiles.${face.key} does not match /fonts/${face.out}.{woff2,woff}`)
    process.exit(1)
  }
}

await mkdir(out(''), { recursive: true })
const cjk = await collectCjk()
const extras = await collectNonCjkExtras()
const rows = []

for (const face of FACES) {
  const text = face.key === 'cjk' ? cjk + CJK_ASCII : face.text + (face.extras ? extras : '')
  const input = await readFile(src(face.src))
  const hb = await loadFace(input)
  const present = [...new Set(text)].filter((ch) => hb.has(ch.codePointAt(0)))
  const absent = [...new Set(text)].filter((ch) => !hb.has(ch.codePointAt(0)) && ch.trim())
  const subsetText = present.join('')
  const options = { keepFeatures: face.features, noHinting: face.group === 'cjk' }
  const woff2 = await subsetFont(input, subsetText, { ...options, targetFormat: 'woff2' })
  const woff = await subsetFont(input, subsetText, { ...options, targetFormat: 'woff' })
  await writeFile(out(`${face.out}.woff2`), woff2)
  await writeFile(out(`${face.out}.woff`), woff)
  if (face.glyphList) await writeFile(out(`${face.out}.glyphs.txt`), `${present.filter((c) => c !== '\n').join('')}\n`)
  rows.push({ face, glyphs: present.length, woff2: woff2.length, woff: woff.length })
  if (face.group === 'cjk' && absent.length) console.warn(`  ${face.out}: not in the source font: ${absent.join('')}`)
}

// Licences sit next to the files (OFL §2: keep the licence with every copy).
const licenceSources = {
  'OFL-Cormorant.txt': 'OFL-cormorant.txt',
  'OFL-SourceSerif4.txt': 'LICENSE-sourceserif.md',
  'OFL-JetBrainsMono.txt': 'OFL-jetbrainsmono.txt',
  'OFL-LXGWWenKai.txt': 'OFL-wenkai.txt',
  'OFL-MaShanZheng.txt': 'OFL-mashanzheng.txt',
}
for (const [to, from] of Object.entries(licenceSources)) {
  const path = join(ROOT, FONTS_SRC, 'dl', from)
  if (await exists(path)) await copyFile(path, out(to))
  else if (!(await exists(out(to)))) console.warn(`  licence source missing: ${path}`)
}

await writeHeroOutlines()

console.log('face                       glyphs    woff2      woff')
for (const r of rows) {
  console.log(`${r.face.out.padEnd(26)} ${String(r.glyphs).padStart(6)} ${kb(r.woff2).padStart(9)} ${kb(r.woff).padStart(9)}`)
}
const latin = rows.filter((r) => r.face.group === 'latin').reduce((s, r) => s + r.woff2, 0)
const wenkai = rows.find((r) => r.face.key === 'cjk')
console.log(`Latin woff2 total ${kb(latin)} (budget ${kb(FONT_BUDGET.latinWoff2Total)})`)
console.log(`WenKai woff ${kb(wenkai.woff)} (budget ${kb(FONT_BUDGET.cjkWoff)})`)

/**
 * Outlines Ma Shan Zheng glyphs to SVG. public/glyphs/hero-rulin.svg is the vertical 入林 for the
 * hero; mashanzheng.json holds every display glyph's path in a 1000-unit em box, y down, for any
 * other inline use (title cards). Paths use fill="currentColor" so CSS sets the ink.
 */
async function writeHeroOutlines() {
  const face = FACES.find((f) => f.key === 'cjkDisplay')
  const hb = await loadFace(await readFile(src(face.src)))
  const { upem, ascender, descender } = hb.metrics()
  // The ideographic em box: 1 em tall, centred on the font's ascender/descender span.
  const top = (ascender + descender) / 2 + upem / 2
  const glyphs = {}
  for (const ch of DISPLAY_GLYPHS) {
    glyphs[ch] = { d: hb.path(ch, { dx: 0, top }), advance: hb.advance(ch) }
  }
  await mkdir(join(ROOT, 'public/glyphs'), { recursive: true })
  await writeFile(
    join(ROOT, 'public/glyphs/mashanzheng.json'),
    `${JSON.stringify({ font: 'Ma Shan Zheng', licence: '/fonts/OFL-MaShanZheng.txt', em: upem, glyphs })}\n`,
  )

  // aria-hidden: the DOM carries the accent as text with its gloss; the outline is only its picture.
  const stack = (chars) => {
    const paths = [...chars].map((ch, i) => `<path transform="translate(0 ${i * upem})" d="${glyphs[ch].d}"/>`).join('')
    return (
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${upem} ${upem * [...chars].length}" aria-hidden="true" focusable="false">` +
      `<g fill="currentColor">${paths}</g></svg>\n`
    )
  }
  const hero = stack('入林')
  await writeFile(join(ROOT, 'public/glyphs/hero-rulin.svg'), hero)
  console.log(`public/glyphs/hero-rulin.svg ${kb(hero.length)} raw, ${kb(gzipSync(hero).length)} gzip`)
}
