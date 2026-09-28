import { socials } from '../../content/socials'
import { workItems } from '../../content/work'

/** Every URL the terminal prints, as its display form (no scheme, no www, no trailing slash) → href. */
const displayOf = (href: string) => href.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')

let table: (readonly [display: string, href: string])[] | null = null
function links() {
  if (!table) {
    const hrefs = [...socials.map((s) => s.href), ...Object.values(workItems).flatMap((w) => w.links.map((l) => l.href))]
    // Longest first, so github.com/cylim/oripax wins over github.com/cylim.
    table = [...new Set(hrefs)].map((h) => [displayOf(h), h] as const).toSorted((a, b) => b[0].length - a[0].length)
  }
  return table
}

export interface LinkSplit {
  before: string
  display: string
  after: string
  href: string
}

/** Find the first known URL in a terminal line, so the DOM log can render it as a real <a>. */
export function linkIn(text: string): LinkSplit | null {
  for (const [display, href] of links()) {
    const i = text.indexOf(display)
    if (i < 0) continue
    const end = i + display.length
    // Whole path segments only: github.com/cylim must not match inside github.com/cylimx.
    if (/[\w/-]/.test(text.charAt(end))) continue
    return { before: text.slice(0, i), display, after: text.slice(end), href }
  }
  return null
}
