import type { Page, TestInfo } from '@playwright/test'

/** Fixed chart time, so the grove and colophon render the same on every run. */
export const NOW = '2026-01-01T04:00:00Z'

/** Section ids in walk order with their deep-link hashes (design.md §6.2). */
export const ARRIVALS = [
  { id: 'threshold', hash: '' },
  { id: 'cabin', hash: '#cabin' },
  { id: 'grove', hash: '#grove' },
  { id: 'contact', hash: '#contact' },
] as const

/**
 * The mode a project should boot in (design.md §13.2, src/core/boot/mode.ts). No WebGL2 and
 * prefers-reduced-motion both pick the album. `?e2e=1` only relaxes the performance-caveat probe
 * (SwiftShader fails it); `?mode=immersive` and `?still=` are what skip the soft gates.
 */
export function expectedMode(info: TestInfo): 'static' | 'immersive' {
  return info.project.name === 'no-webgl' || info.project.name === 'reduced-motion' ? 'static' : 'immersive'
}

/** Why the album shows, as recorded on `<html data-static-reason>` (content/ui.ts AlbumReason). */
export function expectedStaticReason(info: TestInfo): string | null {
  if (info.project.name === 'no-webgl') return 'nowebgl'
  if (info.project.name === 'reduced-motion') return 'reduced'
  return null
}

/** Lets a page without `?e2e=1` finish booting: the mode is final once the idle stage import has had its chance. */
export async function booted(page: Page): Promise<void> {
  await page.waitForLoadState('load')
  await page.waitForTimeout(1500)
}

/** Waits for `window.__cy.settled`: no dive running and the active section ready (?e2e=1 only). */
export async function settled(page: Page, timeout = process.env.CI ? 120_000 : 30_000): Promise<void> {
  await page.waitForFunction(() => window.__cy?.settled === true, null, { timeout })
}

/** Chunks that must never load in the album: three.js and R3F (stack.md §2, §4). */
export const THREE_CHUNK = /\/assets\/(three|r3f)-[\w-]+\.js$/
