import { expect, test } from '@playwright/test'
import { GROVE_ON_WALK, NOW, WALK_ARRIVALS, THREE_CHUNK, booted, expectedMode, expectedStaticReason, settled } from './helpers'

// The album, no JavaScript, and the static files that replace Jekyll (design.md §14,
// stack.md §9, §10). Every visitor gets all the content; only the atmosphere is optional.

// These visits skip ?e2e=1 so nothing but the real gates decides the mode.
test.describe('the album', () => {
  test('starts in the right mode and never loads three.js when static', async ({ page }, info) => {
    const threeRequests: string[] = []
    page.on('request', (r) => {
      if (THREE_CHUNK.test(new URL(r.url()).pathname)) threeRequests.push(r.url())
    })
    await page.goto('/')
    await booted(page)
    const mode = expectedMode(info)
    await expect(page.locator('html')).toHaveAttribute('data-mode', mode)
    const reason = expectedStaticReason(info)
    if (reason) await expect(page.locator('html')).toHaveAttribute('data-static-reason', reason)
    if (mode === 'static') {
      expect(threeRequests).toEqual([])
      await expect(page.locator('#stage canvas')).toHaveCount(0)
    }
  })

  test('explains itself with the right banner', async ({ page }, info) => {
    test.skip(expectedMode(info) !== 'static', 'immersive projects have no album banner')
    await page.goto('/')
    await booted(page)
    const noWebgl = info.project.name === 'no-webgl'
    const text = noWebgl ? "Your browser can't draw the forest, so here's the paper version." : 'You asked for less motion, so this is the still version.'
    // The banner is prerendered with every reason's line, and CSS shows the one for <html
    // data-static-reason> (AlbumBanner.tsx). 'nowebgl' and 'error' share their words.
    const line = page.locator(`.album-banner [data-reason="${noWebgl ? 'nowebgl' : 'reduced'}"]`)
    await expect(line).toBeVisible()
    await expect(line).toContainText(text)
    await expect(page.locator('.album-banner [data-reason]:visible')).toHaveCount(1)
    const walk = page.getByRole('button', { name: 'Walk the forest' }).or(page.getByRole('link', { name: 'Walk the forest' }))
    // Walking needs WebGL2: offered to the reduced-motion visitor, never without it.
    if (noWebgl) await expect(walk.first()).toBeHidden()
    else await expect(walk.first()).toBeVisible()
  })

  test('holds every section and exactly one h1', async ({ page }) => {
    await page.goto(`/?mode=static&e2e=1&now=${NOW}`)
    await settled(page)
    await expect(page.locator('html')).toHaveAttribute('data-mode', 'static')
    for (const { id } of WALK_ARRIVALS) {
      await expect(page.locator(`section#${id}`)).toHaveCount(1)
      await expect(page.locator(`#${id}-heading`)).toHaveAttribute('tabindex', '-1')
    }
    // A detour grove joins the page when a jump heads there, not before (src/content/features.ts).
    await expect(page.locator('section#grove')).toHaveCount(GROVE_ON_WALK ? 1 : 0)
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
  })

  test('the saved "Still version" choice wins over a capable browser', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'one project is enough')
    await page.addInitScript(() => localStorage.setItem('cy.prefs', JSON.stringify({ mode: 'static' })))
    await page.goto('/')
    await booted(page)
    await expect(page.locator('html')).toHaveAttribute('data-mode', 'static')
    await expect(page.locator('html')).toHaveAttribute('data-static-reason', 'pref')
  })
})

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false })

  test('the prerendered page has the whole site', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'one project is enough')
    await page.goto('/')
    await expect(page.locator('html')).toHaveAttribute('data-mode', 'static')
    await expect(page.getByRole('heading', { level: 1, name: 'CY Lim' })).toBeVisible()
    for (const { id } of WALK_ARRIVALS) await expect(page.locator(`section#${id} h1, section#${id} h2`).first()).toBeAttached()
    for (const href of ['https://github.com/cylim', 'https://x.com/seewhy', 'https://www.linkedin.com/in/cylim226', 'https://t.me/cyants']) {
      await expect(page.locator(`a[rel~="me"][href="${href}"]`).first()).toBeAttached()
    }
    const html = await page.content()
    // The grove's noscript line, exactly when the grove is on the walk (src/content/features.ts).
    expect(html.includes('The live chart needs JavaScript.')).toBe(GROVE_ON_WALK)
  })
})

// Plain HTTP checks: one project is enough.
test.describe('static files', () => {
  test('the 2018 article still renders at its Jekyll URL', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop')
    const res = await page.goto('/articles/201808-first-year.html')
    expect(res?.status()).toBe(200)
    await expect(page.getByRole('heading', { level: 1, name: 'My first year working in the IT industry' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Back to the edge of the forest' })).toHaveAttribute('href', '/')
  })

  test('404.html leads home', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop')
    const res = await page.goto('/404.html')
    expect(res?.status()).toBe(200)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Back to the edge of the forest' })).toHaveAttribute('href', '/')
  })

  test('carried-over and new files are served', async ({ request }, info) => {
    test.skip(info.project.name !== 'desktop')
    for (const path of [
      '/robots.txt',
      '/sitemap.xml',
      '/CREDITS.txt',
      '/favicon.svg',
      '/favicon.ico',
      '/apple-touch-icon.png',
      '/seals/lin-zhuwen-nav.svg',
      '/fonts/source-serif-4-400.woff2',
      '/fonts/wenkai-subset.woff',
      '/articles/201808-first-year.md',
      '/resources/resume-en.pdf',
      '/resources/profile.json',
      '/CNAME',
    ]) {
      const res = await request.get(path)
      expect(res.status(), path).toBe(200)
    }
    expect(await (await request.get('/robots.txt')).text()).toContain('Sitemap: https://cy.my/sitemap.xml')
  })
})
