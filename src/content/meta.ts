/**
 * Head tags and structured data (content.md §6, stack.md §9). The source of truth: index.html
 * carries the same tags by hand (they must work before any script runs), and meta.test.ts fails
 * when the two drift apart. The two descriptions follow content/features.ts, so the build writes
 * them into index.html from here (`withMetaCopy`, run by vite.config.ts in dev and build).
 */

import { color } from '../theme/tokens.ts'
import { features } from './features.ts'

export const meta = {
  title: 'CY Lim, software engineer in Penang',
  // Two variants: with the grove on the walk, and while it is paused (content/features.ts). The
  // build writes whichever is live into index.html (vite.config.ts `metaCopy`).
  description: features.grove
    ? 'Software engineer in Penang, Malaysia, shipping since 2017. I build React and TypeScript web apps, web3 frontends and mobile apps for clients, and practise fengshui and Qimen Dunjia.'
    : 'Software engineer in Penang, Malaysia, shipping since 2017. I build React and TypeScript web apps, web3 frontends and mobile apps for clients, and practise fengshui.',
  canonical: 'https://cy.my/',
  lang: 'en',
  themeColor: color.paper,
  /** Keep the existing Pinterest domain verification. */
  pinterestVerify: '006fe72c99b1a79d71240d11c25793aa',
  og: {
    title: 'CY Lim · A walk into the mist',
    description: features.grove
      ? 'Walk through an ink-wash forest. My work hangs in a cabin, a live Qimen Dunjia chart waits in a grove, and a signpost at the end of the path shows where to find me.'
      : 'Walk through an ink-wash forest. My work hangs in a cabin, and a signpost at the end of the path shows where to find me.',
    type: 'website',
    url: 'https://cy.my/',
    // TODO(owner): approve og.png (rendered from the T0 scene with the name and hero line by
    // scripts/shots.mjs). The alt carries the words drawn in the image.
    image: 'https://cy.my/og.png',
    imageAlt: 'CY Lim, with the line “Full stack since 2017. Web and mobile apps, the services behind them, and the pipelines that ship them.”, under pine trees in ink-wash mist.',
  },
  twitter: {
    card: 'summary_large_image',
    creator: '@seewhy' as string | null,
  },
  /** <link rel="me"> targets. */
  relMe: ['https://github.com/cylim', 'https://x.com/seewhy', 'https://www.linkedin.com/in/cylim226'],
  jsonLd: {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: 'CY Lim',
    alternateName: 'Chee Yeong Lim',
    jobTitle: 'Software Engineer',
    url: 'https://cy.my/',
    address: { '@type': 'PostalAddress', addressLocality: 'Penang', addressCountry: 'MY' },
    alumniOf: { '@type': 'CollegeOrUniversity', name: 'University of Wollongong' },
    knowsLanguage: ['English', 'Chinese', 'Cantonese', 'Malay', 'Japanese'],
    sameAs: ['https://github.com/cylim', 'https://x.com/seewhy', 'https://www.linkedin.com/in/cylim226'],
  },
} as const

const attrEscape = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;')

/**
 * index.html with its description and og:description set from `meta`. vite.config.ts runs it on the
 * page in dev and build, so flipping a feature switch needs no hand edit of index.html.
 */
export function withMetaCopy(html: string): string {
  const set = (tag: RegExp, value: string) => html.replace(tag, (_m, open: string, close: string) => `${open}${attrEscape(value)}${close}`)
  html = set(/(<meta\s+name="description"\s+content=")[^"]*(")/, meta.description)
  html = set(/(<meta\s+property="og:description"\s+content=")[^"]*(")/, meta.og.description)
  return html
}
