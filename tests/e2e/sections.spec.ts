import { expect, test } from '@playwright/test'
import { ARRIVALS, GROVE, JOURNEY_END, NOW, expectedMode, settled } from './helpers'

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

test('a deep link to the paused grove lands on the lantern', async ({ page }) => {
  test.skip(GROVE, 'the grove is on (src/content/features.ts)')
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
  // The grove when it is on; else the cabin, the other place before the lantern.
  const [back, name] = GROVE ? (['grove', /^Grove\b/] as const) : (['cabin', /^Work\b/] as const)
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
  for (const { id } of ARRIVALS) {
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
