import { describe, expect, it } from 'vitest'
import {
  alsoWork,
  cabin,
  contact,
  contactOutput,
  featuredWork,
  forest,
  grove,
  groveHeading,
  hero,
  palaces,
  serviceById,
  socials,
  stars,
  timeline,
  ui,
  whoamiOutput,
} from './content'
import { render } from './entry-server'

// renderToString escapes quotes and ampersands; compare against the same escaping.
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;')

describe('prerendered content layer (design.md §14.2: everything is in the HTML)', () => {
  const html = render()
  const has = (s: string) => expect(html, s).toContain(esc(s))

  it('carries the hero and every link on the first screen', () => {
    for (const s of [hero.name, hero.role, hero.positioning, hero.subline, hero.scrollHint]) has(s)
    for (const s of socials) expect(html).toContain(`href="${s.href}"`)
    expect(html.match(/rel="me"/g)?.length).toBeGreaterThanOrEqual(8)
    has(ui.skipLink)
  })

  it('carries services, work, the Also list and the timeline', () => {
    for (const c of forest.cards) for (const id of c.serviceIds) has(serviceById(id).body)
    for (const w of [...featuredWork, ...alsoWork]) {
      has(w.title)
      has(w.summary)
    }
    for (const e of timeline) has(e.org)
    has(cabin.bridge)
    has(cabin.intro[0] ?? '')
  })

  it('carries the terminal transcript for no-JS visitors', () => {
    for (const l of [...whoamiOutput, ...contactOutput].filter(Boolean)) {
      const plain = l.replace(/\s+/g, ' ')
      expect(html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ')).toContain(esc(plain))
    }
  })

  it('carries the grove explanation, the noscript line and the whole glossary', () => {
    has(groveHeading.heading)
    for (const s of [grove.disclaimer, grove.honesty, grove.noscript, grove.boardNote, grove.luopan]) has(s)
    // Glossary meanings wrap their Chinese runs in <span lang="zh-Hans"> (A11Y-8),
    // so compare against the text with tags stripped.
    const text = html.replace(/<[^>]+>/g, '')
    for (const t of [...palaces, ...stars]) {
      expect(text, t.meaning).toContain(esc(t.meaning))
    }
    expect(html).toContain('<noscript>')
  })

  it('carries the contact and the footer', () => {
    has(contact.line)
    has(contact.footer)
    expect(html).toContain(`href="${contact.source.href}"`)
  })

  it('renders nothing that depends on the visitor or the clock', () => {
    expect(html).not.toMatch(/Cast for \w+day/)
    expect(html).not.toContain('id="qimen"')
    expect(html).not.toContain('role="log"')
  })
})
