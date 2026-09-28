import { ClampToEdgeWrapping, DataTexture, LinearFilter, RGBAFormat, SRGBColorSpace, UnsignedByteType } from 'three'
import { inkRamp } from '../../../theme/tokens'

export type RampStops = readonly (readonly [stop: number, hex: string])[]

function hexBytes(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.replace('#', ''), 16)
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff]
}

/**
 * RGBA bytes of the luminance → ink ramp (stack.md §5 `makeInkRamp`), lerped in sRGB bytes
 * between the token stops so each stop lands on its exact palette hex.
 */
export function makeInkRampData(stops: RampStops = inkRamp, width = 256): Uint8Array {
  const data = new Uint8Array(width * 4)
  const sorted = stops.toSorted((a, b) => a[0] - b[0])
  const first = sorted[0]
  const last = sorted[sorted.length - 1]
  if (!first || !last) throw new Error('makeInkRampData needs at least one stop')
  for (let i = 0; i < width; i++) {
    const t = i / (width - 1)
    let rgb = hexBytes(t <= first[0] ? first[1] : last[1])
    for (let k = 1; k < sorted.length; k++) {
      const a = sorted[k - 1]
      const b = sorted[k]
      if (a && b && t >= a[0] && t <= b[0]) {
        const f = b[0] === a[0] ? 0 : (t - a[0]) / (b[0] - a[0])
        const ca = hexBytes(a[1])
        const cb = hexBytes(b[1])
        rgb = [ca[0] + (cb[0] - ca[0]) * f, ca[1] + (cb[1] - ca[1]) * f, ca[2] + (cb[2] - ca[2]) * f]
        break
      }
    }
    data[i * 4] = Math.round(rgb[0])
    data[i * 4 + 1] = Math.round(rgb[1])
    data[i * 4 + 2] = Math.round(rgb[2])
    data[i * 4 + 3] = 255
  }
  return data
}

/** 256 × 1 ramp texture. sRGB colour space, so the shader samples linear values. Zero download. */
export function makeInkRamp(stops: RampStops = inkRamp): DataTexture {
  const width = 256
  const tex = new DataTexture(makeInkRampData(stops, width), width, 1, RGBAFormat, UnsignedByteType)
  tex.colorSpace = SRGBColorSpace
  tex.minFilter = LinearFilter
  tex.magFilter = LinearFilter
  tex.wrapS = ClampToEdgeWrapping
  tex.wrapT = ClampToEdgeWrapping
  tex.generateMipmaps = false
  tex.needsUpdate = true
  return tex
}
