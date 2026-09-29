/**
 * 时家奇门 · 转盘 · 拆补法 chart types: qimen-spec.md §13, field for field.
 * Values are the Chinese names, because content/glossary keys its glosses by them.
 * Static palace data (trigram, direction, azimuth, element, branches, mountains) is not
 * repeated in the chart; it comes from the §2.2 constants.
 */

export type Stem = '甲' | '乙' | '丙' | '丁' | '戊' | '己' | '庚' | '辛' | '壬' | '癸'
export type Branch = '子' | '丑' | '寅' | '卯' | '辰' | '巳' | '午' | '未' | '申' | '酉' | '戌' | '亥'
export type PalaceNo = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9
export type OuterPalaceNo = Exclude<PalaceNo, 5>
export type Star = '天蓬' | '天芮' | '天冲' | '天辅' | '天禽' | '天心' | '天柱' | '天任' | '天英'
export type Door = '休门' | '生门' | '伤门' | '杜门' | '景门' | '死门' | '惊门' | '开门'
export type Deity = '值符' | '螣蛇' | '太阴' | '六合' | '白虎' | '玄武' | '九地' | '九天' | '勾陈' | '朱雀'

/** Index order is tyme4ts `SolarTerm#getIndex()`: 0 = 冬至. Odd indices are 节 (month boundaries). */
export type SolarTermName =
  | '冬至' | '小寒' | '大寒' | '立春' | '雨水' | '惊蛰' | '春分' | '清明' | '谷雨' | '立夏' | '小满' | '芒种'
  | '夏至' | '小暑' | '大暑' | '立秋' | '处暑' | '白露' | '秋分' | '寒露' | '霜降' | '立冬' | '小雪' | '大雪'

export type TimeBasis = 'civil' | 'standard' | 'trueSolar'
export type ZiHour = 'zi23' | 'split' | 'midnight'
export type DeityNames = 'huXuan' | 'gouQue'
export type Dun = 'yang' | 'yin'
export type Yuan = 'upper' | 'middle' | 'lower'

export interface QimenOptions {
  /** IANA zone; default: the device's resolved zone. */
  timeZone?: string
  /** Fixed offset in minutes east of UTC; overrides timeZone. +480 = "cast in Penang time". */
  utcOffsetMinutes?: number
  /** Default 'civil': the visitor's clock, DST included. */
  timeBasis?: TimeBasis
  /** Degrees east; required when timeBasis is 'trueSolar'. */
  longitude?: number
  /** Default 'zi23': 23:00–23:59 belongs to the next day for both day and hour pillars. */
  ziHour?: ZiHour
  /** Default 'huXuan': 白虎/玄武 in both 遁. */
  deityNames?: DeityNames
}

export type ResolvedOptions = Required<Omit<QimenOptions, 'timeZone' | 'utcOffsetMinutes' | 'longitude'>> & {
  timeZone: string | null
  utcOffsetMinutes: number | null
  longitude: number | null
}

/** One row per solar term: start instant (epoch ms, UTC) and index 0..23 with 0 = 冬至. Sorted by startMs. */
export interface TermRow {
  startMs: number
  index: number
}

/** A sexagenary pillar. `index` 0 = 甲子 … 59 = 癸亥; `name` is stem + branch. */
export interface GanZhi {
  index: number
  stem: Stem
  branch: Branch
  name: string
}

/** Wall-clock fields of the basis clock. */
export interface Wall {
  y: number
  mo: number
  d: number
  h: number
  mi: number
  s: number
}

export interface ChartBasis {
  timeBasis: TimeBasis
  /** basis − UTC in minutes; fractional for 'trueSolar' and for historical zone offsets with seconds. */
  offsetMinutes: number
  /** Basis wall time, `YYYY-MM-DDTHH:mm:ss` with no zone suffix. */
  local: string
}

export interface SolarTermRef {
  index: number
  name: SolarTermName
  /** ISO 8601 UTC, second precision, no milliseconds. */
  startUtc: string
}

export interface SolarTermInfo extends SolarTermRef {
  next: SolarTermRef
}

export interface XunShou {
  /** The 旬首 甲 pillar, e.g. 甲戌. */
  head: GanZhi
  /** The 仪 it hides under. */
  yi: Stem
  /** Earth palace of that 仪; may be 5. */
  palace: PalaceNo
}

export interface ZhiFu {
  star: Star
  /** Raw P0; 5 possible (then the star is 天禽). */
  homePalace: PalaceNo
  /** The stem used to place it: the hour stem, or the 旬首 仪 in a 甲 hour. */
  stem: Stem
  palaceRaw: PalaceNo
  /** Lodged landing palace (5 → 2). */
  palace: OuterPalaceNo
}

export interface ZhiShi {
  door: Door
  /** lodge(P0): a door's home is always an outer palace. */
  homePalace: OuterPalaceNo
  /** Hours since the 旬首 hour, 0..9. */
  steps: number
  palaceRaw: PalaceNo
  palace: OuterPalaceNo
}

export interface PlateFlags {
  stars: boolean
  doors: boolean
}

export interface ChartVoid {
  /** 时空: the two void branches of the hour pillar. */
  hour: readonly Branch[]
  hourPalaces: readonly PalaceNo[]
  /** 日空. */
  day: readonly Branch[]
  dayPalaces: readonly PalaceNo[]
}

export interface PalaceFlags {
  zhiFu: boolean
  zhiShi: boolean
  hourVoid: boolean
  dayVoid: boolean
  horse: boolean
}

export interface PalaceState {
  earth: Stem
  /** Heaven stems carried here; two when 天禽 rides with 天芮 ([天芮's, 天禽's]). Empty for palace 5. */
  heaven: readonly Stem[]
  /** Stars here; [天芮, 天禽] when they ride together. Empty for palace 5. */
  stars: readonly Star[]
  door: Door | null
  deity: Deity | null
  /** 0 = 值符 … 7 = 九天, independent of `deityNames`. */
  deitySlot: number | null
  /** 暗干: computed and tested, not rendered in v1. */
  hidden: Stem
  /** Palace 2 only: the centre earth stem lodged here (中五寄坤二). null elsewhere. */
  lodgedEarth: Stem | null
  flags: PalaceFlags
}

/** Output of the chart engine (qimen-spec.md §13). */
export interface QimenChart {
  /** The input instant, ISO 8601 UTC. */
  instantUtc: string
  basis: ChartBasis
  options: ResolvedOptions
  pillars: { year: GanZhi; month: GanZhi; day: GanZhi; hour: GanZhi }
  solarTerm: SolarTermInfo
  dun: Dun
  yuan: Yuan
  /** 局, 1..9. */
  ju: number
  /** The 符头 pillar. */
  fuTou: GanZhi
  xunShou: XunShou
  zhiFu: ZhiFu
  zhiShi: ZhiShi
  /** Clockwise ring steps 0..7 of stars and doors from their home slots. */
  rotation: { stars: number; doors: number }
  fuYin: PlateFlags
  fanYin: PlateFlags
  void: ChartVoid
  horse: { branch: Branch; palace: PalaceNo }
  /** Start palace of the 暗干. */
  hiddenStart: PalaceNo
  /** Next instant the chart can change (时辰 boundary or term start), ISO 8601 UTC. */
  nextChangeUtc: string
  palaces: Record<PalaceNo, PalaceState>
}

/**
 * Ring offsets for the grove renderer (design.md §9.5), in 45° slots from 伏吟.
 * Slot k is bearing k × 45° in palace order [1, 8, 3, 4, 9, 2, 7, 6]. Palace 5 counts as 2.
 * The renderer never derives positions itself.
 */
export interface RingOffsets {
  /** slot(值符 landing) − slot(值符 star's home), normalised to −3..4 (shortest turn). ≡ chart.rotation.stars (mod 8). */
  heaven: number
  /** slot(值使 landing) − slot(值使 door's home), normalised to −3..4. ≡ chart.rotation.doors (mod 8). */
  human: number
  /** Absolute slot 0..7 of the 值符 deity; glyph order runs clockwise from it in the yang dun, anticlockwise in the yin. */
  spirit: number
  dun: Dun
}
