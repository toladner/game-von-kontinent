import { describe, expect, it } from 'vitest'
import { STRINGS, t } from './index'
import { GOODS } from '@content/goods'
import { GOODS_WELT } from '@content/goods-welt'
import { COUNTRIES } from '@content/maps/classic/countries'
import { COUNTRIES_WELT } from '@content/maps/welt/countries'
import { PORTS } from '@content/maps/classic/ports'
import { PORTS_WELT } from '@content/maps/welt/ports'
import { TRANSLATED_IDS } from '@content/naming'

/**
 * The catalogue cannot be checked by the type system past a certain point.
 *
 * TypeScript guarantees that every key has both a German and an English
 * string, which is the failure that would otherwise happen most often. What it
 * cannot see is a translation that quietly drops a `{hole}`, a plural whose
 * other half was never written, or an overlay entry keyed to a harbour that
 * does not exist — all of which fail silently, in front of a player, in one
 * language only.
 */
describe('the phrase table', () => {
  const entries = Object.entries(STRINGS)

  it('has something to say in both languages', () => {
    for (const [key, phrase] of entries) {
      expect(phrase.de.trim(), `${key} (de)`).not.toBe('')
      expect(phrase.en.trim(), `${key} (en)`).not.toBe('')
    }
  })

  /**
   * The one that actually bites. `'{n} Punkte'` translated as `'several
   * marks'` compiles, renders, and is wrong in a way nobody notices until a
   * number is missing from a sentence in the language they do not test in.
   */
  it('fills the same holes in both languages', () => {
    const holes = (text: string) =>
      [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!).sort()

    for (const [key, phrase] of entries) {
      expect(holes(phrase.en), `${key}: the English fills different holes`).toEqual(
        holes(phrase.de),
      )
    }
  })

  it('writes both halves of every plural', () => {
    const stems = entries
      .map(([key]) => key)
      .filter((key) => key.endsWith('.one'))
      .map((key) => key.slice(0, -'.one'.length))

    expect(stems.length, 'expected some plurals to exist at all').toBeGreaterThan(5)
    for (const stem of stems) {
      expect(Object.hasOwn(STRINGS, `${stem}.other`), `${stem}.other is missing`).toBe(true)
    }
  })

  it('renders a key that does not exist as itself rather than as nothing', () => {
    // Reachable only where a key is built from data — a card id, say. Showing
    // the key is ugly; showing an empty line is a sentence with a hole in it.
    expect(t('de', 'gibt.es.nicht' as never)).toBe('gibt.es.nicht')
  })
})

/**
 * The English names are an overlay keyed by id, and a key that matches nothing
 * is invisible: the good keeps its German name and looks like a translation
 * nobody got round to. This is how a typo in `naming.ts` gets caught.
 */
describe('the English name overlay', () => {
  it('names goods that exist', () => {
    const ids = new Set([...GOODS, ...GOODS_WELT].map((g) => g.id))
    for (const id of TRANSLATED_IDS.goods) {
      expect(ids.has(id), `no Warenkarte number ${id}`).toBe(true)
    }
  })

  it('names countries that exist', () => {
    const ids = new Set([...COUNTRIES, ...COUNTRIES_WELT].map((c) => c.id))
    for (const id of TRANSLATED_IDS.countries) {
      expect(ids.has(id), `no country "${id}"`).toBe(true)
    }
  })

  it('names harbours that exist', () => {
    const ids = new Set([...PORTS, ...PORTS_WELT].map((p) => p.id))
    for (const id of TRANSLATED_IDS.ports) {
      expect(ids.has(id), `no harbour "${id}"`).toBe(true)
    }
  })

  it('actually reaches the data', () => {
    // A spot check that the fold happened at all: Kaffee is number 29, and
    // if the overlay were never applied it would still be Kaffee in English.
    const coffee = GOODS.find((g) => g.id === 29)!
    expect(coffee.name).toBe('Kaffee')
    expect(coffee.en).toBe('Coffee')
  })
})
