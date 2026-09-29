import { describe, expect, it } from 'vitest'
import { Box3, Vector3, type BufferAttribute } from 'three'
import { exit } from '../../core/world/layout'
import { MARKS } from '../../core/world/journey'
import { socials } from '../../content/socials'
import { layout as chrome } from '../../theme/tokens'
import { FINALE, albumWindow, mountOpenAt, mountWidth, pinMoved, scissorRect, signedAt } from './finale'
import { FLAME_RANGE, approach, flameBreath, flameLevel } from './flame'
import { LANTERN, buildLanternGeometry } from './lanternGeometry'
import { layoutFaces, rowAt, rowBands, type MeasureText } from './signpostFace'
import { ATLAS, BOARD, BOARDS, LEAN, POST, boardDirection, boardFaceCentre, boardNormal, buildBoards, buildFaces, buildTimber, toAtlas } from './signpostGeometry'

describe('lantern flame', () => {
  it('stays inside 0.92..1.0 and never flashes faster than 3 Hz', () => {
    let lo = Infinity
    let hi = -Infinity
    let crossings = 0
    let prev = flameLevel(0, false) - 0.96
    for (let t = 0; t < 60; t += 1 / 240) {
      const v = flameLevel(t, false)
      lo = Math.min(lo, v)
      hi = Math.max(hi, v)
      const d = v - 0.96
      if (Math.sign(d) !== Math.sign(prev)) crossings++
      prev = d
    }
    expect(lo).toBeGreaterThanOrEqual(FLAME_RANGE[0])
    expect(hi).toBeLessThanOrEqual(FLAME_RANGE[1])
    // Two crossings per cycle: under 3 cycles a second on average.
    expect(crossings / 60 / 2).toBeLessThan(3)
  })

  it('breathes on a 3 to 5 s rhythm', () => {
    // Peaks of the breath over a minute: between 12 and 20 of them.
    let peaks = 0
    for (let t = 0.05; t < 60; t += 0.05) {
      const a = flameBreath(t - 0.05)
      const b = flameBreath(t)
      const c = flameBreath(t + 0.05)
      if (b > a && b >= c && b > 0.2) peaks++
    }
    expect(peaks).toBeGreaterThanOrEqual(12)
    expect(peaks).toBeLessThanOrEqual(20)
  })

  it('holds still under reduced motion', () => {
    expect(flameLevel(0, true)).toBe(flameLevel(12.3, true))
  })

  it('approaches its target linearly and lands on it', () => {
    let v = 0
    for (let i = 0; i < 15; i++) v = approach(v, 1, 4, 1 / 60)
    expect(v).toBe(1)
    expect(approach(0.5, 0, 4, 0.05)).toBeCloseTo(0.3)
  })
})

describe('lantern geometry', () => {
  const geo = buildLanternGeometry()
  const pos = geo.getAttribute('position') as BufferAttribute

  it('is 1.8 m tall and under 0.9 m across the eave, standing on its base', () => {
    const box = new Box3().setFromBufferAttribute(pos)
    expect(box.min.y).toBeCloseTo(0, 5)
    expect(box.max.y).toBeCloseTo(exit.lantern.height, 2)
    // A modest eave, about twice the chamber: not a kasuga lantern's broad umbrella roof.
    expect(box.max.x - box.min.x).toBeGreaterThan(0.7)
    expect(box.max.x - box.min.x).toBeLessThan(0.9)
  })

  it('is octagonal, with a flat face (not a corner) toward each compass point', () => {
    // The plinth's outer corners sit at 22.5° + k·45°.
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const z = pos.getZ(i)
      if (pos.getY(i) > 0.05 || Math.hypot(x, z) < 0.41) continue
      const deg = ((Math.atan2(x, z) * 180) / Math.PI + 360) % 45
      expect(Math.min(Math.abs(deg - 22.5), 45 - Math.abs(deg - 22.5))).toBeLessThan(0.01)
    }
  })

  it('opens the chamber on the four cardinal faces around the flame', () => {
    const { open0, open1, r } = LANTERN.chamber
    const midY = (open0 + open1) / 2
    // Wall triangles at the flame's height: none face N, W, S or E.
    let facing = 0
    for (let t = 0; t < pos.count; t += 3) {
      const ys = [pos.getY(t), pos.getY(t + 1), pos.getY(t + 2)]
      if (Math.min(...ys) > midY || Math.max(...ys) < midY) continue
      const cx = (pos.getX(t) + pos.getX(t + 1) + pos.getX(t + 2)) / 3
      const cz = (pos.getZ(t) + pos.getZ(t + 1) + pos.getZ(t + 2)) / 3
      if (Math.hypot(cx, cz) > r + 0.01) continue
      const face = Math.round(Math.atan2(cx, cz) / (Math.PI / 4))
      if (face % 2 === 0) facing++
    }
    expect(facing).toBe(0)
    expect(LANTERN.flameY).toBeGreaterThan(open0)
    expect(LANTERN.flameY).toBeLessThan(open1)
  })
})

// A stand-in for canvas measureText: half an em per character.
const measure: MeasureText = (text, px) => text.length * px * 0.5

describe('signpost', () => {
  const timber = buildTimber()
  const boards = buildBoards()
  const faces = buildFaces()

  it('is a single post of 2.3 to 2.6 m, leaning a little, standing on the ground', () => {
    const box = new Box3().setFromBufferAttribute(timber.getAttribute('position') as BufferAttribute)
    expect(box.max.y).toBeGreaterThan(2.3)
    expect(box.max.y).toBeLessThan(2.6 + POST.cap)
    expect(box.min.y).toBeLessThan(0)
    const top = new Vector3(0, POST.height, 0).applyMatrix4(LEAN)
    const lean = Math.atan2(Math.hypot(top.x, top.z), top.y) * (180 / Math.PI)
    expect(lean).toBeGreaterThan(1)
    expect(lean).toBeLessThan(5)
  })

  it('carries one board per social link, in order, at distinct heights', () => {
    expect(BOARDS.map((b) => b.id)).toEqual(socials.map((s) => s.id))
    const ys = BOARDS.map((b) => b.y)
    for (let i = 1; i < ys.length; i++) expect((ys[i - 1] ?? 0) - (ys[i] ?? 0)).toBeGreaterThan(BOARD.height + 0.05)
    expect(Math.max(...ys) + BOARD.height / 2).toBeLessThan(POST.height)
  })

  it('points every board away south into the mist, both ways, with its face to the approach', () => {
    const sides = new Set(BOARDS.map((b) => b.side))
    expect(sides).toEqual(new Set([1, -1]))
    for (const b of BOARDS) {
      const d = boardDirection(b)
      // South is −Z; east (screen-left) is −X.
      expect(d.z).toBeLessThan(-0.3)
      expect(Math.sign(d.x)).toBe(b.side)
      const n = boardNormal(b)
      expect(n.z).toBeGreaterThan(0.8)
    }
    const yaws = BOARDS.map((b) => b.side * b.away)
    expect(new Set(yaws).size).toBe(BOARDS.length)
  })

  it('stays cheap: a few hundred triangles in all', () => {
    const tris = [timber, boards, faces].reduce((n, g) => n + g.getAttribute('position').count / 3, 0)
    expect(tris).toBeLessThan(1500)
    expect(faces.getAttribute('uv')).toBeDefined()
    expect(timber.getAttribute('iInk')).toBeDefined()
  })

  it('maps each board face onto its own row of the atlas', () => {
    const face = layoutFaces(measure)
    const uv = faces.getAttribute('uv') as BufferAttribute
    // Triangles come board by board; each one's centroid v must fall in that board's row.
    const seen = new Map<string, number>()
    for (let t = 0; t < uv.count; t += 3) {
      const u = (uv.getX(t) + uv.getX(t + 1) + uv.getX(t + 2)) / 3
      const v = (uv.getY(t) + uv.getY(t + 1) + uv.getY(t + 2)) / 3
      expect(u).toBeGreaterThan(0)
      expect(u).toBeLessThan(1)
      const id = rowAt(face, v)
      expect(id).not.toBeNull()
      seen.set(id ?? '', (seen.get(id ?? '') ?? 0) + 1)
    }
    expect([...seen.keys()]).toEqual(socials.map((s) => s.id))
  })
})

describe('signpost faces', () => {
  const face = layoutFaces(measure)

  it('cuts a logo and the username on each board, and no product names', () => {
    expect(face.rows.map((r) => r.id)).toEqual(socials.map((s) => s.id))
    expect(face.rows.map((r) => r.text)).toEqual(socials.map((s) => s.display))
    for (const s of socials) {
      if (s.label.length > 1) for (const r of face.rows) expect(r.text.toLowerCase()).not.toContain(s.label.toLowerCase())
    }
  })

  it('keeps the lettering on its board, clear of the pegs and the pointed end', () => {
    for (const r of face.rows) {
      const board = BOARDS.find((b) => b.id === r.id)
      if (!board) throw new Error(r.id)
      expect(r.markX).toBeGreaterThanOrEqual(r.left - 1e-6)
      expect(r.textX + measure(r.text, r.textPx)).toBeLessThanOrEqual(r.right + 1e-6)
      expect(r.textX).toBeGreaterThan(r.markX + r.markSize)
      // The mark and the type sit inside the board's height.
      const mid = (r.top + r.bottom) / 2
      expect(mid - r.markSize / 2).toBeGreaterThan(r.top)
      expect(mid + r.markSize / 2).toBeLessThan(r.bottom)
      expect(r.baseline).toBeLessThan(r.bottom)
      // The pointed end is on the side the board points to.
      const [tipX] = toAtlas(board, board.length, 0)
      const [buttX] = toAtlas(board, 0, 0)
      expect(Math.sign(tipX - buttX)).toBe(board.side)
      expect(r.left).toBeGreaterThanOrEqual(Math.min(tipX, buttX))
      expect(r.right).toBeLessThanOrEqual(Math.max(tipX, buttX))
    }
  })

  it('uses one type size, legible from the path', () => {
    const sizes = new Set(face.rows.map((r) => r.textPx))
    expect(sizes.size).toBe(1)
    // At least 8 cm type on a 20 cm board.
    expect((face.rows[0]?.textPx ?? 0) / ATLAS.pxPerMetre).toBeGreaterThanOrEqual(0.08)
  })

  it('maps texture v back to the board it glows', () => {
    const { v0, v1 } = rowBands(face)
    face.rows.forEach((r, i) => {
      const mid = ((v0[i] ?? 0) + (v1[i] ?? 0)) / 2
      expect(rowAt(face, mid)).toBe(r.id)
      expect(v1[i] ?? 0).toBeGreaterThan(v0[i] ?? 0)
    })
    // The gaps between rows and the atlas margins belong to no board.
    expect(rowAt(face, 0.999)).toBeNull()
    expect(rowAt(face, 0.001)).toBeNull()
  })

  it('leans the lantern flame east toward the boards, following the hovered one', () => {
    const { flame } = exit.lantern
    const dirs = BOARDS.map((b) => {
      const c = boardFaceCentre(b).add(new Vector3(...exit.signpost.base))
      return Math.atan2(c.x - flame[0], c.z - flame[2]) * (180 / Math.PI)
    })
    // East is −X: every board lies east of the flame; the one pointing west is nearer it.
    for (const d of dirs) expect(d).toBeLessThan(-45)
    expect(Math.max(...dirs) - Math.min(...dirs)).toBeGreaterThan(2)
  })
})

describe('finale', () => {
  it('opens the mounts late in E2 and signs at the seal mark', () => {
    expect(mountOpenAt(MARKS.finaleStart)).toBe(false)
    expect(mountOpenAt(FINALE.mountOpenAt)).toBe(true)
    expect(FINALE.mountOpenAt).toBeLessThan(MARKS.sealStamp)
    expect(signedAt(MARKS.sealStamp)).toBe(true)
    expect(FINALE.colophonAfterMs).toBeLessThan(FINALE.sealAfterMs)
  })

  it('leaves a centred 3:4 window between the mounts on landscape', () => {
    const w = albumWindow(1280, 800)
    expect(mountWidth(1280, 800)).toBe(340)
    expect(w).toEqual({ x: 340, y: 0, w: 600, h: 800 })
    expect(w.w / w.h).toBeCloseTo(3 / 4)
  })

  it('has no mounts on phones and portrait screens, only the 12 px border on phones', () => {
    expect(mountWidth(390, 844)).toBe(0)
    expect(albumWindow(390, 844)).toEqual({ x: 12, y: 12, w: 366, h: 820 })
    expect(chrome.mountBorderPortrait).toBe(12)
    expect(mountWidth(820, 1180)).toBe(0)
    expect(scissorRect(390, 844)).toBeNull()
  })

  it('scissors to whole pixels that cover the window', () => {
    const r = scissorRect(1366, 768)
    expect(r).not.toBeNull()
    if (!r) return
    const m = mountWidth(1366, 768)
    expect(r.x).toBeLessThanOrEqual(m)
    expect(r.x + r.w).toBeGreaterThanOrEqual(1366 - m)
    expect(Number.isInteger(r.x) && Number.isInteger(r.w)).toBe(true)
  })

  it('writes a pin only when it moves past the slop or changes visibility', () => {
    const a = { x: 100, y: 100, visible: true }
    expect(pinMoved(undefined, a, 1)).toBe(true)
    expect(pinMoved(a, { x: 100.4, y: 99.8, visible: true }, 0.5)).toBe(false)
    expect(pinMoved(a, { x: 103, y: 100, visible: true }, FINALE.pinSlop)).toBe(false)
    expect(pinMoved(a, { x: 110, y: 100, visible: true }, FINALE.pinSlop)).toBe(true)
    expect(pinMoved(a, { ...a, visible: false }, FINALE.pinSlop)).toBe(true)
    expect(pinMoved({ ...a, visible: false }, { x: 300, y: 0, visible: false }, 0.5)).toBe(false)
  })
})
