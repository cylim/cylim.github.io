#!/usr/bin/env node
// Prerender the content layer into dist/index.html (stack.md §10, design.md §14.2).
//
//   vite build && vite build --ssr src/entry-server.tsx --outDir dist-ssr && node scripts/prerender.mjs
//   node scripts/prerender.mjs --dist /tmp/out --ssr /tmp/out-ssr
//
// Replaces the <!--content--> slot inside #root with renderToString(<ContentLayer />), so crawlers,
// no-JS visitors and the first paint get every section's copy, the links and the glossary. The client
// hydrates the same markup. Fails loudly if the slot or the SSR bundle is missing, or if the result
// is missing copy that must be on the first screen. Owner: dom.

import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { gzipSync } from 'node:zlib'
import { fileURLToPath, pathToFileURL } from 'node:url'

// Optional: --dist <dir> --ssr <dir> (defaults: dist and dist-ssr at the repo root).
const args = process.argv.slice(2)
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 && args[i + 1] ? resolve(args[i + 1]) : fallback
}
const repo = fileURLToPath(new URL('..', import.meta.url))
const htmlPath = resolve(flag('dist', resolve(repo, 'dist')), 'index.html')
const ssrPath = pathToFileURL(resolve(flag('ssr', resolve(repo, 'dist-ssr')), 'entry-server.js'))

const SLOT = '<!--content-->'

const { render, features } = await import(ssrPath.href)
const html = await readFile(htmlPath, 'utf8')
if (!html.includes(SLOT)) throw new Error(`prerender: ${SLOT} not found in dist/index.html (already prerendered?)`)

const body = render()
if (typeof body !== 'string' || body.length < 1000) throw new Error('prerender: render() returned too little markup')
for (const must of ['id="threshold-heading"', 'CY Lim', 'https://github.com/cylim', 'id="content"', 'id="contact-heading"']) {
  if (!body.includes(must)) throw new Error(`prerender: output is missing ${must}`)
}
// The grove section is there exactly when it is on (src/content/features.ts).
if (body.includes('id="grove-heading"') !== Boolean(features?.grove)) {
  throw new Error(`prerender: the grove section should be ${features?.grove ? 'on' : 'off'} (src/content/features.ts)`)
}

const out = html.replace(SLOT, body)
await writeFile(htmlPath, out)

const kb = (n) => `${(n / 1024).toFixed(1)} KB`
console.log(`prerender: dist/index.html ${kb(Buffer.byteLength(out))}, ${kb(gzipSync(out).length)} gzip`)
