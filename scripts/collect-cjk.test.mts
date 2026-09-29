import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { CHART_GLYPHS, CJK_PUNCT, collectCjk, collectNonCjkExtras, isCjk, stripComments } from './collect-cjk.mjs'

describe('stripComments', () => {
  it('drops line and block comments but keeps strings that look like them', () => {
    const src = [
      "const a = '林' // 木屋 in a comment",
      '/* 九宫 */ const b = "https://cy.my/*not a comment*/"',
      'const c = `石${"灯"}` // 灯',
    ].join('\n')
    const out = stripComments(src)
    expect(out).toContain("'林'")
    expect(out).not.toContain('木屋')
    expect(out).not.toContain('九宫')
    expect(out).toContain('"https://cy.my/*not a comment*/"')
    expect(out).toContain('`石${"灯"}`')
    expect(out.match(/灯/g)).toHaveLength(1)
  })

  it('handles nested template expressions', () => {
    const out = stripComments('const s = `a${b ? `入${"林"}` : c}d` // 屋')
    expect(out).toContain('入')
    expect(out).toContain('林')
    expect(out).not.toContain('屋')
  })
})

describe('isCjk', () => {
  it('accepts ideographs and CJK punctuation, rejects Latin and pinyin', () => {
    for (const ch of '林螣、。（') expect(isCjk(ch.codePointAt(0)!)).toBe(true)
    for (const ch of 'aǚ·→') expect(isCjk(ch.codePointAt(0)!)).toBe(false)
  })
})

describe('collectCjk', () => {
  let root = ''
  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'cy-collect-'))
    await mkdir(join(root, 'src/content'), { recursive: true })
    await writeFile(join(root, 'src/content/site.ts'), "export const a = { zh: '槟城', pinyin: 'bīn chéng' } // 鬼\n")
    await writeFile(join(root, 'src/content/site.test.ts'), "expect('魑魅').toBe('魍魉')\n")
    await writeFile(join(root, 'index.html'), '<!-- 魃 --><p lang="zh-Hans">写</p>\n')
    await writeFile(join(root, 'src/content/lookup.ts'), "export const isHan = (s: string) => /[㐀-鿿]/.test(s)\n")
  })
  afterAll(() => rm(root, { recursive: true, force: true }))

  const opts = () => ({ root, paths: ['src/content', 'index.html', 'src/missing'] })

  it('finds drawn characters and skips comments, tests and missing paths', async () => {
    const cjk = await collectCjk(opts())
    for (const ch of '槟城写') expect(cjk).toContain(ch)
    for (const ch of '鬼魑魅魍魉魃㐀鿿') expect(cjk).not.toContain(ch)
  })

  it('always includes the chart vocabulary and CJK punctuation, sorted and unique', async () => {
    const cjk = await collectCjk(opts())
    for (const ch of CHART_GLYPHS + CJK_PUNCT) expect(cjk).toContain(ch)
    const chars = [...cjk]
    expect(new Set(chars).size).toBe(chars.length)
    expect(chars.map((c) => c.codePointAt(0)!)).toEqual(chars.map((c) => c.codePointAt(0)!).toSorted((a, b) => a - b))
  })

  it('reports the pinyin as Latin-side extras', async () => {
    expect(await collectNonCjkExtras(opts())).toBe('ī é'.replace(' ', '').split('').toSorted().join(''))
  })

  it('covers every glyph the qimen chart can print', () => {
    for (const ch of '甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥天蓬天芮天冲天辅天禽天心天柱天任天英休门生门伤门杜门景门死门惊门开门值符螣蛇太阴六合白虎玄武九地九天勾陈朱雀阳遁阴遁旬首')
      expect(CHART_GLYPHS).toContain(ch)
  })
})
