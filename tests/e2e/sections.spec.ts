import { expect, test } from '@playwright/test'
import { ARRIVALS, GROVE_MODE, GROVE_REACHABLE, JOURNEY_END, NOW, WALK_ARRIVALS, expectedMode, settled } from './helpers'

// Deep links land on each section (stack.md §12, design.md §6.2). Smoke assertions gate CI;
// the @visual screenshots are advisory until CI-made baselines are committed.

for (const { id, hash } of ARRIVALS) {
  test(`arrives at ${id}`, async ({ page }, info) => {
    await page.goto(`/?e2e=1&tier=medium&now=${NOW}${hash}`)
    await settled(page)

    await expect(page.locator(`#${id}`)).toBeInViewport()
    await expect(page.locator(`#${id}-heading`)).toBeAttached()
    expect(await page.evaluate(() => window.__cy?.state().active)).toBe(id)

    const mode = expectedMode(info)
    await expect(page.locator('html')).toHaveAttribute('data-mode', mode)
    if (mode === 'static') await expect(page.locator('#stage canvas')).toHaveCount(0)
    else await expect(page.locator('#stage canvas')).toBeVisible()
  })

  test(`${id} looks right @visual`, async ({ page }) => {
    await page.goto(`/?e2e=1&tier=medium&now=${NOW}${hash}`)
    await settled(page)
    await expect(page).toHaveScreenshot(`${id}.png`, { animations: 'disabled', caret: 'hide' })
  })
}

test('a deep link to #threshold is the top of the walk', async ({ page }) => {
  await page.goto(`/?e2e=1&now=${NOW}#threshold`)
  await settled(page)
  expect(await page.evaluate(() => window.__cy?.state().active)).toBe('threshold')
  await expect(page.locator('#threshold')).toBeInViewport()
})

test('an unknown hash falls back to the threshold', async ({ page }) => {
  await page.goto(`/?e2e=1&now=${NOW}#nowhere`)
  await settled(page)
  expect(await page.evaluate(() => window.__cy?.state().active)).toBe('threshold')
})

test('a deep link to the grove while it is off lands on the lantern', async ({ page }) => {
  test.skip(GROVE_REACHABLE, 'the grove is on the map (src/content/features.ts)')
  await page.goto(`/?e2e=1&now=${NOW}#grove`)
  await settled(page)
  await expect(page).toHaveURL(/#contact$/)
  expect(await page.evaluate(() => window.__cy?.state().active)).toBe('contact')
  await expect(page.locator('#contact')).toBeInViewport()
  await expect(page.locator('#grove')).toHaveCount(0)
})

test('back/forward re-dives', async ({ page }) => {
  await page.goto(`/?e2e=1&now=${NOW}`)
  await settled(page)
  const nav = page.getByRole('navigation', { name: 'Jump to a place' })
  // The grove when it is on the map; else the cabin, the other place before the lantern.
  const [back, name] = GROVE_REACHABLE ? (['grove', /^Grove\b/] as const) : (['cabin', /^Work\b/] as const)
  await nav.getByRole('link', { name }).click()
  await expect(page).toHaveURL(new RegExp(`#${back}$`))
  await settled(page)
  await nav.getByRole('link', { name: /^Contact\b/ }).click()
  await expect(page).toHaveURL(/#contact$/)
  await settled(page)

  await page.goBack()
  await expect(page).toHaveURL(new RegExp(`#${back}$`))
  await settled(page)
  await expect(page.locator(`#${back}-heading`)).toBeFocused()
  expect(await page.evaluate(() => window.__cy?.state().active)).toBe(back)

  await page.goForward()
  await expect(page).toHaveURL(/#contact$/)
  await settled(page)
  await expect(page.locator('#contact-heading')).toBeFocused()
})

test('scrolling through the walk passes every section in order', async ({ page }) => {
  await page.goto(`/?e2e=1&now=${NOW}`)
  await settled(page)
  const jvhs: number[] = []
  // A detour grove is not on the walk a fresh load scrolls through.
  if (GROVE_MODE === 'detour') await expect(page.locator('#grove')).toHaveCount(0)
  for (const { id } of WALK_ARRIVALS) {
    // A section's top is the boundary with the one before it, so step a little way inside.
    await page.locator(`#${id}`).evaluate((el) => {
      el.scrollIntoView({ block: 'start', behavior: 'instant' })
      scrollBy({ top: Math.min(el.getBoundingClientRect().height / 3, innerHeight / 2), behavior: 'instant' })
    })
    // With the real scenes, a section's prewarm can block the main thread for seconds under
    // parallel SwiftShader workers, so give the scroll listener time to run.
    await expect.poll(() => page.evaluate(() => window.__cy?.state().active), { timeout: 20_000 }).toBe(id)
    jvhs.push(await page.evaluate(() => window.__cy?.state().jvh ?? -1))
  }
  await page.evaluate(() => scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }))
  await expect.poll(() => page.evaluate(() => Math.round(window.__cy?.state().jvh ?? -1)), { timeout: 20_000 }).toBe(JOURNEY_END)
  expect(jvhs).toEqual(jvhs.toSorted((a, b) => a - b))
})

test('a detour to the grove puts it on the walk for the rest of the visit', async ({ page }) => {
  test.skip(GROVE_MODE !== 'detour', 'the grove is not a detour (src/content/features.ts)')
  await page.goto(`/?e2e=1&now=${NOW}`)
  await settled(page)
  await expect(page.locator('#grove')).toHaveCount(0)
  await page.getByRole('navigation', { name: 'Jump to a place' }).getByRole('link', { name: /^Grove\b/ }).click()
  await expect(page).toHaveURL(/#grove$/)
  await settled(page)
  await expect(page.locator('#grove')).toBeInViewport()
  await expect(page.locator('#grove-heading')).toBeFocused()
  expect(await page.evaluate(() => window.__cy?.state().active)).toBe('grove')
  // The walk now runs through the grove to the lantern: the full 1000 jvh.
  await page.evaluate(() => scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }))
  await expect.poll(() => page.evaluate(() => Math.round(window.__cy?.state().jvh ?? -1)), { timeout: 20_000 }).toBe(1000)
  await expect.poll(() => page.evaluate(() => window.__cy?.state().active), { timeout: 20_000 }).toBe('contact')
})
