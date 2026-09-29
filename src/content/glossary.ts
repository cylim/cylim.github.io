/**
 * Glossary for every Chinese string on screen (content.md §4 plus site accents).
 * Components never contain gloss text; they look it up here with `glossFor(zh)`.
 * TODO(owner): glossary sign-off (design.md §18.2). CY practises, so CY signs off.
 *
 * The chart data uses the same Chinese keys as lib/qimen (qimen-spec.md §13).
 */

import type { GlossaryTerm } from './types'
import { chartTerms, methodTerms, siteAccents } from './accents'

export { chartTerms, methodTerms, siteAccents }

export type Element = 'water' | 'wood' | 'fire' | 'earth' | 'metal'
export type Nature = 'auspicious' | 'mildly auspicious' | 'neutral' | 'mildly inauspicious' | 'inauspicious'
export type PalaceNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9
export type Direction = 'N' | 'NE' | 'E' | 'SE' | 'C' | 'S' | 'SW' | 'W' | 'NW'

/**
 * Trigram lines, bottom to top; true = solid (yang), false = broken (yin).
 * Draw trigrams as bars, never the Unicode ☰–☷ glyphs (design.md §4.5). A yin line is two bars
 * with a gap of 28% of the line length; in circular layouts the bottom line sits nearest the centre.
 */
export type TrigramLines = readonly [bottom: boolean, middle: boolean, top: boolean]

export interface PalaceGloss extends GlossaryTerm {
  readonly number: PalaceNumber
  /** null for the centre. */
  readonly trigram: TrigramLines | null
  readonly direction: Direction
  readonly directionEn: string
  readonly element: Element
}

export interface DoorGloss extends GlossaryTerm {
  readonly home: PalaceNumber
  readonly element: Element
  readonly nature: Nature
}

export interface StarGloss extends GlossaryTerm {
  readonly home: PalaceNumber
  readonly element: Element
  readonly nature: Nature
}

export interface DeityGloss extends GlossaryTerm {
  /** Position counting from 值符 (1..8); null for alternates. */
  readonly order: number | null
  readonly nature: Nature
  /** Alternates replace 白虎/玄武 in the yang cycle in some lineages. */
  readonly alternateFor?: '白虎' | '玄武'
}

export interface StemGloss extends GlossaryTerm {
  readonly yinYang: 'yin' | 'yang'
  readonly element: Element
  readonly role: 'hidden' | 'wonder' | 'instrument'
  /** Role label in Chinese, e.g. 日奇 or 仪. */
  readonly roleZh: string
  /** For the six 仪: which 甲 leader it hides. */
  readonly hides?: string
}

export interface BranchGloss extends GlossaryTerm {
  readonly animal: string
  readonly hours: string
  readonly palace: PalaceNumber
}

export interface MountainGloss {
  readonly zh: string
  readonly pinyin: string
  /** Centre bearing in degrees, clockwise from north. */
  readonly bearing: number
  readonly palace: PalaceNumber
}

export interface SolarTermGloss extends GlossaryTerm {
  /** tyme4ts index, 0 = 冬至. */
  readonly index: number
}

// ---------------------------------------------------------------------------- groups

/** Section headers for each glossary group. */
export const glossaryGroups = {
  palaces: { zh: '九宫', pinyin: 'jiǔ gōng', en: 'Nine Palaces', meaning: 'The Luo Shu grid of eight directions and a centre that every chart is laid on.' },
  doors: { zh: '八门', pinyin: 'bā mén', en: 'Eight Doors', meaning: 'The human layer: what kind of action the hour favours in each direction.' },
  stars: { zh: '九星', pinyin: 'jiǔ xīng', en: 'Nine Stars', meaning: 'The heaven layer: the character and timing working in each palace.' },
  deities: { zh: '八神', pinyin: 'bā shén', en: 'Eight Deities', meaning: 'The spirit layer: unseen help or hindrance in each palace.' },
  stems: { zh: '天干', pinyin: 'tiān gān', en: 'Heavenly Stems', meaning: 'Ten stems laid on the earth and heaven plates. Three are wonders, six are instruments, one hides.' },
  branches: { zh: '地支', pinyin: 'dì zhī', en: 'Earthly Branches', meaning: 'Twelve branches that name the two-hour periods and place 旬空 and 驿马 on the board.' },
} as const satisfies Record<string, GlossaryTerm>

// ---------------------------------------------------------------------------- palaces, doors, stars, deities

export const palaces: readonly PalaceGloss[] = [
  { number: 1, zh: '坎', pinyin: 'kǎn', trigram: [false, true, false], en: 'Water', direction: 'N', directionEn: 'North', element: 'water', meaning: 'Depth, danger and flow. The middle son.' },
  { number: 2, zh: '坤', pinyin: 'kūn', trigram: [false, false, false], en: 'Earth', direction: 'SW', directionEn: 'Southwest', element: 'earth', meaning: 'Receptiveness and support. The mother.' },
  { number: 3, zh: '震', pinyin: 'zhèn', trigram: [true, false, false], en: 'Thunder', direction: 'E', directionEn: 'East', element: 'wood', meaning: 'A sudden start, movement. The eldest son.' },
  { number: 4, zh: '巽', pinyin: 'xùn', trigram: [false, true, true], en: 'Wind', direction: 'SE', directionEn: 'Southeast', element: 'wood', meaning: 'Gentle, gradual influence that gets in everywhere. The eldest daughter.' },
  { number: 5, zh: '中', pinyin: 'zhōng', trigram: null, en: 'Centre', direction: 'C', directionEn: 'Centre', element: 'earth', meaning: 'The pivot. In Qimen, whatever lands here lodges in 坤 2.' },
  { number: 6, zh: '乾', pinyin: 'qián', trigram: [true, true, true], en: 'Heaven', direction: 'NW', directionEn: 'Northwest', element: 'metal', meaning: 'Strength and leadership. The father.' },
  { number: 7, zh: '兑', pinyin: 'duì', trigram: [true, true, false], en: 'Lake', direction: 'W', directionEn: 'West', element: 'metal', meaning: 'Joy and speech. The youngest daughter.' },
  { number: 8, zh: '艮', pinyin: 'gèn', trigram: [false, false, true], en: 'Mountain', direction: 'NE', directionEn: 'Northeast', element: 'earth', meaning: 'Stillness, knowing when to stop. The youngest son.' },
  { number: 9, zh: '离', pinyin: 'lí', trigram: [true, false, true], en: 'Fire', direction: 'S', directionEn: 'South', element: 'fire', meaning: 'Clarity and visibility. The middle daughter.' },
]

/** Listed in home-palace ring order: 休 生 伤 杜 景 死 惊 开. */
export const doors: readonly DoorGloss[] = [
  { zh: '休门', pinyin: 'xiū mén', en: 'Rest Door', home: 1, element: 'water', nature: 'auspicious', meaning: 'Rest and recovery, calm meetings, mending relationships.' },
  { zh: '生门', pinyin: 'shēng mén', en: 'Life Door', home: 8, element: 'earth', nature: 'auspicious', meaning: 'Growth and profit. Property, business, anything meant to grow.' },
  { zh: '伤门', pinyin: 'shāng mén', en: 'Harm Door', home: 3, element: 'wood', nature: 'inauspicious', meaning: 'Injury and conflict. Traditionally for chasing debts or hunting; poor for anything delicate.' },
  { zh: '杜门', pinyin: 'dù mén', en: 'Block Door', alt: ['Delusion Door', 'Closed Door'], home: 4, element: 'wood', nature: 'neutral', meaning: 'Closed and hidden. Good for retreat or keeping a secret; poor for getting things moving.' },
  { zh: '景门', pinyin: 'jǐng mén', en: 'View Door', alt: ['Scenery Door'], home: 9, element: 'fire', nature: 'neutral', meaning: 'Light and display. Documents, exams, presentations. Looks can outrun substance here.' },
  { zh: '死门', pinyin: 'sǐ mén', en: 'Death Door', home: 2, element: 'earth', nature: 'inauspicious', meaning: 'Endings and stillness. Traditionally for funerals and closing things out; avoid for new starts.' },
  { zh: '惊门', pinyin: 'jīng mén', en: 'Fear Door', alt: ['Shock Door'], home: 7, element: 'metal', nature: 'inauspicious', meaning: 'Alarm and upset. Disputes, bad news, arguments; also suits litigation.' },
  { zh: '开门', pinyin: 'kāi mén', en: 'Open Door', home: 6, element: 'metal', nature: 'auspicious', meaning: 'Beginnings. Opening a business, travel, careers, meeting people in power.' },
]

/** Listed by home palace 1–9. Ring order from 坎 1: 蓬 任 冲 辅 英 芮 柱 心, with 禽 riding 芮. */
export const stars: readonly StarGloss[] = [
  { zh: '天蓬', pinyin: 'tiān péng', en: 'Canopy', home: 1, element: 'water', nature: 'inauspicious', meaning: 'Bold and risky. Big schemes, and in bad company, theft.' },
  { zh: '天芮', pinyin: 'tiān ruì', en: 'Grass', alt: ['Ailing'], home: 2, element: 'earth', nature: 'inauspicious', meaning: 'The problem star. Illness and faults, but also study and the student.' },
  { zh: '天冲', pinyin: 'tiān chōng', en: 'Impulse', home: 3, element: 'wood', nature: 'mildly auspicious', meaning: 'Fast, decisive action. Competition and hitting back.' },
  { zh: '天辅', pinyin: 'tiān fǔ', en: 'Assistant', home: 4, element: 'wood', nature: 'auspicious', meaning: 'Culture and teaching. Study, advice, people who help.' },
  { zh: '天禽', pinyin: 'tiān qín', en: 'Bird', alt: ['Connecting'], home: 5, element: 'earth', nature: 'auspicious', meaning: 'The centre. Balance and steady support. In rotating-plate charts it rides with 天芮.' },
  { zh: '天心', pinyin: 'tiān xīn', en: 'Heart', home: 6, element: 'metal', nature: 'auspicious', meaning: 'The strategist. Planning, medicine, leadership.' },
  { zh: '天柱', pinyin: 'tiān zhù', en: 'Pillar', home: 7, element: 'metal', nature: 'mildly inauspicious', meaning: 'Sharp words and breakage. Criticism, collapse; suits holding your ground.' },
  { zh: '天任', pinyin: 'tiān rèn', en: 'Ren', alt: ['Duty'], home: 8, element: 'earth', nature: 'mildly auspicious', meaning: 'Steady weight. Patience, property, slow and reliable gains.' },
  { zh: '天英', pinyin: 'tiān yīng', en: 'Hero', home: 9, element: 'fire', nature: 'mildly inauspicious', meaning: 'Brightness and display. Fame, and a short temper.' },
]

/**
 * Counted from 值符: clockwise in the yang cycle, anticlockwise in the yin cycle.
 * The live chart uses 白虎/玄武 in both cycles (grove.ts chartOptions); some lineages use 勾陈/朱雀
 * in the yang cycle.
 */
export const deities: readonly DeityGloss[] = [
  { order: 1, zh: '值符', pinyin: 'zhí fú', en: 'Chief', nature: 'auspicious', meaning: 'The leader. Authority, protection, help from people above you.' },
  { order: 2, zh: '螣蛇', pinyin: 'téng shé', en: 'Serpent', nature: 'inauspicious', meaning: 'Worry and illusion. Strange events, false alarms, tangled thinking.' },
  { order: 3, zh: '太阴', pinyin: 'tài yīn', en: 'Moon', alt: ['Great Yin'], nature: 'auspicious', meaning: 'Quiet help. Secrets, planning out of sight, discreet allies.' },
  { order: 4, zh: '六合', pinyin: 'liù hé', en: 'Six Harmony', nature: 'auspicious', meaning: 'Coming together. Partnerships, marriage, go-betweens.' },
  { order: 5, zh: '白虎', pinyin: 'bái hǔ', en: 'White Tiger', nature: 'inauspicious', meaning: 'Force. Injury, pressure, harsh authority.' },
  { order: 6, zh: '玄武', pinyin: 'xuán wǔ', en: 'Black Tortoise', nature: 'inauspicious', meaning: 'The hidden. Theft, lies and loss; also cleverness.' },
  { order: 7, zh: '九地', pinyin: 'jiǔ dì', en: 'Nine Earth', nature: 'auspicious', meaning: 'Staying low. Stability, defence, storage, the long game.' },
  { order: 8, zh: '九天', pinyin: 'jiǔ tiān', en: 'Nine Heaven', nature: 'auspicious', meaning: 'Going high. Bold moves, expansion, travel.' },
  { order: null, alternateFor: '白虎', zh: '勾陈', pinyin: 'gōu chén', en: 'Hook', nature: 'inauspicious', meaning: 'Entanglement. Delays, disputes, things that drag on.' },
  { order: null, alternateFor: '玄武', zh: '朱雀', pinyin: 'zhū què', en: 'Vermilion Bird', nature: 'inauspicious', meaning: 'Words. Documents, news, gossip, arguments.' },
]

// ---------------------------------------------------------------------------- stems, branches, mountains

export const stems: readonly StemGloss[] = [
  { zh: '甲', pinyin: 'jiǎ', yinYang: 'yang', element: 'wood', role: 'hidden', roleZh: '遁', en: 'The Commander', meaning: 'Never shown on the chart. It hides under one of the six 仪, which is where 遁甲 ("hidden Jia") gets its name.' },
  { zh: '乙', pinyin: 'yǐ', yinYang: 'yin', element: 'wood', role: 'wonder', roleZh: '日奇', en: 'Sun Wonder', meaning: 'Gentle growth. Flexibility, soft influence, healing.' },
  { zh: '丙', pinyin: 'bǐng', yinYang: 'yang', element: 'fire', role: 'wonder', roleZh: '月奇', en: 'Moon Wonder', meaning: 'Brightness and force. Momentum, authority, being seen.' },
  { zh: '丁', pinyin: 'dīng', yinYang: 'yin', element: 'fire', role: 'wonder', roleZh: '星奇', en: 'Star Wonder', meaning: 'A light in the dark. Insight, documents, hope.' },
  { zh: '戊', pinyin: 'wù', yinYang: 'yang', element: 'earth', role: 'instrument', roleZh: '仪', hides: '甲子', en: 'Instrument', meaning: 'Capital and stability. Money, resources, the ground under you.' },
  { zh: '己', pinyin: 'jǐ', yinYang: 'yin', element: 'earth', role: 'instrument', roleZh: '仪', hides: '甲戌', en: 'Instrument', meaning: 'Private plans. Desire, secrets, the unfinished.' },
  { zh: '庚', pinyin: 'gēng', yinYang: 'yang', element: 'metal', role: 'instrument', roleZh: '仪', hides: '甲申', en: 'Instrument', meaning: 'Obstruction. Opponents, rigid force, the thing in your way.' },
  { zh: '辛', pinyin: 'xīn', yinYang: 'yin', element: 'metal', role: 'instrument', roleZh: '仪', hides: '甲午', en: 'Instrument', meaning: 'Error and correction. Mistakes, penalties, refinement.' },
  { zh: '壬', pinyin: 'rén', yinYang: 'yang', element: 'water', role: 'instrument', roleZh: '仪', hides: '甲辰', en: 'Instrument', meaning: 'Flow and entrapment. Movement and change, and getting stuck in it.' },
  { zh: '癸', pinyin: 'guǐ', yinYang: 'yin', element: 'water', role: 'instrument', roleZh: '仪', hides: '甲寅', en: 'Instrument', meaning: 'Concealment. Networks, endings, the net.' },
]

export const stemGroups: readonly GlossaryTerm[] = [
  { zh: '三奇', pinyin: 'sān qí', en: 'Three Wonders', meaning: '乙 丙 丁. The three lucky stems, strongest when they meet a good door.' },
  { zh: '六仪', pinyin: 'liù yí', en: 'Six Instruments', meaning: '戊 己 庚 辛 壬 癸. Each one hides one of the six 甲 leaders.' },
]

export const branches: readonly BranchGloss[] = [
  { zh: '子', pinyin: 'zǐ', en: 'Rat', animal: 'Rat', hours: '23–01', palace: 1, meaning: 'The first branch, midnight. Water.' },
  { zh: '丑', pinyin: 'chǒu', en: 'Ox', animal: 'Ox', hours: '01–03', palace: 8, meaning: 'The second branch. Earth.' },
  { zh: '寅', pinyin: 'yín', en: 'Tiger', animal: 'Tiger', hours: '03–05', palace: 8, meaning: 'The third branch. Wood.' },
  { zh: '卯', pinyin: 'mǎo', en: 'Rabbit', animal: 'Rabbit', hours: '05–07', palace: 3, meaning: 'The fourth branch, dawn. Wood.' },
  { zh: '辰', pinyin: 'chén', en: 'Dragon', animal: 'Dragon', hours: '07–09', palace: 4, meaning: 'The fifth branch. Earth.' },
  { zh: '巳', pinyin: 'sì', en: 'Snake', animal: 'Snake', hours: '09–11', palace: 4, meaning: 'The sixth branch. Fire.' },
  { zh: '午', pinyin: 'wǔ', en: 'Horse', animal: 'Horse', hours: '11–13', palace: 9, meaning: 'The seventh branch, noon. Fire.' },
  { zh: '未', pinyin: 'wèi', en: 'Goat', animal: 'Goat', hours: '13–15', palace: 2, meaning: 'The eighth branch. Earth.' },
  { zh: '申', pinyin: 'shēn', en: 'Monkey', animal: 'Monkey', hours: '15–17', palace: 2, meaning: 'The ninth branch. Metal.' },
  { zh: '酉', pinyin: 'yǒu', en: 'Rooster', animal: 'Rooster', hours: '17–19', palace: 7, meaning: 'The tenth branch, dusk. Metal.' },
  { zh: '戌', pinyin: 'xū', en: 'Dog', animal: 'Dog', hours: '19–21', palace: 6, meaning: 'The eleventh branch. Earth.' },
  { zh: '亥', pinyin: 'hài', en: 'Pig', animal: 'Pig', hours: '21–23', palace: 6, meaning: 'The twelfth branch. Water.' },
]

/**
 * The Twenty-four Mountains, clockwise from 壬, 子 centred on 0°. Cardinal branches and the four
 * corner-trigram mountains are carved 20% larger. No colour-coding by element (design.md §9.2).
 */
export const mountains: readonly MountainGloss[] = [
  { zh: '壬', pinyin: 'rén', bearing: 345, palace: 1 },
  { zh: '子', pinyin: 'zǐ', bearing: 0, palace: 1 },
  { zh: '癸', pinyin: 'guǐ', bearing: 15, palace: 1 },
  { zh: '丑', pinyin: 'chǒu', bearing: 30, palace: 8 },
  { zh: '艮', pinyin: 'gèn', bearing: 45, palace: 8 },
  { zh: '寅', pinyin: 'yín', bearing: 60, palace: 8 },
  { zh: '甲', pinyin: 'jiǎ', bearing: 75, palace: 3 },
  { zh: '卯', pinyin: 'mǎo', bearing: 90, palace: 3 },
  { zh: '乙', pinyin: 'yǐ', bearing: 105, palace: 3 },
  { zh: '辰', pinyin: 'chén', bearing: 120, palace: 4 },
  { zh: '巽', pinyin: 'xùn', bearing: 135, palace: 4 },
  { zh: '巳', pinyin: 'sì', bearing: 150, palace: 4 },
  { zh: '丙', pinyin: 'bǐng', bearing: 165, palace: 9 },
  { zh: '午', pinyin: 'wǔ', bearing: 180, palace: 9 },
  { zh: '丁', pinyin: 'dīng', bearing: 195, palace: 9 },
  { zh: '未', pinyin: 'wèi', bearing: 210, palace: 2 },
  { zh: '坤', pinyin: 'kūn', bearing: 225, palace: 2 },
  { zh: '申', pinyin: 'shēn', bearing: 240, palace: 2 },
  { zh: '庚', pinyin: 'gēng', bearing: 255, palace: 7 },
  { zh: '酉', pinyin: 'yǒu', bearing: 270, palace: 7 },
  { zh: '辛', pinyin: 'xīn', bearing: 285, palace: 7 },
  { zh: '戌', pinyin: 'xū', bearing: 300, palace: 6 },
  { zh: '乾', pinyin: 'qián', bearing: 315, palace: 6 },
  { zh: '亥', pinyin: 'hài', bearing: 330, palace: 6 },
]

/**
 * The 24 solar terms, for the chart header and the colophon.
 * TODO(owner): new glossary strings (not in content.md); English follows the common HKO names.
 */
export const solarTerms: readonly SolarTermGloss[] = [
  { index: 0, zh: '冬至', pinyin: 'dōng zhì', en: 'Winter Solstice', meaning: 'The shortest day. The yang cycle begins.' },
  { index: 1, zh: '小寒', pinyin: 'xiǎo hán', en: 'Minor Cold', meaning: 'Solar term, sun at 285°.' },
  { index: 2, zh: '大寒', pinyin: 'dà hán', en: 'Major Cold', meaning: 'Solar term, sun at 300°.' },
  { index: 3, zh: '立春', pinyin: 'lì chūn', en: 'Start of Spring', meaning: 'Solar term, sun at 315°. The sexagenary year turns here.' },
  { index: 4, zh: '雨水', pinyin: 'yǔ shuǐ', en: 'Rain Water', meaning: 'Solar term, sun at 330°.' },
  { index: 5, zh: '惊蛰', pinyin: 'jīng zhé', en: 'Awakening of Insects', meaning: 'Solar term, sun at 345°.' },
  { index: 6, zh: '春分', pinyin: 'chūn fēn', en: 'Spring Equinox', meaning: 'Solar term, sun at 0°.' },
  { index: 7, zh: '清明', pinyin: 'qīng míng', en: 'Clear and Bright', meaning: 'Solar term, sun at 15°.' },
  { index: 8, zh: '谷雨', pinyin: 'gǔ yǔ', en: 'Grain Rain', meaning: 'Solar term, sun at 30°.' },
  { index: 9, zh: '立夏', pinyin: 'lì xià', en: 'Start of Summer', meaning: 'Solar term, sun at 45°.' },
  { index: 10, zh: '小满', pinyin: 'xiǎo mǎn', en: 'Grain Buds', meaning: 'Solar term, sun at 60°.' },
  { index: 11, zh: '芒种', pinyin: 'máng zhòng', en: 'Grain in Ear', meaning: 'Solar term, sun at 75°.' },
  { index: 12, zh: '夏至', pinyin: 'xià zhì', en: 'Summer Solstice', meaning: 'The longest day. The yin cycle begins.' },
  { index: 13, zh: '小暑', pinyin: 'xiǎo shǔ', en: 'Minor Heat', meaning: 'Solar term, sun at 105°.' },
  { index: 14, zh: '大暑', pinyin: 'dà shǔ', en: 'Major Heat', meaning: 'Solar term, sun at 120°.' },
  { index: 15, zh: '立秋', pinyin: 'lì qiū', en: 'Start of Autumn', meaning: 'Solar term, sun at 135°.' },
  { index: 16, zh: '处暑', pinyin: 'chǔ shǔ', en: 'End of Heat', meaning: 'Solar term, sun at 150°.' },
  { index: 17, zh: '白露', pinyin: 'bái lù', en: 'White Dew', meaning: 'Solar term, sun at 165°.' },
  { index: 18, zh: '秋分', pinyin: 'qiū fēn', en: 'Autumn Equinox', meaning: 'Solar term, sun at 180°.' },
  { index: 19, zh: '寒露', pinyin: 'hán lù', en: 'Cold Dew', meaning: 'Solar term, sun at 195°.' },
  { index: 20, zh: '霜降', pinyin: 'shuāng jiàng', en: "Frost's Descent", meaning: 'Solar term, sun at 210°.' },
  { index: 21, zh: '立冬', pinyin: 'lì dōng', en: 'Start of Winter', meaning: 'Solar term, sun at 225°.' },
  { index: 22, zh: '小雪', pinyin: 'xiǎo xuě', en: 'Minor Snow', meaning: 'Solar term, sun at 240°.' },
  { index: 23, zh: '大雪', pinyin: 'dà xuě', en: 'Major Snow', meaning: 'Solar term, sun at 255°.' },
]

// ---------------------------------------------------------------------------- terms

export const luopanTerms: readonly GlossaryTerm[] = [
  { zh: '罗盘', pinyin: 'luó pán', en: 'Luopan', meaning: "The fengshui compass. Rings of trigrams, stems and branches around a magnetic needle, used to read a building's facing." },
  { zh: '天池', pinyin: 'tiān chí', en: 'Heaven Pool', meaning: 'The needle at the centre of a luopan.' },
  { zh: '洛书', pinyin: 'luò shū', en: 'Luo Shu', meaning: 'The 3×3 magic square behind the nine palaces. Every row, column and diagonal adds up to 15.' },
  { zh: '后天八卦', pinyin: 'hòu tiān bā guà', en: 'Later Heaven Bagua', meaning: "King Wen's arrangement of the eight trigrams, matched to directions and to the Luo Shu numbers." },
  { zh: '二十四山', pinyin: 'èr shí sì shān', en: 'Twenty-four Mountains', meaning: 'The 24 compass directions of 15° each, named for eight stems, twelve branches and four trigrams.' },
]

// ---------------------------------------------------------------------------- lookup

const ELEMENT_EN: Readonly<Record<Element, string>> = { water: 'Water', wood: 'Wood', fire: 'Fire', earth: 'Earth', metal: 'Metal' }

/**
 * The sixty stem-branch pairs (干支) that name years, months, days and double hours, e.g. 丙午
 * bǐng wǔ · Fire Horse. A date's pillar is a pair, so it is glossed as one: 丙 alone would read as
 * its Qimen plate role (Moon Wonder), which belongs to stems on the chart, not to dates.
 * TODO(owner): new glosses (not in content.md), built from the stem and branch entries.
 */
function stemBranchPairs(): GlossaryTerm[] {
  return Array.from({ length: 60 }, (_, i) => {
    const s = stems[i % 10] as StemGloss
    const b = branches[i % 12] as BranchGloss
    return {
      zh: `${s.zh}${b.zh}`,
      pinyin: `${s.pinyin} ${b.pinyin}`,
      en: `${ELEMENT_EN[s.element]} ${b.animal}`,
      meaning: `Stem ${s.zh}, ${s.yinYang} ${s.element}, over branch ${b.zh}, the ${b.animal}: one of the sixty pairs that count years, months, days and double hours.`,
    }
  })
}

/**
 * The nine structures as the header prints them, 阴遁四局: 四局 sì jú · Structure 4. Without these the
 * numeral stayed an unglossed run and the gloss on 局 alone read "jú" for "四局".
 * TODO(owner): new glosses (not in content.md), built from the 局 entry.
 */
const NUMERALS: readonly (readonly [string, string])[] = [
  ['一', 'yī'],
  ['二', 'èr'],
  ['三', 'sān'],
  ['四', 'sì'],
  ['五', 'wǔ'],
  ['六', 'liù'],
  ['七', 'qī'],
  ['八', 'bā'],
  ['九', 'jiǔ'],
]

function numberedStructures(): GlossaryTerm[] {
  const ju = chartTerms.find((t) => t.zh === '局')
  if (!ju) return []
  return NUMERALS.map(([zh, pinyin], i) => ({
    zh: `${zh}${ju.zh}`,
    pinyin: `${pinyin} ${ju.pinyin}`,
    en: `${ju.en} ${i + 1}`,
    meaning: ju.meaning,
  }))
}

let index: Map<string, GlossaryTerm> | null = null

// Built on first use, not at module load, so modules that never look up a gloss can tree-shake the data.
function buildIndex(): Map<string, GlossaryTerm> {
  const map = new Map<string, GlossaryTerm>()
  const lists: readonly (readonly GlossaryTerm[])[] = [
    Object.values(glossaryGroups),
    palaces,
    doors,
    stars,
    deities,
    stems,
    stemGroups,
    branches,
    solarTerms,
    chartTerms,
    methodTerms,
    luopanTerms,
    siteAccents,
    stemBranchPairs(),
    numberedStructures(),
  ]
  for (const list of lists) for (const t of list) if (!map.has(t.zh)) map.set(t.zh, t)
  for (const m of mountains) {
    if (!map.has(m.zh)) map.set(m.zh, { zh: m.zh, pinyin: m.pinyin, en: `${m.bearing}°`, meaning: '' })
  }
  return map
}

/**
 * Gloss for a Chinese string, or undefined. Single characters that are both a stem and a palace
 * resolve to the first registered meaning (palaces before stems before mountains). A stem alone
 * reads as its Qimen plate role; a stem-branch pair (丙午) reads as a calendar pillar. Where the
 * same characters mean something else in place, use the contextual lookups below.
 */
export function glossFor(zh: string): GlossaryTerm | undefined {
  index ??= buildIndex()
  return index.get(zh)
}

/**
 * Gloss for a chart mark (值符 值使 旬空 驿马, design.md §9.8) and for the header's duty line.
 * 值符 is both the first deity ("Chief", which glossFor returns) and the duty mark ("Duty Chief");
 * here the chart terms win. Anything else falls through to glossFor, so this can be passed as the
 * lookup for a whole line such as "值符 天芮 Grass in 乾6, 值使 死门 Death Door in 离9".
 */
export function glossForMark(zh: string): GlossaryTerm | undefined {
  return chartTerms.find((t) => t.zh === zh) ?? glossFor(zh)
}

/**
 * Gloss for one of the Twenty-four Mountains on the luopan's R4 ring (design.md §9.2), e.g.
 * "甲 jiǎ · Mountain 75°". Eight mountains are stems, so glossFor would give the stem's plate role
 * ("甲 · The Commander, never shown on the chart") for a glyph that is on the dial.
 * TODO(owner): new glosses (not in content.md), built from `mountains` and `palaces`.
 */
export function glossForMountain(zh: string): GlossaryTerm | undefined {
  const m = mountains.find((x) => x.zh === zh)
  if (!m) return undefined
  const p = palaces.find((x) => x.number === m.palace) as PalaceGloss
  const from = (m.bearing + 352.5) % 360
  const to = (m.bearing + 7.5) % 360
  const stem = stems.find((x) => x.zh === zh)
  const branch = branches.find((x) => x.zh === zh)
  const named = stem
    ? `the stem ${zh}, ${stem.yinYang} ${stem.element}`
    : branch
      ? `the branch ${zh}, the ${branch.animal}`
      : `the trigram ${zh}, ${palaces.find((x) => x.zh === zh)?.en ?? ''}`
  return {
    zh: m.zh,
    pinyin: m.pinyin,
    en: `Mountain ${m.bearing}°`,
    meaning: `One of the Twenty-four Mountains: ${from}° to ${to}°, in palace ${p.number} ${p.zh}, ${p.directionEn.toLowerCase()}. Named for ${named}.`,
  }
}
