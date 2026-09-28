/**
 * Site-level copy: nav, hero, per-section headings and lines, seals, colophon.
 * Source: content.md §2, §3, §5, §7 with design.md §18.1 proposals applied as defaults
 * (hero accent 入林, links row in the hero, services as two forest cards, Work/Grove/Contact nav,
 * cabin bridge line, four featured scrolls plus "Also", colophon on).
 */

import type { SectionId } from '../core/sections/ids'
import type { Accent, Link } from './types'

// ---------------------------------------------------------------------------- nav (design.md §4.1, §4.2)

export interface NavItem {
  readonly id: SectionId
  /** Real anchor target. The threshold links to the bare path. */
  readonly href: '/' | '#cabin' | '#grove' | '#contact'
  /** Plain word, first. Carries the accessible name. */
  readonly label: string
  /** Accessible name, e.g. "Work, the cabin". */
  readonly ariaLabel: string
  /** CJK accent above the label (aria-hidden; its gloss shows on hover and focus). */
  readonly accent: Accent
}

/** Desktop shows the home mark plus the three places; the mobile bar adds "Top" first. */
export const homeMark = {
  name: 'CY Lim',
  ariaLabel: 'CY Lim, back to the edge of the forest',
  href: '/',
} as const

export const nav: readonly NavItem[] = [
  {
    id: 'threshold',
    href: '/',
    label: 'Top',
    ariaLabel: 'Top, the edge of the forest',
    accent: { zh: '林', pinyin: 'lín', en: 'forest (also the surname Lim)' },
  },
  {
    id: 'cabin',
    href: '#cabin',
    label: 'Work',
    ariaLabel: 'Work, the cabin',
    accent: { zh: '木屋', pinyin: 'mù wū', en: 'wooden hut' },
  },
  {
    id: 'grove',
    href: '#grove',
    label: 'Grove',
    ariaLabel: 'Grove, a live Qimen Dunjia chart',
    accent: { zh: '九宫', pinyin: 'jiǔ gōng', en: 'nine palaces' },
  },
  {
    id: 'contact',
    href: '#contact',
    label: 'Contact',
    ariaLabel: 'Contact, the stone lantern',
    accent: { zh: '石灯', pinyin: 'shí dēng', en: 'stone lantern' },
  },
]

// ---------------------------------------------------------------------------- hero (content.md §2, design.md §8.1)

const positioningOptions = [
  'I build web apps and web3 frontends, from a blank repo to launch.',
  'Software engineer in Penang. I turn product ideas into shipped React and TypeScript apps.',
  'The parts of software people touch. Web, mobile and web3, since 2017.',
] as const

export const hero = {
  name: 'CY Lim',
  /** Meta and JSON-LD only. */
  fullName: 'Chee Yeong Lim',
  role: 'Software engineer in Penang, Malaysia.',
  positioningOptions,
  positioning: positioningOptions[2],
  subline:
    'Walk in. The work is in the cabin, a live Qimen chart is in the grove, and my links hang by the lantern at the end.',
  // TODO(owner): e.g. 'Taking on a small number of freelance projects.' Only if true. Hidden while null.
  availability: null as string | null,
  /** design.md §18.1: accepted default over content.md's 入山. */
  accent: { zh: '入林', pinyin: 'rù lín', en: 'into the forest (林 is also Lim)' } satisfies Accent,
  /** design.md §18.1: a small social-links row on the first screen. */
  showSocialRow: true,
  scrollHint: 'Scroll to walk in',
} as const

// ---------------------------------------------------------------------------- forest walk (design.md §8.2)

export const forest = {
  servicesHeading: 'What I build',
  /** Services in two sticky cards, split by the pine wipe (F2). Ids from services.ts. */
  cards: [
    { beat: 'F1', serviceIds: ['web-apps', 'web3'] },
    { beat: 'F3', serviceIds: ['mobile', 'pipelines-security'] },
  ],
} as const

// ---------------------------------------------------------------------------- cabin (content.md §3, design.md §8.3–8.4)

export const cabin = {
  /** Small label above the h2. */
  label: 'Work',
  heading: 'The Cabin',
  accent: { zh: '木屋', pinyin: 'mù wū', en: 'wooden hut' } satisfies Accent,
  /** C1, zone L. design.md §18.1 accepted. */
  bridge:
    "In old landscape paintings there's always a hut, and in the hut there's always a scholar at a desk. This one writes software.",
  /** I1, zone L. "The panels in here" stays as written; the panels are the scrolls. */
  intro: [
    // TODO(owner): Cyants (2018–2024) is "Software Engineer" on LinkedIn, so this no longer says "set up
    // my own studio". Put the studio back only if you want to claim it.
    "I've been shipping software since 2017. I started by leading six-week MVP builds for agency clients, then ran the Penang team at a blockchain startup. From 2018 to 2024 I also took on agency coding projects and small Upwork jobs. I've worked on blockchain frontends since 2019, and most of what I write now is React and TypeScript.",
    // Backticks mark inline code.
    'The panels in here are selected work. The terminal answers questions. Type `help`.',
  ],
  workHeading: 'Selected work',
  alsoHeading: 'Also',
  timelineHeading: "Where I've been",
  stackHeading: 'Tools I reach for',
  terminalHeading: 'Terminal',
  openTerminal: 'Open terminal',
  /** "01 / 04" style index on each scroll card. */
  scrollIndex: '{n} / {total}',
  // TODO(owner): drafted labels (not in content.md).
  /** Accessible name of each card's tag list. */
  tagsLabel: 'Built with',
  /** Summary of the <details> holding a project's longer write-up. */
  more: 'More',
  timelineColumns: { years: 'Years', where: 'Where', role: 'Role' },
} as const

// ---------------------------------------------------------------------------- grove heading (copy lives in grove.ts)

export const groveHeading = {
  heading: 'The Grove',
  accent: { zh: '九宫', pinyin: 'jiǔ gōng', en: 'nine palaces' } satisfies Accent,
} as const

// ---------------------------------------------------------------------------- contact (content.md §5, design.md §8.7)

export const contact = {
  /** Small label above the h2. */
  label: 'The Lantern',
  heading: 'Contact',
  accent: { zh: '石灯', pinyin: 'shí dēng', en: 'stone lantern' } satisfies Accent,
  /** Carved on the stele and shown in the DOM. */
  line: 'End of the path. If you have something to build, find me here.',
  footer: '© 2026 CY Lim. Built with React Three Fiber.',
  source: { label: 'Source on GitHub', href: 'https://github.com/cylim/cylim.github.io' } satisfies Link,
  walkAgain: 'Walk again',
  /** E3 map pins; real links that fog-dive. */
  mapPins: {
    cabin: 'Work',
    grove: 'Grove',
    threshold: 'Start',
  },
} as const

// ---------------------------------------------------------------------------- inscriptions and title cards (design.md §4.1, §4.3)

/**
 * Section inscription (题款) and fog-dive title card per section: accent in Ma Shan Zheng,
 * English name under it. Ma Shan Zheng is subset to 入 林 木 屋 九 宫 石 灯 only.
 */
export const inscriptions: Record<SectionId, { readonly accent: Accent; readonly name: string }> = {
  threshold: { accent: hero.accent, name: 'The edge of the forest' },
  cabin: { accent: cabin.accent, name: 'The Cabin' },
  grove: { accent: groveHeading.accent, name: 'The Grove' },
  contact: { accent: contact.accent, name: 'Contact' },
}

// ---------------------------------------------------------------------------- seals (design.md §4.4)

export const seals = {
  /** The 林 seal ships: 朱文 for the nav mark, cabin desk and finale; 白文 for the hero signature. */
  lin: { zh: '林', enabled: true },
} as const

// ---------------------------------------------------------------------------- colophon (design.md §8.7 E3)

/**
 * The colophon (题跋) writes itself in E3, dated for this visit in the traditional calendar.
 * Rules: the sexagenary year turns at 立春; the term day reads {term}日 on day 0 and
 * {term}后{N}日 (Chinese numerals) on days 1 to 14; values come from the same calendar as the chart.
 * Example: 丙午年 秋分后五日 戌时 · 林 写于槟城
 */
export const colophon = {
  enabled: true,
  /** {yearGz} e.g. 丙午; {termDay} e.g. 秋分后五日; {hourBranch} e.g. 戌. */
  zh: '{yearGz}年 {termDay} {hourBranch}时 · 林 写于槟城',
  termDayZero: '{term}日',
  termDayAfter: '{term}后{n}日',
  /** {termDayEn} e.g. "five days after the autumn equinox"; {yearPinyin} e.g. "Bing-Wu"; {hourAnimal} e.g. "Dog". */
  en: 'Inscribed in Penang for your visit, {termDayEn}, in the {yearPinyin} year, at the hour of the {hourAnimal}. 林 is Lim. Two trees make a forest.',
  termDayZeroEn: 'on the day of {termEn}',
  termDayAfterEn: '{nEn} days after {termEn}',
  termDayOneEn: 'one day after {termEn}',
  // TODO(owner): the eve form for the 15th and 16th day of a term (lib/calendar/colophon.ts), e.g. 清明前一日.
  termDayBefore: '{term}前{n}日',
  termDayBeforeEn: '{nEn} days before {termEn}',
  termDayOneBeforeEn: 'the day before {termEn}',
  /** Numerals for day counts 1 to 14; the 15th and 16th days use the eve form above. 十五 is a spare. */
  numeralsZh: ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二', '十三', '十四', '十五'],
  numeralsEn: ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen'],
} as const
