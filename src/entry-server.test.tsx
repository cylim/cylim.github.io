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
import { features } from './content/features'

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
    for (const w of featuredWork) {
      has(w.title)
      has(w.summary)
    }
    for (const w of alsoWork) {
      has(w.title)
      has(w.oneLine ?? w.summary)
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

  // The live page follows content/features.ts: the grove's copy is prerendered exactly when the grove
  // is on the walk. A detour grove is rendered by the client when a dive joins it.
  it.runIf(features.grove === 'walk')('carries the grove explanation, the noscript line and the whole glossary', () => {
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

  it.runIf(features.grove !== 'walk')('leaves a grove off the walk out: no section, chart copy or glossary', () => {
    expect(html).not.toContain('id="grove"')
    expect(html).not.toContain(esc(groveHeading.heading))
    for (const s of [grove.disclaimer, grove.honesty, grove.noscript, grove.boardNote, grove.luopan, grove.readChart]) {
      expect(html, s).not.toContain(esc(s))
    }
    expect(html).not.toContain('glossary-island')
    // A detour grove is still on the map: the nav links to it.
    expect(html.includes('href="#grove"')).toBe(features.grove === 'detour')
  })

  it.runIf(features.grove === 'off')('names Qimen nowhere but the terminal while the grove is off', () => {
    // The terminal's whoami keeps its fengshui and Qimen line; nothing else names it.
    expect(whoamiOutput.reduce((h, line) => h.replace(esc(line), ''), html)).not.toMatch(/Qimen/)
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
