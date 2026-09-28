/** Tools I reach for (content.md §3). Also summarised by the terminal's `stack` command. */

export interface StackGroup {
  readonly id: string
  readonly label: string
  readonly items: readonly string[]
}

// TODO(owner): trim to what you want to be hired for. Move is not listed: no public Move code found.
export const stack: readonly StackGroup[] = [
  { id: 'languages', label: 'Languages', items: ['TypeScript', 'JavaScript', 'Dart', 'Swift', 'Solidity'] },
  {
    id: 'frontend',
    label: 'Frontend',
    items: ['React', 'TanStack Start / Router / Query', 'Next.js', 'Tailwind CSS', 'StyleX', 'Framer Motion', 'GSAP'],
  },
  { id: '3d', label: '3D', items: ['three.js', 'React Three Fiber'] },
  { id: 'mobile', label: 'Mobile', items: ['React Native', 'Flutter', 'iOS (Swift)'] },
  {
    id: 'backend',
    label: 'Backend and data',
    items: ['Node.js', 'Express', 'Convex', 'Cloudflare Workers', 'Cloudflare D1', 'Drizzle ORM'],
  },
  { id: 'web3', label: 'Web3', items: ['Cosmos', 'Terra', 'Aptos', 'Solana', 'EVM (ethers.js)', 'x402'] },
  { id: 'services', label: 'Auth, payments, monitoring', items: ['Clerk', 'Better Auth', 'Stripe', 'Sentry', 'PostHog'] },
  {
    id: 'ship',
    label: 'Build, test, ship',
    items: ['Bun', 'Vite', 'Vitest', 'Playwright', 'GitHub Actions', 'GitLab CI', 'Docker'],
  },
]
