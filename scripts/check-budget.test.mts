import { spawnSync } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { ROOT } from './collect-cjk.mjs'

// Runs check-budget.mjs against a tiny synthetic dist/ to pin its hard rules.

const script = new URL('./check-budget.mjs', import.meta.url).pathname
let dist = ''

async function fixture({ preloadThree = false, blog = false, extra = [] as string[] } = {}) {
  dist = await mkdtemp(join(tmpdir(), 'cy-budget-'))
  const assets = join(dist, 'assets')
  await mkdir(assets, { recursive: true })
  const chunk = async (name: string, code: string, sources: string[]) => {
    await writeFile(join(assets, name), code)
    // Real maps point back into the repo; absolute paths do the same from a temp dir.
    const abs = sources.map((src) => join(ROOT, src))
    await writeFile(join(assets, `${name}.map`), JSON.stringify({ version: 3, sources: abs, mappings: '' }))
  }
  await chunk('index-a.js', 'import{a as e}from"./boot-vendor-b.js";const m=()=>import("./mountStage-c.js");', ['src/main.tsx'])
  await chunk('boot-vendor-b.js', 'export const a=1;', ['node_modules/react/index.js'])
  await chunk('mountStage-c.js', 'import{T as t}from"./three-d.js";const s=()=>import("./Scene-e.js");', ['src/core/render/mountStage.tsx'])
  await chunk('three-d.js', 'export const T=1;', ['node_modules/three/build/three.module.js'])
  await chunk('Scene-e.js', 'import{T as t}from"./three-d.js";export default 1;', ['src/sections/threshold/Scene.tsx', ...extra])
  const preload = preloadThree ? '<link rel="modulepreload" crossorigin href="/assets/three-d.js">' : ''
  await writeFile(
    join(dist, 'index.html'),
    `<!doctype html><html><head><script type="module" crossorigin src="/assets/index-a.js"></script><link rel="modulepreload" crossorigin href="/assets/boot-vendor-b.js">${preload}</head><body></body></html>`,
  )
  if (blog) await mkdir(join(dist, 'blog'))
}

const run = () => spawnSync(process.execPath, [script, '--dist', dist, '--json'], { encoding: 'utf8' })

afterEach(() => rm(dist, { recursive: true, force: true }))

describe('check-budget', () => {
  it('passes a build that keeps three behind a dynamic import', async () => {
    await fixture()
    const res = run()
    expect(res.status, res.stderr).toBe(0)
    const report = JSON.parse(res.stdout) as { boot: string[]; stageCore: string[] }
    expect(report.boot.toSorted()).toEqual(['assets/boot-vendor-b.js', 'assets/index-a.js'])
    expect(report.stageCore.toSorted()).toEqual(['assets/Scene-e.js', 'assets/mountStage-c.js', 'assets/three-d.js'])
  })

  it('fails when index.html modulepreloads three', async () => {
    await fixture({ preloadThree: true })
    const res = run()
    expect(res.status).toBe(1)
    expect(res.stderr).toContain('modulepreloads /assets/three-d.js')
    expect(res.stderr).toContain('three.js or R3F code is in the boot closure')
  })

  it('fails when dist would shadow the /blog project site', async () => {
    await fixture({ blog: true })
    const res = run()
    expect(res.status).toBe(1)
    expect(res.stderr).toContain('dist/blog/ would shadow')
  })

  it('fails when the dev-only render bench or n8ao ships (QM-9, QM-P10)', async () => {
    await fixture({ extra: ['src/core/render/RenderTest.tsx', 'node_modules/n8ao/dist/N8AO.js'] })
    const res = run()
    expect(res.status).toBe(1)
    expect(res.stderr).toContain('the RenderTest bench ships in assets/Scene-e.js')
    expect(res.stderr).toContain('n8ao ships in assets/Scene-e.js')
  })
})
