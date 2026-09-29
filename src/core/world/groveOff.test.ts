import { describe, expect, it, vi } from 'vitest'
import { Vector3 } from 'three'
import {
  BEATS,
  BEAT_SPANS,
  EMERGE,
  GROVE_GAP,
  J,
  MARKS,
  MIST_CUT,
  MIST_WAIT,
  PORTRAIT,
  SCENE_SPANS,
  SECTION_SPANS,
  STILLS,
  channelKeys,
  sampleScalar,
  scrollSvh,
  sectionAtJvh,
  sectionHeightSvh,
  type Channel,
} from './journey'
import { grove } from './layout'
import { SECTION_IDS, WALK_SECTION_IDS, sectionFromHash, walkSection } from '../sections/ids'
import { registry } from '../sections/registry'
import { visibleSections } from '../store/journey'
import { buildCameraPath } from '../camera/path'
import { mistHoldTarget } from '../camera/rig'
import { shiftXKeys } from '../camera/framing'
import { BED_SPANS } from '../../audio/cues'
import { groveOnScreen } from '../../audio/triggers'
import { hero, meta, nav, terminal, terminalCommands } from '../../content'

// The walk without the grove, as a detour starts it, whatever content/features.ts says today: the
// grove-on walk is pinned by journey.test.ts, path.test.ts and the rest, the switch between them by
// walkSwitch.test.ts, and an off grove's links by groveOffMode.test.ts.
vi.mock('../../content/features', () => ({ features: { grove: 'detour' } }))

describe('the walk without the grove (a detour, content/features.ts)', () => {
  it('cuts the grove beats and moves the exit up by their 217 jvh', () => {
    expect(GROVE_GAP).toBe(217)
    expect(J).toBe(783)
    expect(BEATS.map((b) => b.id).filter((id) => id.startsWith('G'))).toEqual([])
    expect(BEAT_SPANS.map((b) => b.id)).toEqual(BEATS.map((b) => b.id))
    expect(BEATS.find((b) => b.id === 'E0')?.jvh).toEqual([645, 663])
    expect(BEATS.find((b) => b.id === 'E1')?.hold).toEqual([669, 715])
    expect(BEATS.find((b) => b.id === 'E3')?.jvh).toEqual([768, 783])
    expect(MARKS.finaleStart).toBe(718)
    expect(MARKS.sealStamp).toBe(768)
    expect(STILLS.E1).toBe(692)
    expect(STILLS.E3).toBe(783)
    expect(EMERGE.contact.atJvh).toBe(655)
  })

  it('has three sections, tiling 0..J, with the path to the lantern in contact', () => {
    expect(WALK_SECTION_IDS).toEqual(['threshold', 'cabin', 'contact'])
    let at = 0
    for (const id of WALK_SECTION_IDS) {
      const s = SECTION_SPANS[id]
      expect(s.jvh[0], id).toBe(at)
      expect(sectionAtJvh(s.arrivalJvh)).toBe(id)
      at = s.jvh[1]
    }
    expect(at).toBe(J)
    expect(WALK_SECTION_IDS.reduce((n, id) => n + sectionHeightSvh(id), 0)).toBeCloseTo(scrollSvh(J) + 100, 9)
    expect(SECTION_SPANS.contact.arrivalJvh).toBe(669)
    for (const jvh of [572, 600, 640, 700, 782]) expect(sectionAtJvh(jvh)).toBe('contact')
    for (const b of BEATS.filter((x) => x.id.startsWith('P'))) expect(b.section, b.id).toBe('contact')
    expect(BEATS.find((b) => b.id === 'P1')?.zone).toBeNull()
  })

  it('keeps #grove the grove, though it has no span on this walk until a dive joins it', () => {
    expect(sectionFromHash('#grove')).toBe('grove')
    expect(walkSection('grove')).toBe('grove')
    expect(WALK_SECTION_IDS).toEqual(['threshold', 'cabin', 'contact'])
    expect(SECTION_SPANS.grove.jvh).toEqual([572, 572])
    expect(registry.grove.arrivalJvh).toBe(669)
  })

  it('still loads the grove chunk for the path, up to the cut, and the lantern from there', () => {
    expect(SCENE_SPANS.grove).toEqual([572, MIST_CUT])
    expect(SCENE_SPANS.contact).toEqual([MIST_CUT, J])
    expect(registry.grove.spanJvh).toEqual([572, MIST_CUT])
    expect(registry.contact.spanJvh).toEqual([MIST_CUT, J])
    expect(visibleSections(600 / J)).toContain('grove')
    expect(visibleSections(700 / J)).not.toContain('grove')
    expect(SECTION_IDS).toHaveLength(4)
  })

  it('keeps every key in its beat and in order, and cuts only at the moon gate and the mist wall', () => {
    const channels: Channel[] = ['pos', 'look', 'fov', 'fog', 'roll', 'up', 'paper']
    let at = 0
    for (const b of BEATS) {
      expect(b.jvh[0], b.id).toBe(at)
      at = b.jvh[1]
      for (const c of channels) for (const key of b[c]) expect(key.at >= b.jvh[0] && key.at <= b.jvh[1], `${b.id}.${c}`).toBe(true)
    }
    expect(at).toBe(J)
    for (const c of channels) {
      const keys = channelKeys(c)
      for (let i = 1; i < keys.length; i++) expect(keys[i]!.at, `${c} ${i}`).toBeGreaterThanOrEqual(keys[i - 1]!.at)
    }
    const pos = channelKeys('pos')
    expect(pos.filter((k) => k.cut).map((k) => k.at)).toEqual([572, MIST_CUT])
    for (let i = 1; i < pos.length; i++) {
      const a = pos[i - 1]!
      const b = pos[i]!
      if (b.cut) continue
      const speed = Math.hypot(b.v[0] - a.v[0], b.v[1] - a.v[1], b.v[2] - a.v[2]) / Math.max(b.at - a.at, 1e-6)
      expect(speed, `${a.at} → ${b.at}`).toBeLessThan(2)
    }
  })

  it('hides the cut in the mist wall under full paper at the fog peak', () => {
    const paper = channelKeys('paper')
    const fog = channelKeys('fog')
    expect(sampleScalar(paper, MIST_CUT - 1)).toBe(1)
    expect(sampleScalar(paper, MIST_CUT)).toBe(1)
    expect(sampleScalar(paper, 610)).toBe(0)
    expect(sampleScalar(paper, 640)).toBe(0)
    expect(sampleScalar(fog, MIST_CUT)).toBeCloseTo(0.14)
    expect(sampleScalar(fog, 645)).toBeLessThan(0.03)
  })

  it('never shows the clearing: after the cut the camera is south of it and looks south', () => {
    for (const portrait of [false, true]) {
      const path = buildCameraPath({ portrait, hFit: 34 })
      const pos = new Vector3()
      const look = new Vector3()
      for (let jvh = 600; jvh < MIST_CUT; jvh += 1) {
        path.pos.sample(jvh, pos)
        expect(pos.z, `${jvh}`).toBeGreaterThan(-125)
      }
      for (let jvh = MIST_CUT; jvh <= MARKS.finaleStart; jvh += 1) {
        path.pos.sample(jvh, pos)
        path.look.sample(jvh, look)
        expect(pos.z, `${jvh}`).toBeLessThan(grove.centre[2] - grove.floorDisc.radius)
        expect(look.z, `${jvh}`).toBeLessThan(pos.z)
      }
    }
  })

  it('waits in the mist for the lantern, not the grove', () => {
    expect(MIST_WAIT).toEqual({ section: 'contact', jvh: [628, 645] })
    expect(mistHoldTarget(630, false)).toBe(1)
    expect(mistHoldTarget(630, true)).toBe(0)
    expect(mistHoldTarget(650, false)).toBe(0)
  })

  it('centres the stream pause, which has no card, and lifts P3 in portrait', () => {
    const keys = shiftXKeys({ width: 1280, height: 800, header: 72 }, false)
    expect(sampleScalar(keys, 596)).toBe(0)
    expect(PORTRAIT.lookLiftBeats).toContain('P3')
    expect(PORTRAIT.subjectY).not.toHaveProperty('P3')
  })

  it('plays no chart sounds, and lights the lantern from the cut', () => {
    for (const jvh of [630, 650, 700]) expect(groveOnScreen({ jvh, dive: { phase: 'idle', amount: 0, to: null, waiting: false } })).toBe(false)
    expect(BED_SPANS.crackle).toEqual([[MIST_CUT, J]])
    expect(BED_SPANS.hum).toEqual([[245, 572]])
  })

  it('keeps the grove on the map: the nav, the first-screen copy, the meta tags and the terminal', () => {
    expect(nav.map((n) => n.id)).toEqual(['threshold', 'cabin', 'grove', 'contact'])
    for (const s of [hero.subline, meta.description, meta.og.description]) expect(s).toMatch(/Qimen/)
    const help = terminalCommands.find((c) => c.name === 'help')?.output ?? []
    expect(help.join('\n')).toMatch(/qimen/)
    expect(terminalCommands.filter((c) => c.name === 'qimen' || c.name === 'grove').some((c) => c.hidden)).toBe(false)
    expect(terminalCommands.find((c) => c.name === 'grove')?.action).toEqual({ type: 'navigate', hash: '#grove' })
    expect(terminal.chips).toContain('qimen')
  })
})
