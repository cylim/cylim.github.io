/**
 * Social links: the only contact channels (no email, no form). Shown in the hero row,
 * on the signpost's boards and in the terminal's `contact` output.
 */

export type SocialId = 'github' | 'x' | 'linkedin' | 'telegram'

export interface SocialLink {
  readonly id: SocialId
  /** The platform, kept for screen readers; the logo stands in for it on screen. */
  readonly label: string
  /** Visible username next to the logo (also cut on its signpost board). */
  readonly display: string
  readonly href: string
  readonly rel: 'me'
}

export const socials: readonly SocialLink[] = [
  { id: 'github', label: 'GitHub', display: 'cylim', href: 'https://github.com/cylim', rel: 'me' },
  {
    id: 'x',
    label: 'X',
    display: '@seewhy',
    href: 'https://x.com/seewhy',
    rel: 'me',
  },
  {
    id: 'linkedin',
    label: 'LinkedIn',
    display: 'cylim226',
    href: 'https://www.linkedin.com/in/cylim226',
    rel: 'me',
  },
  { id: 'telegram', label: 'Telegram', display: '@cyants', href: 'https://t.me/cyants', rel: 'me' },
]

export function socialById(id: SocialId): SocialLink {
  const s = socials.find((x) => x.id === id)
  if (!s) throw new Error(`unknown social ${id}`)
  return s
}
