import { describe, expect, it } from 'vitest'
import { withCfasyncOff } from '../vite.config.ts'

describe('vite.config: cy:cfasync-off (QM-D3)', () => {
  it("puts data-cfasync back on Vite's entry script and leaves the rest alone", () => {
    const built = [
      '<script data-cfasync="false">;(function(){})()</script>',
      '<script type="application/ld+json">{}</script>',
      '<script type="module" crossorigin src="/assets/index-a.js"></script>',
      '<link rel="modulepreload" crossorigin href="/assets/boot-vendor-b.js">',
    ].join('\n')
    expect(withCfasyncOff(built).split('\n')).toEqual([
      '<script data-cfasync="false">;(function(){})()</script>',
      '<script type="application/ld+json">{}</script>',
      '<script data-cfasync="false" type="module" crossorigin src="/assets/index-a.js"></script>',
      '<link rel="modulepreload" crossorigin href="/assets/boot-vendor-b.js">',
    ])
  })
})
