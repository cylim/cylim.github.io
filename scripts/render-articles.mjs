#!/usr/bin/env node
// Renders the static pages that live outside the app, in the site's ink style, from the tokens:
//   public/articles/*.md  → public/articles/*.html (the .md stays next to it)
//   public/404.html          GitHub Pages serves it for any missing path
//   public/sitemap.xml       the home page plus every article
// Jekyll used to render the article, and Actions deploys skip Jekyll, so without this
// /articles/201808-first-year.html (and the extensionless URL Pages derives from it) would 404
// (stack.md §10). Runs first in `npm run build`. Outputs are deterministic and committed.
// Owner: tooling.

import { readdir, readFile, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { Marked } from 'marked'
import { ROOT } from './collect-cjk.mjs'

const { breakpoint, color, font, fontFiles, sealSize, typeScale: ts } = await import('../src/theme/tokens.ts')
const PUBLIC = join(ROOT, 'public')
const ARTICLES = join(PUBLIC, 'articles')
const SITE = 'https://cy.my'
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const plain = (md) =>
  md
    .replace(/[*_`[\]]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

/** 201808-first-year → "August 2018" and its ISO month, when the name starts with YYYYMM. */
function dateFromSlug(slug) {
  const m = /^(\d{4})(\d{2})-/.exec(slug)
  if (!m) return null
  const month = Number(m[2])
  return month >= 1 && month <= 12 ? { label: `${MONTHS[month - 1]} ${m[1]}`, iso: `${m[1]}-${m[2]}` } : null
}

const CSS = `
@font-face{font-family:'Source Serif 4';font-weight:400;font-display:swap;src:url(${fontFiles.body400.woff2}) format('woff2')}
@font-face{font-family:'Source Serif 4';font-weight:600;font-display:swap;src:url(${fontFiles.body600.woff2}) format('woff2')}
@font-face{font-family:'Cormorant Garamond';font-weight:600;font-display:swap;src:url(${fontFiles.display600.woff2}) format('woff2')}
@font-face{font-family:'JetBrains Mono';font-weight:400;font-display:swap;src:url(${fontFiles.mono.woff2}) format('woff2')}
*,*::before,*::after{box-sizing:border-box}
html{background:${color.paper};color:${color.inkNong};font-family:${font.body};font-size:100%;-webkit-text-size-adjust:100%}
body{margin:0;font-size:${ts.body.size};line-height:${ts.body.lineHeight}}
header,main,footer{max-width:${ts.body.measure};margin:0 auto;padding:0 1.25rem}
header{padding-top:1.5rem}
.home{display:inline-flex;align-items:center;gap:.6rem;min-height:44px;color:${color.inkJiao};text-decoration:none;font-family:${font.display};font-weight:600;font-size:${ts.homeMark.size};line-height:${ts.homeMark.lineHeight}}
.home img{width:${sealSize.nav}px;height:${sealSize.nav}px}
main{padding-top:3rem;padding-bottom:3rem}
h1{font-family:${font.display};font-weight:600;font-size:${ts.h2.size};line-height:${ts.h2.lineHeight};color:${color.inkJiao};margin:0 0 .5rem}
.date{font-weight:600;font-size:${ts.label.size};line-height:${ts.label.lineHeight};letter-spacing:${ts.label.tracking};font-variant-caps:all-small-caps;color:${color.inkZhong};margin:0 0 2.5rem}
h2{font-weight:600;font-size:${ts.h3.size};line-height:${ts.h3.lineHeight};color:${color.inkJiao};margin:2.5rem 0 .75rem}
h3{font-weight:600;font-size:${ts.body.size};margin:2rem 0 .5rem}
p,ul,ol{margin:0 0 1.1em}
li{margin:.25em 0}
a{color:${color.inkJiao};text-decoration-color:${color.inkDan};text-underline-offset:.2em}
a:hover{text-decoration-color:${color.cinnabar}}
:focus-visible{outline:2px solid ${color.cinnabar};outline-offset:2px;box-shadow:0 0 0 4px ${color.paperLight}}
code,pre{font-family:${font.mono};font-size:${ts.mono.size}}
pre{background:${color.paperShade};padding:1rem 1.25rem;overflow-x:auto;line-height:${ts.mono.lineHeight};border-left:2px solid ${color.inkQing}}
:not(pre)>code{background:${color.paperShade};padding:.05em .3em}
blockquote{margin:0 0 1.1em;padding-left:1rem;border-left:2px solid ${color.inkQing};color:${color.inkZhong}}
hr{border:0;border-top:1px solid ${color.inkQing};margin:2.5rem 0}
footer{padding-bottom:3rem;border-top:1px solid ${color.inkQing};padding-top:1.25rem;font-size:${ts.bodySmall.size};color:${color.inkZhong}}
footer a{display:inline-block;min-height:44px;line-height:44px}
.lost{min-height:calc(100svh - 7rem);padding-top:18vh}
.lost h1{font-size:${ts.display.size};line-height:${ts.display.lineHeight};letter-spacing:${ts.display.tracking};margin-bottom:1.5rem}
.lost p{color:${color.inkZhong}}
.lost a{display:inline-block;min-height:44px;line-height:44px}
.ridges{position:fixed;left:0;right:0;bottom:0;width:100%;height:38vh;z-index:-1}
@media (min-width:${breakpoint.desktop}px){body{font-size:${ts.body.desktop}}h2{font-size:${ts.h3.desktop}}h3{font-size:${ts.body.desktop}}code,pre{font-size:${ts.mono.desktop}}}
`.trim()

function shell({ title, description, head = '', body }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
<meta name="theme-color" content="${color.paper}">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon.ico" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="preload" href="${fontFiles.body400.woff2}" as="font" type="font/woff2" crossorigin>
${head}<style>${CSS}</style>
</head>
<body>
<header><a class="home" href="/"><img src="/seals/lin-zhuwen-nav.svg" alt="" width="${sealSize.nav}" height="${sealSize.nav}">CY Lim</a></header>
${body}
</body>
</html>
`
}

function articlePage({ slug, title, description, date, html }) {
  const url = `${SITE}/articles/${slug}.html`
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: title,
    ...(date ? { datePublished: date.iso } : {}),
    author: { '@type': 'Person', name: 'CY Lim', url: `${SITE}/` },
    url,
  }
  const head = [
    `<link rel="canonical" href="${url}">`,
    '<meta property="og:type" content="article">',
    `<meta property="og:url" content="${url}">`,
    `<meta property="og:title" content="${escapeHtml(title)}">`,
    `<meta property="og:description" content="${escapeHtml(description)}">`,
    `<meta property="og:image" content="${SITE}/og.png">`,
    `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`,
    '',
  ].join('\n')
  const body = `<main>
<article>
<h1>${escapeHtml(title)}</h1>
${date ? `<p class="date"><time datetime="${date.iso}">${date.label}</time></p>\n` : ''}${html}
</article>
</main>
<footer><a href="/">Back to the edge of the forest</a></footer>`
  return shell({ title: `${title} · CY Lim`, description, head, body })
}

/** One ridge line as a closed path over a 1200 × 300 box. Sums of sines, so it never changes. */
function ridge(base, amp, seed) {
  const pts = []
  for (let x = 0; x <= 1200; x += 20) {
    const y = base - amp * (0.55 * Math.sin(x / 190 + seed) + 0.3 * Math.sin(x / 71 + seed * 2.3) + 0.15 * Math.sin(x / 23 + seed * 5.1))
    pts.push(`${x} ${y.toFixed(1)}`)
  }
  return `M0 300L${pts.join('L')}L1200 300Z`
}

/** Two ridges fading down into mist, the far one paler (远山淡). */
function ridges() {
  return `<svg class="ridges" aria-hidden="true" focusable="false" viewBox="0 0 1200 300" preserveAspectRatio="none">
<defs><linearGradient id="mist" x1="0" y1="0" x2="0" y2="1"><stop offset=".35" stop-color="${color.paper}" stop-opacity="0"/><stop offset="1" stop-color="${color.paper}"/></linearGradient></defs>
<path d="${ridge(150, 60, 1.7)}" fill="${color.inkQing}" fill-opacity=".55"/>
<path d="${ridge(215, 45, 4.2)}" fill="${color.inkDan}" fill-opacity=".35"/>
<rect width="1200" height="300" fill="url(#mist)"/>
</svg>`
}

function notFoundPage() {
  // TODO(owner): 404 wording is drafted by tooling, not from content.md.
  const body = `<main class="lost">
<h1>Lost in the mist</h1>
<p>This path fades out here. The forest starts again at its edge.</p>
<p><a href="/">Back to the edge of the forest</a></p>
</main>
${ridges()}`
  return shell({
    title: 'Lost in the mist · CY Lim',
    description: 'This page does not exist. The walk starts at cy.my.',
    head: '<meta name="robots" content="noindex">\n',
    body,
  })
}

const marked = new Marked({ gfm: true })
const articles = []
for (const file of (await readdir(ARTICLES)).filter((f) => f.endsWith('.md')).toSorted()) {
  const slug = basename(file, '.md')
  const md = await readFile(join(ARTICLES, file), 'utf8')
  const heading = /^#\s+(.+)$/m.exec(md)
  const title = heading ? heading[1].trim() : slug
  const rest = heading ? md.replace(heading[0], '') : md
  const firstPara = rest.split(/\n\s*\n/).find((b) => b.trim() && !/^\s*(#|```|[-*]\s|\d+\.)/.test(b)) ?? ''
  const text = plain(firstPara)
  const description = text.length <= 160 ? text : `${text.slice(0, text.lastIndexOf(' ', 157))}…`
  const date = dateFromSlug(slug)
  await writeFile(join(ARTICLES, `${slug}.html`), articlePage({ slug, title, description, date, html: await marked.parse(rest) }))
  articles.push({ slug, date })
  console.log(`public/articles/${slug}.html`)
}

await writeFile(join(PUBLIC, '404.html'), notFoundPage())
console.log('public/404.html')

const urls = [`  <url><loc>${SITE}/</loc></url>`, ...articles.map(({ slug }) => `  <url><loc>${SITE}/articles/${slug}.html</loc></url>`)]
await writeFile(
  join(PUBLIC, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`,
)
console.log('public/sitemap.xml')
