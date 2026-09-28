/**
 * Head tags and structured data (content.md §6, stack.md §9). The source of truth: index.html
 * carries the same tags by hand (they must work before any script runs), and meta.test.ts fails
 * when the two drift apart.
 */

import { color } from '../theme/tokens'

export const meta = {
  title: 'CY Lim, software engineer in Penang',
  description:
    'Software engineer in Penang, Malaysia. I build React and TypeScript web apps and web3 frontends, and practise fengshui and Qimen Dunjia.',
  canonical: 'https://cy.my/',
  lang: 'en',
  themeColor: color.paper,
  /** Keep the existing Pinterest domain verification. */
  pinterestVerify: '006fe72c99b1a79d71240d11c25793aa',
  og: {
    title: 'CY Lim · A walk into the mist',
    description:
      'Scroll through an ink-wash forest. Selected work in a cabin, a live Qimen Dunjia chart in a grove, and a lantern at the end of the path.',
    type: 'website',
    url: 'https://cy.my/',
    // TODO(owner): approve og.png (rendered from the T0 scene with the name and hero line by
    // scripts/shots.mjs). The alt carries the words drawn in the image.
    image: 'https://cy.my/og.png',
    imageAlt: 'CY Lim, with the line “The parts of software people touch. Web, mobile and web3, since 2017.”, under pine trees in ink-wash mist.',
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
