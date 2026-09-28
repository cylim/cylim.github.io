// Thin wrapper over harfbuzzjs for the font scripts: cmap coverage, metrics and glyph outlines.
// harfbuzzjs and fontverter arrive with subset-font (a devDependency), so no extra install.
// Owner: tooling.

import fontverter from 'fontverter'
import * as hb from 'harfbuzzjs'

const round1 = (n) => Math.round(n * 10) / 10

/** Loads a ttf, otf, woff or woff2 buffer. */
export async function loadFace(buffer) {
  const sfnt = await fontverter.convert(Buffer.from(buffer), 'sfnt')
  const face = new hb.Face(new hb.Blob(new Uint8Array(sfnt)))
  const font = new hb.Font(face)
  const unicodes = new Set(face.collectUnicodes())
  const glyphOf = (ch) => {
    const gid = font.nominalGlyph(ch.codePointAt(0))
    if (gid === undefined) throw new Error(`no glyph for ${ch}`)
    return gid
  }
  return {
    unicodes,
    has: (cp) => unicodes.has(cp),
    metrics() {
      const e = font.hExtents()
      return { upem: face.upem, ascender: e.ascender, descender: e.descender }
    },
    advance: (ch) => font.glyphHAdvance(glyphOf(ch)),
    /** SVG path in em units with y pointing down; `top` is the font-space y that maps to 0. */
    path(ch, { dx = 0, top }) {
      const pt = (x, y) => `${round1(x + dx)} ${round1(top - y)}`
      return font
        .glyphToJson(glyphOf(ch))
        .map(({ type, values: v }) => {
          if (type === 'Z') return 'Z'
          const pairs = []
          for (let i = 0; i < v.length; i += 2) pairs.push(pt(v[i], v[i + 1]))
          return `${type}${pairs.join(' ')}`
        })
        .join('')
    },
  }
}
