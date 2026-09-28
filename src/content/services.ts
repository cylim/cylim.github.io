/**
 * What I build for clients (content.md §3). Shown as two forest-walk cards (site.ts `forest.cards`),
 * each service an <article> in document order.
 */

export type ServiceId = 'web-apps' | 'web3' | 'mobile' | 'pipelines-security'

export interface Service {
  readonly id: ServiceId
  readonly title: string
  readonly body: string
}

export const services: readonly Service[] = [
  {
    id: 'web-apps',
    title: 'Web apps, blank repo to launch',
    body: "Product idea in, working React and TypeScript app out. Sign-in, payments, realtime data and deploys included. I've built client MVPs since 2017. JRNY and OripaX below are two recent personal builds of the same kind.",
  },
  {
    id: 'web3',
    title: 'Web3 frontends',
    // TODO(owner): OK to claim Aptos client work publicly? Evidence is private Cyants repos.
    body: "Wallet flows, dashboards and dApps that make on-chain data readable. I've shipped on Cosmos and Terra, and built on Aptos, Solana and EVM chains.",
  },
  {
    id: 'mobile',
    title: 'Mobile apps',
    // TODO(owner): still offering mobile? Newest public evidence is the Terra Flutter dApp.
    body: 'Cross-platform apps in React Native or Flutter, and native iOS in Swift.',
  },
  {
    id: 'pipelines-security',
    title: 'Pipelines and a security-minded review',
    // TODO(owner): keep this service? Based on TBSx3 CI/CD, the 2019 Docker talk, degree and CPEH.
    body: 'CI/CD that tests and deploys on every push, and a second look at an existing codebase before it goes live. My degree is in digital system security and I hold the CPEH (Certified Professional Ethical Hacker) certification.',
  },
]

export function serviceById(id: ServiceId): Service {
  const s = services.find((x) => x.id === id)
  if (!s) throw new Error(`unknown service ${id}`)
  return s
}
