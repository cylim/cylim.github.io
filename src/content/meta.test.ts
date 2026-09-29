import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { meta, withMetaCopy } from './meta'
import { color } from '../theme/tokens'

// index.html carries the head tags statically (they must work before any script); this keeps them in
// step with meta.ts, the source of truth. The two descriptions follow content/features.ts, so the
// build writes them from meta.ts (vite.config.ts cy:meta-copy): check the page as built.
const source = readFileSync(new URL('../../index.html', import.meta.url), 'utf8')
const html = withMetaCopy(source)
const attr = (selector: RegExp, page: string = html) => selector.exec(page)?.[1]
const metaName = (name: string) => attr(new RegExp(`<meta\\s+name="${name}"\\s+content="([^"]*)"`))
const metaProp = (prop: string) => attr(new RegExp(`<meta\\s+property="${prop}"\\s+content="([^"]*)"`))
const squash = (s: string | undefined) => s?.replace(/\s+/g, ' ').trim()

describe('index.html head matches content/meta.ts', () => {
  it('title, description, canonical, robots, theme colour and verification', () => {
    expect(attr(/<title>([^<]*)<\/title>/)).toBe(meta.title)
    expect(squash(attr(/<meta\s+name="description"\s+content="([^"]*)"/))).toBe(meta.description)
    expect(attr(/<link rel="canonical" href="([^"]*)"/)).toBe(meta.canonical)
    expect(metaName('theme-color')).toBe(meta.themeColor)
    expect(meta.themeColor).toBe(color.paper)
    expect(metaName('p:domain_verify')).toBe(meta.pinterestVerify)
    expect(metaName('robots')).toBe('index, follow')
    expect(attr(/<html lang="([^"]*)"/)).toBe(meta.lang)
  })

  it('Open Graph and the twitter card', () => {
    expect(metaProp('og:type')).toBe(meta.og.type)
    expect(metaProp('og:url')).toBe(meta.og.url)
    expect(metaProp('og:title')).toBe(meta.og.title)
    expect(squash(metaProp('og:description'))).toBe(meta.og.description)
    expect(metaProp('og:image')).toBe(meta.og.image)
    expect(metaProp('og:image:alt')).toBe(meta.og.imageAlt)
    expect(metaName('twitter:card')).toBe(meta.twitter.card)
    expect(metaName('twitter:creator')).toBe(meta.twitter.creator)
  })

  it('rel=me links and the JSON-LD Person', () => {
    const relMe = [...html.matchAll(/<link rel="me" href="([^"]*)"/g)].map((m) => m[1])
    expect(relMe).toEqual([...meta.relMe])
    const ld = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)?.[1] ?? '{}'
    expect(JSON.parse(ld)).toEqual(meta.jsonLd)
  })

  it('writes both descriptions from meta.ts, and nothing else', () => {
    const stale = source
      .replace(/(<meta\s+name="description"\s+content=")[^"]*"/, '$1stale copy &amp; more"')
      .replace(/(<meta\s+property="og:description"\s+content=")[^"]*"/, '$1stale"')
    const out = withMetaCopy(stale)
    expect(squash(attr(/<meta\s+name="description"\s+content="([^"]*)"/, out))).toBe(meta.description)
    expect(squash(attr(/<meta\s+property="og:description"\s+content="([^"]*)"/, out))).toBe(meta.og.description)
    expect(out.replace(/content="[^"]*"/g, '')).toBe(source.replace(/content="[^"]*"/g, ''))
  })

  it('keeps the prerender slot and the fixed mount points', () => {
    expect(html).toContain('<div id="root"><!--content--></div>')
    expect(html).toContain('<div id="stage" aria-hidden="true"></div>')
    expect(html).toContain('<div id="veil" aria-hidden="true"></div>')
    expect(html).toContain('<html lang="en" data-mode="static">')
  })
})
