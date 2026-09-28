/**
 * Selected work (content.md §3). Four featured items become the cabin's hanging scrolls
 * (design.md §8.4, in `featuredOrder`); the "Also" list closes the scroll-4 card; hidden items
 * appear nowhere.
 */

import type { Link } from './types'

export type WorkId =
  | 'cosmos-insights'
  | 'terra-dapp'
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
  'cosmos-insights': {
    id: 'cosmos-insights',
    title: 'Cosmos insights platform',
    context: 'Kysen Technologies',
    role: 'Frontend engineer',
    // TODO(owner): exact years for this project. 2019–2026 is the whole Kysen role.
    years: '2019–2026',
    // TODO(owner): product name, what it showed, public link, TypeScript or not.
    summary: 'React frontend for an insights platform covering the Cosmos blockchain.',
    tags: ['React', 'Cosmos'],
    links: [],
    image: null,
  },
  'terra-dapp': {
    id: 'terra-dapp',
    title: 'Terra swap and invest app',
    context: 'Kysen Technologies',
    role: 'Mobile engineer',
    // TODO(owner): years, integration partners, public link if any.
    years: null,
    summary: 'A Flutter dApp for swapping and investing in Terra cryptocurrencies through third-party integrations.',
    tags: ['Flutter', 'Dart', 'Terra'],
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
    summary:
      'A Japanese-style oripa (original pack) gacha on X Layer. Each draw is a USDC micropayment over x402, cards mint as ERC-721 NFTs, and the odds shift as each finite pool empties.',
    tags: ['TanStack Start', 'Cloudflare Workers', 'D1', 'Drizzle', 'Solidity', 'x402', 'Matter.js'],
    links: [{ label: 'github.com/cylim/oripax', href: 'https://github.com/cylim/oripax' }],
    // TODO(owner): clear a screenshot for the scroll.
    image: null,
  },
  jrny: {
    id: 'jrny',
    title: 'JRNY',
    // TODO(owner): personal, client or partner project? Relation to jrny.app? Hackathon?
    context: 'Personal project',
    role: 'Solo build',
    years: '2025',
    summary:
      'A travel log that shows who else is in your city right now, who overlapped with your past trips, and lets travellers organise meetups.',
    tags: ['TanStack Start', 'Convex', 'Better Auth', 'Stripe', 'Cloudflare Workers'],
    links: [{ label: 'github.com/cylim/jrny-app-demo', href: 'https://github.com/cylim/jrny-app-demo' }],
    // TODO(owner): clear a screenshot for the scroll.
    image: null,
  },
  'jrny-plan': {
    id: 'jrny-plan',
    title: 'JRNY Plan',
    context: 'Personal project',
    role: 'Solo build',
    years: '2026',
    summary:
      'Helps a group pick a time or make a decision. Hosts propose times, everyone marks availability in real time, and the app ranks the best overlap. It can check Google Calendar free/busy without reading event details.',
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
    summary:
      'Blockchain-backed anti-counterfeiting for supply chains. I ran hiring and project management for the Penang team, built the API services behind the web dashboard and mobile app, and set up GitLab CI/CD to deploy to AWS, Rancher and Firebase.',
    tags: ['API services', 'GitLab CI/CD', 'AWS', 'Rancher', 'Firebase'],
    links: [],
    image: null,
  },
  'jrny-spark': {
    id: 'jrny-spark',
    title: 'JRNY Spark',
    // TODO(owner): show or hide? It's an intimacy game. Hidden by default (not in any list below).
    context: 'Personal project',
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
      "Small merged patches: a Windows install fix for Ghost, device photo upload for Bonfida's SNS Manager, and link or docs fixes in React, TanStack Query and Aptos Core.",
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
  // TODO(owner): add a Tokenyze item (2024–2026) and a Mercury Labs / atticc item if you can describe them.
}

/** The four hanging scrolls, in hall order (scroll 1 nearest the door). design.md §18.1 default. */
export const featuredOrder = ['oripax', 'jrny', 'cosmos-insights', 'terra-dapp'] as const satisfies readonly WorkId[]

/** The "Also" list at the end of the scroll-4 card. */
export const alsoOrder = ['jrny-plan', 'tbsx3', 'upstream'] as const satisfies readonly WorkId[]

export const featuredWork: readonly WorkItem[] = featuredOrder.map((id) => workItems[id])
export const alsoWork: readonly WorkItem[] = alsoOrder.map((id) => workItems[id])
