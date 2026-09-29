import type { Page, TestInfo } from '@playwright/test'
import { features } from '../../src/content/features'

/**
 * The grove's mode (src/content/features.ts); the specs follow the site. Reachable: a nav item and a
 * working #grove link (on the walk, or a detour the dive joins). On the walk: a fresh load has it.
 */
export const GROVE_MODE = features.grove
export const GROVE_REACHABLE = GROVE_MODE !== 'off'
export const GROVE_ON_WALK = GROVE_MODE === 'walk'

/** Fixed chart time, so the grove and colophon render the same on every run. */
export const NOW = '2026-01-01T04:00:00Z'

/** Section ids in walk order with their deep-link hashes (design.md §6.2). The grove while it is reachable. */
export const ARRIVALS = [
  { id: 'threshold', hash: '' },
  { id: 'cabin', hash: '#cabin' },
  ...(GROVE_REACHABLE ? [{ id: 'grove', hash: '#grove' } as const] : []),
  { id: 'contact', hash: '#contact' },
] as const

/** The sections a fresh load has, in walk order: the grove only while it is on the walk. */
export const WALK_ARRIVALS = ARRIVALS.filter((a) => a.id !== 'grove' || GROVE_ON_WALK)

/** Journey length in jvh on a fresh load: 1000, or 783 with the grove's 217 jvh cut (src/core/world/beats.ts). */
export const JOURNEY_END = GROVE_ON_WALK ? 1000 : 783

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
