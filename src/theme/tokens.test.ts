import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { color, cssVars } from './tokens'

// Read from disk: Vitest stubs CSS imports, `?raw` included.
const css = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8')

function rootDeclarations(source: string): Map<string, string> {
  const root = /:root\s*\{([^}]*)\}/.exec(source)?.[1] ?? ''
  const out = new Map<string, string>()
  for (const m of root.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    const [, name, value] = m
    if (name && value) out.set(name, value.trim())
  }
  return out
}

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))

describe('tokens', () => {
  it('tokens.css declares every cssVars() entry with the same value', () => {
    const declared = rootDeclarations(css)
    for (const [name, value] of Object.entries(cssVars())) {
      expect(declared.get(name), name).toBe(value)
    }
  })

  it('night is the exact RGB inverse of paper', () => {
    const inverse = rgb(color.paper).map((c) => 255 - c)
    expect(rgb(color.night)).toEqual(inverse)
  })
})
