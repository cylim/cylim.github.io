/** Tools I reach for (content.md §3). Also summarised by the terminal's `stack` command. */

export interface StackGroup {
  readonly id: string
  readonly label: string
  readonly items: readonly string[]
}

export const stack: readonly StackGroup[] = [
  { id: 'languages', label: 'Languages', items: ['TypeScript', 'JavaScript', 'Dart', 'Swift', 'Solidity', 'Move'] },
  {
    id: 'frontend',
    label: 'Frontend',
    items: ['React', 'TanStack Start / Router / Query', 'Next.js', 'Tailwind CSS', 'StyleX', 'Framer Motion', 'GSAP'],
  },
  { id: '3d', label: '3D', items: ['three.js', 'React Three Fiber'] },
  { id: 'mobile', label: 'Mobile', items: ['React Native', 'Expo', 'Flutter', 'iOS (Swift)'] },
  {
    id: 'backend',
    label: 'Backend and data',
    items: ['Node.js', 'NestJS', 'Next.js API routes', 'PostgreSQL', 'Drizzle ORM', 'Convex', 'Cloudflare Workers and D1'],
  },
  { id: 'web3', label: 'Web3', items: ['Cosmos', 'Terra', 'Ethereum', 'Base', 'Aptos', 'Solana', 'Hedera', 'wagmi and viem', 'x402'] },
  { id: 'services', label: 'Auth, payments, monitoring', items: ['Clerk', 'Better Auth', 'Stripe', 'Sentry', 'PostHog'] },
  {
    id: 'ship',
    label: 'DevOps and cloud',
    items: ['GitHub Actions', 'GitLab CI', 'Docker', 'AWS', 'Azure', 'Firebase', 'Cloudflare', 'Vitest', 'Playwright'],
  },
]
