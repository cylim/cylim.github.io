/**
 * What I build for clients (content.md §3). Shown as two forest-walk cards (site.ts `forest.cards`),
 * each service an <article> in document order.
 */

export type ServiceId = 'web-apps' | 'mobile' | 'backend' | 'devops'

export interface Service {
  readonly id: ServiceId
  readonly title: string
  readonly body: string
}

export const services: readonly Service[] = [
  {
    id: 'web-apps',
    title: 'Web apps',
    body: "React and TypeScript apps with sign-in, payments and realtime data, built for clients since 2017 and for my studio Cyants, whose own products include JRNY. Plenty of it on chain, with wallet flows and dApps across Cosmos, Terra, Ethereum, Aptos, Base and Solana.",
  },
  {
    id: 'mobile',
    title: 'Mobile apps',
    body: 'React Native or Flutter when one codebase should cover both app stores, Swift when it has to feel exactly like iOS. I started out as an iOS developer, and since then I have shipped Harvest in Flutter and NextRare and Pave in React Native.',
  },
  {
    id: 'backend',
    title: 'Backend services and APIs',
    body: "The services behind the apps. APIs in Node.js, NestJS and Next.js, Postgres with Drizzle, Convex and Cloudflare Workers, and serverless on AWS and Azure. I built the backend APIs for NextRare's rewards and pack odds, and the API services behind TBSx3.",
  },
  {
    id: 'devops',
    title: 'DevOps and a security-minded review',
    body: 'CI/CD that tests and deploys on every push, Docker, and releases to AWS, Azure, Firebase and Cloudflare. Plus a hard second look at your code before it meets the internet. I studied digital system security and hold the CPEH ethical hacking certification.',
  },
]

export function serviceById(id: ServiceId): Service {
  const s = services.find((x) => x.id === id)
  if (!s) throw new Error(`unknown service ${id}`)
  return s
}
