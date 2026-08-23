// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { GOODS } from '@content/goods'
import { GOODS_WELT } from '@content/goods-welt'
import { DRAWN_GOODS, GoodIcon } from './GoodIcon'

const ALL = [...GOODS, ...GOODS_WELT]

describe('the Warenkarten vignettes', () => {
  it('has a picture for every good in every pack', () => {
    // A good without one falls back to a plain crate, which is a fine last
    // resort and a poor plan: two crates side by side tell a player nothing.
    const drawn = new Set(DRAWN_GOODS)
    const missing = ALL.filter((g) => !drawn.has(g.id)).map((g) => `${g.id} ${g.name}`)
    expect(missing).toEqual([])
  })

  it('draws something for every one of them', () => {
    for (const good of ALL) {
      const { container, unmount } = render(<GoodIcon goodId={good.id} />)
      const svg = container.querySelector('svg')!
      // The frame and its ground are three shapes; anything real adds more.
      expect(svg.querySelectorAll('path, circle, rect, ellipse').length, good.name)
        .toBeGreaterThan(5)
      unmount()
    }
  })

  it('gives goods that are not alike pictures that are not alike', () => {
    // The whole point is telling one card from another at a glance. Sharing a
    // sack is fine; sharing a sack *and* its stencil is not.
    const seen = new Map<string, string>()
    const clashes: string[] = []
    for (const good of ALL) {
      const { container, unmount } = render(<GoodIcon goodId={good.id} />)
      // The clip and hatch ids are per-instance, so strip them before compare.
      const shape = container.innerHTML.replace(/(id|clip-path|fill)="[^"]*(g|p)[a-z0-9]+[^"]*"/g, '')
      const already = seen.get(shape)
      if (already) clashes.push(`${good.name} is identical to ${already}`)
      else seen.set(shape, good.name)
      unmount()
    }
    expect(clashes).toEqual([])
  })

  it('names the good for a screen reader when asked, and hides otherwise', () => {
    const withTitle = render(<GoodIcon goodId={29} title="Kaffee" />)
    expect(withTitle.container.querySelector('svg')!.getAttribute('role')).toBe('img')
    expect(withTitle.container.querySelector('svg')!.getAttribute('aria-label')).toBe('Kaffee')
    withTitle.unmount()

    // On a card the name is already written beside it, so the picture is
    // decoration and should not be read out twice.
    const plain = render(<GoodIcon goodId={29} />)
    expect(plain.container.querySelector('svg')!.getAttribute('role')).toBe('presentation')
  })
})
