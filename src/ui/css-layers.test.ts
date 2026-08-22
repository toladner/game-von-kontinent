import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * Every hand-written rule must live in a cascade layer.
 *
 * Unlayered CSS beats layered CSS whatever the source order, so a plain
 * `.paper { position: relative }` silently defeats Tailwind's `fixed`
 * utility. That is not a theoretical risk: it put the bottom sheet into
 * normal flow, off the bottom of the screen, where the harbour could not be
 * opened at all — and jsdom cannot catch it, because jsdom does no layout.
 */
const css = readFileSync('src/index.css', 'utf8')

/** Top-level blocks, brace-balanced, with comments and whitespace removed. */
function topLevelRules(source: string): string[] {
  const rules: string[] = []
  let i = 0
  while (i < source.length) {
    if (source.startsWith('/*', i)) {
      const end = source.indexOf('*/', i)
      i = end === -1 ? source.length : end + 2
      continue
    }
    if (/\s/.test(source[i]!)) {
      i += 1
      continue
    }
    const brace = source.indexOf('{', i)
    const semicolon = source.indexOf(';', i)
    // A statement such as `@import 'tailwindcss';` ends before any block.
    if (semicolon !== -1 && (brace === -1 || semicolon < brace)) {
      rules.push(source.slice(i, semicolon + 1))
      i = semicolon + 1
      continue
    }
    if (brace === -1) break
    let depth = 0
    let j = brace
    for (; j < source.length; j++) {
      if (source[j] === '{') depth += 1
      else if (source[j] === '}') {
        depth -= 1
        if (depth === 0) {
          j += 1
          break
        }
      }
    }
    rules.push(source.slice(i, j))
    i = j
  }
  return rules
}

describe('the stylesheet', () => {
  it('keeps every hand-written rule inside a cascade layer', () => {
    const stray = topLevelRules(css)
      .map((rule) => rule.split('{', 1)[0]!.trim())
      .filter(
        (selector) =>
          !selector.startsWith('@layer') &&
          !selector.startsWith('@theme') &&
          !selector.startsWith('@import') &&
          // Keyframes are not subject to the cascade at all.
          !selector.startsWith('@keyframes'),
      )

    expect(stray, `unlayered rules would outrank Tailwind utilities: ${stray.join(', ')}`).toEqual(
      [],
    )
  })

  it('declares .paper as a layered component, so `fixed` can override it', () => {
    const components = css.slice(css.indexOf('@layer components'))
    expect(components).toContain('.paper {')
    expect(components).toContain('position: relative')
  })
})
