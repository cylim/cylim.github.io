// The DOM chart's palace grid: keyboard users hear how to move between palaces (design.md §15, A11Y-9).
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { fixtureA } from '../test/fixtures'
import { QimenFigure } from './QimenFigure'

describe('QimenFigure palace grid', () => {
  it('describes every palace button (the roving tab stop included) with the arrow-key hint', () => {
    const root = document.createElement('div')
    root.innerHTML = renderToStaticMarkup(<QimenFigure chart={fixtureA()} />)
    const hint = root.querySelector('#qimen-grid-hint')
    expect(hint?.textContent).toMatch(/Arrow keys/)
    const buttons = [...root.querySelectorAll('.qm-palaces button')]
    expect(buttons).toHaveLength(9)
    for (const b of buttons) expect(b.getAttribute('aria-describedby')).toBe('qimen-grid-hint')
    expect(root.querySelector('button[tabindex="0"]')?.getAttribute('aria-describedby')).toBe('qimen-grid-hint')
  })

  it('glosses 值符 in the duty line and the marks row as the duty mark, the deity row as Chief (CD-2)', () => {
    const root = document.createElement('div')
    root.innerHTML = renderToStaticMarkup(<QimenFigure chart={fixtureA()} />)
    const duty = root.querySelector('.qm-header > span:last-child [data-gloss]')
    expect(duty?.textContent).toBe('值符')
    expect(duty?.getAttribute('data-en')).toBe('Duty Chief')
    const marks = [...root.querySelectorAll('.qm-marks [data-gloss]')].filter((el) => el.textContent === '值符')
    expect(marks.length).toBe(1)
    expect(marks[0]?.getAttribute('data-en')).toBe('Duty Chief')
    const deities = [...root.querySelectorAll('.qm-palaces dd [data-gloss]')].filter((el) => el.textContent === '值符')
    expect(deities.length).toBeGreaterThan(0)
    for (const d of deities) expect(d.getAttribute('data-en')).toBe('Chief')
  })

  it('marks the Chinese in the visually hidden caption with lang (A11Y-8)', () => {
    const root = document.createElement('div')
    root.innerHTML = renderToStaticMarkup(<QimenFigure chart={fixtureA()} />)
    const zh = [...root.querySelectorAll('#qimen-title [lang="zh-Hans"]')].map((e) => e.textContent)
    expect(zh).toContain('值符')
  })
})
