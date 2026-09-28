#!/usr/bin/env node
// Screenshot a running dev server at hashes or scroll positions, for visual checks while building.
// Chromium's CLI `--screenshot` returns a blank frame for any scrolled page, so this drives
// Playwright instead.
//
//   node scripts/dev-shot.mjs --port 5199 --out /tmp/cy-me [--size 1280x800] [--wait 1500] [--query 'e2e=1&tier=high'] \
//     '#cabin' '#grove' 'jvh:120' 'jvh:742' '/?mode=static'
//
// Targets: '#hash' (fresh load with that hash), 'jvh:N' (load, then scroll to journey position N),
// or a path with its own query. Prints window.__cy state (with e2e=1) and page errors per shot.
// Owner: tooling.

import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'

const args = process.argv.slice(2)
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  if (i < 0) return fallback
  const [value] = args.splice(i, 2).slice(1)
  return value ?? fallback
}
const port = opt('port', '5173')
const out = opt('out', '/tmp/cy-shots')
const [width, height] = opt('size', '1280x800').split('x').map(Number)
const wait = Number(opt('wait', '1500'))
const query = opt('query', 'e2e=1&tier=high')
const targets = args.length ? args : ['#top']

await mkdir(out, { recursive: true })
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--hide-scrollbars'],
})
const page = await browser.newPage({ viewport: { width, height } })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))

for (const [i, target] of targets.entries()) {
  errors.length = 0
  const base = `http://localhost:${port}`
  const jvh = target.startsWith('jvh:') ? Number(target.slice(4)) : null
  const url =
    jvh !== null ? `${base}/?${query}` : target.startsWith('#') ? `${base}/?${query}${target === '#top' ? '' : target}` : `${base}${target}`
  await page.goto('about:blank')
  await page.goto(url, { waitUntil: 'networkidle' })
  if (jvh !== null) {
    await page.evaluate((j) => scrollTo({ top: (j / 1000) * (document.documentElement.scrollHeight - innerHeight), behavior: 'instant' }), jvh)
  }
  await page.waitForTimeout(wait)
  const state = await page.evaluate(() => {
    const s = window.__cy?.state()
    return s ? { jvh: Math.round(s.jvh), active: s.active, stage: s.stage, tier: s.tier, settled: window.__cy.settled } : { mode: document.documentElement.dataset.mode }
  })
  const file = join(out, `${String(i).padStart(2, '0')}-${target.replace(/[^\w]+/g, '_').replace(/^_|_$/g, '') || 'top'}.png`)
  await page.screenshot({ path: file })
  console.log(file, JSON.stringify(state), errors.length ? `ERRORS: ${errors.join(' | ')}` : '')
}
await browser.close()
