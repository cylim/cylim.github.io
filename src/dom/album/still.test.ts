import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { stillSrc } from '../../content/stills'
import { breakpoint } from '../../theme/tokens'
import { STILL_SIZES } from './Still'

/**
 * index.html preloads the album's first still for album visits (QM-P5). It can only do that from the
 * head script, so it repeats the files and sizes <Still id="T0" priority> asks for; a preload that
 * picked a different file would download twice. This keeps the two in step.
 */
describe('the album still preload in index.html', () => {
  const html = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../../../index.html'), 'utf8')
  const script = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1] ?? '').find((s) => s.includes('/stills/'))

  it('preloads exactly the sources the T0 <picture> would pick', () => {
    expect(script).toBeDefined()
    expect(script).toContain(`'(max-width: ${breakpoint.desktop - 0.02}px)', '${stillSrc('T0', 800, 'avif', true)}'`)
    expect(script).toContain(`'${stillSrc('T0', 800, 'avif')} 800w, ${stillSrc('T0', 1600, 'avif')} 1600w', '${STILL_SIZES}'`)
  })

  it('only in the album, and only when the visit starts at the top', () => {
    expect(script).toContain(`getAttribute('data-mode') !== 'static'`)
    expect(script).toContain(`location.hash !== '#threshold'`)
  })
})
