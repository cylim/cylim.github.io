/**
 * Social links: the only contact channels (no email, no form). Shown in the hero row,
 * on the stele and in the terminal's `contact` output.
 */

export type SocialId = 'github' | 'x' | 'linkedin' | 'blog'

export interface SocialLink {
  readonly id: SocialId
  readonly label: string
  /** Visible "shown as" text next to the label. */
  readonly display: string
  readonly href: string
  readonly rel: 'me'
}

export const socials: readonly SocialLink[] = [
  { id: 'github', label: 'GitHub', display: 'github.com/cylim', href: 'https://github.com/cylim', rel: 'me' },
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
    display: 'linkedin.com/in/cylim226',
    href: 'https://www.linkedin.com/in/cylim226',
    rel: 'me',
  },
  {
    id: 'blog',
    label: 'Blog',
    // TODO(owner): cy.my/blog/ is a 2016 Hexo blog with two posts (a separate repo). Keep, repoint or drop?
    display: 'cy.my/blog',
    href: 'https://cy.my/blog/',
    rel: 'me',
  },
]

export function socialById(id: SocialId): SocialLink {
  const s = socials.find((x) => x.id === id)
  if (!s) throw new Error(`unknown social ${id}`)
  return s
}
