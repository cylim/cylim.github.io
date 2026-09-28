import {
  BoxGeometry,
  BufferGeometry,
  Color,
  CylinderGeometry,
  ExtrudeGeometry,
  Float32BufferAttribute,
  LatheGeometry,
  Matrix4,
  Quaternion,
  Shape,
  Vector2,
  Vector3,
} from 'three'
import { hall } from '../../../core/world/layout'
import { color } from '../../../theme/tokens'
import { IGNITE_FULL_S } from './hallUniforms'
import { LineBuilder, type LineStyle } from './lines'

/**
 * The hall's timber frame and desk as line work (design.md §8.4): paired posts on plinths, each
 * capped with a 斗拱 bracket set (栌斗 base block, crossing 拱 arms, 升 blocks), beams across each
 * pair, and the 书案 writing desk with its inkstone, five-peak brush rest and brush.
 * Interlocking standard parts: the oldest component library in Chinese building.
 */

/** Post top (the bracket set's base). */
export const POST_TOP = hall.floor.y + hall.postPairs.height
const POST_RADIUS = { top: 0.13, bottom: 0.15 }

/** Bracket set heights, from the post top: 栌斗, 拱 arms, 升 blocks. The beam sits on the 升. */
const LUDOU = { top: 0.36, bottom: 0.26, straight: 0.08, taper: 0.06 }
const ARM = { height: 0.1, width: 0.08, along: 1.05, across: 0.9, curl: 0.08 }
const SHENG = { top: 0.16, bottom: 0.12, straight: 0.05, taper: 0.03 }
const BEAM = { height: 0.26, depth: 0.2, overhang: 0.3 }

const NOMINAL_ORIGIN = new Vector3(hall.centreLineX, hall.floor.y, hall.floor.zNorth - 0.5)

/** The shader's floor front (hall.glsl igniteArrival), from the doorway. */
export function floorArrival(p: Vector3): number {
  const d = Math.hypot(p.x - NOMINAL_ORIGIN.x, p.z - NOMINAL_ORIGIN.z)
  return d < 12 ? d / 12 : 1 + (d - 12) / 30
}

/** Brackets light last, near to far, and finish inside the 2.5 s ignition. */
function bracketArrival(p: Vector3): number {
  const depth = (hall.floor.zNorth - p.z) / (hall.floor.zNorth - hall.floor.zSouth)
  return IGNITE_FULL_S - 0.6 + 0.3 * Math.min(1, Math.max(0, depth))
}

const scaled = (hex: string, k: number) => new Color(hex).multiplyScalar(k)

export const LINE_STYLES = {
  bracket: { color: scaled(color.cyanLine, 1.7), idle: 0.9, arrive: bracketArrival },
  beam: { color: scaled(color.cyanGhost, 2.2), idle: 0.6, arrive: bracketArrival },
  plinth: { color: scaled(color.cyanGhost, 1.8), idle: 0.5, arrive: floorArrival },
  desk: { color: scaled(color.cyanLine, 1.25), idle: 0.6, arrive: floorArrival },
  wire: { color: scaled(color.cyanLine, 1.1), idle: 0.3, arrive: floorArrival },
} satisfies Record<string, LineStyle>

const at = (x: number, y: number, z: number, rotY = 0, s: Vector3 = new Vector3(1, 1, 1)) =>
  new Matrix4().compose(new Vector3(x, y, z), new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), rotY), s)

/** A 斗 block: a square frustum (the 欹) under a straight square (耳 and 平), base at y 0. */
function dou(top: number, bottom: number, taper: number, straight: number): BufferGeometry {
  // A 4-sided cylinder turned 45° is a square frustum; its corners sit at radius side/√2.
  const frustum = new CylinderGeometry(top / Math.SQRT2, bottom / Math.SQRT2, taper, 4, 1)
  frustum.rotateY(Math.PI / 4)
  frustum.translate(0, taper / 2, 0)
  const box = new BoxGeometry(top, straight, top)
  box.translate(0, taper + straight / 2, 0)
  return mergeSolids([frustum, box])
}

/** A 拱 arm along local x: flat top, ends rounded underneath (卷杀), centred, base at y 0. */
function arm(length: number): BufferGeometry {
  const h = ARM.height
  const l = length / 2
  const c = ARM.curl
  const s = new Shape()
  s.moveTo(-l, h)
  s.lineTo(l, h)
  s.lineTo(l, h * 0.45)
  s.quadraticCurveTo(l, 0, l - c, 0)
  s.lineTo(-l + c, 0)
  s.quadraticCurveTo(-l, 0, -l, h * 0.45)
  s.closePath()
  const g = new ExtrudeGeometry(s, { depth: ARM.width, bevelEnabled: false, curveSegments: 3 })
  g.translate(0, 0, -ARM.width / 2)
  return g
}

/** Position-only merge; EdgesGeometry needs nothing else. */
function mergeSolids(parts: BufferGeometry[]): BufferGeometry {
  const positions: number[] = []
  for (const p of parts) {
    const g = p.index ? p.toNonIndexed() : p
    const a = g.getAttribute('position')
    for (let i = 0; i < a.count; i++) positions.push(a.getX(i), a.getY(i), a.getZ(i))
    if (g !== p) g.dispose()
    p.dispose()
  }
  const out = new BufferGeometry()
  out.setAttribute('position', new Float32BufferAttribute(positions, 3))
  return out
}

/** One bracket set on a post top at (x, POST_TOP, z). The 华拱 runs along the beam (x). */
function bracketSet(lines: LineBuilder, x: number, z: number) {
  const y0 = POST_TOP
  const style = LINE_STYLES.bracket
  lines.edges(dou(LUDOU.top, LUDOU.bottom, LUDOU.taper, LUDOU.straight), at(x, y0, z), style)
  const armY = y0 + LUDOU.taper + LUDOU.straight
  lines.edges(arm(ARM.along), at(x, armY, z), style, 25)
  lines.edges(arm(ARM.across), at(x, armY, z, Math.PI / 2), style, 25)
  const shengY = armY + ARM.height
  const reach = [ARM.along / 2 - 0.08, ARM.across / 2 - 0.08]
  const spots: [number, number][] = [
    [0, 0],
    [reach[0] ?? 0, 0],
    [-(reach[0] ?? 0), 0],
    [0, reach[1] ?? 0],
    [0, -(reach[1] ?? 0)],
  ]
  for (const [dx, dz] of spots) lines.edges(dou(SHENG.top, SHENG.bottom, SHENG.taper, SHENG.straight), at(x + dx, shengY, z + dz), style)
}

/** Height of the bracket set: the beam's underside sits this far above the post top. */
export const BRACKET_HEIGHT = LUDOU.taper + LUDOU.straight + ARM.height + SHENG.taper + SHENG.straight

/** Every static line in the hall except the desk: plinths, bracket sets and beams. */
export function frameLines(lines: LineBuilder): LineBuilder {
  const [xa = 0, xb = 8] = hall.postPairs.x
  for (const z of hall.postPairs.z) {
    for (const x of hall.postPairs.x) {
      const plinth = new CylinderGeometry(0.21, 0.25, 0.1, 8, 1)
      plinth.translate(0, 0.05, 0)
      lines.edges(plinth, at(x, hall.floor.y, z), LINE_STYLES.plinth, 30)
      bracketSet(lines, x, z)
    }
    const span = Math.abs(xb - xa) + 2 * BEAM.overhang
    const beamY = POST_TOP + BRACKET_HEIGHT + BEAM.height / 2
    lines.edges(new BoxGeometry(span, BEAM.height, BEAM.depth), at((xa + xb) / 2, beamY, z), LINE_STYLES.beam)
  }
  return lines
}

/** Instanced post geometry: tapered round columns whose UV u runs up the post (the grain). */
export function postGeometry(): BufferGeometry {
  const h = hall.postPairs.height
  const g = new CylinderGeometry(POST_RADIUS.top, POST_RADIUS.bottom, h, 12, 1, true)
  g.translate(0, h / 2, 0)
  const uv = g.getAttribute('uv')
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getY(i), uv.getX(i))
  return g
}

// ---------------------------------------------------------------------------- the desk (§8.4 I3)

/** The desk's frame of reference: origin on the floor under its centre; the top is at y DESK_TOP. */
export const DESK_TOP = hall.desk.topY - hall.desk.pos[1]

/** The paper sheet on the desk, desk-local: centre, size (m), yaw. The seal sits in its lower left. */
export const PAPER = { centre: new Vector3(-0.1, DESK_TOP + 0.0015, 0.06), size: new Vector2(0.3, 0.42), yawDeg: -4 }
/** The inkstone's well, desk-local centre and radii (an ellipse on the stone's top). */
export const WELL = { centre: new Vector3(0.55, DESK_TOP + 0.0302, 0.03), rx: 0.05, rz: 0.036 }

/** 翘头 raised end: a small upturned curl on each end of the top board, extruded across its depth. */
function raisedEnd(): BufferGeometry {
  const s = new Shape()
  s.moveTo(0, 0)
  s.lineTo(0.1, 0)
  s.quadraticCurveTo(0.14, 0, 0.15, 0.045)
  s.lineTo(0.13, 0.05)
  s.quadraticCurveTo(0.12, 0.018, 0.08, 0.018)
  s.lineTo(0, 0.018)
  s.closePath()
  const g = new ExtrudeGeometry(s, { depth: hall.desk.depth, bevelEnabled: false, curveSegments: 4 })
  g.translate(0, 0, -hall.desk.depth / 2)
  return g
}

/** 笔山: five small peaks, the tallest in the middle, the landscape outside in miniature. */
function brushRest(): BufferGeometry {
  const peaks = [0.024, 0.038, 0.055, 0.038, 0.024]
  const w = 0.18
  const s = new Shape()
  s.moveTo(-w / 2, 0)
  peaks.forEach((h, i) => {
    const x = -w / 2 + ((i + 0.5) / peaks.length) * w
    s.lineTo(x - w / 20, h * 0.55)
    s.lineTo(x, h)
    s.lineTo(x + w / 20, h * 0.55)
  })
  s.lineTo(w / 2, 0)
  s.closePath()
  const g = new ExtrudeGeometry(s, { depth: 0.026, bevelEnabled: false })
  g.translate(0, 0, -0.013)
  return g
}

/** A brush lying along x: handle, ferrule and a tapering tip. */
function brush(): BufferGeometry {
  const profile = [
    new Vector2(0, 0),
    new Vector2(0.0055, 0.004),
    new Vector2(0.006, 0.16),
    new Vector2(0.0075, 0.165),
    new Vector2(0.0075, 0.18),
    new Vector2(0.0068, 0.2),
    new Vector2(0, 0.235),
  ]
  const g = new LatheGeometry(profile, 6)
  g.rotateZ(-Math.PI / 2)
  g.translate(-0.12, 0, 0)
  return g
}

/**
 * The desk in desk-local coordinates (add hall.desk.pos): top board with raised ends, legs, aprons,
 * end stretchers, inkstone and well rim, brush rest and brush, and the wires that run up the back
 * legs into the pane's base.
 */
export function deskLines(lines: LineBuilder, origin: Vector3): LineBuilder {
  const { width, depth } = hall.desk
  const o = (x: number, y: number, z: number, rotY = 0, s?: Vector3) => at(origin.x + x, origin.y + y, origin.z + z, rotY, s)
  const style = LINE_STYLES.desk
  const board = 0.045
  const legX = width / 2 - 0.12
  const legZ = depth / 2 - 0.1
  lines.edges(new BoxGeometry(width, board, depth), o(0, DESK_TOP - board / 2, 0), style)
  lines.edges(raisedEnd(), o(width / 2 - 0.15, DESK_TOP, 0), style, 25)
  lines.edges(raisedEnd(), o(-(width / 2 - 0.15), DESK_TOP, 0, 0, new Vector3(-1, 1, 1)), style, 25)
  const legH = DESK_TOP - board
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) lines.edges(new BoxGeometry(0.05, legH, 0.05), o(sx * legX, legH / 2, sz * legZ), style)
    for (const y of [0.12, 0.5]) lines.edges(new BoxGeometry(0.03, 0.03, 2 * legZ), o(sx * legX, y, 0), style)
  }
  for (const sz of [-1, 1]) lines.edges(new BoxGeometry(2 * legX, 0.05, 0.02), o(0, legH - 0.03, sz * (legZ + 0.04)), style)
  // Inkstone and the rim of its well.
  lines.edges(new BoxGeometry(0.15, 0.03, 0.24), o(WELL.centre.x, DESK_TOP + 0.015, WELL.centre.z + 0.08), style)
  const rim: Vector3[] = []
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2
    rim.push(new Vector3(origin.x + WELL.centre.x + Math.cos(a) * WELL.rx, origin.y + WELL.centre.y + 0.0005, origin.z + WELL.centre.z + Math.sin(a) * WELL.rz))
  }
  lines.polyline(rim, style, false, true)
  // Brush rest to the left of the paper, the brush across its valleys.
  lines.edges(brushRest(), o(-0.6, DESK_TOP, 0.2), style, 25)
  lines.edges(brush(), o(-0.6, DESK_TOP + 0.03, 0.2, 0.08), style, 30)
  // Wires up the back legs into the pane's base (design.md §10.1).
  const pane = hall.terminalPane
  const tilt = (-pane.tiltBackDeg * Math.PI) / 180
  const baseY = pane.centre[1] - (pane.height / 2) * Math.cos(tilt) - origin.y
  const baseZ = pane.centre[2] + (pane.height / 2) * Math.sin(-tilt) - origin.z
  for (const sx of [-1, 1]) {
    const x = sx * legX
    lines.polyline(
      [
        new Vector3(origin.x + x + sx * 0.03, origin.y, origin.z - legZ),
        new Vector3(origin.x + x + sx * 0.03, origin.y + legH, origin.z - legZ),
        new Vector3(origin.x + sx * (pane.width / 2 - 0.1), origin.y + baseY, origin.z + baseZ),
      ],
      LINE_STYLES.wire,
      true,
    )
  }
  return lines
}
