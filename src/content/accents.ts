/**
 * The glossary lists the boot bundle needs: site accents, and the method and chart terms that appear
 * in the grove copy. Split from glossary.ts so the first screen doesn't carry the whole glossary;
 * glossary.ts re-exports them and includes them in glossFor().
 */

import type { GlossaryTerm } from './types'

export const chartTerms: readonly GlossaryTerm[] = [
  { zh: '值符', pinyin: 'zhí fú', en: 'Duty Chief', meaning: "The star leading this hour. It starts in the palace of the hour's hidden 甲 and moves to where the hour stem sits. The first deity shares its name." },
  { zh: '值使', pinyin: 'zhí shǐ', en: 'Duty Envoy', meaning: 'The door on duty this hour. It starts in the same palace and steps one palace for each two-hour period since the decade began.' },
  { zh: '阳遁', pinyin: 'yáng dùn', en: 'Yang cycle', meaning: 'From the winter solstice until the summer solstice. Stems are laid out forward through the palaces, 1 to 9.' },
  { zh: '阴遁', pinyin: 'yīn dùn', en: 'Yin cycle', meaning: 'From the summer solstice until the winter solstice. Stems are laid out backward, 9 to 1.' },
  { zh: '局', pinyin: 'jú', en: 'Structure', meaning: "Numbered 1 to 9: the palace where 戊 starts. Set by the solar term and which third of it you're in. Eighteen in all, nine yang and nine yin." },
  { zh: '元', pinyin: 'yuán', en: 'Third', alt: ['Upper, middle, lower'], meaning: 'Each 15-day solar term splits into three five-day thirds, 上元 中元 下元, each with its own 局.' },
  { zh: '旬首', pinyin: 'xún shǒu', en: 'Decade Head', meaning: 'The 甲 that leads the current decade of ten two-hour periods (20 hours), hidden under one of the six 仪.' },
  { zh: '旬空', pinyin: 'xún kōng', en: 'Void', meaning: 'Each decade of ten two-hour periods pairs its ten stems with only ten of the twelve branches. The two left over are void: their palaces are "empty" for now, delayed, hollow, or not yet real.' },
  { zh: '驿马', pinyin: 'yì mǎ', en: 'Post Horse', meaning: 'Movement, travel and change. Found from the hour branch: 申子辰 → 寅, 寅午戌 → 申, 巳酉丑 → 亥, 亥卯未 → 巳.' },
  // TODO(owner): 时辰 is a new gloss (the grove method note uses it); not in content.md.
  { zh: '时辰', pinyin: 'shí chen', en: 'Double hour', meaning: 'One of the twelve two-hour periods of the day, each named for an earthly branch. The chart turns at each one.' },
  // TODO(owner): the thirds, 中五 and 禽寄坤 are new glosses the chart labels need (lib/qimen/labels.ts).
  { zh: '上元', pinyin: 'shàng yuán', en: 'Upper third', meaning: 'The first five days of a solar term, with its own 局.' },
  { zh: '中元', pinyin: 'zhōng yuán', en: 'Middle third', meaning: 'The middle five days of a solar term, with its own 局.' },
  { zh: '下元', pinyin: 'xià yuán', en: 'Lower third', meaning: 'The last five days of a solar term, with its own 局.' },
  { zh: '中五', pinyin: 'zhōng wǔ', en: 'Centre 5', meaning: 'The centre palace. Whatever lands here lodges in 坤 2.' },
  { zh: '禽寄坤', pinyin: 'qín jì kūn', en: 'Bird lodges in Kun', meaning: 'On a rotating-plate chart the centre star 天禽 and its stem ride with 天芮, the star of 坤 2.' },
  { zh: '天盘', pinyin: 'tiān pán', en: 'Heaven plate', meaning: 'The stems carried round by the stars.' },
  { zh: '地盘', pinyin: 'dì pán', en: 'Earth plate', meaning: 'The fixed layout of stems for this 局.' },
]

export const methodTerms: readonly GlossaryTerm[] = [
  { zh: '奇门遁甲', pinyin: 'qí mén dùn jiǎ', en: 'Qimen Dunjia', alt: ['Wonder Doors, Hidden Jia'], meaning: 'A Chinese system for reading time and direction, with military roots.' },
  { zh: '时家奇门', pinyin: 'shí jiā qí mén', en: 'Hour Qimen', meaning: 'A new chart every two-hour 时辰, twelve a day.' },
  { zh: '转盘', pinyin: 'zhuàn pán', en: 'Rotating plate', meaning: 'Stars, doors and deities turn around the eight outer palaces as rings. The other school, 飞盘, flies them through the palaces in Luo Shu order.' },
  { zh: '拆补法', pinyin: 'chāi bǔ fǎ', en: 'Split-and-patch method', meaning: "Switches 局 at the exact solar-term moment and reads the 元 from the 符头, instead of the 置闰 method's leap adjustments." },
  { zh: '符头', pinyin: 'fú tóu', en: 'Head day', meaning: 'The 甲 or 己 day that opens each five-day block. Its branch picks the 元: 子午卯酉 upper, 寅申巳亥 middle, 辰戌丑未 lower.' },
]

/**
 * Site accents outside the chart.
 * TODO(owner): 文 and 留白 glosses are new (design.md §4.5 and the terminal's `cat .mist`).
 */
export const siteAccents: readonly GlossaryTerm[] = [
  { zh: '林', pinyin: 'lín', en: 'forest', meaning: 'Two trees make a forest. 林 is also the surname Lim.' },
  { zh: '入林', pinyin: 'rù lín', en: 'into the forest', meaning: 'Stepping into the trees. 林 is also Lim.' },
  { zh: '木屋', pinyin: 'mù wū', en: 'wooden hut', meaning: "The scholar's hut in every landscape painting. This one writes software." },
  { zh: '九宫', pinyin: 'jiǔ gōng', en: 'nine palaces', meaning: 'The Luo Shu grid every Qimen chart is laid on.' },
  { zh: '石灯', pinyin: 'shí dēng', en: 'stone lantern', meaning: 'The one warm light in the forest, at the end of the path.' },
  { zh: '文', pinyin: 'wén', en: 'writing', meaning: 'Writing, literature. Here, the blog.' },
  { zh: '留白', pinyin: 'liú bái', en: 'leaving white', meaning: 'Ink-wash painters paint mist by not painting it: the paper is left blank.' },
]
