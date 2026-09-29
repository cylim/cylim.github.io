import { DataTexture, LinearFilter, NoColorSpace, RGBAFormat, RepeatWrapping, UnsignedByteType } from 'three'

/**
 * Procedural 宣纸 texture for the ink pass (design.md §7.2), generated once at startup instead of
 * downloading a WebP. Tileable, deterministic, every channel centred on 0.5 so multiplying by
 * `1 + (c − 0.5) × amp` keeps paper exactly at the `paper` token on average:
 * - R: tooth, fine grain a pixel or two across;
 * - G: fibres, short curved strands in every direction, mostly lighter than the sheet;
 * - B: mottle, soft low-frequency cloudiness (also drives the ink bleed).
 */

export const GRAIN_SIZE = 512
const DEFAULT_SEED = 0x6c696e // "lin"

function mulberry32(seed: number): () => number {
  let a = seed | 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Separable 3-tap box blur with wrap-around, in place. */
function blur3(src: Float32Array, size: number): void {
  const tmp = new Float32Array(src.length)
  for (let y = 0; y < size; y++) {
    const row = y * size
    for (let x = 0; x < size; x++) {
      const l = (x + size - 1) % size
      const r = (x + 1) % size
      tmp[row + x] = ((src[row + l] ?? 0) + (src[row + x] ?? 0) + (src[row + r] ?? 0)) / 3
    }
  }
  for (let y = 0; y < size; y++) {
    const u = ((y + size - 1) % size) * size
    const c = y * size
    const d = ((y + 1) % size) * size
    for (let x = 0; x < size; x++) src[c + x] = ((tmp[u + x] ?? 0) + (tmp[c + x] ?? 0) + (tmp[d + x] ?? 0)) / 3
  }
}

/** Tileable value noise with `period` cells across the tile, sampled on a `size` grid. */
function periodicValueNoise(size: number, period: number, rand: () => number): Float32Array {
  const grid = new Float32Array(period * period)
  for (let i = 0; i < grid.length; i++) grid[i] = rand()
  const out = new Float32Array(size * size)
  for (let y = 0; y < size; y++) {
    const gy = (y / size) * period
    const y0 = Math.floor(gy)
    const fy = gy - y0
    const sy = fy * fy * (3 - 2 * fy)
    const r0 = (y0 % period) * period
    const r1 = ((y0 + 1) % period) * period
    for (let x = 0; x < size; x++) {
      const gx = (x / size) * period
      const x0 = Math.floor(gx)
      const fx = gx - x0
      const sx = fx * fx * (3 - 2 * fx)
      const c0 = x0 % period
      const c1 = (x0 + 1) % period
      const a = grid[r0 + c0] ?? 0
      const b = grid[r0 + c1] ?? 0
      const c = grid[r1 + c0] ?? 0
      const d = grid[r1 + c1] ?? 0
      out[y * size + x] = a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy
    }
  }
  return out
}

/** Bilinear upsample of a tileable square field. */
function upsampleWrap(src: Float32Array, from: number, to: number): Float32Array {
  const out = new Float32Array(to * to)
  const k = from / to
  for (let y = 0; y < to; y++) {
    const sy = y * k
    const y0 = Math.floor(sy)
    const fy = sy - y0
    const r0 = (y0 % from) * from
    const r1 = ((y0 + 1) % from) * from
    for (let x = 0; x < to; x++) {
      const sx = x * k
      const x0 = Math.floor(sx)
      const fx = sx - x0
      const c0 = x0 % from
      const c1 = (x0 + 1) % from
      const top = (src[r0 + c0] ?? 0) * (1 - fx) + (src[r0 + c1] ?? 0) * fx
      const bottom = (src[r1 + c0] ?? 0) * (1 - fx) + (src[r1 + c1] ?? 0) * fx
      out[y * to + x] = top * (1 - fy) + bottom * fy
    }
  }
  return out
}

function splat(field: Float32Array, size: number, x: number, y: number, v: number): void {
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const fx = x - x0
  const fy = y - y0
  const xa = ((x0 % size) + size) % size
  const xb = (xa + 1) % size
  const ya = ((y0 % size) + size) % size
  const yb = (ya + 1) % size
  field[ya * size + xa] = (field[ya * size + xa] ?? 0) + v * (1 - fx) * (1 - fy)
  field[ya * size + xb] = (field[ya * size + xb] ?? 0) + v * fx * (1 - fy)
  field[yb * size + xa] = (field[yb * size + xa] ?? 0) + v * (1 - fx) * fy
  field[yb * size + xb] = (field[yb * size + xb] ?? 0) + v * fx * fy
}

const toByte = (v: number) => Math.max(0, Math.min(255, Math.round(v * 255)))
const mean = (f: Float32Array) => f.reduce((a, b) => a + b, 0) / f.length

/** RGBA bytes of the paper tile. Pure and deterministic for a given seed. */
export function generatePaperGrain(size: number = GRAIN_SIZE, seed: number = DEFAULT_SEED): Uint8Array {
  const rand = mulberry32(seed)
  const n = size * size

  // Tooth: white noise softened by one blur, then re-expanded so its spread survives the blur.
  const tooth = new Float32Array(n)
  for (let i = 0; i < n; i++) tooth[i] = rand()
  blur3(tooth, size)

  // Fibres: tapered, gently curving strands; about 70% lighter than the sheet, the rest darker.
  const fibre = new Float32Array(n)
  const count = Math.round((900 * n) / (512 * 512))
  for (let f = 0; f < count; f++) {
    let x = rand() * size
    let y = rand() * size
    let angle = rand() * Math.PI * 2
    const bend = (rand() - 0.5) * 0.05
    const length = 10 + rand() ** 2 * 70
    const strength = (rand() < 0.7 ? 1 : -0.7) * (0.35 + rand() * 0.65)
    for (let s = 0; s < length; s += 0.5) {
      const taper = Math.sin((Math.PI * s) / length)
      splat(fibre, size, x, y, strength * taper * 0.5)
      x += Math.cos(angle) * 0.5
      y += Math.sin(angle) * 0.5
      angle += bend * 0.5
    }
  }
  blur3(fibre, size)

  // Mottle: four octaves of tileable value noise, built at quarter resolution (it is low-frequency).
  const low = Math.max(8, size / 4)
  const octaves: [period: number, weight: number][] = [
    [4, 0.4],
    [8, 0.3],
    [16, 0.2],
    [32, 0.1],
  ]
  const mottleLow = new Float32Array(low * low)
  for (const [period, weight] of octaves) {
    const layer = periodicValueNoise(low, period, rand)
    for (let i = 0; i < mottleLow.length; i++) mottleLow[i] = (mottleLow[i] ?? 0) + (layer[i] ?? 0) * weight
  }
  const mottle = upsampleWrap(mottleLow, low, size)

  // Each channel is re-centred on its own mean, so the multiply in the ink pass is exactly neutral.
  const channels: [Float32Array, number][] = [
    [tooth, 2.6],
    [fibre, 0.9],
    [mottle, 2.2],
  ]
  const out = new Uint8Array(n * 4)
  channels.forEach(([field, gain], c) => {
    const m = mean(field)
    for (let i = 0; i < n; i++) out[i * 4 + c] = toByte(0.5 + ((field[i] ?? m) - m) * gain)
  })
  for (let i = 0; i < n; i++) out[i * 4 + 3] = 255
  return out
}

let shared: DataTexture | null = null
let primed: Uint8Array | null = null

/** Texels generated elsewhere (env/prepare.ts runs `generatePaperGrain()` in a worker). */
export function primePaperGrain(data: Uint8Array): void {
  if (!shared && data.length === GRAIN_SIZE * GRAIN_SIZE * 4) primed = data
}

/**
 * The shared paper tile (created on first use, kept for the page's lifetime). Data, not colour.
 * Uses the primed texels when the stage prepared them off the main thread, else generates them.
 */
export function getPaperGrain(): DataTexture {
  if (shared) return shared
  const data = primed ?? generatePaperGrain()
  primed = null
  const tex = new DataTexture(data, GRAIN_SIZE, GRAIN_SIZE, RGBAFormat, UnsignedByteType)
  tex.colorSpace = NoColorSpace
  tex.wrapS = RepeatWrapping
  tex.wrapT = RepeatWrapping
  tex.minFilter = LinearFilter
  tex.magFilter = LinearFilter
  tex.generateMipmaps = false
  tex.needsUpdate = true
  shared = tex
  return tex
}
