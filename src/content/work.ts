/**
 * Selected work (content.md §3). Four featured items become the cabin's hanging scrolls
 * (design.md §8.4, in `featuredOrder`); the "Also" list closes the scroll-4 card; hidden items
 * appear nowhere.
 */

import type { Link } from './types'

export type WorkId =
  | 'tokenyze'
  | 'kysen'
  | 'nextrare'
  | 'asterix'
  | 'miroma'
  | 'mercury-labs'
  | 'atticc'
  | 'oripax'
  | 'jrny'
  | 'jrny-plan'
  | 'tbsx3'
  | 'jrny-spark'
  | 'upstream'

export interface WorkItem {
  readonly id: WorkId
  readonly title: string
  /** Employer, client or "Personal project". */
  readonly context: string
  readonly role: string
  /** Display string. null means unknown: hide until the owner fills it in. */
  readonly years: string | null
  readonly summary: string
  /** One line for the "Also" list, where the full summary would overflow the card. */
  readonly oneLine?: string
  readonly tags: readonly string[]
  readonly links: readonly Link[]
  /** Scroll image core: public path to a 512 px WebP, or null for the procedural emblem (NDA work). */
  readonly image: string | null
  /**
   * The longer write-up inside the card's <details> (design.md §8.4). null until written: the card
   * then has no <details>. TODO(owner): a short paragraph or two per featured project.
   */
  readonly writeup?: readonly string[] | null
}

export const workItems: Readonly<Record<WorkId, WorkItem>> = {
  tokenyze: {
    id: 'tokenyze',
    title: 'Tokenyze Agent Portal',
    context: 'Tokenyze',
    role: 'Frontend engineer',
    years: '2024–2026',
    summary:
      'The agent dashboard for Tokenyze, which tokenises gold and other metals. Agents use it to handle compliance on gold trades.',
    // TODO(owner): swap these for the real stack once confirmed.
    tags: ['Frontend', 'Tokenised gold', 'Compliance'],
    links: [{ label: 'tokenyze.co', href: 'https://tokenyze.co' }],
    image: null,
  },
  kysen: {
    id: 'kysen',
    title: 'Kysen',
    context: 'Kysen Technologies',
    role: 'Software engineer',
    years: '2019–2026',
    summary:
      'Kysen runs Proof of Stake validators and builds products for other blockchain teams. I built the React frontend for Cosmos Outpost, an analytics site for the Cosmos ecosystem, and Harvest, a Flutter wallet on Terra that earned yield on stablecoin deposits and swapped between Terra stablecoins. I also worked on Mirror Wallet, a mobile wallet for trading tokenised US stocks on Mirror Protocol.',
    tags: ['React', 'Flutter', 'Cosmos', 'Terra'],
    links: [{ label: 'kysenpool.io', href: 'https://www.kysenpool.io' }],
    image: null,
  },
  nextrare: {
    id: 'nextrare',
    title: 'NextRare',
    context: 'Cyants, client work',
    role: 'Mobile and backend engineer',
    years: '2025–2026',
    summary:
      'An iOS and Android app for opening collectible card packs. I built features across the app, including pack reveals, missions, a loyalty points system, and crypto deposits and withdrawals on Base and Solana, plus the backend APIs for rewards and pack odds.',
    tags: ['Expo', 'React Native', 'Next.js', 'Drizzle', 'Privy'],
    links: [{ label: 'nextrare.cards', href: 'https://nextrare.cards' }],
    image: null,
  },
  asterix: {
    id: 'asterix',
    title: 'Asterix and Amaterasu',
    context: 'Cyants, client work',
    role: 'Web and Move engineer',
    years: '2024–2025',
    summary:
      'Seven web apps for Asterix, a hybrid token and NFT project on Ethereum, covering staking, vesting, a quest platform and NFT rerolls. Then Amaterasu, a hybrid NFT collection on Aptos, including its Move smart contracts.',
    tags: ['Next.js', 'wagmi', 'Aptos', 'Move', 'Three.js'],
    links: [],
    image: null,
  },
  miroma: {
    id: 'miroma',
    title: 'Liv and Pave',
    context: 'Miroma Project Factory',
    role: 'Software engineer',
    years: '2021–now',
    oneLine: 'Health apps with Miroma Project Factory. Liv for dementia care, and Pave for Cancer Institute NSW.',
    summary:
      'Health apps. I wrote most of Liv, a support app for people living with dementia and their carers, in 2021, and I now work on Stage 3 of Pave, the quit-vaping app for young people from Cancer Institute NSW.',
    tags: ['React Native', 'Expo', 'NestJS', 'Azure'],
    links: [],
    image: null,
  },
  'mercury-labs': {
    id: 'mercury-labs',
    title: 'Mercury Labs',
    context: 'Mercury Labs',
    role: 'Software engineer',
    years: '2022–2023',
    oneLine: 'Tokenised wine, and a Hedera dashboard for suppliers to tokenise their own assets.',
    summary:
      'Mercury Labs tokenises real assets, starting with wine. I built a Hedera dashboard where a supplier creates its own token, sets up a multisig treasury and uploads the token metadata.',
    tags: ['Hedera', 'Next.js', 'IPFS'],
    links: [{ label: 'mercury.eco', href: 'https://mercury.eco' }],
    image: null,
  },
  atticc: {
    id: 'atticc',
    title: 'atticc',
    context: 'atticc',
    role: 'Software engineer',
    years: '2022–2023',
    oneLine: 'A web3 social network on CyberConnect and XMTP. I built most of the web app.',
    summary:
      'A web3 social network. I built most of the web app, including profiles and follows on CyberConnect, wallet-to-wallet chat over XMTP, token-gated communities, peer-to-peer NFT trading and an NFT membership pass.',
    tags: ['Next.js', 'CyberConnect', 'XMTP', 'Solidity'],
    links: [],
    image: null,
  },
  oripax: {
    id: 'oripax',
    title: 'OripaX',
    // TODO(owner): hackathon entry? Name the event. Live demo URL?
    context: 'Personal project',
    role: 'Solo build',
    years: '2026',
    oneLine: 'A personal build. An on-chain gacha where every draw is a USDC micropayment over x402.',
    summary:
      'A Japanese-style oripa gacha on X Layer. Every draw is a USDC micropayment over x402, every card mints as an ERC-721 NFT, and the odds shift as each finite pool empties.',
    tags: ['TanStack Start', 'Cloudflare Workers', 'D1', 'Drizzle', 'Solidity', 'x402', 'Matter.js'],
    links: [{ label: 'github.com/cylim/oripax', href: 'https://github.com/cylim/oripax' }],
    // TODO(owner): clear a screenshot for the scroll.
    image: null,
  },
  jrny: {
    id: 'jrny',
    title: 'JRNY',
    context: 'Cyants',
    role: 'Solo build',
    years: '2025',
    oneLine: 'A Cyants travel app that shows who else is in your city right now.',
    summary:
      'A travel log with a social side. It shows who else is in your city right now and who overlapped with your past trips, then helps you turn that into a meetup.',
    tags: ['TanStack Start', 'Convex', 'Better Auth', 'Stripe', 'Cloudflare Workers'],
    links: [{ label: 'github.com/cylim/jrny-app-demo', href: 'https://github.com/cylim/jrny-app-demo' }],
    // TODO(owner): clear a screenshot for the scroll.
    image: null,
  },
  'jrny-plan': {
    id: 'jrny-plan',
    title: 'JRNY Plan',
    context: 'Cyants',
    role: 'Solo build',
    years: '2026',
    summary:
      'Group scheduling without the back-and-forth. Hosts propose times, everyone marks availability live, and the app ranks the best overlap. It reads Google Calendar free/busy without ever seeing event details.',
    tags: ['React 19', 'TanStack Start', 'Convex', 'StyleX', 'Playwright'],
    // TODO(owner): rename the supreme-dollop repo, or give a live URL on a real domain.
    links: [{ label: 'github.com/cylim/supreme-dollop', href: 'https://github.com/cylim/supreme-dollop' }],
    image: null,
  },
  tbsx3: {
    id: 'tbsx3',
    title: 'TBSx3',
    context: 'TBSx3',
    role: 'Senior Software Engineer, Penang team lead',
    years: '2017–2018',
    oneLine: 'Blockchain anti-counterfeiting for supply chains. I led the Penang team.',
    summary:
      'Blockchain-backed anti-counterfeiting for supply chains. I led the Penang team through hiring and delivery, built the API services behind the web dashboard and mobile app, and set up GitLab CI/CD shipping to AWS, Rancher and Firebase.',
    tags: ['API services', 'GitLab CI/CD', 'AWS', 'Rancher', 'Firebase'],
    links: [],
    image: null,
  },
  'jrny-spark': {
    id: 'jrny-spark',
    title: 'JRNY Spark',
    // TODO(owner): show or hide? It's an intimacy game. Hidden by default (not in any list below).
    context: 'Cyants',
    role: 'Solo build',
    years: '2026',
    summary:
      'A couples board-game PWA where play data never leaves the device. Offline-first with IndexedDB, and a pure TypeScript game engine.',
    tags: ['TanStack Start', 'Convex', 'Clerk', 'IndexedDB', 'Workbox'],
    links: [{ label: 'github.com/cylim/jrny-spark', href: 'https://github.com/cylim/jrny-spark' }],
    image: null,
  },
  upstream: {
    id: 'upstream',
    title: 'Upstream fixes',
    context: 'Open source',
    role: 'Contributor',
    years: '2020–2024',
    summary:
      "Merged fixes in tools I use. A Windows install fix for Ghost, device photo upload for Bonfida's SNS Manager, and docs and link fixes in React, TanStack Query and Aptos Core.",
    tags: ['Ghost', 'Solana', 'React', 'TanStack Query', 'Aptos'],
    links: [
      { label: 'Ghost #12096', href: 'https://github.com/TryGhost/Ghost/pull/12096' },
      { label: 'SNS Manager #14', href: 'https://github.com/Bonfida/sns-manager/pull/14' },
      { label: 'React #19598', href: 'https://github.com/react/react/pull/19598' },
      { label: 'TanStack Query #5332', href: 'https://github.com/TanStack/query/pull/5332' },
      { label: 'Aptos Core #11718', href: 'https://github.com/aptos-labs/aptos-core/pull/11718' },
    ],
    image: null,
  },
}

/** The four hanging scrolls, in hall order (scroll 1 nearest the door). design.md §18.1 default. */
export const featuredOrder = ['tokenyze', 'kysen', 'nextrare', 'asterix'] as const satisfies readonly WorkId[]

/** The "Also" list at the end of the scroll-4 card. */
export const alsoOrder = ['miroma', 'atticc', 'mercury-labs', 'jrny'] as const satisfies readonly WorkId[]

export const featuredWork: readonly WorkItem[] = featuredOrder.map((id) => workItems[id])
export const alsoWork: readonly WorkItem[] = alsoOrder.map((id) => workItems[id])
