#!/usr/bin/env node
// Strips what the Pages artifact must not carry, after check-budget has read it (QM-13, QM-D6, CP-7).
//
//   npm run build && npm run check:budget && npm run prune:dist
//   node scripts/prune-dist.mjs [--dist <dir>]
//
// - Source maps. vite.config.ts builds with `sourcemap: 'hidden'` because check-budget classifies
//   chunks by them, but hidden only drops the comment: the .map files (about 8.5 MB, with full
//   sourcesContent) would still be fetchable at /assets/*.js.map.
// - Notes and glyph lists copied from public/ that nothing loads at runtime: the fonts and seals
//   READMEs, the subset glyph lists (read by check-glyphs from public/) and the stills manifest
//   (written by scripts/shots.mjs).
//
// Exits 1 if a pruned path is still referenced by the HTML, CSS or JS that ships.
// Owner: tooling.

import { existsSync } from 'node:fs'
import { readdir, readFile, rm } from 'node:fs/promises'
import { join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Paths relative to dist/, `/` separated. */
export function isPruned(path) {
  return (
    path.endsWith('.map') ||
    path === 'fonts/README.md' ||
    path === 'seals/README.md' ||
    /^fonts\/[^/]+\.glyphs\.txt$/.test(path) ||
    path === 'stills/stills.json'
  )
}

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) yield* walk(full)
    else yield full
  }
}

/** Deletes the pruned files under `dist`. Returns the removed paths and any still referenced. */
export async function pruneDist(dist) {
  const removed = []
  const shipped = []
  for await (const file of walk(dist)) {
    const path = relative(dist, file).split('\\').join('/')
    if (isPruned(path)) removed.push(path)
    else if (/\.(html|css|js)$/.test(path)) shipped.push(file)
  }
  const dangling = []
  for (const file of shipped) {
    const text = await readFile(file, 'utf8')
    for (const path of removed) {
      // Maps are named after their chunk, which every chunk mentions; only a real reference counts.
      const needle = path.endsWith('.map') ? `${path.split('/').pop()}` : `/${path}`
      if (text.includes(needle)) dangling.push(`${relative(dist, file)} → ${path}`)
    }
  }
  await Promise.all(removed.map((path) => rm(join(dist, path))))
  return { removed, dangling }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2)
  const i = args.indexOf('--dist')
  const root = fileURLToPath(new URL('..', import.meta.url))
  const dist = resolve(root, i >= 0 && args[i + 1] ? args[i + 1] : 'dist')
  if (!existsSync(join(dist, 'index.html'))) {
    console.error(`No build at ${dist}. Run \`npm run build\` first.`)
    process.exit(1)
  }
  const { removed, dangling } = await pruneDist(dist)
  const maps = removed.filter((p) => p.endsWith('.map')).length
  console.log(`prune-dist: removed ${maps} source maps and ${removed.length - maps} dev files`)
  for (const path of removed.filter((p) => !p.endsWith('.map'))) console.log(`  ${path}`)
  if (dangling.length) {
    console.error(`prune-dist: pruned files are still referenced:\n  ${dangling.join('\n  ')}`)
    process.exit(1)
  }
}
