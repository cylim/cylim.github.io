import { Color, SRGBColorSpace } from 'three'

/**
 * The cabin post group grades everything through three's AgX (core/render PostRig). AgX lifts and
 * desaturates, so a material that outputs a token's linear value would not show the token on
 * screen: night would come out grey-blue and the desk seal's cinnabar would drift toward brown.
 * `agxInverse` returns the linear input that AgX maps back onto a given sRGB token, so the
 * night shell, the paper sheet and the seal read as the exact palette (design.md §2.4, §2.5).
 *
 * This is three r186's AgXToneMapping (tonemapping_pars_fragment), exposure 1, run backwards.
 * Matrices are column-major, as GLSL's mat3(vec3, vec3, vec3) constructor takes them.
 */

type V3 = [number, number, number]
type M3 = readonly [V3, V3, V3]

const REC2020_TO_SRGB: M3 = [
  [1.6605, -0.1246, -0.0182],
  [-0.5876, 1.1329, -0.1006],
  [-0.0728, -0.0083, 1.1187],
]
const SRGB_TO_REC2020: M3 = [
  [0.6274, 0.0691, 0.0164],
  [0.3293, 0.9195, 0.088],
  [0.0433, 0.0113, 0.8956],
]
const INSET: M3 = [
  [0.856627153315983, 0.137318972929847, 0.11189821299995],
  [0.0951212405381588, 0.761241990602591, 0.0767994186031903],
  [0.0482516061458583, 0.101439036467562, 0.811302368396859],
]
const OUTSET: M3 = [
  [1.1271005818144368, -0.1413297634984383, -0.14132976349843826],
  [-0.11060664309660323, 1.157823702216272, -0.11060664309660294],
  [-0.016493938717834573, -0.016493938717834257, 1.2519364065950405],
]
const MIN_EV = -12.47393
const MAX_EV = 4.026069

const mul = (m: M3, v: V3): V3 => [
  m[0][0] * v[0] + m[1][0] * v[1] + m[2][0] * v[2],
  m[0][1] * v[0] + m[1][1] * v[1] + m[2][1] * v[2],
  m[0][2] * v[0] + m[1][2] * v[1] + m[2][2] * v[2],
]

function inverse(m: M3): M3 {
  const [[a, b, c], [d, e, f], [g, h, i]] = m
  const A = e * i - f * h
  const B = -(d * i - f * g)
  const C = d * h - e * g
  const det = a * A + b * B + c * C
  return [
    [A / det, -(b * i - c * h) / det, (b * f - c * e) / det],
    [B / det, (a * i - c * g) / det, -(a * f - c * d) / det],
    [C / det, -(a * h - b * g) / det, (a * e - b * d) / det],
  ]
}

const SRGB_TO_REC2020_OUT = inverse(REC2020_TO_SRGB)
const OUTSET_INV = inverse(OUTSET)
const INSET_INV = inverse(INSET)
const REC2020_TO_SRGB_IN = inverse(SRGB_TO_REC2020)

const sigmoid = (x: number) => {
  const x2 = x * x
  const x4 = x2 * x2
  return 15.5 * x4 * x2 - 40.14 * x4 * x + 31.96 * x4 - 6.868 * x2 * x + 0.4298 * x2 + 0.1191 * x - 0.00232
}

/** The sigmoid rises monotonically on [0, 1], so bisection inverts it. */
function sigmoidInverse(y: number): number {
  let lo = 0
  let hi = 1
  for (let k = 0; k < 40; k++) {
    const mid = (lo + hi) / 2
    if (sigmoid(mid) < y) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

const clamp01 = (x: number) => Math.min(Math.max(x, 0), 1)

/** AgX, linear sRGB in and out (for tests and for checking a value by hand). */
export function agx(rgb: readonly number[]): V3 {
  let c = mul(INSET, mul(SRGB_TO_REC2020, [rgb[0] ?? 0, rgb[1] ?? 0, rgb[2] ?? 0]))
  c = c.map((x) => sigmoid(clamp01((Math.log2(Math.max(x, 1e-10)) - MIN_EV) / (MAX_EV - MIN_EV)))) as V3
  c = mul(OUTSET, c).map((x) => Math.max(0, x) ** 2.2) as V3
  return mul(REC2020_TO_SRGB, c).map(clamp01) as V3
}

/** The linear sRGB input AgX turns into `rgb` (linear sRGB). Out-of-gamut parts clamp at 0. */
export function agxInverseLinear(rgb: readonly number[]): V3 {
  let c = mul(SRGB_TO_REC2020_OUT, [rgb[0] ?? 0, rgb[1] ?? 0, rgb[2] ?? 0])
  c = mul(OUTSET_INV, c.map((x) => Math.max(0, x) ** (1 / 2.2)) as V3)
  c = c.map((x) => 2 ** (sigmoidInverse(x) * (MAX_EV - MIN_EV) + MIN_EV)) as V3
  return mul(REC2020_TO_SRGB_IN, mul(INSET_INV, c)).map((x) => Math.max(0, x)) as V3
}

/** A token hex, pre-compensated for the cabin's AgX grade, as a linear three Color. */
export function agxInverse(hex: string): Color {
  const target = new Color().setStyle(hex, SRGBColorSpace)
  const [r, g, b] = agxInverseLinear([target.r, target.g, target.b])
  return new Color(r, g, b)
}
