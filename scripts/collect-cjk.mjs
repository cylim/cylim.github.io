#!/usr/bin/env node
// Collects every character the site can draw, for font subsetting (stack.md §7, design.md §3).
//
//   node scripts/collect-cjk.mjs            prints the CJK set and the non-ASCII Latin-side set
//   node scripts/collect-cjk.mjs --files    also lists which file each CJK character first came from
//
// Sources are scanned as text with comments stripped, so a character that only appears in a code
// comment does not cost a glyph. Test files are skipped for the same reason. CHART_GLYPHS is added
// on top: the 3D chart builds its SDF atlas from the full list once (design.md §3.1), so every glyph
// the engine could ever print must be in the WenKai subset even if today's content never shows it.
// Owner: tooling.

import { readdir, readFile } from 'node:fs/promises'
import { extname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = fileURLToPath(new URL('..', import.meta.url))

/** Paths scanned for drawable text. Directories are walked recursively. */
export const SCAN = [
  'src/content',
  'src/lib/qimen',
  'src/lib/calendar',
  'src/dom',
  'src/sections',
  'src/core/text',
  'index.html',
]

const SCAN_EXT = new Set(['.ts', '.tsx', '.js', '.json', '.html', '.md'])
// Tests never reach the page, and .mts/.mjs under src/ are Node-side tools (e.g. a chart printer).
const SKIP_FILE = /\.(test|spec)\.[cm]?[jt]sx?$|\.d\.ts$/

/**
 * The full chart vocabulary (qimen-spec.md, design.md §9, content.md §4). Kept here rather than read
 * from the engine so the subset stays complete while the engine is still being written.
 */
export const CHART_GLYPHS = [
  // 天干, 地支
  '甲乙丙丁戊己庚辛壬癸',
  '子丑寅卯辰巳午未申酉戌亥',
  // 九宫 and 八卦, with 中五 and 禽寄坤
  '坎坤震巽中乾兑艮离宫五寄',
  // 九星
  '天蓬芮冲辅禽心柱任英',
  // 八门
  '休生伤杜景死惊开门',
  // 八神, both naming traditions (白虎/玄武 and 勾陈/朱雀)
  '值符螣蛇太阴六合白虎玄武九地勾陈朱雀',
  // 二十四节气
  '立春雨水惊蛰分清明谷夏小满芒种至暑大秋处露寒霜降冬雪',
  // 局, 遁, 元, 旬, markers and plates
  '阳遁局上下元旬首空亡驿马使盘人神地罗洛书二十四山伏吟反拆补转时家奇甲八星',
  // Numerals and calendar words for the colophon, the inscription band and the terminal
  '〇零一二三四五六七八九十廿卅百千初正腊月日年后前刻',
  // Directions and the five phases
  '东南西北木火土金',
].join('')

/** CJK punctuation the chart, colophon and glosses use; always in the WenKai subset. */
export const CJK_PUNCT = '，。、：；！？「」『』《》〈〉（）—…·　'

/**
 * ASCII kept in the WenKai subset so troika can draw mixed labels such as `离9`, `阳遁4局` or `07:00`
 * in one font without reaching for its network fallback.
 */
export const CJK_ASCII = ' 0123456789:.-/()·'

/** Ma Shan Zheng draws only the hero accent and the section inscriptions (design.md §3). */
export const DISPLAY_GLYPHS = '入林木屋九宫石灯'

/** Code point is a CJK ideograph or CJK punctuation / full-width form. */
export function isCjk(cp) {
  return (
    (cp >= 0x3400 && cp <= 0x4dbf) || // Ext A
    (cp >= 0x4e00 && cp <= 0x9fff) || // URO
    (cp >= 0xf900 && cp <= 0xfaff) || // compatibility
    (cp >= 0x20000 && cp <= 0x3134f) || // Ext B to G
    (cp >= 0x3000 && cp <= 0x303f) || // CJK symbols and punctuation
    (cp >= 0xff00 && cp <= 0xffef) // half-width and full-width forms
  )
}

/**
 * Removes // and /* *\/ comments from JS/TS source while leaving strings, template literals and
 * regex-free code intact. Not a full parser; good enough for data modules and components.
 */
export function stripComments(src) {
  let out = ''
  let i = 0
  const n = src.length
  const templateDepth = []
  while (i < n) {
    const c = src[i]
    const d = src[i + 1]
    if (c === '/' && d === '/') {
      while (i < n && src[i] !== '\n') i++
      continue
    }
    if (c === '/' && d === '*') {
      const end = src.indexOf('*/', i + 2)
      i = end < 0 ? n : end + 2
      continue
    }
    if (c === '"' || c === "'") {
      const q = c
      out += c
      i++
      while (i < n && src[i] !== q && src[i] !== '\n') {
        if (src[i] === '\\') out += src[i++]
        out += src[i++]
      }
      if (i < n) out += src[i++]
      continue
    }
    if (c === '`' || (c === '}' && templateDepth.at(-1) === 0)) {
      if (c === '}') templateDepth.pop()
      out += c
      i++
      while (i < n && src[i] !== '`') {
        if (src[i] === '\\') {
          out += src[i] + (src[i + 1] ?? '')
          i += 2
          continue
        }
        if (src[i] === '$' && src[i + 1] === '{') {
          out += '${'
          i += 2
          templateDepth.push(0)
          break
        }
        out += src[i++]
      }
      if (src[i] === '`') out += src[i++]
      continue
    }
    if (templateDepth.length) {
      if (c === '{') templateDepth[templateDepth.length - 1]++
      else if (c === '}') templateDepth[templateDepth.length - 1]--
    }
    out += c
    i++
  }
  return out
}

/**
 * Regex character classes with CJK range bounds, like `[㐀-鿿]`, test for CJK rather than draw it,
 * so their endpoints must not cost glyphs.
 */
const CJK_RANGE_CLASS = /\[[^\]\n]*[\u3400-\u9fff\uf900-\ufaff]-[\u3400-\u9fff\uf900-\ufaff][^\]\n]*\]/g

function stripHtmlComments(src) {
  return src.replace(/<!--[\s\S]*?-->/g, '')
}

async function* walk(path) {
  let entries
  try {
    entries = await readdir(path, { withFileTypes: true })
  } catch (error) {
    if (error.code === 'ENOTDIR') {
      yield path
      return
    }
    if (error.code === 'ENOENT') return
    throw error
  }
  for (const entry of entries) {
    const full = join(path, entry.name)
    if (entry.isDirectory()) yield* walk(full)
    else yield full
  }
}

/** Reads every scanned file and returns its drawable text (comments stripped). */
export async function scanSources({ root = ROOT, paths = SCAN } = {}) {
  const files = []
  for (const p of paths) {
    for await (const file of walk(join(root, p))) {
      if (!SCAN_EXT.has(extname(file)) || SKIP_FILE.test(file)) continue
      const raw = await readFile(file, 'utf8')
      const ext = extname(file)
      const text =
        ext === '.html' || ext === '.md' ? stripHtmlComments(raw) : ext === '.json' ? raw : stripComments(raw).replace(CJK_RANGE_CLASS, '')
      files.push({ file: relative(root, file), text })
    }
  }
  return files
}

const uniqSorted = (chars) => [...new Set(chars)].toSorted((a, b) => a.codePointAt(0) - b.codePointAt(0)).join('')

/**
 * Every CJK character the site can draw: scanned sources plus the chart vocabulary and CJK
 * punctuation. Sorted by code point, no duplicates.
 */
export async function collectCjk(options) {
  const files = await scanSources(options)
  const found = []
  for (const { text } of files) for (const ch of text) if (isCjk(ch.codePointAt(0))) found.push(ch)
  return uniqSorted([...found, ...CHART_GLYPHS, ...CJK_PUNCT])
}

/** Non-ASCII, non-CJK characters in the sources (pinyin, arrows, typographic punctuation). */
export async function collectNonCjkExtras(options) {
  const files = await scanSources(options)
  const found = []
  for (const { text } of files) {
    for (const ch of text) {
      const cp = ch.codePointAt(0)
      // Combining marks only show up in regexes that strip them (pinyin is precomposed), so skip them.
      if (cp > 0x7e && !isCjk(cp) && !/\p{Cc}|\p{Cf}|\p{M}/u.test(ch)) found.push(ch)
    }
  }
  return uniqSorted(found)
}

/** First file each CJK character appears in, for tracing where a glyph comes from. */
export async function cjkOrigins(options) {
  const files = await scanSources(options)
  const origin = new Map()
  for (const { file, text } of files) {
    for (const ch of text) if (isCjk(ch.codePointAt(0)) && !origin.has(ch)) origin.set(ch, file)
  }
  return origin
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const cjk = await collectCjk()
  const extras = await collectNonCjkExtras()
  console.log(`CJK (${[...cjk].length}): ${cjk}`)
  console.log(`Non-ASCII, non-CJK in sources (${[...extras].length}): ${extras}`)
  if (process.argv.includes('--files')) {
    const origin = await cjkOrigins()
    const byFile = new Map()
    for (const [ch, file] of origin) byFile.set(file, (byFile.get(file) ?? '') + ch)
    for (const [file, chars] of byFile) console.log(`  ${file}: ${chars}`)
  }
}
