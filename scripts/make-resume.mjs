#!/usr/bin/env node
// Prints scripts/resume/resume-en.html to public/resources/resume-en.pdf with Chromium, so the
// résumé keeps real, selectable text and the site's own fonts. Rerun after editing the HTML.
//
//   node scripts/make-resume.mjs        (CHROMIUM_PATH overrides the browser, default /usr/bin/chromium)
import { chromium } from 'playwright'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const source = join(ROOT, 'scripts/resume/resume-en.html')
const out = join(ROOT, 'public/resources/resume-en.pdf')

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium' })
try {
  const page = await browser.newPage()
  await page.goto(`file://${source}`, { waitUntil: 'load' })
  await page.evaluate(() => document.fonts.ready)
  await page.pdf({ path: out, format: 'A4', printBackground: true, preferCSSPageSize: true, tagged: true, outline: true })
  console.log(`wrote ${out}`)
} finally {
  await browser.close()
}
