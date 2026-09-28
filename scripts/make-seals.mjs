#!/usr/bin/env node
// Generates the cinnabar seals and the favicon (design.md §4.4, §2.3). Outputs are committed.
//
//   node scripts/make-seals.mjs [--png]      --png also writes preview PNGs to /tmp/cy-seals
//
// The 林 glyph is hand-traced as stroke centrelines on the 100 × 100 grid, after the Shuowen
// small-seal form (scripts/seals/refs/林-seal.svg, public domain, Wikimedia Commons): two 木, each
// a stem with upturned branches and downturned roots, squared up to fill the field the way seal
// carvers adapt 小篆 to a square (缪篆). Every stamp is seeded, so reruns are stable.
//
// Carving roughness, the pressed rim and uneven 印泥 are geometry and masks baked into each file.
// No SVG filters: they are slow on phones. Each placement gets its own press (a different
// seed) and a fixed resting angle between −2° and 2°, never 0° (design.md §4.4).
// Owner: tooling.

import { execFileSync } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'
import { ROOT } from './collect-cjk.mjs'

const { color } = await import('../src/theme/tokens.ts')
const OUT = join(ROOT, 'public/seals')

// ------------------------------------------------------------------------------------ random

function rngFrom(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const between = (rng, lo, hi) => lo + (hi - lo) * rng()

/** Smooth 1D value noise in −1..1. */
function noise1(rng) {
  const v = Array.from({ length: 97 }, () => rng() * 2 - 1)
  return (x) => {
    const i = Math.floor(x)
    const f = x - i
    const a = v[((i % 97) + 97) % 97]
    const b = v[(((i + 1) % 97) + 97) % 97]
    const t = (1 - Math.cos(f * Math.PI)) / 2
    return a * (1 - t) + b * t
  }
}

// ------------------------------------------------------------------------------------ paths

/** Parses SVG path data (M L H V C S Q Z, absolute and relative) into flattened subpaths. */
function flattenPath(d, step = 0.8) {
  const tokens = d.match(/[a-df-zA-DF-Z]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/g) ?? []
  const subpaths = []
  let cur = null
  let x = 0
  let y = 0
  let sx = 0
  let sy = 0
  let lastCtrl = null
  let cmd = ''
  let i = 0
  const num = () => Number(tokens[i++])
  const push = (px, py) => cur.points.push([px, py])
  const cubic = (x1, y1, x2, y2, x3, y3) => {
    const len = Math.hypot(x1 - x, y1 - y) + Math.hypot(x2 - x1, y2 - y1) + Math.hypot(x3 - x2, y3 - y2)
    const n = Math.max(2, Math.ceil(len / step))
    for (let k = 1; k <= n; k++) {
      const t = k / n
      const u = 1 - t
      push(
        u * u * u * x + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3,
        u * u * u * y + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3,
      )
    }
  }
  while (i < tokens.length) {
    if (/[a-zA-Z]/.test(tokens[i])) cmd = tokens[i++]
    const rel = cmd === cmd.toLowerCase()
    const ox = rel ? x : 0
    const oy = rel ? y : 0
    switch (cmd.toUpperCase()) {
      case 'M': {
        x = ox + num()
        y = oy + num()
        sx = x
        sy = y
        cur = { points: [[x, y]], closed: false }
        subpaths.push(cur)
        cmd = rel ? 'l' : 'L'
        lastCtrl = null
        break
      }
      case 'L':
        x = ox + num()
        y = oy + num()
        push(x, y)
        lastCtrl = null
        break
      case 'H':
        x = (rel ? x : 0) + num()
        push(x, y)
        lastCtrl = null
        break
      case 'V':
        y = (rel ? y : 0) + num()
        push(x, y)
        lastCtrl = null
        break
      case 'C': {
        const [x1, y1, x2, y2, x3, y3] = [ox + num(), oy + num(), ox + num(), oy + num(), ox + num(), oy + num()]
        cubic(x1, y1, x2, y2, x3, y3)
        x = x3
        y = y3
        lastCtrl = [x2, y2]
        break
      }
      case 'S': {
        const [x1, y1] = lastCtrl ? [2 * x - lastCtrl[0], 2 * y - lastCtrl[1]] : [x, y]
        const [x2, y2, x3, y3] = [ox + num(), oy + num(), ox + num(), oy + num()]
        cubic(x1, y1, x2, y2, x3, y3)
        x = x3
        y = y3
        lastCtrl = [x2, y2]
        break
      }
      case 'Q': {
        const [qx, qy, x3, y3] = [ox + num(), oy + num(), ox + num(), oy + num()]
        cubic(x + (2 / 3) * (qx - x), y + (2 / 3) * (qy - y), x3 + (2 / 3) * (qx - x3), y3 + (2 / 3) * (qy - y3), x3, y3)
        x = x3
        y = y3
        lastCtrl = null
        break
      }
      case 'Z':
        cur.closed = true
        x = sx
        y = sy
        lastCtrl = null
        break
      default:
        throw new Error(`unsupported path command ${cmd}`)
    }
  }
  return subpaths
}

/** Resamples a polyline to roughly even spacing. */
function resample(points, spacing) {
  const out = [points[0]]
  let carry = 0
  for (let k = 1; k < points.length; k++) {
    const [ax, ay] = points[k - 1]
    const [bx, by] = points[k]
    const seg = Math.hypot(bx - ax, by - ay)
    let t = spacing - carry
    while (t <= seg) {
      out.push([ax + ((bx - ax) * t) / seg, ay + ((by - ay) * t) / seg])
      t += spacing
    }
    carry = seg - (t - spacing)
  }
  const last = points.at(-1)
  if (Math.hypot(last[0] - out.at(-1)[0], last[1] - out.at(-1)[1]) > spacing * 0.3) out.push(last)
  return out
}

const signedArea = (poly) => {
  let s = 0
  for (let k = 0; k < poly.length; k++) {
    const [ax, ay] = poly[k]
    const [bx, by] = poly[(k + 1) % poly.length]
    s += ax * by - bx * ay
  }
  return s / 2
}
/** Same winding for every ink polygon, so the nonzero fill unions overlaps instead of punching holes. */
const clockwise = (poly) => (signedArea(poly) < 0 ? poly.toReversed() : poly)

function pointInPoly([px, py], poly) {
  let inside = false
  for (let a = 0, b = poly.length - 1; a < poly.length; b = a++) {
    const [ax, ay] = poly[a]
    const [bx, by] = poly[b]
    if (ay > py !== by > py && px < ((bx - ax) * (py - ay)) / (by - ay) + ax) inside = !inside
  }
  return inside
}

/** One decimal, no trailing .0, no leading zero: path data is most of each seal's bytes. */
const num1 = (n) =>
  (Math.round(n * 10) / 10)
    .toFixed(1)
    .replace(/\.0$/, '')
    .replace(/^(-?)0\./, '$1.')

/** Compact path data: absolute first point, then relative lines. */
function polyToD(poly) {
  const r = num1
  let d = `M${r(poly[0][0])} ${r(poly[0][1])}l`
  let px = Math.round(poly[0][0] * 10) / 10
  let py = Math.round(poly[0][1] * 10) / 10
  const parts = []
  for (let k = 1; k < poly.length; k++) {
    const qx = Math.round(poly[k][0] * 10) / 10
    const qy = Math.round(poly[k][1] * 10) / 10
    const dx = qx - px
    const dy = qy - py
    if (dx === 0 && dy === 0) continue
    parts.push(`${r(dx)}${dy < 0 ? '' : ' '}${r(dy)}`)
    px = qx
    py = qy
  }
  d += parts.join(' ').replace(/ -/g, '-')
  return `${d}z`
}

// ------------------------------------------------------------------------------------ carving

/**
 * Outlines a centreline as a carved stroke: width wanders a few percent, the edges carry fine
 * knife chatter, and the ends are blunt, slightly squared caps.
 */
function carveStroke(centre, halfWidth, rng, { chatter = 0.28, wander = 0.07 } = {}) {
  const pts = resample(centre, 1.6)
  const wn = noise1(rng)
  const el = noise1(rng)
  const er = noise1(rng)
  const phase = rng() * 50
  const left = []
  const right = []
  let s = 0
  const normalAt = (k) => {
    const a = pts[Math.max(0, k - 1)]
    const b = pts[Math.min(pts.length - 1, k + 1)]
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
    return [-(b[1] - a[1]) / len, (b[0] - a[0]) / len]
  }
  for (let k = 0; k < pts.length; k++) {
    if (k) s += Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1])
    const [nx, ny] = normalAt(k)
    const w = halfWidth * (1 + wander * wn(phase + s / 11))
    const jl = chatter * el(s / 1.7) + chatter * 0.4 * (rng() * 2 - 1)
    const jr = chatter * er(s / 1.7) + chatter * 0.4 * (rng() * 2 - 1)
    left.push([pts[k][0] + nx * (w + jl), pts[k][1] + ny * (w + jl)])
    right.push([pts[k][0] - nx * (w + jr), pts[k][1] - ny * (w + jr)])
  }
  const cap = (k, dir) => {
    const [nx, ny] = normalAt(k)
    const tx = ny * dir
    const ty = -nx * dir
    const w = halfWidth * (1 + wander * wn(phase + (k ? s : 0) / 11))
    const out = []
    for (const deg of [60, 30, 0, -30, -60]) {
      const a = (deg * Math.PI) / 180
      // Superellipse: blunter than a round cap, softer than a square one.
      const c = Math.cos(a)
      const sn = Math.sin(a)
      const rad = w / Math.pow(Math.abs(c) ** 3 + Math.abs(sn) ** 3, 1 / 3)
      const j = 1 + 0.06 * (rng() * 2 - 1)
      out.push([pts[k][0] + (tx * c * 0.8 + nx * sn * dir) * rad * j, pts[k][1] + (ty * c * 0.8 + ny * sn * dir) * rad * j])
    }
    return out
  }
  const end = cap(pts.length - 1, -1)
  const start = cap(0, 1)
  return clockwise([...left, ...end, ...right.toReversed(), ...start])
}

/**
 * A closed outline with the same knife chatter along its normals. Orientation is kept, because
 * reference glyphs are filled even-odd and their counters are reversed contours.
 */
function roughenOutline(poly, rng, chatter = 0.22, spacing = 1.3) {
  const pts = resample([...poly, poly[0]], spacing).slice(0, -1)
  const en = noise1(rng)
  let s = 0
  return pts.map((p, k) => {
    const a = pts[(k - 1 + pts.length) % pts.length]
    const b = pts[(k + 1) % pts.length]
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
    if (k) s += Math.hypot(p[0] - pts[k - 1][0], p[1] - pts[k - 1][1])
    const j = chatter * en(s / 1.6) + chatter * 0.4 * (rng() * 2 - 1)
    return [p[0] - ((b[1] - a[1]) / len) * j, p[1] + ((b[0] - a[0]) / len) * j]
  })
}

/** Rounded square outline, sampled and roughened. Worn corners have a slightly larger radius. */
function roughSquare(x0, y0, x1, y1, radius, rng, chatter) {
  const pts = []
  const corners = [
    [x1 - radius, y0 + radius, -90],
    [x1 - radius, y1 - radius, 0],
    [x0 + radius, y1 - radius, 90],
    [x0 + radius, y0 + radius, 180],
  ]
  for (const [cx, cy, a0] of corners) {
    const rr = radius * between(rng, 0.8, 1.35)
    for (let a = a0; a <= a0 + 90; a += 15) {
      const t = (a * Math.PI) / 180
      pts.push([cx + Math.cos(t) * rr, cy + Math.sin(t) * rr])
    }
  }
  return roughenOutline(pts, rng, chatter)
}

/** An irregular blob, for bites, voids and patches. */
function blob(cx, cy, r, rng, vertices = 6) {
  const pts = []
  const turn = rng() * Math.PI * 2
  for (let k = 0; k < vertices; k++) {
    const a = turn + (k / vertices) * Math.PI * 2
    const rr = r * between(rng, 0.65, 1.25)
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * between(rng, 0.8, 1.1)])
  }
  return clockwise(pts)
}

// ------------------------------------------------------------------------------------ glyphs

/**
 * 林 as centrelines. Each 木: a stem, branches as a U whose base meets the stem, roots as an
 * arch that leaves the stem lower down. `box` is the glyph's field; strokes stay inside it.
 */
function linCentrelines([x0, y0, x1, y1], { armTop = 0.02, armBase = 0.4, rootTop = 0.575 } = {}) {
  const w = x1 - x0
  const h = y1 - y0
  const Y = (f) => y0 + f * h
  const lines = []
  // The halves are not mirror images: the right 木 sits a touch higher at the roots, as brushed seals do.
  const trees = [
    { cx: x0 + w * 0.245, a: w * 0.175, root: rootTop },
    { cx: x0 + w * 0.755, a: w * 0.175, root: rootTop - 0.015 },
  ]
  for (const { cx, a, root } of trees) {
    const bend = a * 0.95
    lines.push([
      [cx, Y(0)],
      [cx, Y(1)],
    ])
    lines.push(
      flattenPath(
        `M${cx - a} ${Y(armTop)} V${Y(armBase) - bend} Q${cx - a} ${Y(armBase)} ${cx} ${Y(armBase)} Q${cx + a} ${Y(armBase)} ${cx + a} ${Y(armBase) - bend} V${Y(armTop)}`,
      )[0].points,
    )
    lines.push(
      flattenPath(
        `M${cx - a} ${Y(1)} V${Y(root) + bend} Q${cx - a} ${Y(root)} ${cx} ${Y(root)} Q${cx + a} ${Y(root)} ${cx + a} ${Y(root) + bend} V${Y(1)}`,
      )[0].points,
    )
  }
  return lines
}

// ------------------------------------------------------------------------------------ stamp

/**
 * Boundary runs of the union of overlapping carved strokes: the parts of each outline that are
 * not inside another stroke. The pressed rim follows these, so joints show no seams.
 */
function unionEdges(polys) {
  const runs = []
  polys.forEach((poly, i) => {
    let run = []
    const flush = () => {
      if (run.length > 1) runs.push(run)
      run = []
    }
    for (const pt of [...poly, poly[0]]) {
      if (polys.some((other, j) => j !== i && pointInPoly(pt, other))) flush()
      else run.push(pt)
    }
    flush()
  })
  return runs
}

const runToD = (run) => polyToD(run).slice(0, -1)

/**
 * Builds one impression.
 *   style 'zhu' (朱文): red strokes and a red frame on paper.
 *   style 'bai' (白文): a red field with the strokes cut out, so paper shows through.
 * `carved` are overlapping stroke polygons (nonzero union). `outlines` are reference glyph
 * outlines (even-odd, with counters) thickened by `thicken` units.
 */
function stamp({ id, style, carved = [], outlines = [], thicken = 0, seed, angle = 0, inkpad = 1, frame = 5.2 }) {
  const rng = rngFrom(seed)
  const edgeRng = rngFrom(seed * 7 + 1)
  const bites = []
  const bleed = []
  const rims = unionEdges(carved)
  let frameD = ''
  let insideField

  // Stroke-edge bites (朱文) or red creeping into the cuts (白文), along the visible edges only.
  for (const run of rims) {
    for (const pt of run) {
      if (edgeRng() < 0.035) (style === 'zhu' ? bites : bleed).push(blob(pt[0], pt[1], between(edgeRng, 0.35, 0.85), edgeRng, 5))
    }
  }
  const inGlyph = (pt) =>
    carved.some((q) => pointInPoly(pt, q)) || outlines.reduce((inside, q) => (pointInPoly(pt, q) ? !inside : inside), false)

  if (style === 'zhu') {
    const outer = roughSquare(3.2, 3.2, 96.8, 96.8, 3.2, rng, 0.3)
    const inner = roughSquare(3.2 + frame, 3.2 + frame, 96.8 - frame, 96.8 - frame, 1.2, rng, 0.25)
    frameD = polyToD(outer) + polyToD(inner)
    rims.push([...outer, outer[0]], [...inner, inner[0]])
    // Chips out of the frame's outer edge, the wear of an old stone.
    for (let k = 0; k < 4; k++) {
      const pt = outer[Math.floor(rng() * outer.length)]
      bites.push(blob(pt[0], pt[1], between(rng, 1.1, 2.3), rng, 7))
    }
    insideField = (pt) => (pointInPoly(pt, outer) && !pointInPoly(pt, inner)) || inGlyph(pt)
  } else {
    const field = roughSquare(2.6, 2.6, 97.4, 97.4, 2.4, rng, 0.35)
    frameD = polyToD(field)
    rims.push([...field, field[0]])
    for (let k = 0; k < 5; k++) {
      const pt = field[Math.floor(rng() * field.length)]
      bites.push(blob(pt[0], pt[1], between(rng, 0.9, 2.1), rng, 7))
    }
    insideField = (pt) => pointInPoly(pt, field) && !inGlyph(pt)
  }

  // 印泥: pressure falls off toward one side, so voids and pale patches gather there.
  const pr = rngFrom(seed * 13 + 5)
  const theta = pr() * Math.PI * 2
  const [gx, gy] = [Math.cos(theta), Math.sin(theta)]
  const pressure = (x, y) => 0.5 + 0.5 * (((x - 50) * gx + (y - 50) * gy) / 50)
  const voids = []
  for (let tries = 0; voids.length < 70 * inkpad && tries < 6000; tries++) {
    const x = between(pr, 3, 97)
    const y = between(pr, 3, 97)
    if (pr() > 0.12 + 0.88 * (1 - pressure(x, y)) ** 2) continue
    if (!insideField([x, y])) continue
    voids.push(blob(x, y, 0.22 + 0.75 * pr() ** 3, pr, 5))
  }
  // Pale, thin-paste areas on the low-pressure side, stepped so they have no hard edge.
  const patches = [[], [], []]
  for (let k = 0; k < 3; k++) {
    const d = between(pr, 16, 34)
    const px = 50 - gx * d + between(pr, -14, 14)
    const py = 50 - gy * d + between(pr, -14, 14)
    const r = between(pr, 8, 15)
    patches[0].push(blob(px, py, r, pr, 11))
    patches[1].push(blob(px + between(pr, -2, 2), py + between(pr, -2, 2), r * 0.7, pr, 10))
    patches[2].push(blob(px + between(pr, -2, 2), py + between(pr, -2, 2), r * 0.4, pr, 9))
  }

  const g = `${id}-g`
  const p = `${id}-p`
  const f = `${id}-f`
  const c = `${id}-c`
  const o = `${id}-o`
  const pad = angle ? 2.5 : 0
  const view = `${-pad} ${-pad} ${100 + 2 * pad} ${100 + 2 * pad}`
  const area = 'x="-5" y="-5" width="110" height="110"'
  const on = style === 'zhu' ? '#fff' : '#000'
  const thick = thicken ? ` stroke="${on}" stroke-width="${thicken}" stroke-linejoin="round"` : ''
  const defs = [
    `<path id="${f}" d="${frameD}"/>`,
    carved.length ? `<path id="${c}" d="${carved.map(polyToD).join('')}"/>` : '',
    outlines.length ? `<path id="${o}" d="${outlines.map(polyToD).join('')}"/>` : '',
  ].join('')
  const glyphUses = [
    carved.length ? `<use href="#${c}" fill="${on}"/>` : '',
    outlines.length ? `<use href="#${o}" fill="${on}" fill-rule="evenodd"${thick}/>` : '',
  ].join('')
  const glyphMask =
    style === 'zhu'
      ? `<use href="#${f}" fill="#fff" fill-rule="evenodd"/>${glyphUses}`
      : `<use href="#${f}" fill="#fff"/>${glyphUses}${bleed.length ? `<path fill="#fff" d="${bleed.map(polyToD).join('')}"/>` : ''}`
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${view}">`,
    `<defs>${defs}`,
    `<mask id="${g}" maskUnits="userSpaceOnUse" ${area}>${glyphMask}<path fill="#000" d="${bites.map(polyToD).join('')}"/></mask>`,
    `<mask id="${p}" maskUnits="userSpaceOnUse" ${area}><rect ${area} fill="#fff"/>`,
    ['#f1f1f1', '#e7e7e7', '#dddddd'].map((grey, k) => `<path fill="${grey}" d="${patches[k].map(polyToD).join('')}"/>`).join(''),
    `<path fill="#000" d="${voids.map(polyToD).join('')}"/></mask>`,
    '</defs>',
    `<g${angle ? ` transform="rotate(${angle} 50 50)"` : ''} mask="url(#${p})"><g mask="url(#${g})">`,
    `<rect ${area} fill="${color.cinnabar}"/>`,
    // The pressed rim: paste gathers at the edges of the impression, a shade darker.
    `<path fill="none" stroke="${color.cinnabarDeep}" stroke-width="1.3" stroke-opacity=".6" stroke-linejoin="round" d="${rims.map(runToD).join('')}"/>`,
    '</g></g></svg>',
  ].join('')
  return svg
}

/** The favicon: a clean 白文 square with paper strokes, legible at 16 px on light or dark tabs. */
function favicon(glyphPolys) {
  const rng = rngFrom(11)
  const field = roughSquare(4, 4, 96, 96, 7, rng, 0.2)
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' +
    `<path fill="${color.cinnabar}" d="${polyToD(field)}"/>` +
    `<path fill="${color.paperLight}" d="${glyphPolys.map(polyToD).join('')}"/></svg>`
  )
}

// ------------------------------------------------------------------------------------ build

const carveAll = (lines, hw, seed, opts) => {
  const rng = rngFrom(seed)
  return lines.map((l) => carveStroke(l, hw, rng, opts))
}

// 朱文 林: frame inner edge at 8.4, glyph field inset a little further.
const linZhu = carveAll(linCentrelines([15.5, 14, 84.5, 86]), 3.15, 101)
// 白文 林: strokes are cut, so they run wider and closer to the edge.
const linBai = carveAll(linCentrelines([15, 12.5, 85, 87.5]), 4.3, 202)
const linIcon = carveAll(linCentrelines([17, 15, 83, 85]), 5.4, 303, { chatter: 0.08, wander: 0.03 })


await mkdir(OUT, { recursive: true })

/** Resting angles per placement (design.md §4.4). Also listed in public/seals/seals.json. */
const placements = {
  nav: -1.2,
  hero: 1.4,
  desk: -0.8,
  finale: 1.7,
}

const files = {
  'lin-zhuwen.svg': stamp({ id: 'lz', style: 'zhu', carved: linZhu, seed: 21 }),
  'lin-baiwen.svg': stamp({ id: 'lb', style: 'bai', carved: linBai, seed: 22 }),
  'lin-zhuwen-nav.svg': stamp({ id: 'lzn', style: 'zhu', carved: linZhu, seed: 31, angle: placements.nav, inkpad: 0.6 }),
  'lin-baiwen-hero.svg': stamp({ id: 'lbh', style: 'bai', carved: linBai, seed: 32, angle: placements.hero }),
  'lin-zhuwen-finale.svg': stamp({ id: 'lzf', style: 'zhu', carved: linZhu, seed: 33, angle: placements.finale }),
}
for (const [file, svg] of Object.entries(files)) {
  await writeFile(join(OUT, file), `${svg}\n`)
  console.log(`${file.padEnd(26)} ${String(svg.length).padStart(6)} B raw ${String(gzipSync(svg).length).padStart(6)} B gzip`)
}
await writeFile(
  join(OUT, 'seals.json'),
  `${JSON.stringify(
    {
      note: 'Resting angles in degrees, clockwise positive. Files named -nav, -hero, -finale have theirs baked in; rotate the base files yourself for other placements (the cabin-desk decal uses desk).',
      angles: placements,
      files: Object.keys(files),
    },
    null,
    2,
  )}\n`,
)

const icon = favicon(linIcon)
await writeFile(join(ROOT, 'public/favicon.svg'), `${icon}\n`)

// Raster versions need rsvg-convert (librsvg) and ImageMagick; both are optional.
try {
  const touch = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180"><rect width="180" height="180" fill="${color.paper}"/><svg x="26" y="26" width="128" height="128" viewBox="-2.5 -2.5 105 105">${files['lin-baiwen.svg'].replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '')}</svg></svg>`
  execFileSync('rsvg-convert', ['-w', '180', '-h', '180', '-o', join(ROOT, 'public/apple-touch-icon.png')], { input: touch })
  // The cabin-desk decal texture. Palette PNG: a quarter of the size of full RGBA, alpha kept.
  const decal = execFileSync('rsvg-convert', ['-w', '256', '-h', '256', join(OUT, 'lin-zhuwen.svg')])
  const sharp = (await import('sharp')).default
  await sharp(decal).png({ palette: true, quality: 80, compressionLevel: 9 }).toFile(join(OUT, 'lin-zhuwen-256.png'))
  execFileSync('rsvg-convert', ['-w', '32', '-h', '32', '-o', '/tmp/cy-favicon-32.png', join(ROOT, 'public/favicon.svg')])
  execFileSync('rsvg-convert', ['-w', '16', '-h', '16', '-o', '/tmp/cy-favicon-16.png', join(ROOT, 'public/favicon.svg')])
  execFileSync('magick', ['/tmp/cy-favicon-16.png', '/tmp/cy-favicon-32.png', join(ROOT, 'public/favicon.ico')])
  if (process.argv.includes('--png')) {
    await mkdir('/tmp/cy-seals', { recursive: true })
    for (const file of Object.keys(files)) {
      for (const size of [28, 44, 64, 400]) {
        execFileSync('rsvg-convert', ['-w', String(size), '-b', color.paper, '-o', `/tmp/cy-seals/${file.replace('.svg', '')}-${size}.png`, join(OUT, file)])
      }
    }
  }
} catch (error) {
  console.warn(`raster icons skipped: ${error.message}`)
}
