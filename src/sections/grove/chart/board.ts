/**
 * The stone board as plain three objects: stone meshes, the four glyph batches, the marks and the
 * hit quads, and `update()`, which places everything for one MotionFrame. GroveChart.tsx owns the
 * clock, the store and the pointer; this file owns where things are.
 *
 * Glyphs are troika BatchedText members (one draw call per batch): `carve` (ring carvings and the
 * 24 mountains), `lit` (paper glyphs, earth stems, band), `thin` (anything with 螣 or 蓬, whose thin
 * strokes need a 128 px SDF) and `latin` (English labels). Members are never in the scene graph;
 * their matrices are relative to the dial, which the batches sit in.
 */

import { BufferGeometry, Color, Group, InstancedMesh, Matrix4, Mesh, PlaneGeometry, Quaternion, Vector3 } from 'three'
import { BatchedText, Text } from 'troika-three-text'
import { SDF_GLYPH_SIZE, TEXT_FONTS } from '../../../core/text/configure'
import { grove } from '../../../core/world/layout'
import { glossFor, palaces as palaceGlosses } from '../../../content'
import { MARKS_ZH, MOUNTAINS, PALACE_NUMBERS, PALACE_ZH, palaceAtSlot } from '../../../lib/qimen'
import type { PalaceNo } from '../../../lib/qimen/types'
import { color } from '../../../theme/tokens'
import {
  apronGeometry,
  apronInkGeometry,
  arcPoints,
  brushRingGeometry,
  dotGeometry,
  floorDiscGeometry,
  hourWedgeGeometry,
  joinGeometry,
  luoShuPoints,
  markRingGeometry,
  mossGeometry,
  needleGeometry,
  plateGeometry,
  platformGeometry,
  ribbonGeometry,
  trigramGeometry,
  turningRingGeometry,
  washGeometry,
} from './geometry'
import {
  BAND,
  DEG,
  DOT,
  ENGLISH,
  FLIGHT_ARC,
  LIFT,
  MOUNTAIN,
  ON_RING,
  PLATFORM_Y,
  bearingPoint,
  blockSpot,
  clockwiseTangent,
  deityBearing,
  dotNumeral,
  nameRowStart,
  palaceLocal,
  riderBearing,
} from './layout'
import { batchColor, createBoardMaterials, disposeBoardMaterials, type BoardMaterials } from './materials'
import { RING_IDS, type ChartModel, type Rider, type RingId } from './model'
import type { MotionFrame } from './motion'
import { THIN_GLYPHS } from './glyphs'

type BatchKind = 'carve' | 'lit' | 'thin' | 'latin'

const THIN = new RegExp(`[${THIN_GLYPHS}]`)
const Y_AXIS = new Vector3(0, 1, 0)
const FLAT = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -Math.PI / 2)

const INK = {
  paper: batchColor(color.paper),
  carving: batchColor(color.bluestoneDeep),
  mountain: batchColor(color.inkJiao),
  faint: batchColor(color.inkDan),
}

/** Per-frame view state that isn't the chart's own clock. */
export interface BoardView {
  /** Dial turn, clockwise on screen, radians (compass or manual rotation). */
  dial: number
  /** Needle swing relative to the dial, radians. */
  needle: number
  /** 0..1 blend to the English layout. */
  english: number
  selected: PalaceNo | null
  /** 0..1 selection fade. */
  select: number
  /** Dim the other palaces to 70% (a selection does; the compass's facing palace doesn't). */
  dimOthers: boolean
}

/** A glyph the pointer can hover (tooltip) and click (select its palace). */
export interface HitGlyph {
  zh: string
  palace: PalaceNo | null
}

interface Member {
  text: Text
  /** Width in ems, for the hit quad. */
  ems: number
}

const ems = (s: string) => [...s].reduce((w, ch) => w + (/[\x20-\x7e·]/.test(ch) ? 0.5 : 1), 0)

const dotCount = (odd: boolean) => PALACE_NUMBERS.reduce((n, p) => n + ((p % 2 === 1) === odd ? dotNumeral(p).dots.length : 0), 0)
/** The Luo Shu brush swells and thins as it goes, like a loaded brush. */
const brushWidth = (t: number) => 0.05 + 0.03 * Math.sin(t * 40) ** 2

const tmpPos = new Vector3()
const tmpPos2 = new Vector3()
const tmpRight = new Vector3()
const tmpQuat = new Quaternion()
const tmpQuat2 = new Quaternion()
const tmpScale = new Vector3()
const tmpMat = new Matrix4()

function ringQuat(bearingDeg: number, out: Quaternion): Quaternion {
  return out.setFromAxisAngle(Y_AXIS, Math.PI - bearingDeg * DEG).multiply(FLAT)
}

/** The band lies on the north step's tread, read from the seat: tops to the south. */
function placeOnStep(m: Member, dz: number, size: number): void {
  m.text.position.set(0, BAND.y + LIFT.glyph, BAND.z + dz)
  m.text.quaternion.copy(FLAT)
  m.text.scale.setScalar(size)
}

export class Board {
  readonly root = new Group()
  readonly dial = new Group()
  readonly mats: BoardMaterials = createBoardMaterials()
  /** Stone the pointer picks palaces on (and drags the dial by). */
  readonly stone: Mesh[] = []
  readonly hourWedge: Mesh
  readonly hits: InstancedMesh
  readonly hitGlyphs: HitGlyph[] = []

  private readonly rings: Record<RingId, Mesh>
  private readonly batches: Record<BatchKind, BatchedText>
  private readonly riders = new Map<string, Member>()
  private readonly riderEnglish = new Map<string, Member>()
  private readonly carvings = new Map<string, Member>()
  private readonly earth = new Map<PalaceNo, Member>()
  private readonly earthEnglish = new Map<PalaceNo, Member>()
  private readonly names = new Map<PalaceNo, Member>()
  private readonly mountains: Member[] = []
  private readonly lodged: Member
  private readonly horse: Member
  private readonly band: { line1: Member; line2: Member }
  private readonly hitMembers: (Member | null)[] = []
  private readonly voidHits: number[] = []

  private readonly dots: { filled: InstancedMesh; hollow: InstancedMesh; joins: InstancedMesh; lodgedLine: Mesh }
  private readonly voidMarks: InstancedMesh
  private readonly plates: { star: Mesh; deity: Mesh; ring: Mesh }
  private readonly brush: { yang: Mesh; yin: Mesh }
  private readonly arc: Mesh
  private arcKey = ''
  private readonly wash: Mesh
  private readonly washes = new Map<PalaceNo, BufferGeometry>()
  private readonly needle: Mesh
  private readonly geometries: BufferGeometry[] = []
  private hourIndex = -1
  private bandText = ''

  constructor(model: ChartModel) {
    const m = this.mats
    const [cx, , cz] = grove.centre
    this.root.name = 'grove-chart'
    this.root.position.set(cx, 0, cz)
    this.dial.name = 'grove-dial'
    this.root.add(this.dial)

    const mesh = (geo: BufferGeometry, mat: Mesh['material'], name: string, order = 0) => {
      const o = new Mesh(geo, mat)
      o.name = name
      o.renderOrder = order
      o.matrixAutoUpdate = false
      o.updateMatrix()
      this.geometries.push(geo)
      this.dial.add(o)
      return o
    }

    // Stone.
    const floor = mesh(floorDiscGeometry(), m.stone, 'floor-disc')
    const platform = mesh(platformGeometry(), m.bluestone, 'platform')
    const apron = mesh(apronGeometry(), m.stone, 'apron')
    this.rings = {
      heaven: mesh(turningRingGeometry('heaven', 1), m.bluestone, 'ring-heaven'),
      human: mesh(turningRingGeometry('human', 2), m.bluestone, 'ring-human'),
      spirit: mesh(turningRingGeometry('spirit', 3), m.bluestone, 'ring-spirit'),
    }
    for (const r of RING_IDS) this.rings[r].matrixAutoUpdate = true
    this.stone.push(platform, floor, apron, ...RING_IDS.map((r) => this.rings[r]))

    // Painted and carved pieces on the stone.
    mesh(apronInkGeometry(), m.ink, 'apron-ink')
    mesh(mossGeometry(), m.moss, 'moss')
    mesh(trigramGeometry((p) => palaceGlosses.find((g) => g.number === p)?.trigram ?? null), m.paper, 'trigrams')
    this.hourWedge = mesh(hourWedgeGeometry(), m.ink, 'hour-marker')
    this.hourWedge.matrixAutoUpdate = true

    const instanced = (geo: BufferGeometry, mat: Mesh['material'], count: number, name: string, order = 1) => {
      const o = new InstancedMesh(geo, mat, count)
      o.name = name
      o.renderOrder = order
      o.frustumCulled = false
      this.geometries.push(geo)
      this.dial.add(o)
      return o
    }
    const joinCount = PALACE_NUMBERS.reduce((n, p) => n + dotNumeral(p).joins.length, 0)
    this.dots = {
      filled: instanced(dotGeometry(false), m.paper, dotCount(false), 'luo-shu-filled', 0),
      hollow: instanced(dotGeometry(true), m.paper, dotCount(true), 'luo-shu-hollow', 0),
      joins: instanced(joinGeometry(), m.paper, joinCount, 'luo-shu-joins', 0),
      lodgedLine: mesh(joinGeometry(), m.faintLine, 'lodged-line', 1),
    }
    this.dots.lodgedLine.matrixAutoUpdate = true
    this.voidMarks = instanced(markRingGeometry(), m.voidMark, 2, 'void-marks')

    const plate = plateGeometry()
    this.plates = {
      star: mesh(plate, m.plate, 'zhifu-star-plate', 1),
      deity: mesh(plate, m.plate, 'zhifu-deity-plate', 1),
      ring: mesh(brushRingGeometry(0.8, 0.44), m.seal, 'zhishi-ring', 1),
    }
    for (const o of Object.values(this.plates)) o.matrixAutoUpdate = true

    const brushY = PLATFORM_Y + LIFT.overlay
    this.brush = {
      yang: mesh(ribbonGeometry(luoShuPoints([1, 2, 3, 4, 5, 6, 7, 8, 9]), brushWidth, brushY), m.brush, 'luo-shu-brush-yang', 1),
      yin: mesh(ribbonGeometry(luoShuPoints([9, 8, 7, 6, 5, 4, 3, 2, 1]), brushWidth, brushY), m.brush, 'luo-shu-brush-yin', 1),
    }
    this.arc = mesh(new BufferGeometry(), m.arc, 'zhifu-arc', 1)

    const washFill = new Color(color.paperLight)
    for (const p of PALACE_NUMBERS) this.washes.set(p, washGeometry(p, washFill, washFill))
    this.wash = mesh(this.washes.get(5) as BufferGeometry, m.wash, 'selection-wash', 1)
    this.wash.visible = false

    this.needle = mesh(needleGeometry(new Color(color.inkJiao), new Color(color.cinnabar)), m.needle, 'needle')
    this.needle.position.set(0, grove.needle[1], 0)
    this.needle.matrixAutoUpdate = true

    // Glyphs.
    const batch = (kind: BatchKind, mat: BoardMaterials['text'][BatchKind], order: number) => {
      const b = new BatchedText()
      b.name = `glyphs-${kind}`
      b.material = mat
      b.renderOrder = order
      b.frustumCulled = false
      b.raycast = () => undefined
      this.dial.add(b)
      return b
    }
    this.batches = {
      carve: batch('carve', m.text.carve, 2),
      lit: batch('lit', m.text.lit, 3),
      thin: batch('thin', m.text.thin, 3),
      latin: batch('latin', m.text.latin, 3),
    }

    for (const r of model.riders) this.rider(r)
    for (const c of model.carvings) this.member(this.carvings, c.key, c.text, 'carve')
    for (const p of PALACE_NUMBERS) {
      this.member(this.earth, p, model.earth[p], 'lit')
      this.member(this.earthEnglish, p, glossFor(model.earth[p])?.en ?? '', 'latin')
      const name = this.member(this.names, p, p === 5 ? PALACE_ZH[5] : `${PALACE_ZH[p]}${p}`, 'lit')
      name.text.anchorX = 'left'
    }
    MOUNTAINS.forEach((zh) => this.mountains.push(this.create(zh, 'carve')))
    this.lodged = this.create(MARKS_ZH.lodged, 'lit')
    this.horse = this.create(MARKS_ZH.horseMark, 'lit')
    this.band = { line1: this.create('', 'lit'), line2: this.create('', 'lit') }
    this.placeStatic()

    // Hit quads: riders, earth stems, names, marks and mountains.
    for (const r of model.riders) this.hit(this.riders.get(r.key) ?? null, r.gloss, null)
    for (const p of PALACE_NUMBERS) {
      this.hit(this.earth.get(p) ?? null, model.earth[p], p)
      this.hit(this.names.get(p) ?? null, PALACE_ZH[p], p)
    }
    this.hit(this.lodged, MARKS_ZH.lodged, 5)
    this.hit(this.horse, MARKS_ZH.horse, null)
    for (let i = 0; i < 2; i++) this.voidHits.push(this.hit(null, MARKS_ZH.void, null))
    // `@r4`: the mountain's own gloss (甲 is Mountain 75° here, not the stem's plate role; dom/gloss/detail.ts).
    MOUNTAINS.forEach((zh, k) => this.hit(this.mountains[k] ?? null, `${zh}@r4`, palaceAtSlot(Math.round((k * 15) / 45))))
    const quad = new PlaneGeometry(1, 1)
    this.geometries.push(quad)
    this.hits = new InstancedMesh(quad, m.hit, this.hitGlyphs.length)
    this.hits.name = 'glyph-hits'
    this.dial.add(this.hits)
  }

  // ---------------------------------------------------------------------------- members

  private create(text: string, kind: BatchKind): Member {
    const t = new Text()
    t.text = text
    t.fontSize = 1
    t.anchorX = 'center'
    t.anchorY = 'middle'
    const thin = kind !== 'latin' && THIN.test(text)
    t.font = kind === 'latin' ? TEXT_FONTS.body : TEXT_FONTS.cjk
    t.sdfGlyphSize = thin ? SDF_GLYPH_SIZE.hero : SDF_GLYPH_SIZE.label
    t.color = kind === 'carve' ? INK.carving.clone() : INK.paper.clone()
    t.fillOpacity = 0
    this.batches[thin ? 'thin' : kind].addText(t)
    return { text: t, ems: ems(text) }
  }

  private member<K>(map: Map<K, Member>, key: K, text: string, kind: BatchKind): Member {
    const m = this.create(text, kind)
    map.set(key, m)
    return m
  }

  private rider(r: Rider): void {
    this.member(this.riders, r.key, r.text, 'lit')
    if (r.role !== 'star2' && r.role !== 'stem2') this.member(this.riderEnglish, r.key, glossFor(r.gloss)?.en ?? '', 'latin')
  }

  private hit(member: Member | null, zh: string, palace: PalaceNo | null): number {
    this.hitMembers.push(member)
    return this.hitGlyphs.push({ zh, palace }) - 1
  }

  private static setText(m: Member, text: string): void {
    if (m.text.text === text) return
    m.text.text = text
    m.ems = ems(text)
  }

  // ---------------------------------------------------------------------------- placement

  /** The mountains never move on the dial (§9.2): place them once. */
  private placeStatic(): void {
    MOUNTAINS.forEach((_, k) => {
      const m = this.mountains[k] as Member
      const bearing = k * 15
      const [x, z] = bearingPoint(bearing, MOUNTAIN.r)
      m.text.position.set(x, MOUNTAIN.y + LIFT.glyph, z)
      ringQuat(bearing, m.text.quaternion)
      m.text.scale.setScalar(MOUNTAIN.size * (k % 3 === 0 ? MOUNTAIN.big : 1))
      m.text.fillOpacity = 1
    })
  }

  /** A palace-block pose: slab centre + the counter-rotated (u, v) offset, upright to the viewer. */
  private blockPose(p: PalaceNo, u: number, v: number, dial: number, y: number, pos: Vector3, quat: Quaternion): void {
    const [cx, cz] = palaceLocal(p)
    const c = Math.cos(dial)
    const s = Math.sin(dial)
    const ox = u
    const oz = -v
    pos.set(cx + ox * c + oz * s, y, cz - ox * s + oz * c)
    quat.setFromAxisAngle(Y_AXIS, dial).multiply(FLAT)
  }

  private ringPose(bearing: number, spot: { r: number; t?: number; y: number }, pos: Vector3, quat: Quaternion): void {
    const [x, z] = bearingPoint(bearing, spot.r)
    const [tx, tz] = clockwiseTangent(bearing)
    const t = spot.t ?? 0
    pos.set(x + tx * t, spot.y + LIFT.glyph, z + tz * t)
    ringQuat(bearing, quat)
  }

  update(f: MotionFrame, view: BoardView): void {
    const { dial, english, selected } = view
    this.dial.rotation.y = -dial
    const dim = (p: PalaceNo | null) => (!view.dimOthers || selected === null || p === null || p === selected ? 1 : 1 - 0.3 * view.select)
    const model = f.model

    // Rings and the lit glyphs riding them.
    for (const r of RING_IDS) this.rings[r].rotation.y = -f.angle[r] * 45 * DEG
    const seen = new Set<string>()
    for (const r of model.riders) {
      seen.add(r.key)
      let m = this.riders.get(r.key)
      if (!m) {
        this.rider(r)
        m = this.riders.get(r.key) as Member
      }
      Board.setText(m, r.text)
      const fly = f.fly[r.ring]
      const bearing = r.ring === 'spirit' ? deityBearing(f.angle.spirit, f.deityRel[r.index] ?? 0) : riderBearing(r.index, f.angle[r.ring])
      const ringSpot = ON_RING[r.role]
      this.ringPose(bearing, ringSpot, tmpPos, tmpQuat)
      const spot = blockSpot(r.role, english)
      // The plated glyphs sit on their plate: the 值符 deity and the 值符 star (the small 禽 when it is 天禽).
      const raise = (r.role === 'deity' || r.role === model.zhiFuRole) && r.palace === model.zhiFu ? LIFT.plate : 0
      this.blockPose(r.palace, spot.u, spot.v, dial, PLATFORM_Y + LIFT.glyph + raise, tmpPos2, tmpQuat2)
      m.text.position.lerpVectors(tmpPos, tmpPos2, fly)
      m.text.position.y += FLIGHT_ARC * Math.sin(Math.PI * fly)
      m.text.quaternion.slerpQuaternions(tmpQuat, tmpQuat2, fly)
      m.text.scale.setScalar(ringSpot.size + (spot.size - ringSpot.size) * fly)
      m.text.fillOpacity = fly < 1 ? 1 : dim(r.palace)

      const en = this.riderEnglish.get(r.key)
      if (en) {
        Board.setText(en, glossFor(r.gloss)?.en ?? '')
        const below = r.role === 'deity' ? ENGLISH.deityBelow : ENGLISH.below
        this.blockPose(r.palace, spot.u, spot.v - below, dial, PLATFORM_Y + LIFT.glyph, en.text.position, en.text.quaternion)
        en.text.scale.setScalar(ENGLISH.size)
        en.text.fillOpacity = english * Math.max(0, fly * 4 - 3) * 0.85 * dim(r.palace)
      }
    }
    for (const [key, m] of this.riders) {
      if (seen.has(key)) continue
      m.text.fillOpacity = 0
      const en = this.riderEnglish.get(key)
      if (en) en.text.fillOpacity = 0
    }

    // Ring carvings: bluestone-deep, uncovered as the light lifts off them (§9.5).
    for (const c of model.carvings) {
      const m = this.carvings.get(c.key) ?? this.member(this.carvings, c.key, c.text, 'carve')
      Board.setText(m, c.ring === 'heaven' && c.role !== 'star' ? f.earthModel.carvings.find((x) => x.key === c.key)?.text ?? c.text : c.text)
      const bearing = c.ring === 'spirit' ? deityBearing(f.angle.spirit, f.deityRel[c.index] ?? 0) : riderBearing(c.index, f.angle[c.ring])
      const spot = c.role === 'star' ? ON_RING.carveStar : ON_RING[c.role]
      this.ringPose(bearing, spot, m.text.position, m.text.quaternion)
      if (c.ring === 'spirit') m.text.position.y += 0.15 * f.spiritLift
      m.text.scale.setScalar(spot.size)
      m.text.fillOpacity = Math.min(1, f.fly[c.ring] * 2)
    }

    // Earth stems: carved, then filled paper-white as the brush reaches them.
    for (const p of PALACE_NUMBERS) {
      const m = this.earth.get(p) as Member
      const stem = f.earthModel.earth[p]
      Board.setText(m, stem)
      const spot = blockSpot('earth', english)
      this.blockPose(p, spot.u, spot.v, dial, PLATFORM_Y + LIFT.glyph, m.text.position, m.text.quaternion)
      m.text.scale.setScalar(spot.size)
      const ink = f.ink[p] ?? 1
      ;(m.text.color as Color).copy(INK.carving).lerp(INK.paper, ink)
      m.text.fillOpacity = dim(p)
      const en = this.earthEnglish.get(p) as Member
      Board.setText(en, glossFor(stem)?.en ?? '')
      this.blockPose(p, spot.u, spot.v - ENGLISH.below, dial, PLATFORM_Y + LIFT.glyph, en.text.position, en.text.quaternion)
      en.text.scale.setScalar(ENGLISH.size)
      en.text.fillOpacity = english * ink * 0.85 * dim(p)

      this.placeName(p, dial, english, dim(p))
    }
    const lodged = blockSpot('lodged', english)
    this.blockPose(5, lodged.u, lodged.v, dial, PLATFORM_Y + LIFT.glyph, this.lodged.text.position, this.lodged.text.quaternion)
    this.lodged.text.scale.setScalar(lodged.size)
    this.lodged.text.fillOpacity = 0.75 * dim(5)
    // A faint line from the note toward 坤2, the south-west corner (+u, +v).
    this.blockPose(5, lodged.u + 0.34, lodged.v, dial, PLATFORM_Y + LIFT.overlay, this.dots.lodgedLine.position, tmpQuat)
    this.dots.lodgedLine.rotation.set(0, dial + Math.PI / 4, 0)
    this.dots.lodgedLine.scale.set(0.5, 1, 1)
    this.placeDots(dial, english)

    // Marks (§9.3, §9.4).
    this.placeMarks(f, dial, english, dim)

    // The Luo Shu brush and the 值符 arc.
    for (const dun of ['yang', 'yin'] as const) {
      const b = this.brush[dun]
      b.visible = model.dun === dun && f.brushAlpha > 0.001
      const count = (b.geometry.attributes.position?.count ?? 0) / 6
      b.geometry.setDrawRange(0, Math.round(count * f.brush) * 6)
    }
    this.mats.brush.opacity = 0.85 * f.brushAlpha
    const arcKey = model.arc ? `${model.arc.from}-${model.arc.to}` : ''
    if (arcKey !== this.arcKey) {
      this.arcKey = arcKey
      this.arc.geometry.dispose()
      this.arc.geometry = model.arc ? ribbonGeometry(arcPoints(model.arc.from, model.arc.to), (t) => 0.02 + 0.1 * Math.sin(Math.PI * t) ** 0.6 * (1 - 0.4 * t), PLATFORM_Y + LIFT.overlay) : new BufferGeometry()
    }
    const arcCount = (this.arc.geometry.attributes.position?.count ?? 0) / 6
    this.arc.geometry.setDrawRange(0, Math.round(arcCount * f.arc) * 6)
    this.arc.visible = arcCount > 0 && f.arcAlpha > 0.001
    this.mats.arc.opacity = f.arcAlpha

    // The hour marker (§9.6): the current 时辰's branch mountain inverted, like a rubbing.
    const hour = MOUNTAINS.indexOf(model.hourBranch)
    if (hour !== this.hourIndex) {
      const was = this.mountains[this.hourIndex]
      if (was) (was.text.color as Color).copy(INK.mountain)
      const now = this.mountains[hour]
      if (now) (now.text.color as Color).copy(INK.paper)
      this.hourIndex = hour
      this.hourWedge.rotation.y = -hour * 15 * DEG
    }

    // The inscription band prints field by field (§9.5, 4.6–5.2 s).
    const line1 = model.band.fields.join(' · ')
    if (line1 + model.band.pillars !== this.bandText) {
      this.bandText = line1 + model.band.pillars
      Board.setText(this.band.line1, line1)
      Board.setText(this.band.line2, model.band.pillars)
    }
    this.placeBand(model, f.band)

    // Selection wash (§9.7).
    this.wash.visible = selected !== null && view.select > 0.001
    if (selected !== null) this.wash.geometry = this.washes.get(selected) as BufferGeometry
    this.mats.wash.opacity = view.select

    this.needle.rotation.y = view.needle
    this.updateHits(f, dial)
  }

  private placeName(p: PalaceNo, dial: number, english: number, alpha: number): void {
    const m = this.names.get(p) as Member
    const spot = blockSpot('name', english)
    const numeral = dotNumeral(p)
    const u = nameRowStart(p) + DOT.r + numeral.width + DOT.r + 0.1
    this.blockPose(p, u, spot.v, dial, PLATFORM_Y + LIFT.glyph, m.text.position, m.text.quaternion)
    m.text.scale.setScalar(spot.size)
    m.text.fillOpacity = alpha
  }

  private placeDots(dial: number, english: number): void {
    const v = blockSpot('name', english).v
    let filled = 0
    let hollow = 0
    let joins = 0
    for (const p of PALACE_NUMBERS) {
      const n = dotNumeral(p)
      const u0 = nameRowStart(p) + DOT.r
      const target = n.hollow ? this.dots.hollow : this.dots.filled
      for (const d of n.dots) {
        this.blockPose(p, u0 + d.u, v + d.v, dial, PLATFORM_Y + LIFT.overlay, tmpPos, tmpQuat)
        tmpMat.compose(tmpPos, tmpQuat2.setFromAxisAngle(Y_AXIS, dial), tmpScale.set(1, 1, 1))
        target.setMatrixAt(n.hollow ? hollow++ : filled++, tmpMat)
      }
      for (const j of n.joins) {
        // Joins run between the dots' edges, so hollow dots stay open.
        const len = Math.hypot(j.u1 - j.u0, j.v1 - j.v0)
        const ku = (j.u1 - j.u0) / len
        const kv = (j.v1 - j.v0) / len
        this.blockPose(p, u0 + j.u0 + ku * DOT.r, v + j.v0 + kv * DOT.r, dial, PLATFORM_Y + LIFT.overlay, tmpPos, tmpQuat)
        const angle = Math.atan2(kv, ku) + dial
        tmpMat.compose(tmpPos, tmpQuat2.setFromAxisAngle(Y_AXIS, angle), tmpScale.set(Math.max(0, len - 2 * DOT.r), 1, 1))
        this.dots.joins.setMatrixAt(joins++, tmpMat)
      }
    }
    this.dots.filled.instanceMatrix.needsUpdate = true
    this.dots.hollow.instanceMatrix.needsUpdate = true
    this.dots.joins.instanceMatrix.needsUpdate = true
  }

  private placeMarks(f: MotionFrame, dial: number, english: number, dim: (p: PalaceNo | null) => number): void {
    const model = f.model
    const stamp = f.marks
    const grow = 1 + 0.25 * (1 - stamp)
    const alpha = Math.min(1, stamp * 1.5)
    // The 值符 star's plate: a two-character name (天芮), or the one-character small 禽 riding with it.
    const star = blockSpot(model.zhiFuRole, english)
    const starChars = model.zhiFuRole === 'star' ? 2 : 1
    const deity = blockSpot('deity', english)
    const door = blockSpot('door', english)
    this.blockPose(model.zhiFu, star.u, star.v, dial, PLATFORM_Y + LIFT.plate, this.plates.star.position, this.plates.star.quaternion)
    this.plates.star.quaternion.setFromAxisAngle(Y_AXIS, dial)
    this.plates.star.scale.set((star.size * starChars + 0.16) * grow, 1, (star.size + 0.12) * grow)
    this.blockPose(model.zhiFu, deity.u, deity.v, dial, PLATFORM_Y + LIFT.plate, this.plates.deity.position, this.plates.deity.quaternion)
    this.plates.deity.quaternion.setFromAxisAngle(Y_AXIS, dial)
    this.plates.deity.scale.set((deity.size * 2 + 0.14) * grow, 1, (deity.size + 0.12) * grow)
    this.blockPose(model.zhiShi, door.u, door.v, dial, PLATFORM_Y + LIFT.overlay, this.plates.ring.position, this.plates.ring.quaternion)
    this.plates.ring.quaternion.setFromAxisAngle(Y_AXIS, dial)
    this.plates.ring.scale.setScalar((door.size / 0.6) * grow)
    this.mats.plate.opacity = alpha
    this.mats.seal.opacity = alpha
    for (const o of Object.values(this.plates)) o.visible = alpha > 0.001

    const voidSpot = blockSpot('void', english)
    this.voidMarks.count = model.voids.length
    model.voids.forEach((p, i) => {
      this.blockPose(p, voidSpot.u, voidSpot.v, dial, PLATFORM_Y + LIFT.overlay, tmpPos, tmpQuat)
      tmpMat.compose(tmpPos, tmpQuat2.identity(), tmpScale.set(1, 1, 1))
      this.voidMarks.setMatrixAt(i, tmpMat)
      const h = this.voidHits[i]
      if (h !== undefined) (this.hitGlyphs[h] as HitGlyph).palace = p
    })
    this.voidMarks.instanceMatrix.needsUpdate = true
    this.mats.voidMark.opacity = alpha * 0.9

    const horseSpot = blockSpot('horse', english)
    if (model.horse !== null) {
      this.blockPose(model.horse, horseSpot.u, horseSpot.v, dial, PLATFORM_Y + LIFT.glyph, this.horse.text.position, this.horse.text.quaternion)
      this.horse.text.scale.setScalar(horseSpot.size)
      ;(this.horse.text.color as Color).copy(INK.faint)
    }
    this.horse.text.fillOpacity = model.horse === null ? 0 : alpha * dim(model.horse)
  }

  private placeBand(model: ChartModel, printed: number): void {
    placeOnStep(this.band.line1, BAND.line1.dz, BAND.line1.size)
    placeOnStep(this.band.line2, BAND.line2.dz, BAND.line2.size)
    // Reveal by field with a left-to-right wipe, using troika's caret positions once laid out.
    const reveal = (m: Member, from: number, to: number, fieldEnds: readonly number[]) => {
      const info = m.text.textRenderInfo
      const carets = info?.caretPositions
      m.text.fillOpacity = info && printed > from ? 1 : 0
      if (!carets || printed >= to) {
        m.text.clipRect = null
        return
      }
      const k = Math.min(Math.floor(printed - from), fieldEnds.length - 1)
      const endOf = (i: number) => (i < 0 ? (carets[0] ?? 0) : (carets[(fieldEnds[i] ?? 0) * 4 + 1] ?? 0))
      const x = endOf(k - 1) + (endOf(k) - endOf(k - 1)) * (printed - from - k)
      m.text.clipRect = [-1e3, -1e3, x, 1e3]
    }
    const fields = model.band.fields
    const ends: number[] = []
    let at = -1
    for (const [i, field] of fields.entries()) {
      at += field.length + (i === 0 ? 0 : 3)
      ends.push(at)
    }
    reveal(this.band.line1, 0, 3, ends)
    reveal(this.band.line2, 3, 4, [model.band.pillars.length - 1])
  }

  private updateHits(f: MotionFrame, dial: number): void {
    f.model.riders.forEach((r, i) => {
      const g = this.hitGlyphs[i]
      if (!g) return
      g.zh = `${r.gloss}@${r.palace}`
      g.palace = f.fly[r.ring] > 0.99 ? r.palace : null
    })
    const voidSpot = blockSpot('void', 0)
    this.hitGlyphs.forEach((_, k) => {
      const m = this.hitMembers[k]
      const voidIndex = this.voidHits.indexOf(k)
      if (voidIndex >= 0) {
        const p = f.model.voids[voidIndex]
        if (p === undefined || f.marks < 0.5) tmpMat.makeScale(0, 0, 0)
        else {
          this.blockPose(p, voidSpot.u, voidSpot.v, dial, PLATFORM_Y + LIFT.glyph, tmpPos, tmpQuat)
          tmpMat.compose(tmpPos, tmpQuat, tmpScale.set(0.3, 0.3, 1))
        }
      } else if (!m || m.text.fillOpacity <= 0.01) tmpMat.makeScale(0, 0, 0)
      else {
        const size = m.text.scale.x
        const w = Math.max(1, m.ems) * size
        tmpPos.copy(m.text.position)
        // Names are left-anchored: move the quad's centre half a width along the glyph's reading direction.
        if (m.text.anchorX === 'left') tmpPos.addScaledVector(tmpRight.set(1, 0, 0).applyQuaternion(m.text.quaternion), w / 2)
        tmpMat.compose(tmpPos, m.text.quaternion, tmpScale.set(w, size, 1))
      }
      this.hits.setMatrixAt(k, tmpMat)
    })
    this.hits.instanceMatrix.needsUpdate = true
    this.hits.computeBoundingSphere()
  }

  /** True once troika has laid out the band, whose print reads caret positions. */
  laidOut(): boolean {
    return this.band.line1.text.textRenderInfo !== null && this.band.line2.text.textRenderInfo !== null
  }

  /** Dial-space point → the palace under it: the slab grid inside the square, else the bearing's palace. */
  palaceAt(local: Vector3): PalaceNo | null {
    const half = grove.platform.size / 2
    if (Math.abs(local.x) <= half && Math.abs(local.z) <= half) {
      let best: PalaceNo = 5
      let d = Infinity
      for (const p of PALACE_NUMBERS) {
        const [x, z] = palaceLocal(p)
        const dd = Math.hypot(local.x - x, local.z - z)
        if (dd < d) {
          d = dd
          best = p
        }
      }
      return best
    }
    const r = Math.hypot(local.x, local.z)
    if (r > grove.rings.mountains.r1) return null
    const bearing = ((Math.atan2(-local.x, local.z) / DEG) % 360 + 360) % 360
    return palaceAtSlot(Math.round(bearing / 45))
  }

  /** World position of a hit glyph, for the tooltip anchor. */
  hitWorld(index: number, out: Vector3): Vector3 {
    this.hits.getMatrixAt(index, tmpMat)
    return out.setFromMatrixPosition(tmpMat).applyMatrix4(this.dial.matrixWorld)
  }

  /**
   * Frees the GPU side for good: only when the grove really unmounts (GroveChart's
   * useDisposeOnUnmount), never on an <Activity> hide, because nothing rebuilds a disposed board.
   */
  dispose(): void {
    for (const b of Object.values(this.batches)) b.dispose()
    const members = [...this.riders.values(), ...this.riderEnglish.values(), ...this.carvings.values(), ...this.earth.values(), ...this.earthEnglish.values(), ...this.names.values(), ...this.mountains, this.lodged, this.horse, this.band.line1, this.band.line2]
    for (const m of members) m.text.dispose()
    // An InstancedMesh owns its instance-matrix buffer; three frees it only on the mesh's own dispose.
    for (const o of [this.dots.filled, this.dots.hollow, this.dots.joins, this.voidMarks, this.hits]) o.dispose()
    for (const g of this.geometries) g.dispose()
    for (const g of this.washes.values()) g.dispose()
    this.arc.geometry.dispose()
    disposeBoardMaterials(this.mats)
  }
}
