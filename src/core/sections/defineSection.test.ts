import { describe, expect, it } from 'vitest'
import { defineSection } from './defineSection'
import type { SectionSceneModule } from './types'

const base = {
  id: 'grove',
  hash: '#grove',
  label: 'Grove',
  zh: '九宫',
  spanJvh: [640, 860],
  arrivalJvh: 690,
  heightSvh: 220,
  post: 'ink',
} as const

describe('defineSection', () => {
  it('shares one fetch between the lazy Scene, prefetch and prewarm', async () => {
    let calls = 0
    const mod: SectionSceneModule = { default: () => null }
    const def = defineSection({ ...base, load: async () => (calls++, mod) })
    await Promise.all([def.load(), def.load()])
    await def.load()
    expect(calls).toBe(1)
  })

  it('passes a failed load on and does not keep the rejection itself (QM-11)', async () => {
    let calls = 0
    const def = defineSection({
      ...base,
      load: () => (++calls === 1 ? Promise.reject(new Error('chunk')) : Promise.resolve({ default: () => null })),
    })
    await expect(def.load()).rejects.toThrow('chunk')
    await expect(def.load()).resolves.toBeDefined()
    expect(calls).toBe(2)
  })
})
