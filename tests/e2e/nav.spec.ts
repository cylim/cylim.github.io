import { expect, test } from '@playwright/test'
import { GROVE, NOW, settled } from './helpers'

// The jump nav, skip link, home mark and contact links (design.md §4, §8.7, §15).

const PLACES = [
  { name: /^Work\b/, href: '#cabin', id: 'cabin' },
  ...(GROVE ? [{ name: /^Grove\b/, href: '#grove', id: 'grove' } as const] : []),
  { name: /^Contact\b/, href: '#contact', id: 'contact' },
] as const

test.beforeEach(async ({ page }) => {
  await page.goto(`/?e2e=1&tier=medium&now=${NOW}`)
  await settled(page)
})

test('the skip link is the first stop and targets #content', async ({ page }, info) => {
  test.skip(info.project.name === 'mobile', 'no Tab key on a phone')
  await page.keyboard.press('Tab')
  const skip = page.getByRole('link', { name: 'Skip to content' })
  await expect(skip).toBeFocused()
  await expect(skip).toHaveAttribute('href', '#content')
  await expect(skip).toBeVisible()
  await expect(page.locator('main#content')).toHaveCount(1)
})

test('one jump nav with plain-word links to the places', async ({ page }) => {
  const nav = page.getByRole('navigation', { name: 'Jump to a place' })
  await expect(nav).toHaveCount(1)
  // The places (Top is the bare path); no Grove while it is paused (src/content/features.ts).
  await expect(nav.locator('a[href^="#"]')).toHaveCount(PLACES.length)
  await expect(nav.getByRole('link', { name: /^Grove\b/ })).toHaveCount(GROVE ? 1 : 0)
  for (const place of PLACES) {
    const link = nav.getByRole('link', { name: place.name })
    await expect(link).toBeVisible()
    await expect(link).toHaveAttribute('href', place.href)
    expect(await link.getAttribute('data-jump'), `${place.href} is a fog-dive link`).not.toBeNull()
    const box = await link.boundingBox()
    expect(box, `${place.href} has a box`).not.toBeNull()
    expect(box!.width).toBeGreaterThanOrEqual(44)
    expect(box!.height).toBeGreaterThanOrEqual(44)
  }
})

for (const place of PLACES) {
  test(`jumping to ${place.id} lands, focuses the heading and marks the nav`, async ({ page }) => {
    const link = page.getByRole('navigation', { name: 'Jump to a place' }).getByRole('link', { name: place.name })
    await link.click()
    await expect(page).toHaveURL(new RegExp(`${place.href}$`))
    await settled(page)
    await expect(page.locator(`#${place.id}`)).toBeInViewport()
    await expect(page.locator(`#${place.id}-heading`)).toBeFocused()
    await expect(link).toHaveAttribute('aria-current', 'location')
    expect(await page.evaluate(() => window.__cy?.state().active)).toBe(place.id)
  })
}

test('the home mark goes back to the edge of the forest', async ({ page }, info) => {
  await page.goto(`/?e2e=1&tier=medium&now=${NOW}${GROVE ? '#grove' : '#contact'}`)
  await settled(page)
  // Under 768 px the home mark hides and "Top" leads the bottom bar (design.md §4.2).
  const home =
    info.project.name === 'mobile'
      ? page.getByRole('navigation', { name: 'Jump to a place' }).getByRole('link', { name: /^Top\b/ })
      : page.getByRole('link', { name: 'CY Lim, back to the edge of the forest' })
  await home.click()
  await settled(page)
  await expect(page.locator('#threshold')).toBeInViewport()
  expect(await page.evaluate(() => window.__cy?.state().active)).toBe('threshold')
})

test('contact is social links only, each rel="me"', async ({ page }) => {
  const contact = page.locator('#contact')
  const expected = [
    ['GitHub', 'https://github.com/cylim'],
    ['X', 'https://x.com/seewhy'],
    ['LinkedIn', 'https://www.linkedin.com/in/cylim226'],
  ] as const
  for (const [label, href] of expected) {
    const link = contact.locator(`a[href="${href}"]`).first()
    await expect(link).toContainText(label)
    await expect(link).toHaveAttribute('rel', /\bme\b/)
  }
  await expect(contact.locator('form')).toHaveCount(0)
  await expect(contact.locator('a[href^="mailto:"]')).toHaveCount(0)
})

test('name, role and the social links are on the first screen', async ({ page }) => {
  await expect(page.getByRole('heading', { level: 1, name: 'CY Lim' })).toBeInViewport()
  await expect(page.locator('#threshold a[href="https://github.com/cylim"]').first()).toBeAttached()
})
