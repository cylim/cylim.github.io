/**
 * The procedural emblem a scroll shows when its project has no screenshot (NDA work, or none
 * cleared yet; design.md §8.4 I2). Seeded from a hash of the project name, so each project keeps
 * its emblem. Drawn as a luminance mask, white on black; the scroll shader maps it to the
 * night → cyan duotone like any screenshot. Every line is 0° or 45°, like the hall's traces.
 */

export interface EmblemPlan {
  /** Spokes from the chip to the ring, at multiples of 45°. */
  spokes: readonly number[]
  /** Where each spoke jogs 45°, as a fraction of its length (0 = no jog), and which way. */
  jogs: readonly { at: number; dir: -1 | 1 }[]
  /** The chip's 5 × 5 pad pattern, mirrored left to right. */
  pads: readonly boolean[]
  chipTurned: boolean
  /** Buses running from the ring down to the foot of the core, as x fractions of the width. */
  buses: readonly number[]
  ringVias: number
}

/** FNV-1a, 32-bit. */
export function hashName(name: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < name.length; i++) {
    h ^= name.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function emblemPlan(name: string): EmblemPlan {
  const rand = mulberry32(hashName(name))
  const spokes = [0, 1, 2, 3, 4, 5, 6, 7].filter(() => rand() < 0.7)
  if (spokes.length < 3) spokes.push(0, 2, 4, 6)
  const unique = [...new Set(spokes)].toSorted((a, b) => a - b)
  const pads: boolean[] = []
  for (let r = 0; r < 5; r++) {
    const row = [rand() < 0.55, rand() < 0.55, rand() < 0.6]
    pads.push(row[0] ?? false, row[1] ?? false, row[2] ?? false, row[1] ?? false, row[0] ?? false)
  }
  const busCount = 2 + Math.floor(rand() * 3)
  return {
    spokes: unique,
    jogs: unique.map(() => (rand() < 0.6 ? { at: 0.3 + rand() * 0.35, dir: rand() < 0.5 ? -1 : 1 } : { at: 0, dir: 1 })),
    pads,
    chipTurned: rand() < 0.5,
    buses: Array.from({ length: busCount }, (_, i) => 0.5 + (i - (busCount - 1) / 2) * 0.13),
    ringVias: 16 + 8 * Math.floor(rand() * 3),
  }
}

const grey = (v: number) => `rgb(${v}, ${v}, ${v})`

/** Draw the emblem into a w × h mask (the scroll's image core is 9:16). */
export function drawEmblem(ctx: CanvasRenderingContext2D, w: number, h: number, plan: EmblemPlan): void {
  const u = w / 288
  ctx.fillStyle = grey(0)
  ctx.fillRect(0, 0, w, h)
  ctx.lineCap = 'square'
  ctx.lineJoin = 'miter'
  const cx = w / 2
  const cy = h * 0.4
  const R = w * 0.36

  const circle = (r: number, lw: number, v: number) => {
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.lineWidth = lw * u
    ctx.strokeStyle = grey(v)
    ctx.stroke()
  }
  const via = (x: number, y: number, r: number, v: number) => {
    ctx.beginPath()
    ctx.arc(x, y, r * u, 0, Math.PI * 2)
    ctx.lineWidth = 1.6 * u
    ctx.strokeStyle = grey(v)
    ctx.stroke()
  }

  // The ring, like a luopan's outer circle, with ticks every 15°.
  circle(R, 3, 235)
  circle(R * 0.84, 1.4, 150)
  for (let k = 0; k < 24; k++) {
    const a = (k / 24) * Math.PI * 2
    const r0 = R * (k % 3 === 0 ? 0.88 : 0.93)
    ctx.beginPath()
    ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0)
    ctx.lineTo(cx + Math.cos(a) * R * 0.98, cy + Math.sin(a) * R * 0.98)
    ctx.lineWidth = 1.2 * u
    ctx.strokeStyle = grey(170)
    ctx.stroke()
  }
  for (let k = 0; k < plan.ringVias; k++) {
    const a = ((k + 0.5) / plan.ringVias) * Math.PI * 2
    via(cx + Math.cos(a) * R * 0.76, cy + Math.sin(a) * R * 0.76, 2.2, 120)
  }

  // Spokes from the chip out to the ring, one 45° jog each.
  const chip = R * 0.3
  plan.spokes.forEach((s, i) => {
    const a = (s * Math.PI) / 4
    const jog = plan.jogs[i] ?? { at: 0, dir: 1 }
    const r0 = chip * 1.15
    const r1 = R * 0.7
    const pts: [number, number][] = [[cx + Math.cos(a) * r0, cy + Math.sin(a) * r0]]
    if (jog.at > 0) {
      const rj = r0 + (r1 - r0) * jog.at
      const b = a + (jog.dir * Math.PI) / 4
      const step = (r1 - r0) * 0.22
      const p1: [number, number] = [cx + Math.cos(a) * rj, cy + Math.sin(a) * rj]
      const p2: [number, number] = [p1[0] + Math.cos(b) * step, p1[1] + Math.sin(b) * step]
      pts.push(p1, p2, [p2[0] + Math.cos(a) * (r1 - rj - step * 0.7), p2[1] + Math.sin(a) * (r1 - rj - step * 0.7)])
    } else pts.push([cx + Math.cos(a) * r1, cy + Math.sin(a) * r1])
    ctx.beginPath()
    pts.forEach(([x, y], k) => (k === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)))
    ctx.lineWidth = 2.4 * u
    ctx.strokeStyle = grey(225)
    ctx.stroke()
    const end = pts[pts.length - 1]
    if (end) via(end[0], end[1], 4, 245)
  })

  // The chip and its pads.
  ctx.save()
  ctx.translate(cx, cy)
  if (plan.chipTurned) ctx.rotate(Math.PI / 4)
  ctx.lineWidth = 2 * u
  ctx.strokeStyle = grey(235)
  ctx.strokeRect(-chip, -chip, chip * 2, chip * 2)
  ctx.fillStyle = grey(40)
  ctx.fillRect(-chip, -chip, chip * 2, chip * 2)
  const cell = (chip * 2 * 0.8) / 5
  plan.pads.forEach((on, i) => {
    if (!on) return
    const x = -chip * 0.8 + (i % 5) * cell
    const y = -chip * 0.8 + Math.floor(i / 5) * cell
    ctx.fillStyle = grey(210)
    ctx.fillRect(x + cell * 0.18, y + cell * 0.18, cell * 0.64, cell * 0.64)
  })
  ctx.restore()

  // Buses from the ring down to the foot of the core, stepping in at 45° and ending in pads.
  for (const bx of plan.buses) {
    const x0 = w * bx
    const y0 = cy + Math.sqrt(Math.max(0, R * R - (x0 - cx) ** 2))
    const yj = y0 + (h - y0) * 0.35
    const dx = Math.sign(cx - x0) * w * 0.04
    ctx.beginPath()
    ctx.moveTo(x0, y0)
    ctx.lineTo(x0, yj)
    ctx.lineTo(x0 + dx, yj + Math.abs(dx))
    ctx.lineTo(x0 + dx, h * 0.94)
    ctx.lineWidth = 1.8 * u
    ctx.strokeStyle = grey(200)
    ctx.stroke()
    ctx.fillStyle = grey(230)
    ctx.fillRect(x0 + dx - 4 * u, h * 0.94 - 3 * u, 8 * u, 6 * u)
  }
}
