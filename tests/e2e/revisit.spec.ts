import { expect, test } from '@playwright/test'
import { GROVE, NOW, expectedMode, settled } from './helpers'

// An <Activity> hide keeps a section's GPU resources warm (stack.md §4); only a real unmount frees
// them (sections/shared/lifetime.ts). wave3c QM-1 / QM-P1: the grove chart lost every glyph after
// G3 → E3 → G3, because its dispose ran on the hide. QM-2 / QM-P6: every revisit recompiled shaders.

test('the grove chart keeps its glyphs and shaders across a hide and show', async ({ page }, info) => {
  test.skip(expectedMode(info) !== 'immersive', 'the walk only')
  test.skip(!GROVE, 'the grove is paused (src/content/features.ts)')
  test.setTimeout(120_000)
  // Count programs deleted on the page's own canvas (troika's SDF canvas is detached, so it's left out).
  await page.addInitScript(() => {
    const counts = { deleteProgram: 0 }
    Object.assign(window, { cyGlDeletes: counts })
    const orig = WebGL2RenderingContext.prototype.deleteProgram
    WebGL2RenderingContext.prototype.deleteProgram = function (this: WebGL2RenderingContext, p: WebGLProgram | null) {
      if ((this.canvas as HTMLCanvasElement).parentElement) counts.deleteProgram++
      return orig.call(this, p)
    }
  })
  await page.goto(`/?e2e=1&tier=high&now=${NOW}#grove`)
  await settled(page, 60_000)

  const stats = () => page.evaluate(() => window.__cy?.renderStats?.() ?? null)
  const go = async (jvh: number) => {
    await page.evaluate((j) => window.__cy?.scrollToJvh(j), jvh)
    await settled(page, 60_000)
  }
  const at = async (jvh: number) => {
    await go(jvh)
    // The frame governor stops the loop once the scene is still, so the counters can freeze on a frame
    // from the arrival (deep-link paper, fades) when frames are slow. A one-unit nudge after the arrival
    // settles makes the stage draw the steady scene again before it is counted.
    await page.waitForTimeout(1000)
    await go(jvh - 1)
    await go(jvh)
    // Fades and the first frames after an arrival draw extra (slowly, under parallel SwiftShader
    // workers): read the counters once three reads in a row agree.
    let last = await stats()
    for (let agree = 0, i = 0; agree < 2 && i < 40; i++) {
      await page.waitForTimeout(500)
      const next = await stats()
      agree = next?.calls === last?.calls ? agree + 1 : 0
      last = next
    }
    return last
  }

  const first = await at(790)
  expect(first).not.toBeNull()
  await at(995)
  const again = await at(790)
  await at(18)
  const third = await at(790)

  expect(again?.calls, 'G3 draw calls after G3 → E3 → G3').toBe(first?.calls)
  expect(third?.calls, 'G3 draw calls after G3 → T0 → G3').toBe(first?.calls)
  expect(await page.evaluate(() => (window as unknown as { cyGlDeletes: { deleteProgram: number } }).cyGlDeletes.deleteProgram)).toBe(0)
})
