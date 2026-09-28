/**
 * Earth, heaven, human and spirit plates (qimen-spec.md §5–§11).
 */

import { DEITY_SLOTS, HOME_DOOR, HOME_STAR, JU_TABLE, QIYI, RING, STEMS, lodge, mod, ringIdx } from './constants'
import type { Deity, DeityNames, Door, OuterPalaceNo, PalaceNo, Star, Stem, Yuan } from './types'

export type EarthPlate = Readonly<Record<PalaceNo, Stem>>

export const YUAN_NAMES: readonly Yuan[] = ['upper', 'middle', 'lower']

/** 拆补法 (§6): 符头 is the latest 甲 or 己 day, inclusive; its branch gives the 元. */
export function yuanOf(dayIdx: number): { yuan: number; fuTouIdx: number } {
  return { yuan: Math.floor(dayIdx / 5) % 3, fuTouIdx: dayIdx - (dayIdx % 5) }
}

export const juOf = (termIndex: number, yuan: number): number => (JU_TABLE[termIndex] as readonly number[])[yuan] as number

/** §7: 戊 at palace `ju`, the rest along the Luo Shu numbers, forward for 阳 and backward for 阴. */
export function earthPlate(ju: number, yang: boolean): EarthPlate {
  const s = yang ? 1 : -1
  const earth = {} as Record<PalaceNo, Stem>
  QIYI.forEach((stem, k) => {
    earth[(mod(ju - 1 + s * k, 9) + 1) as PalaceNo] = stem
  })
  return earth
}

export function palaceOfStem(earth: EarthPlate, stem: Stem): PalaceNo {
  for (let p = 1; p <= 9; p++) if (earth[p as PalaceNo] === stem) return p as PalaceNo
  throw new RangeError(`stem ${stem} is not on the earth plate`)
}

/** Where everything lands for one hour (§8–§10). */
export interface Placement {
  /** 旬 number 0..5: 甲子 甲戌 甲申 甲午 甲辰 甲寅. */
  xun: number
  xunYi: Stem
  /** Earth palace of the 旬首仪, may be 5. */
  p0: PalaceNo
  /** lodge(p0): rotation origin of stars and doors. */
  home: OuterPalaceNo
  zhiFuStar: Star
  zhiShiDoor: Door
  /** Hour stem, or the 旬首仪 when the hour stem is 甲. */
  useStem: Stem
  ptRaw: PalaceNo
  pt: OuterPalaceNo
  /** Clockwise ring steps of the stars. */
  r: number
  /** Hours since the 旬首 hour, 0..9. */
  n: number
  dtRaw: PalaceNo
  dt: OuterPalaceNo
  /** Clockwise ring steps of the doors. */
  rd: number
}

export function placeHour(earth: EarthPlate, hourIdx: number, yang: boolean): Placement {
  const s = yang ? 1 : -1
  const xun = Math.floor(hourIdx / 10)
  const xunYi = QIYI[xun] as Stem
  const p0 = palaceOfStem(earth, xunYi)
  const home = lodge(p0)
  const hStem = STEMS[hourIdx % 10] as Stem
  const useStem = hStem === '甲' ? xunYi : hStem // 甲 hides under its 仪
  // 值符常遣加时干
  const ptRaw = palaceOfStem(earth, useStem)
  const pt = lodge(ptRaw)
  const r = mod(ringIdx(pt) - ringIdx(home), 8)
  // 值使逆顺遁宫去: count from the raw p0, through 5 like any palace
  const n = hourIdx % 10
  const dtRaw = (mod(p0 - 1 + s * n, 9) + 1) as PalaceNo
  const dt = lodge(dtRaw)
  const rd = mod(ringIdx(dt) - ringIdx(home), 8)
  return { xun, xunYi, p0, home, zhiFuStar: HOME_STAR[p0], zhiShiDoor: HOME_DOOR[home], useStem, ptRaw, pt, r, n, dtRaw, dt, rd }
}

export interface OuterPlates {
  stars: Record<OuterPalaceNo, Star[]>
  heaven: Record<OuterPalaceNo, Stem[]>
  doors: Record<OuterPalaceNo, Door>
  deities: Record<OuterPalaceNo, { deity: Deity; slot: number }>
}

/** Deity labels by slot. Only slots 4 and 5 in the yang dun change (§11). */
export function deityNamesFor(yang: boolean, names: DeityNames): readonly Deity[] {
  if (!yang || names === 'huXuan') return DEITY_SLOTS
  const out = DEITY_SLOTS.slice()
  out[4] = '勾陈'
  out[5] = '朱雀'
  return out
}

/** §9.2, §10, §11. 天禽 and palace 5's earth stem ride with 天芮 in every chart. */
export function turnPlates(earth: EarthPlate, pl: Placement, yang: boolean, names: DeityNames): OuterPlates {
  const s = yang ? 1 : -1
  const stars = {} as Record<OuterPalaceNo, Star[]>
  const heaven = {} as Record<OuterPalaceNo, Stem[]>
  const doors = {} as Record<OuterPalaceNo, Door>
  const deities = {} as Record<OuterPalaceNo, { deity: Deity; slot: number }>
  RING.forEach((src, i) => {
    const dst = RING[(i + pl.r) % 8] as OuterPalaceNo
    stars[dst] = [HOME_STAR[src]]
    heaven[dst] = [earth[src]]
    if (src === 2) {
      stars[dst].push('天禽')
      heaven[dst].push(earth[5])
    }
    doors[RING[(i + pl.rd) % 8] as OuterPalaceNo] = HOME_DOOR[src]
  })
  // 阳 clockwise, 阴 counter-clockwise, slot 0 with the 值符 star
  deityNamesFor(yang, names).forEach((deity, slot) => {
    deities[RING[mod(ringIdx(pl.pt) + s * slot, 8)] as OuterPalaceNo] = { deity, slot }
  })
  return { stars, heaven, doors, deities }
}
