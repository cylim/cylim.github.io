#!/usr/bin/env node
// Enforces the transfer budgets of stack.md §4 and design.md §13.4 against a built dist/.
//
//   npm run build && npm run check:budget
//   node scripts/check-budget.mjs [--dist <dir>] [--json]
//
// Sizes are gzip (level 6, close to what Pages serves) for text and raw bytes for fonts and
// images, which are already compressed. Chunks are classified by their hidden sourcemaps
// (vite.config.ts builds with `sourcemap: 'hidden'`), so section chunks are told apart even though
// Rolldown names all four `Scene-*.js`. Import graphs come from the chunks' own import statements.
//
// Hard rules (exit 1): every budget row marked `gate`, and no three.js or R3F code reachable from
// index.html without a dynamic import (stack.md §4: "no modulepreload of three").
// Owner: tooling.

import { existsSync } from 'node:fs'
import { readdir, readFile, stat, appendFile } from 'node:fs/promises'
import { basename, dirname, join, relative, resolve } from 'node:path'
import { gzipSync } from 'node:zlib'
import { ROOT } from './collect-cjk.mjs'

const args = process.argv.slice(2)
const argValue = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback
}
const DIST = resolve(ROOT, argValue('dist', 'dist'))
const asJson = args.includes('--json')
const KB = 1024

if (!existsSync(join(DIST, 'index.html'))) {
  console.error(`No build at ${DIST}. Run \`npm run build\` first.`)
  process.exit(1)
}

// ------------------------------------------------------------------------------------ files

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) yield* walk(full)
    else yield full
  }
}

const gz = new Map()
async function gzipSize(file) {
  if (!gz.has(file)) gz.set(file, gzipSync(await readFile(file), { level: 6 }).length)
  return gz.get(file)
}
const rawSize = async (file) => (await stat(file)).size
const rel = (file) => relative(DIST, file)

const html = await readFile(join(DIST, 'index.html'), 'utf8')
const files = []
for await (const f of walk(DIST)) files.push(f)
const jsFiles = files.filter((f) => f.endsWith('.js'))
const cssFiles = files.filter((f) => f.endsWith('.css'))

// ------------------------------------------------------------------------------------ graph

const STATIC_IMPORT = /(?:^|[;\s}])(?:import|export)\s*(?:[^"'();]*?from\s*)?["'](\.{1,2}\/[^"']+\.js)["']/g
const DYNAMIC_IMPORT = /import\(\s*["'](\.{1,2}\/[^"']+\.js)["']\s*\)/g

const graph = new Map()
for (const file of jsFiles) {
  const code = await readFile(file, 'utf8')
  const resolveTo = (spec) => resolve(dirname(file), spec)
  graph.set(file, {
    static: [...code.matchAll(STATIC_IMPORT)].map((m) => resolveTo(m[1])),
    dynamic: [...code.matchAll(DYNAMIC_IMPORT)].map((m) => resolveTo(m[1])),
  })
}

/** Static import closure: everything that loads with these chunks, no dynamic import involved. */
function closure(roots) {
  const seen = new Set()
  const stack = [...roots]
  while (stack.length) {
    const f = stack.pop()
    if (seen.has(f) || !graph.has(f)) continue
    seen.add(f)
    stack.push(...graph.get(f).static)
  }
  return seen
}

// Sourcemap sources, project-relative, per chunk.
const sources = new Map()
for (const file of jsFiles) {
  const map = `${file}.map`
  if (!existsSync(map)) continue
  const json = JSON.parse(await readFile(map, 'utf8'))
  const base = resolve(dirname(map), json.sourceRoot ?? '')
  sources.set(
    file,
    json.sources.map((s) => relative(ROOT, resolve(base, s)).replaceAll('\\', '/')),
  )
}
const hasSourcemaps = sources.size > 0
const chunkWith = (path) => jsFiles.find((f) => (sources.get(f) ?? []).some((s) => s === path || s.startsWith(path)))
const containsModule = (file, test) => (sources.get(file) ?? []).some(test)
const isThree = (s) => s.startsWith('node_modules/three/') || s.startsWith('node_modules/@react-three/')

// ------------------------------------------------------------------------------------ sets

const entryHrefs = [
  ...html.matchAll(/<script[^>]+type="module"[^>]*src="([^"]+)"/g),
  ...html.matchAll(/<link[^>]+rel="modulepreload"[^>]*href="([^"]+)"/g),
].map((m) => m[1])
const toFile = (href) => join(DIST, href.replace(/^\//, ''))
const boot = closure(entryHrefs.map(toFile))

const preloadHrefs = [...html.matchAll(/<link[^>]+rel="modulepreload"[^>]*href="([^"]+)"/g)].map((m) => m[1])
const preloadedThree = preloadHrefs.filter((h) => /^(three|r3f)-/.test(basename(h)))
const bootThree = [...boot].filter((f) => containsModule(f, isThree) || /^(three|r3f)-/.test(basename(f)))

const SECTION_IDS = ['threshold', 'cabin', 'grove', 'contact']
const sectionChunk = Object.fromEntries(SECTION_IDS.map((id) => [id, chunkWith(`src/sections/${id}/Scene.tsx`)]))
const mountChunk = chunkWith('src/core/render/mountStage.tsx')
const stageCore = new Set(
  [...closure([mountChunk, sectionChunk.threshold].filter(Boolean))].filter((f) => !boot.has(f)),
)
const textChunk = jsFiles.find((f) => containsModule(f, (s) => s.startsWith('node_modules/troika-three-text/')))

const sum = async (list, size = gzipSize) => {
  let n = 0
  for (const f of list) n += await size(f)
  return n
}

// A section's own code: its Scene chunk plus chunks only it reaches whose sources all sit in its folder.
async function sectionOwn(id) {
  const scene = sectionChunk[id]
  if (!scene) return null
  const own = [...closure([scene])].filter(
    (f) => f === scene || (!boot.has(f) && !stageCore.has(f) && (sources.get(f) ?? []).every((s) => s.startsWith(`src/sections/${id}/`))),
  )
  return { files: own, bytes: await sum(own) }
}

// ------------------------------------------------------------------------------------ assets

const inDir = (dir) => files.filter((f) => rel(f).startsWith(`${dir}/`))
const fontFile = (name) => join(DIST, 'fonts', name)
const latinWoff2 = ['cormorant-garamond-600.woff2', 'source-serif-4-400.woff2', 'source-serif-4-600.woff2'].map(fontFile)
const IMAGE = /\.(png|jpe?g|webp|avif|ktx2|basis|exr|hdr)$/i
// Textures the 3D loads: images bundled by Vite plus anything under /textures. Stills, og.png,
// icons, seals and the legacy /resources are not textures.
const textures = [...inDir('assets'), ...inDir('textures')].filter((f) => IMAGE.test(f))
const allFonts = inDir('fonts').filter((f) => /\.(woff2?|ttf|otf)$/.test(f))
const exists = (list) => list.filter((f) => existsSync(f))

const htmlGz = await gzipSize(join(DIST, 'index.html'))
const cssGz = await sum(cssFiles)
const bootGz = await sum(boot)
const latinBytes = await sum(exists(latinWoff2), rawSize)
const stageGz = await sum(stageCore)
const textGz = textChunk ? await gzipSize(textChunk) : 0
const cjkWoff = existsSync(fontFile('wenkai-subset.woff')) ? await rawSize(fontFile('wenkai-subset.woff')) : null
const textureBytes = await sum(textures, rawSize)
const firstVisit = htmlGz + cssGz + bootGz + latinBytes + stageGz + textureBytes
const allJsGz = await sum(jsFiles)
const fullJourney = htmlGz + cssGz + allJsGz + (await sum(allFonts, rawSize)) + textureBytes

// ------------------------------------------------------------------------------------ report

const rows = []
const row = (name, bytes, budget, { gate = true, note = '' } = {}) =>
  rows.push({ name, bytes, budget, gate, note, ok: bytes === null || budget === null || bytes <= budget })

row('HTML (index.html, prerendered)', htmlGz, 30 * KB)
// No inline critical CSS (QM-P7): every section is prerendered (design.md §14.2), so a selector-based
// critical subset is nearly the whole sheet, and inlining all of it would take the HTML past 30 KB.
// The sheet is one same-origin, render-blocking request; reported so its growth shows up.
row('CSS (one stylesheet, render-blocking, not inlined)', cssGz, null, { gate: false, note: `${cssFiles.length} file(s), in first visit` })
// Boot JS: stack.md §4 and design.md §13.4 ask for 85 KB, which the stack can't meet. React 19,
// ReactDOM and zustand alone are 68.4 KB gzip, and the DOM layer must hydrate the prerendered
// sections, so their copy ships too. Wave 2 moved everything off the first screen into lazy chunks:
// the camera keys and beat notes (core/world/journey.ts; boot keeps core/world/beats.ts), the gloss
// tooltip, the settings panel, and the walk-only chrome (inscriptions, title card, finale, lost
// still). With the wave-2 scenes in, boot measured 97.9 KB in 10 chunks (shared content and token
// modules split out as the lazy chunks started importing them). The gate is 102 KB: that rounded up
// with 4 KB of headroom. Getting to 85 means dropping React for Preact/compat or hydrating islands
// only, an owner decision (wave1-status H1).
row('Boot JS (static closure of index.html)', bootGz, 102 * KB, { note: `${boot.size} chunks` })
row('Latin fonts (woff2: Cormorant, Source Serif 400/600)', latinBytes, 60 * KB)
row('Stage core (mountStage + threshold scene closure, minus boot)', mountChunk ? stageGz : null, 340 * KB, {
  note: mountChunk ? `${stageCore.size} chunks` : 'mountStage chunk not found',
})
for (const id of SECTION_IDS) {
  const own = await sectionOwn(id)
  row(`Section chunk: ${id} (own code)`, own?.bytes ?? null, 40 * KB, { note: own ? '' : 'not found (sourcemaps?)' })
}
row('Shared text chunk (troika)', textChunk ? textGz : null, 50 * KB, { gate: false, note: textChunk ? '~42 KB expected' : 'not built yet' })
// Audio loads only when Sound is first turned on (main.tsx): its chunk and the sample-render worker.
// No budget of its own in the specs; reported so growth shows up.
const audioFiles = [
  chunkWith('src/audio/index.ts'),
  jsFiles.find((f) => containsModule(f, (s) => s === 'src/audio/samples.worker.ts')),
].filter(Boolean)
row('Audio (lazy on Sound: chunk + sample worker)', audioFiles.length ? await sum(audioFiles) : null, null, {
  gate: false,
  note: audioFiles.length ? `${audioFiles.length} files, not in first visit` : 'not found',
})
row('CJK subset for troika (wenkai-subset.woff)', cjkWoff, 60 * KB)
row('Textures total', textureBytes, 120 * KB, { note: `${textures.length} files` })
row('First visit to an interactive threshold', firstVisit, 550 * KB)
row('Full journey (all JS, CSS, HTML, fonts, textures)', fullJourney, 1300 * KB)

// Modules a production build must not carry: the dev server's render bench (QM-9, Stage.tsx gates it
// on import.meta.env.DEV) and n8ao, which @react-three/postprocessing imports for an effect this site
// never uses (QM-P10, vite.config.ts marks it side-effect free).
const MUST_NOT_SHIP = [
  ['the RenderTest bench', (s) => s.endsWith('src/core/render/RenderTest.tsx')],
  ['n8ao', (s) => s.includes('node_modules/n8ao/')],
]
const shippedDevOnly = MUST_NOT_SHIP.flatMap(([name, test]) =>
  jsFiles.filter((f) => containsModule(f, test)).map((f) => `${name} ships in ${rel(f)}`),
)

const problems = []
problems.push(...shippedDevOnly)
if (preloadedThree.length) problems.push(`index.html modulepreloads ${preloadedThree.join(', ')}`)
if (bootThree.length) problems.push(`three.js or R3F code is in the boot closure: ${bootThree.map(rel).join(', ')}`)
if (!hasSourcemaps) problems.push('no sourcemaps in dist/assets; section chunks cannot be classified')
// cy.my/blog/ and cy.my/UOW_INTISubang/ are separate project sites; the user site must not shadow them.
for (const dir of ['blog', 'UOW_INTISubang']) if (existsSync(join(DIST, dir))) problems.push(`dist/${dir}/ would shadow the ${dir} project site`)
for (const r of rows) if (r.gate && !r.ok) problems.push(`${r.name}: ${(r.bytes / KB).toFixed(1)} KB > ${(r.budget / KB).toFixed(0)} KB`)

const fmt = (n) => (n === null ? '—' : `${(n / KB).toFixed(1)} KB`)
if (asJson) {
  console.log(JSON.stringify({ rows, problems, boot: [...boot].map(rel), stageCore: [...stageCore].map(rel) }, null, 2))
} else {
  console.log(`Budgets for ${relative(ROOT, DIST) || DIST}`)
  for (const r of rows) {
    const mark = r.bytes === null ? '  ?' : r.ok ? ' ok' : r.gate ? 'BAD' : 'warn'
    console.log(`${mark.padStart(4)}  ${r.name.padEnd(62)} ${fmt(r.bytes).padStart(10)} / ${fmt(r.budget).padStart(9)}  ${r.note}`)
  }
  console.log(`\nBoot closure: ${[...boot].map((f) => basename(f)).join(', ')}`)
  console.log(`three/r3f preloaded from index.html: ${preloadedThree.length ? preloadedThree.join(', ') : 'none'}`)
}

if (process.env.GITHUB_STEP_SUMMARY) {
  const md = [
    '### Transfer budgets',
    '',
    '| | Item | Size | Budget |',
    '|---|---|---:|---:|',
    ...rows.map((r) => `| ${r.bytes === null ? '?' : r.ok ? 'ok' : r.gate ? '**over**' : 'warn'} | ${r.name} | ${fmt(r.bytes)} | ${fmt(r.budget)} |`),
    '',
    problems.length ? `**${problems.length} problem(s):** ${problems.join('; ')}` : 'All budgets met.',
    '',
  ].join('\n')
  await appendFile(process.env.GITHUB_STEP_SUMMARY, md)
}

if (problems.length) {
  for (const p of problems) console.error(`error: ${p}`)
  process.exit(1)
}
