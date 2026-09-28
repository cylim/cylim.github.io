import type { Vec3 } from '../../world/layout'
import { MARKS } from '../../world/journey'

/**
 * Look constants of the post chain. Colours come from theme/tokens; these are amounts.
 * Owner: core-render.
 */
export const POST = {
  /** Cabin bloom (design.md §7.4): mipmap blur, only emissive above ~1.0 catches. */
  bloom: { threshold: 0.9, smoothing: 0.03, intensity: 1.2, radius: 0.85 },
  /** Paper grain amplitude per channel: tooth, fibres, mottle (multiplicative, mean-neutral). */
  grain: [0.04, 0.055, 0.06] as Vec3,
  /** Noise added to luminance before the ramp so washes feather (ink bleed). */
  bleed: 0.07,
  /** Corner strength of the paper-shade vignette. Never a dark vignette outdoors. */
  vignette: 0.9,
  /**
   * Aerial perspective (inkFog.glsl): the most paper distance alone adds, so far ridges pale to
   * 淡/清 but never vanish (issue H2). postFx.aerial overrides it.
   */
  aerial: 0.5,
  /** Aerial rate per unit of fog density: thinner fog (the finale) also thins the aerial pale. */
  aerialRate: 0.5,
  /**
   * Extra aerial rate deep in the forest walk (×(1 + this), following `forestDepth`): the crowns a
   * few trees back go to 重 and 淡 quickly, so the canopy recedes in planes (深远) instead of
   * reading as one busy ceiling. The threshold's 平远 band keeps the plain rate.
   */
  forestAerial: 0.6,
  /** Contour strength (0..1) and the second-difference range that maps to it. */
  edge: { strength: 0.92, from: 0.06, to: 0.26 },
  /**
   * Contour weight by the depth of the surface it outlines: full up to `near` metres, down to `far`
   * of it by `farAt`, the way a painter outlines the near trees (骨法) and leaves the far ones as
   * washes (没骨). `breaks` is how much the mid-distance lines break up along their length (断笔).
   */
  edgeFalloff: { near: 5, farAt: 65, far: 0.22, breaks: 0.55 },
  /**
   * Pull toward the five ink tones outside the finale (墨分五色). uFlatten takes it to 1 in E2.
   * Kept low on the walk: much more posterises the soft mid-tones of a wash into flat cel bands.
   */
  bands: 0.07,
  /**
   * The finale's painting mist (design §8.7 E2), which replaces the walk's fog as the camera rises:
   * aerial recession from `start` metres out, toward `aerial` paper at most at `rate` per metre
   * (近浓远淡: the lantern and the grove stay dark, the cabin mid, the meadow and ridges pale), and
   * the belts of `layout.exit.mistBelts` at `belt` opacity.
   */
  finaleMist: { aerial: 0.66, rate: 0.0055, start: 55, belt: 0.94 },
  /**
   * Far fog tint in the deep forest (design §8.2): how far toward paper-shade it drifts at most, and
   * the distance over which it comes in. All the way reads as a grey veil, not as depth.
   */
  fogTint: 0.4,
  fogTintDistance: [18, 90] as const,
  /**
   * Understorey mist on the walk: the most paper it lays over the forest floor and trunk bases
   * (below about 3 m), coming in between `from` and `to` metres, so the far forest hangs from its
   * canopy over blank paper (留白) instead of standing as a stockade of trunks.
   */
  understorey: { amount: 0.72, from: 13, to: 38 },
  /** Forest-walk fog breathing (design.md §8.2): ±0.004 over a 12 s cycle, jvh 90–245. */
  fogBreath: { amount: 0.004, period: 12, span: [90, 245] as const },
  /** Extra fog density at full dive: the fog collapses toward the camera. */
  diveFog: 0.25,
  /** Fog density added per unit of the store's lagFog (0..1 paper while the camera catches up). */
  lagFog: 1,
  /** Cabin FinishEffect mono grain (2%, design.md §7.4). */
  finishGrain: 0.02,
  /** Dither amplitude in sRGB code values; uFlatten raises the ink pass's by 50%. */
  dither: 1,
} as const

/** A screen rectangle in CSS px, top-left origin (as `getBoundingClientRect()` gives it). */
export interface ScissorRect {
  x: number
  y: number
  w: number
  h: number
}

/** Mutable knobs sections and the rig may set; PostStack copies them into uniforms every frame. */
export interface PostFx {
  /** Finale flattening 0..1 (design.md §7.3.3). null = automatic: ramps across E2 by scroll. */
  flatten: number | null
  /** Extra fog density added to uFogBoost, e.g. holding the mist wall while the grove chunk loads. */
  fogBoost: number
  /** uFog.y, 1/m. Heavy falloff keeps the mist low so tree bases dissolve and crowns stand clear. */
  fogHeightFalloff: number
  /** uFog.z, mist floor height in metres. */
  fogFloor: number
  /** uFog.w, patchiness of the drifting mist banks: density runs from 1 − w to 1 + w times the beat's. */
  fogNoise: number
  /** The most paper aerial perspective adds with distance, 0..1 (0 turns it off). */
  aerial: number
  /** Mist drift in m/s (design.md §8.1: west at 0.2 m/s; west is +X). Frozen under reduced motion. */
  wind: Vec3
  /**
   * Render only inside this rectangle (CSS px, top-left origin, as `getBoundingClientRect()` gives
   * it), or everywhere when null. For the finale's album window (design.md §8.7 E2): while the mount
   * panels cover the rest of the screen, the scene, the ink pass and the final blit skip the covered
   * pixels. The drawing buffer is not preserved, so outside the rect the canvas turns transparent
   * and the page shows through: only set it while something opaque covers the rest, and set it back
   * to null before the panels open.
   */
  scissor: ScissorRect | null
}

const DEFAULTS: PostFx = {
  flatten: null,
  fogBoost: 0,
  fogHeightFalloff: 0.16,
  fogFloor: 0,
  fogNoise: 0.6,
  aerial: POST.aerial,
  wind: [0.2, 0, 0.05],
  scissor: null,
}

/**
 * The live knobs. Write fields directly (`postFx.fogBoost = 0.05`) from a useFrame or an effect,
 * and put back what you changed when your section unmounts (or call `resetPostFx()`).
 */
export const postFx: PostFx = { ...DEFAULTS, wind: [...DEFAULTS.wind] }

export function resetPostFx(): void {
  Object.assign(postFx, DEFAULTS, { wind: [...DEFAULTS.wind] })
}

/** Automatic uFlatten: 0 before E2, 1 at the seal (design.md §7.3.3, §8.7). */
export function autoFlatten(jvh: number): number {
  const [a, b] = [MARKS.finaleStart, MARKS.sealStamp]
  return Math.min(Math.max((jvh - a) / (b - a), 0), 1)
}

const smooth01 = (a: number, b: number, x: number) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1)
  return t * t * (3 - 2 * t)
}

/**
 * Weight of the finale's painting mist over the walk's fog: 0 at the stele, 1 once the orbit has
 * risen clear of the exit trees (design §8.7 E2), and 1 through E3.
 */
export function finaleMistWeight(jvh: number): number {
  return smooth01(MARKS.finaleStart + 3, MARKS.finaleStart + 30, jvh)
}

/**
 * How far the far fog has drifted from paper toward paper-shade (design §8.2 "as the forest
 * deepens"): rising through the forest walk, full from F3 to the cabin, gone again in the clearing
 * at C1. The path to the grove and everything after stay paper.
 */
export function forestFogTint(jvh: number): number {
  return POST.fogTint * forestDepth(jvh)
}

/**
 * How deep in the forest walk the camera is, 0..1: rising from F1 to F3, thinning through F4 as
 * the trees open on the cabin (which must resolve out of the mist, not fade into it), gone at C1.
 */
export function forestDepth(jvh: number): number {
  return smooth01(95, 205, jvh) * (1 - smooth01(222, 256, jvh))
}

/**
 * Where the understorey mist lies (0..1): the threshold and the forest walk, fading as the door
 * opens; the path to the grove until the mist wall parts; the southern trees at the stele. Never
 * in the grove, whose board must read clean from the seat and in plan, nor in the cabin.
 */
export function understoreyMist(jvh: number): number {
  const walk = 1 - smooth01(262, 290, jvh)
  const path = smooth01(574, 584, jvh) * (1 - smooth01(626, 640, jvh))
  const exit = 0.7 * smooth01(850, 868, jvh)
  return Math.max(walk, path, exit)
}

/**
 * Forest-walk breathing multiplier on the fog density (design.md §8.2: 0.030 ± 0.004 over 12 s),
 * eased in and out over the first and last 10 jvh of the walk so it never steps. `t` is motion
 * time, so it holds still in e2e and under reduced motion.
 */
export function fogBreath(jvh: number, t: number, base: number): number {
  const { amount, period, span } = POST.fogBreath
  const edge = Math.min(jvh - span[0], span[1] - jvh) / 10
  if (edge <= 0 || base <= 0) return 1
  const w = Math.min(edge, 1)
  return 1 + (w * amount * Math.sin((2 * Math.PI * t) / period)) / base
}
