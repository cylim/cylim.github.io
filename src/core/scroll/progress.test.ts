import { describe, expect, it, vi } from 'vitest'
import {
  buildScrollMap,
  jvhAtScroll,
  keyTrack,
  linearScrollMap,
  piecewise,
  reanchorScrollY,
  sameVec3,
  scrollAtJvh,
  trackParam,
  type ScrollAnchor,
} from './progress'
import { BEATS, J, SECTION_SPANS, channelKeys } from '../world/journey'
import { SECTION_IDS } from '../sections/ids'

// The full walk, grove included: these tests pin the design tables and the grove's code, whatever
// content/features.ts says (the live, groveless walk is covered by core/world/groveOff.test.ts).
vi.mock('../../content/features', () => ({ features: { grove: true } }))

const ARRIVALS = SECTION_IDS.map((id) => SECTION_SPANS[id].arrivalJvh)

/** The DOM of ContentLayer at a given viewport height: one anchor per section and per beat, in svh. */
function domAnchors(vh: number, stretch: Partial<Record<string, number>> = {}): { anchors: ScrollAnchor[]; maxScroll: number } {
  const anchors: ScrollAnchor[] = []
  let y = 0
  for (const id of SECTION_IDS) {
    const top = y
    anchors.push({ y: top, jvh: SECTION_SPANS[id].jvh[0] })
    for (const b of BEATS.filter((x) => x.section === id)) {
      anchors.push({ y, jvh: b.jvh[0] })
      y += (b.jvh[1] - b.jvh[0]) * vh * (stretch[b.id] ?? 1)
    }
    // The last section adds the final viewport.
    if (id === SECTION_IDS[SECTION_IDS.length - 1]) y += 100 * vh
  }
  // The document is J + 100 svh tall; the scroll range ends one viewport before the bottom.
  return { anchors, maxScroll: y - 100 * vh }
}

describe('piecewise', () => {
  const knots = [
    { x: 0, y: 0 },
    { x: 10, y: 100 },
    { x: 20, y: 100 },
    { x: 30, y: 400 },
  ]
  it('interpolates, holds flat between equal knots and clamps', () => {
    expect(piecewise(knots, -1)).toBe(0)
    expect(piecewise(knots, 5)).toBe(50)
    expect(piecewise(knots, 15)).toBe(100)
    expect(piecewise(knots, 25)).toBe(250)
    expect(piecewise(knots, 99)).toBe(400)
  })
})

describe('scroll map', () => {
  for (const vh of [800, 844, 667.5]) {
    const { anchors, maxScroll } = domAnchors(vh)
    const map = buildScrollMap(anchors, maxScroll, J, ARRIVALS)

    it(`is monotonic and spans 0..J (viewport ${vh})`, () => {
      expect(jvhAtScroll(map, 0)).toBe(0)
      expect(jvhAtScroll(map, maxScroll)).toBe(J)
      // One assertion for the whole sweep: an expect() per sample (~100k of them) made this test time
      // out at 5 s on a loaded CI runner.
      let prev = -1
      const drops: number[] = []
      for (let y = 0; y <= maxScroll; y += 7) {
        const j = jvhAtScroll(map, y)
        if (j < prev) drops.push(y)
        prev = j
      }
      expect(drops).toEqual([])
    })

    it(`lands exactly on every arrival, even from a rounded scroll offset (viewport ${vh})`, () => {
      for (const a of ARRIVALS) {
        const y = scrollAtJvh(map, a)
        expect(jvhAtScroll(map, y)).toBe(a)
        expect(jvhAtScroll(map, Math.round(y))).toBe(a)
        expect(jvhAtScroll(map, Math.floor(y))).toBe(a)
        expect(jvhAtScroll(map, Math.round(y * 2) / 2)).toBe(a)
      }
      expect(jvhToUAt(map, SECTION_SPANS.cabin.arrivalJvh)).toBe(0.345)
    })

    it(`maps section tops to their span starts (viewport ${vh})`, () => {
      for (const id of SECTION_IDS) {
        const top = anchors.find((a) => a.jvh === SECTION_SPANS[id].jvh[0])!.y
        expect(jvhAtScroll(map, top)).toBeCloseTo(SECTION_SPANS[id].jvh[0], 9)
      }
    })
  }

  it('follows the DOM when a beat is taller than its share, so cards and camera stay locked', () => {
    const { anchors, maxScroll } = domAnchors(800, { I2d: 1.5 })
    const map = buildScrollMap(anchors, maxScroll, J, ARRIVALS)
    const i3Top = anchors.find((a) => a.jvh === 480)!.y
    expect(jvhAtScroll(map, i3Top)).toBeCloseTo(480, 9)
    for (const a of ARRIVALS) expect(jvhAtScroll(map, Math.round(scrollAtJvh(map, a)))).toBe(a)
  })

  it('is linear inside each section with section anchors only (what the driver measures)', () => {
    const vh = 844
    const { anchors, maxScroll } = domAnchors(vh)
    const sections = anchors.filter((a) => SECTION_IDS.some((id) => SECTION_SPANS[id].jvh[0] === a.jvh))
    const map = buildScrollMap(sections, maxScroll, J, ARRIVALS)
    expect(map.knots).toHaveLength(SECTION_IDS.length + 1)
    for (const b of BEATS) expect(scrollAtJvh(map, b.jvh[0])).toBeCloseTo(b.jvh[0] * vh, 6)
    for (const a of ARRIVALS) expect(jvhAtScroll(map, Math.round(scrollAtJvh(map, a)))).toBe(a)
  })

  it('drops anchors that are out of order, hidden or past the scroll range', () => {
    const map = buildScrollMap(
      [
        { y: 400, jvh: 100 },
        { y: 300, jvh: 200 },
        { y: 0, jvh: 300 },
        { y: 9000, jvh: 900 },
        { y: Number.NaN, jvh: 950 },
      ],
      1000,
      J,
    )
    expect(map.knots.map((k) => [k.x, k.y])).toEqual([
      [0, 0],
      [400, 100],
      [1000, J],
    ])
  })

  it('falls back to u = scrollY / maxScroll before the DOM is measured (design.md §0)', () => {
    const map = linearScrollMap(8000, J)
    expect(jvhAtScroll(map, 2760)).toBeCloseTo(345, 9)
    expect(scrollAtJvh(map, 666)).toBeCloseTo(5328, 9)
  })
})

function jvhToUAt(map: ReturnType<typeof buildScrollMap>, jvh: number) {
  return jvhAtScroll(map, Math.round(scrollAtJvh(map, jvh))) / J
}

describe('key track (jvh → spline parameter)', () => {
  const pos = channelKeys('pos')
  // One piece per cut, as the camera path builds them.
  const cut = pos.findIndex((k) => k.cut)
  const pieces = [pos.slice(0, cut), pos.slice(cut)]

  it('is integer at keys, monotonic, and flat across every equal-key hold', () => {
    for (const keys of pieces) {
      const track = keyTrack(keys, sameVec3)
      let prev = -Infinity
      for (let j = keys[0]!.at; j <= keys[keys.length - 1]!.at; j += 0.25) {
        const p = trackParam(track, j)
        expect(p).toBeGreaterThanOrEqual(prev)
        prev = p
      }
      for (let i = 1; i < keys.length; i++) {
        const a = keys[i - 1]!
        const b = keys[i]!
        expect(Number.isInteger(trackParam(track, b.at))).toBe(true)
        if (sameVec3(a.v, b.v)) {
          const mid = trackParam(track, (a.at + b.at) / 2)
          expect(mid, `hold ${a.at}–${b.at}`).toBe(trackParam(track, a.at))
          expect(trackParam(track, b.at)).toBe(trackParam(track, a.at))
        }
      }
    }
  })

  it('holds the camera still through the stationary holds of the beat table', () => {
    const track = keyTrack(pieces[0]!, sameVec3)
    for (const id of ['C3', 'I2a', 'I2b', 'I2c', 'I2d'] as const) {
      const b = BEATS.find((x) => x.id === id)!
      const [h0, h1] = b.hold!
      expect(trackParam(track, h0), id).toBe(trackParam(track, h1))
    }
  })

  it('never produces zero-length segments', () => {
    const track = keyTrack(pieces[1]!, sameVec3)
    for (let i = 1; i < track.points.length; i++) expect(sameVec3(track.points[i - 1]!, track.points[i]!)).toBe(false)
  })
})

/** The map the driver measures (section tops only) at a viewport height. */
function sectionMapAt(vh: number) {
  const { anchors, maxScroll } = domAnchors(vh)
  const sections = anchors.filter((a) => SECTION_IDS.some((id) => SECTION_SPANS[id].jvh[0] === a.jvh))
  return buildScrollMap(sections, maxScroll, J, ARRIVALS)
}

describe('reanchorScrollY (QM-P2)', () => {

  it('keeps the journey position when a resize moves the section tops', () => {
    const before = sectionMapAt(800)
    const after = sectionMapAt(600)
    // G1 (690) at 800 px; the same scrollY at 600 px is past the grove.
    const y = scrollAtJvh(before, 690)
    expect(jvhAtScroll(after, y)).toBeGreaterThan(900)
    const target = reanchorScrollY(before, after, 690, y)
    expect(target).not.toBeNull()
    expect(jvhAtScroll(after, target as number)).toBeCloseTo(690, 6)
  })

  it('leaves the scroll alone when only the scroll range changed (a mobile URL bar)', () => {
    const { anchors, maxScroll } = domAnchors(844)
    const sections = anchors.filter((a) => SECTION_IDS.some((id) => SECTION_SPANS[id].jvh[0] === a.jvh))
    const before = buildScrollMap(sections, maxScroll, J, ARRIVALS)
    const after = buildScrollMap(sections, maxScroll + 56, J, ARRIVALS)
    expect(reanchorScrollY(before, after, 990, scrollAtJvh(before, 990))).toBeNull()
  })

  it('does nothing when the scroll is already there', () => {
    const before = sectionMapAt(800)
    const after = sectionMapAt(600)
    expect(reanchorScrollY(before, after, 690, scrollAtJvh(after, 690))).toBeNull()
  })
})
