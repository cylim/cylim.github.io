import { describe, expect, it } from 'vitest'
import { GRAIN_SIZE, getPaperGrain } from '../core/render/textures/paperGrain'
import { environmentMounted, environmentMounting, whenEnvironmentMounted } from './mountGate'
import { forestPlan, type ForestPlan } from './pines/forest'
import { NEEDLE_ATLAS_SIZE, needleAtlasTexture } from './pines/needleAtlas'
import { applyPrepared, prepareEnvironment } from './prepare'

// QM-P3: what the workers build is what the first render uses, so nothing is rebuilt on the main thread.
describe('stage preparation', () => {
  it('primes the forest plan, the needle atlas and the paper grain', () => {
    const plan: ForestPlan = { pines: [], groveCount: 0 }
    const needles = new Uint8Array(NEEDLE_ATLAS_SIZE.width * NEEDLE_ATLAS_SIZE.height * 2).fill(7)
    const grain = new Uint8Array(GRAIN_SIZE * GRAIN_SIZE * 4).fill(9)
    applyPrepared({ job: 'forest', forest: plan })
    applyPrepared({ job: 'needles', texels: needles })
    applyPrepared({ job: 'grain', texels: grain })
    expect(forestPlan()).toBe(plan)
    expect(needleAtlasTexture().image.data).toBe(needles)
    expect(getPaperGrain().image.data).toBe(grain)
  })

  it('ignores a failed job, and never rejects without workers', async () => {
    expect(() => applyPrepared({ job: 'needles', texels: null })).not.toThrow()
    expect(() => applyPrepared({ job: 'forest', forest: null })).not.toThrow()
    // Node has no Worker: the render then builds everything itself, as before.
    await expect(prepareEnvironment()).resolves.toBeUndefined()
  })
})

describe('environment mount gate', () => {
  it('holds until the last layer is in', async () => {
    let open = false
    environmentMounting()
    const gate = whenEnvironmentMounted().then(() => (open = true))
    await Promise.resolve()
    expect(open).toBe(false)
    environmentMounted()
    await gate
    expect(open).toBe(true)
  })
})
