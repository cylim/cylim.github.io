import { afterEach, describe, expect, it, vi } from 'vitest'
import { Vector3 } from 'three'
import type { GroveMode } from './content/features'

/**
 * A detour visit joins the grove walk at runtime (core/world/walk.ts `joinGroveWalk`). Every table built from
 * the walk must then be exactly what a load with the grove on the walk builds: each walk-dependent
 * module is loaded fresh in both modes, the detour joins, and the two are compared. A module that
 * caches a walk table without registering a rebuild shows up here as a difference.
 */

const GRID = Array.from({ length: 201 }, (_, i) => i * 5)
const idle = { phase: 'idle', amount: 0, to: null, waiting: false } as const

async function load(mode: GroveMode) {
  vi.resetModules()
  vi.doMock('./content/features', () => ({ features: { grove: mode } }))
  const [walk, journey, ids, registry, store, path, framing, rig, postFx, cues, mix, triggers, cards, inscriptions, finale] =
    await Promise.all([
      import('./core/world/walk'),
      import('./core/world/journey'),
      import('./core/sections/ids'),
      import('./core/sections/registry'),
      import('./core/store/journey'),
      import('./core/camera/path'),
      import('./core/camera/framing'),
      import('./core/camera/rig'),
      import('./core/render/post/postFx'),
      import('./audio/cues'),
      import('./audio/mix'),
      import('./audio/triggers'),
      import('./dom/cards'),
      import('./dom/chrome/Inscriptions'),
      import('./sections/contact/finale'),
    ])
  const snapshot = () => {
    const vp = { width: 1280, height: 800, header: 72 }
    const camera = [false, true].map((portrait) => {
      const p = path.buildCameraPath({ portrait, hFit: 34 })
      const at = new Vector3()
      return GRID.map((jvh) => [...p.pos.sample(jvh, at).toArray(), ...p.look.sample(jvh, at).toArray()])
    })
    return {
      beats: {
        GROVE_ON: journey.GROVE_ON,
        GROVE_GAP: journey.GROVE_GAP,
        J: journey.J,
        SECTION_SPANS: journey.SECTION_SPANS,
        SCENE_SPANS: journey.SCENE_SPANS,
        BEAT_SPANS: journey.BEAT_SPANS,
        BEAT_IDS: journey.BEAT_IDS,
        HOLD_EDGES: journey.HOLD_EDGES,
        MARKS: journey.MARKS,
        MIST_WAIT: journey.MIST_WAIT,
        STILLS: journey.STILLS,
        sections: GRID.map(journey.sectionAtJvh),
        scroll: GRID.map(journey.scrollSvh),
      },
      camera: { EMERGE: journey.EMERGE, BEATS: journey.BEATS, PORTRAIT: journey.PORTRAIT, path: camera },
      framing: [false, true].map((portrait) => [framing.shiftXKeys(vp, portrait), framing.shiftYKeys(vp, portrait), framing.fovKeys(portrait, 1.6)]),
      rig: GRID.map((jvh) => rig.mistHoldTarget(jvh, false)),
      post: GRID.map(postFx.understoreyMist),
      ids: { WALK_SECTION_IDS: ids.WALK_SECTION_IDS, grove: ids.walkSection('grove') },
      registry: ids.SECTION_IDS.map((id) => {
        const { spanJvh, span, arrivalJvh, arrivalU, heightSvh } = registry.registry[id]
        return { id, spanJvh, span, arrivalJvh, arrivalU, heightSvh }
      }),
      visible: GRID.map((jvh) => store.visibleSections(jvh / journey.J)),
      audio: {
        BED_SPANS: cues.BED_SPANS,
        CRACKLE_RISE: cues.CRACKLE_RISE,
        SILENCE_AFTER_SEAL: cues.SILENCE_AFTER_SEAL,
        pan: GRID.map(mix.streamPan),
        chime: GRID.map((jvh) => triggers.groveOnScreen({ jvh, dive: idle })),
      },
      cards: cards.CARDS,
      inscriptions: inscriptions.INSCRIPTION_WINDOWS,
      finale: finale.FINALE.mountOpenAt,
    }
  }
  return { walk, store, snapshot }
}

afterEach(() => {
  vi.doUnmock('./content/features')
})

describe('joining the grove walk (a detour, core/world/walk.ts)', () => {
  it('rebuilds every walk table to what a load with the grove on the walk builds', async () => {
    const full = (await load('walk')).snapshot()
    const detour = await load('detour')
    const before = detour.snapshot()
    expect(before.beats.J).toBe(783)
    expect(detour.walk.groveOnWalk()).toBe(false)

    expect(detour.walk.joinGroveWalk()).toBe(true)
    expect(detour.walk.groveOnWalk()).toBe(true)
    const after = detour.snapshot()
    for (const key of Object.keys(full) as (keyof typeof full)[]) expect(after[key], key).toEqual(full[key])
  })

  it('joins once, and never from the walk or with the grove off', async () => {
    const detour = await load('detour')
    expect(detour.walk.joinGroveWalk()).toBe(true)
    expect(detour.walk.joinGroveWalk()).toBe(false)
    expect((await load('walk')).walk.joinGroveWalk()).toBe(false)
    const off = await load('off')
    expect(off.walk.joinGroveWalk()).toBe(false)
    expect(off.walk.groveOnWalk()).toBe(false)
  })

  it('starts the store on the walk the mode names', async () => {
    expect((await load('walk')).store.journey.getState().groveWalk).toBe(true)
    expect((await load('detour')).store.journey.getState().groveWalk).toBe(false)
  })
})
