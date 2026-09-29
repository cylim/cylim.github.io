/** Seeded PRNG (mulberry32). The forest must be identical on every load, so nothing in env uses Math.random. */
export function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
export function smoothstep(e0: number, e1: number, x: number): number {
  const t = clamp((x - e0) / (e1 - e0), 0, 1)
  return t * t * (3 - 2 * t)
}

/** Deterministic 1D value noise in [0, 1], for CPU-side ridge profiles and jitter. */
export function valueNoise1(x: number, seed: number): number {
  const i = Math.floor(x)
  const f = x - i
  const h = (n: number) => {
    const s = Math.sin((n + seed * 131.7) * 127.1) * 43758.5453
    return s - Math.floor(s)
  }
  const u = f * f * (3 - 2 * f)
  return lerp(h(i), h(i + 1), u)
}

/** Five-octave fBm of `valueNoise1`, roughly in [0, 1]. */
export function fbm1(x: number, seed: number, octaves = 5): number {
  let sum = 0
  let amp = 0.5
  let norm = 0
  for (let o = 0; o < octaves; o++) {
    sum += amp * valueNoise1(x, seed + o * 17)
    norm += amp
    x *= 2.03
    amp *= 0.5
  }
  return sum / norm
}
