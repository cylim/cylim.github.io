/**
 * The cabin terminal's commands (content.md §3): exact output lines. The command engine
 * (src/dom/terminal/commands.ts) matches input against these and never invents text.
 */

import { contactOutput, whoamiOutput } from './terminal'

export type TerminalAction =
  | { readonly type: 'print' }
  | { readonly type: 'clear' }
  /** Print, wait 600 ms, then fog-dive to the hash (skips the moon gate). */
  | { readonly type: 'navigate'; readonly hash: '#cabin' | '#grove' | '#contact' }
  /** Output is computed at runtime. See qimenTemplate and fortunes. */
  | { readonly type: 'dynamic'; readonly id: 'qimen' | 'fortune' }

export interface TerminalCommand {
  readonly name: string
  readonly aliases?: readonly string[]
  /** One-line description. Hidden commands leave it empty. */
  readonly description: string
  readonly hidden: boolean
  /** 'prefix' matches "sudo anything". Default is exact, trimmed, lower-cased. */
  readonly match?: 'exact' | 'prefix'
  /** Lines printed before the action runs. */
  readonly output: readonly string[]
  readonly action: TerminalAction
}

export const terminalCommands: readonly TerminalCommand[] = [
  {
    name: 'help',
    description: 'list commands',
    hidden: false,
    output: [
      'whoami     who lives here',
      'services   what I build for clients',
      'projects   selected work',
      'stack      tools I reach for',
      "timeline   where I've worked and studied",
      'contact    where to find me',
      'qimen      cast a Qimen chart for right now',
      'grove      walk on to the grove',
      'clear      wipe the screen',
      '',
      "Not every command is listed. It's a cabin, not a manual.",
    ],
    action: { type: 'print' },
  },
  {
    name: 'whoami',
    description: 'who lives here',
    hidden: false,
    output: whoamiOutput,
    action: { type: 'print' },
  },
  {
    name: 'services',
    description: 'what I build for clients',
    hidden: false,
    output: [
      '1. Web apps, blank repo to launch',
      '   React + TypeScript, auth, payments, realtime, deploys.',
      '2. Web3 frontends',
      '   Wallet flows, dashboards, dApps. Cosmos, Terra, Aptos, Solana, EVM.',
      '3. Mobile apps',
      '   React Native, Flutter, native iOS.',
      '4. Pipelines and a security-minded review',
      '   CI/CD that tests and deploys. Security degree, CPEH.',
    ],
    action: { type: 'print' },
  },
  {
    name: 'projects',
    aliases: ['work', 'ls projects'],
    description: 'selected work',
    hidden: false,
    output: [
      '2026  OripaX           on-chain gacha, x402 + NFTs (personal)',
      '                       github.com/cylim/oripax',
      '2026  JRNY Plan        group scheduling (personal)',
      '                       github.com/cylim/supreme-dollop',
      "2025  JRNY             travel log, who's in town (personal)",
      '                       github.com/cylim/jrny-app-demo',
      '2019+ Cosmos insights  React frontend, at Kysen',
      '      Terra dApp       Flutter swaps and investing, at Kysen',
      '2017  TBSx3            anti-counterfeit, led the Penang team',
      '',
      'The panels around you have the details.',
    ],
    action: { type: 'print' },
  },
  {
    name: 'stack',
    description: 'tools I reach for',
    hidden: false,
    output: [
      'lang      TypeScript, JavaScript, Dart, Swift, Solidity',
      'frontend  React, TanStack, Next.js, Tailwind, StyleX',
      'mobile    React Native, Flutter, iOS',
      'backend   Node.js, Convex, Cloudflare Workers + D1, Drizzle',
      'web3      Cosmos, Terra, Aptos, Solana, EVM, x402',
      'ship      Bun, Vite, Vitest, Playwright, GitHub Actions, Docker',
      'this site React Three Fiber, three.js, GitHub Pages',
    ],
    action: { type: 'print' },
  },
  {
    name: 'timeline',
    aliases: ['history'],
    description: "where I've worked and studied",
    hidden: false,
    output: [
      '2026-     Miroma Project Factory  Software Engineer',
      '2024-26   Tokenyze                Frontend Engineer',
      '2022-23   Mercury Labs, atticc    Software Engineer',
      '2020-22   Miroma Project Factory  Software Engineer',
      '2019-26   Kysen Technologies      Software Engineer',
      '2018-24   Cyants                  SE, agency + Upwork projects',
      '2017-18   TBSx3                   Senior SE, Penang lead',
      '2017      Lava X                  Full Stack Developer',
      '2016      Univ. of Wollongong     BCompSc, Digital System Security',
      '2015      Tableapp                iOS intern',
    ],
    action: { type: 'print' },
  },
  {
    name: 'contact',
    aliases: ['socials'],
    description: 'where to find me',
    hidden: false,
    output: contactOutput,
    action: { type: 'print' },
  },
  {
    name: 'qimen',
    description: 'cast a Qimen chart for right now',
    hidden: false,
    output: [],
    action: { type: 'dynamic', id: 'qimen' },
  },
  {
    name: 'grove',
    aliases: ['cd grove', 'exit', 'logout'],
    description: 'walk on to the grove',
    hidden: false,
    output: ['You step out of the cabin. The mist closes behind you.'],
    action: { type: 'navigate', hash: '#grove' },
  },
  {
    name: 'clear',
    description: 'wipe the screen',
    hidden: false,
    output: [],
    action: { type: 'clear' },
  },

  // Hidden commands (easter eggs, not in `help`)
  {
    name: 'sudo',
    match: 'prefix',
    description: '',
    hidden: true,
    output: ['Permission denied. The cabin belongs to the forest.'],
    action: { type: 'print' },
  },
  {
    name: 'rm -rf /',
    aliases: ['rm -rf *', 'rm -rf ~'],
    description: '',
    hidden: true,
    output: ["The forest was here before root. It'll be here after."],
    action: { type: 'print' },
  },
  {
    name: 'vim',
    aliases: ['vi'],
    description: '',
    hidden: true,
    output: ['You are now in vim. Good luck.', '(type :q to leave)'],
    action: { type: 'print' },
  },
  {
    name: ':q',
    aliases: [':q!', ':wq'],
    description: '',
    hidden: true,
    output: ['Freedom. Most people take longer.'],
    action: { type: 'print' },
  },
  {
    name: 'ls',
    description: '',
    hidden: true,
    output: ['services  projects  stack  timeline  contact  qimen  .mist'],
    action: { type: 'print' },
  },
  {
    name: 'cat .mist',
    description: '',
    hidden: true,
    output: ['留白. Leave it white. Ink-wash painters paint mist by not painting it.'],
    action: { type: 'print' },
  },
  {
    name: 'teh-tarik',
    aliases: ['kopi'],
    description: '',
    hidden: true,
    output: ['Pulling one teh tarik... done. Kurang manis, as ordered.'],
    action: { type: 'print' },
  },
  {
    name: 'luopan',
    aliases: ['compass'],
    description: '',
    hidden: true,
    output: ['On a phone? In the grove, tap "Follow compass" and the luopan turns with you.'],
    action: { type: 'print' },
  },
  {
    name: 'fortune',
    description: '',
    hidden: true,
    output: [],
    action: { type: 'dynamic', id: 'fortune' },
  },
]

/** Placeholders the Qimen engine must supply to fill qimenTemplate. */
export interface QimenTemplateVars {
  /** e.g. "2026-09-28 14:05" */
  readonly localDateTime: string
  /** e.g. "Asia/Kuala_Lumpur" */
  readonly timeZone: string
  /** 干支 of the year, e.g. "丙午" */
  readonly yearGz: string
  readonly monthGz: string
  readonly dayGz: string
  readonly hourGz: string
  readonly dunZh: '阳遁' | '阴遁'
  readonly dunEn: 'Yang' | 'Yin'
  /** 1–9 */
  readonly ju: number
  /** 一 … 九 */
  readonly juZh: string
  /** Star, e.g. "天心" */
  readonly zhifuZh: string
  /** e.g. "Heart" */
  readonly zhifuEn: string
  readonly zhifuPalace: number
  /** Door, e.g. "开门" */
  readonly zhishiZh: string
  /** e.g. "Open" */
  readonly zhishiEn: string
  readonly zhishiPalace: number
  /** Two branches, e.g. "戌亥" */
  readonly kong: string
  /** One branch, e.g. "寅" */
  readonly ma: string
  readonly maPalace: number
}

/**
 * Output of the `qimen` command. Replace {key} with QimenTemplateVars. In the DOM log the chart
 * itself renders as a 3 × 3 HTML grid, south up, after these lines (design.md §10.3).
 */
export const qimenTemplate: readonly string[] = [
  '时家奇门 · 转盘 · 拆补法',
  'cast for {localDateTime} ({timeZone})',
  '{yearGz}年 {monthGz}月 {dayGz}日 {hourGz}时',
  '{dunZh}{juZh}局 · {dunEn} cycle, structure {ju}',
  '值符 {zhifuZh} {zhifuEn} star, palace {zhifuPalace}',
  '值使 {zhishiZh} {zhishiEn} door, palace {zhishiPalace}',
  '旬空 {kong} · 驿马 {ma} (palace {maPalace})',
  '',
  "Type 'grove' to see the whole board.",
  'For reflection, not advice.',
]

export interface Fortune {
  readonly zh: string
  readonly en: string
  readonly source: string
}

/** Public-domain classical lines for the hidden `fortune` command: Chinese first, English second. */
export const fortunes: readonly Fortune[] = [
  { zh: '千里之行，始于足下。', en: 'A journey of a thousand li begins beneath your feet.', source: '道德经 64' },
  { zh: '知人者智，自知者明。', en: 'Knowing others is wisdom. Knowing yourself is clarity.', source: '道德经 33' },
  { zh: '上善若水。', en: 'The highest good is like water.', source: '道德经 8' },
  { zh: '工欲善其事，必先利其器。', en: 'A craftsman who wants to do good work first sharpens his tools.', source: '论语 · 卫灵公' },
  {
    zh: '天时不如地利，地利不如人和。',
    en: 'Good timing is no match for good ground. Good ground is no match for people in harmony.',
    source: '孟子 · 公孙丑下',
  },
  {
    zh: '知彼知己，百战不殆。',
    en: 'Know the other side and know yourself, and a hundred battles hold no danger.',
    source: '孙子兵法 · 谋攻',
  },
]
