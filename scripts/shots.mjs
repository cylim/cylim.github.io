#!/usr/bin/env node
// Renders the album stills and og.png from the real scenes (design.md §14.1, stack.md §9, §12).
//
//   npm run build && npm run shots                       serve dist/ with vite preview, write public/
//   node scripts/shots.mjs --url http://localhost:5206   use a running server (dev or preview)
//   node scripts/shots.mjs --out /tmp/stills --beats T0,E1 --no-og
//
// For each beat (T0, C3, I1, E1, E3) it loads `/?still=<beat>&tier=high&now=…`. The app answers
// ?still= by setting `<html data-still=<beat>>`, hiding the content layer, freezing its clocks,
// exposing window.__cy and jumping to stillJvh(beat) (src/main.tsx). The script waits for the stage
// to be live and settled plus a short grace for the last frames. If the app did not take the still
// (no data-still), it scrolls to stillJvh(beat) itself. Anything left over the canvas is hidden.
//
// Outputs (in --out, default public/stills), the file contract of src/content/stills.ts:
//   <beat>-1600.{avif,webp}  landscape 16:10, 1600 × 1000
//   <beat>-800.{avif,webp}   landscape 16:10, 800 × 500
//   <beat>-portrait-800.{avif,webp}  portrait 4:5, 800 × 1000, rendered at a portrait viewport
//   stills.json (file list and byte sizes); ../og.png 1200×630 from T0 unless --no-og.
// Stills are the painting alone: the content layer and everything the finale lays over the canvas
// (colophon, seal, pins) is hidden, because the album sets its own colophon and seal beside the E3
// still. og.png is the link preview, so it adds the name and the hero line on the paper under the
// forest band, with the 白文 林 seal (design-usable.md: "a K0 still with the name").
// AVIF and WebP need sharp (a devDependency); without it the script writes PNGs instead.
// Landscape 1600 files are squeezed under 120 KB by lowering quality.
// Owner: tooling.

import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { chromium } from '@playwright/test'
import { runnerImport } from 'vite'
import { ROOT } from './collect-cjk.mjs'

const args = process.argv.slice(2)
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : fallback
}
const flag = (name) => args.includes(`--${name}`)

const OUT = resolve(ROOT, opt('out', 'public/stills'))
const OG = resolve(OUT, '..', 'og.png')
const BEATS = opt('beats', 'T0,C3,I1,E1,E3').split(',')
const NOW = opt('now', '2026-09-23T11:00:00Z') // fixed so the chart and colophon never differ between runs
const PORT = Number(opt('port', '4180'))
const READY_TIMEOUT = Number(opt('timeout', '45000'))
const MAX_1600 = 120 * 1024
const CHROMIUM = process.env.CHROMIUM_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined)

let sharp = null
try {
  sharp = (await import('sharp')).default
} catch {
  console.warn('sharp is not installed: writing PNG stills instead of AVIF and WebP')
}

// ------------------------------------------------------------------------------------ server

async function waitForHttp(url, ms) {
  const end = Date.now() + ms
  while (Date.now() < end) {
    try {
      const res = await fetch(url)
      if (res.ok) return
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 250))
  }
  throw new Error(`${url} did not come up within ${ms} ms`)
}

let server = null
let base = opt('url', null)
if (!base) {
  if (!existsSync(join(ROOT, 'dist/index.html'))) {
    console.error('No dist/. Run `npm run build` first, or pass --url to use a running server.')
    process.exit(1)
  }
  // Own process group, so stopping it also stops the vite process npx starts.
  server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: ROOT, stdio: 'ignore', detached: true })
  base = `http://localhost:${PORT}`
  await waitForHttp(base, 30_000)
}

// ------------------------------------------------------------------------------------ capture

const { module: journeyModule } = await runnerImport('/src/core/world/journey.ts', { root: ROOT, configFile: false, logLevel: 'error' })
const stillJvh = journeyModule.stillJvh ?? (() => 0)
const { module: siteModule } = await runnerImport('/src/content/site.ts', { root: ROOT, configFile: false, logLevel: 'error' })
const { module: tokensModule } = await runnerImport('/src/theme/tokens.ts', { root: ROOT, configFile: false, logLevel: 'error' })

const browser = await chromium.launch({
  executablePath: CHROMIUM,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--hide-scrollbars'],
})

/**
 * The og.png card: name, hero line and the 白文 林 seal on the meadow's paper under the forest band
 * (the T0 frame keeps its lower third empty mist), over a feathered paper pocket like the walk's cards.
 * Copy and colours come from content and tokens; the fonts are the site's own faces.
 */
async function addOgCard(page) {
  const { hero } = siteModule
  await page.evaluate(
    ({ name, line, color, font }) => {
      const card = document.createElement('div')
      card.id = 'og-card'
      card.innerHTML = `
        <div class="og-pocket"></div>
        <h1><span></span><img src="/seals/lin-baiwen-hero.svg" alt="" width="58" height="58"></h1>
        <p></p>`
      card.querySelector('h1 span').textContent = name
      // One sentence per line: "Full stack since 2017." / "Web and mobile apps, the services behind them, …"
      const p = card.querySelector('p')
      line.split(/(?<=\.) /).forEach((sentence, i) => {
        if (i) p.append(document.createElement('br'))
        p.append(sentence)
      })
      const style = document.createElement('style')
      style.textContent = `
        #og-card { position: fixed; left: 72px; bottom: 46px; z-index: 9999; visibility: visible !important; }
        #og-card * { visibility: visible !important; }
        #og-card .og-pocket { position: absolute; inset: -28px -60px -26px -48px; border-radius: 48px;
          background: ${color.paper}; opacity: 0.72; filter: blur(22px); }
        #og-card h1 { position: relative; display: flex; align-items: center; gap: 22px; margin: 0;
          font: 600 104px/1 ${font.display}; letter-spacing: 0.005em; color: ${color.inkJiao}; }
        #og-card h1 img { display: block; transform: translateY(6px); }
        #og-card p { position: relative; margin: 14px 0 0 3px; white-space: nowrap;
          font: 400 27px/1.35 ${font.body}; color: ${color.inkNong}; }`
      document.head.append(style)
      document.body.append(card)
    },
    { name: hero.name, line: hero.positioning, color: tokensModule.color, font: tokensModule.font },
  )
  await page.evaluate(async () => {
    // Only the seal: the walk's own lazy images never load while hidden.
    const seal = document.querySelector('#og-card img')
    if (seal && !seal.complete) {
      await new Promise((r) => {
        seal.addEventListener('load', r, { once: true })
        seal.addEventListener('error', r, { once: true })
      })
    }
    await document.fonts.ready
  })
}

/** Loads one beat at one viewport and returns a PNG buffer of the painting alone (plus the og card). */
async function capture(beat, width, height, { og = false } = {}) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 })
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(`${base}/?still=${beat}&tier=high&now=${encodeURIComponent(NOW)}`, { waitUntil: 'load' })

  const live = await page
    .waitForFunction(() => window.__cy?.settled === true && window.__cy.state().stage === 'live', null, { timeout: READY_TIMEOUT })
    .then(() => true)
    .catch(() => false)
  if (!live) console.warn(`  ${beat}: stage never went live (stage=${await page.evaluate(() => window.__cy?.state().stage)})`)

  const taken = await page.evaluate((b) => document.documentElement.dataset.still === b, beat)
  if (!taken) {
    // The app ignored ?still=: scroll the walk to the beat and let the rig settle.
    const jvh = stillJvh(beat)
    await page.evaluate((j) => {
      const range = document.documentElement.scrollHeight - innerHeight
      scrollTo({ top: (j / 1000) * range, behavior: 'instant' })
    }, jvh)
    await page.waitForFunction(() => window.__cy?.settled === true, null, { timeout: READY_TIMEOUT }).catch(() => {})
    await page.waitForTimeout(2500)
    console.warn(`  ${beat}: the app did not take ?still=; scrolled to jvh ${jvh} instead`)
  }
  await page.waitForTimeout(1500) // shader warm-up and the post chain's first full frames

  // Descendants too: the finale's colophon, seal and pins set `visibility: visible` themselves, and
  // a hidden parent does not hide a child that does that.
  await page.addStyleTag({
    content: 'body > :not(#stage):not(#og-card), body > :not(#stage):not(#og-card) * { visibility: hidden !important; }',
  })
  if (og) await addOgCard(page)
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
  const png = await page.screenshot({ type: 'png' })
  if (errors.length) console.warn(`  ${beat}: page errors: ${errors.join(' | ')}`)
  await page.close()
  return png
}

async function encode(png, width, height, stem, cap) {
  const written = []
  if (!sharp) {
    await writeFile(join(OUT, `${stem}.png`), png)
    return [{ file: `${stem}.png`, bytes: png.length }]
  }
  const resized = sharp(png).resize(width, height, { fit: 'cover' })
  for (const [ext, start, floor] of [
    ['avif', 55, 25],
    ['webp', 78, 40],
  ]) {
    const limit = cap ?? Infinity
    let q = start
    let buf
    do {
      buf = await resized.clone()[ext]({ quality: q, effort: ext === 'avif' ? 6 : 5 }).toBuffer()
      q -= 5
    } while (buf.length > limit && q >= floor)
    if (cap && buf.length > cap) console.warn(`  ${stem}.${ext} is ${(buf.length / 1024).toFixed(0)} KB, over ${cap / 1024} KB at the lowest quality`)
    await writeFile(join(OUT, `${stem}.${ext}`), buf)
    written.push({ file: `${stem}.${ext}`, bytes: buf.length })
  }
  return written
}

await mkdir(OUT, { recursive: true })
const manifest = {}
try {
  for (const beat of BEATS) {
    console.log(`${beat}`)
    // Portrait is its own render, not a crop: the rig reframes for portrait (design.md §6.4).
    const landscape = await capture(beat, 1600, 1000)
    const portrait = await capture(beat, 800, 1000)
    manifest[beat] = [
      ...(await encode(landscape, 1600, 1000, `${beat}-1600`, MAX_1600)),
      ...(await encode(landscape, 800, 500, `${beat}-800`)),
      ...(await encode(portrait, 800, 1000, `${beat}-portrait-800`)),
    ]
    for (const f of manifest[beat]) console.log(`  ${f.file.padEnd(24)} ${(f.bytes / 1024).toFixed(1)} KB`)
  }
  if (!flag('no-og')) {
    const og = await capture('T0', 1200, 630, { og: true })
    // Palette PNG with dithering: a quarter of the size of full-colour, and ink wash bands little.
    await writeFile(OG, sharp ? await sharp(og).png({ palette: true, quality: 90, dither: 1, compressionLevel: 9 }).toBuffer() : og)
    console.log(`og.png 1200×630 → ${OG}`)
  }
  await writeFile(join(OUT, 'stills.json'), `${JSON.stringify({ now: NOW, beats: manifest }, null, 2)}\n`)
} finally {
  await browser.close()
  if (server) process.kill(-server.pid, 'SIGTERM')
}
