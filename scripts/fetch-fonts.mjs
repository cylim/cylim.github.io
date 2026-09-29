#!/usr/bin/env node
// Downloads the OFL font sources into .fonts-src/ (git-ignored), from each family's official
// GitHub release or the google/fonts repo. Only subset-fonts needs them; CI does not.
//
//   node scripts/fetch-fonts.mjs [--force]
//
// Needs `unzip` on PATH for the three zip releases.
// Owner: tooling.

import { execFileSync } from 'node:child_process'
import { mkdir, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ROOT } from './collect-cjk.mjs'
import { FONTS_SRC } from './fonts.config.mjs'

const dir = join(ROOT, FONTS_SRC)
const dl = join(dir, 'dl')
const force = process.argv.includes('--force')

/** url → file in .fonts-src/dl/, then optional members to extract from a zip into .fonts-src/. */
const SOURCES = [
  {
    url: 'https://github.com/lxgw/LxgwWenKai/releases/download/v1.522/LXGWWenKai-Regular.ttf',
    file: 'LXGWWenKai-Regular.ttf',
    copyTo: 'LXGWWenKai-Regular.ttf',
  },
  { url: 'https://raw.githubusercontent.com/lxgw/LxgwWenKai/v1.522/OFL.txt', file: 'OFL-wenkai.txt' },
  {
    url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/mashanzheng/MaShanZheng-Regular.ttf',
    file: 'MaShanZheng-Regular.ttf',
    copyTo: 'MaShanZheng-Regular.ttf',
  },
  { url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/mashanzheng/OFL.txt', file: 'OFL-mashanzheng.txt' },
  {
    url: 'https://github.com/CatharsisFonts/Cormorant/releases/download/v4.002/Cormorant_Install_v4.002.zip',
    file: 'Cormorant_Install_v4.002.zip',
    extract: ['Cormorant_Install_v4.002/CormorantGaramond-SemiBold.otf'],
  },
  { url: 'https://raw.githubusercontent.com/CatharsisFonts/Cormorant/master/OFL.txt', file: 'OFL-cormorant.txt' },
  {
    url: 'https://github.com/adobe-fonts/source-serif/releases/download/4.005R/source-serif-4.005_Desktop.zip',
    file: 'source-serif-4.005_Desktop.zip',
    extract: ['source-serif-4.005_Desktop/TTF/SourceSerif4-Regular.ttf', 'source-serif-4.005_Desktop/TTF/SourceSerif4-Semibold.ttf'],
  },
  { url: 'https://raw.githubusercontent.com/adobe-fonts/source-serif/release/LICENSE.md', file: 'LICENSE-sourceserif.md' },
  {
    url: 'https://github.com/JetBrains/JetBrainsMono/releases/download/v2.304/JetBrainsMono-2.304.zip',
    file: 'JetBrainsMono-2.304.zip',
    extract: ['fonts/ttf/JetBrainsMono-Regular.ttf'],
  },
  { url: 'https://raw.githubusercontent.com/JetBrains/JetBrainsMono/master/OFL.txt', file: 'OFL-jetbrainsmono.txt' },
]

const exists = (p) =>
  stat(p).then(
    () => true,
    () => false,
  )

await mkdir(dl, { recursive: true })
for (const s of SOURCES) {
  const target = join(dl, s.file)
  if (force || !(await exists(target))) {
    process.stdout.write(`fetch ${s.url} … `)
    const res = await fetch(s.url, { redirect: 'follow' })
    if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${s.url}`)
    await writeFile(target, Buffer.from(await res.arrayBuffer()))
    console.log('ok')
  }
  if (s.copyTo) execFileSync('cp', [target, join(dir, s.copyTo)])
  if (s.extract) execFileSync('unzip', ['-o', '-j', '-q', target, ...s.extract, '-d', dir])
}
console.log(`Font sources ready in ${FONTS_SRC}/`)
