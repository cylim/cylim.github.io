import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { isPruned, pruneDist } from './prune-dist.mjs'

let dist = ''
afterEach(() => rm(dist, { recursive: true, force: true }))

async function fixture(files: Record<string, string>): Promise<void> {
  dist = await mkdtemp(join(tmpdir(), 'cy-prune-'))
  for (const [path, text] of Object.entries(files)) {
    await mkdir(dirname(join(dist, path)), { recursive: true })
    await writeFile(join(dist, path), text)
  }
}

describe('prune-dist (QM-13, QM-D6, CP-7)', () => {
  it('names source maps and the dev notes, and nothing the site loads', () => {
    for (const p of ['assets/index-a.js.map', 'fonts/README.md', 'seals/README.md', 'fonts/wenkai-subset.glyphs.txt', 'stills/stills.json'])
      expect(isPruned(p), p).toBe(true)
    for (const p of [
      'index.html',
      'assets/index-a.js',
      'fonts/wenkai-subset.woff2',
      'fonts/OFL-LXGWWenKai.txt',
      'seals/lin-zhuwen.svg',
      'seals/seals.json',
      'glyphs/mashanzheng.json',
      'stills/T0-1600.avif',
      'CREDITS.txt',
      'articles/201808-first-year.md',
    ])
      expect(isPruned(p), p).toBe(false)
  })

  it('deletes them and keeps the rest', async () => {
    await fixture({
      'index.html': '<script type="module" src="/assets/index-a.js"></script>',
      'assets/index-a.js': 'console.log(1)',
      'assets/index-a.js.map': '{}',
      'fonts/README.md': '#',
      'fonts/wenkai-subset.glyphs.txt': '林',
      'fonts/wenkai-subset.woff2': '',
      'stills/stills.json': '{}',
    })
    const { removed, dangling } = await pruneDist(dist)
    expect(removed.toSorted()).toEqual(['assets/index-a.js.map', 'fonts/README.md', 'fonts/wenkai-subset.glyphs.txt', 'stills/stills.json'])
    expect(dangling).toEqual([])
    expect(existsSync(join(dist, 'assets/index-a.js.map'))).toBe(false)
    expect(existsSync(join(dist, 'assets/index-a.js'))).toBe(true)
    expect(existsSync(join(dist, 'fonts/wenkai-subset.woff2'))).toBe(true)
  })

  it('reports a pruned file the shipped code still points at', async () => {
    await fixture({
      'index.html': '<link rel="stylesheet" href="/assets/a.css">',
      'assets/a.css': '',
      'assets/b.js': 'fetch("/stills/stills.json");\n//# sourceMappingURL=b.js.map',
      'assets/b.js.map': '{}',
      'stills/stills.json': '{}',
    })
    const { dangling } = await pruneDist(dist)
    expect(dangling.toSorted()).toEqual(['assets/b.js → assets/b.js.map', 'assets/b.js → stills/stills.json'])
  })
})
