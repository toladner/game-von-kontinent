import { describe, expect, it } from 'vitest'
import { STRINGS, t, type MsgKey } from './index'
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
 * other half was never written, a count with no singular behind it, or an
 * overlay entry keyed to a harbour that does not exist — all of which fail
 * silently, in front of a player, in one language only.
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

  /**
   * A pair whose English halves are identical is not a pair.
   *
   * English inflects everything countable, so there is no exception list here
   * and none is wanted: if the two halves read alike, one of them was copied
   * from the other and not looked at again.
   */
  it('inflects something in the English half of every plural', () => {
    for (const [key, phrase] of entries) {
      if (!key.endsWith('.one')) continue
      const other = STRINGS[`${key.slice(0, -'.one'.length)}.other` as MsgKey]
      expect(phrase.en, `${key}: both halves read the same in English`).not.toBe(other.en)
    }
  })

  /**
   * The German half, where the answer is not always yes.
   *
   * A few of these genuinely do not inflect: "Posten", "Std" and "Pkt." are
   * the same word however many there are. The rest do, and a German half
   * copied across from the singular is invisible — it renders, it reads
   * almost right, and only somebody counting notices "2 Kauf frei". So the
   * ones that stay put are written down, and anything else that stays put
   * fails here.
   */
  const GERMAN_UNCHANGED: Readonly<Record<string, string>> = {
    'hud.aboard': 'Posten',
    'report.lots': 'Posten',
    'fleet.mail.lots': 'Posten',
    'reject.holdFull': 'Posten',
    'port.sell.pips': 'Pkt.',
    'time.hours': 'Std',
    'setup.hours': 'Std',
    'setup.pace.hours': 'Std',
  }

  it('inflects the German half too, except where German does not', () => {
    const unchanged: string[] = []
    for (const [key, phrase] of entries) {
      if (!key.endsWith('.one')) continue
      const stem = key.slice(0, -'.one'.length)
      if (phrase.de !== STRINGS[`${stem}.other` as MsgKey].de) continue
      if (!Object.hasOwn(GERMAN_UNCHANGED, stem)) unchanged.push(stem)
    }
    expect(
      unchanged,
      'both German halves read the same: inflect the plural, or list the word in GERMAN_UNCHANGED',
    ).toEqual([])
  })

  it('keeps the list of unchanging German words honest', () => {
    for (const stem of Object.keys(GERMAN_UNCHANGED)) {
      const one = STRINGS[`${stem}.one` as MsgKey]
      const other = STRINGS[`${stem}.other` as MsgKey]
      expect(one && other, `${stem} is no longer a plural`).toBeTruthy()
      expect(
        one.de,
        `${stem}: the German halves now differ — drop it from GERMAN_UNCHANGED`,
      ).toBe(other.de)
    }
  })

  /**
   * Every count is either counted or is a decision.
   *
   * This is the shape of check that earns its keep: it does not ask whether a
   * *particular* phrase was pluralised, it asks of every phrase holding a
   * number whether anybody thought about it. A phrase written next month with
   * "{n} ships" in it fails here until it is either given a singular or
   * written down below with a reason.
   *
   * The convention it rests on is that a hole holding a bare number is always
   * called `{n}`; anything else in a hole was counted before it got here.
   */
  const NOT_COUNTED: Readonly<Record<string, string>> = {
    // Ordinals. The third name, not three names.
    'setup.nthName': 'an ordinal',
    'setup.nthNameLabel': 'an ordinal',
    'ui.seatNumber': 'an ordinal',

    // A tally in brackets after a heading, which stays plural the way the
    // heading over a column of figures does.
    'lobby.registered': 'a heading with its tally in brackets',
    'tables.heading': 'a heading with its tally in brackets',
    'setup.alreadyOnQuay': 'a heading with its tally in brackets',

    // Nothing follows the number that could inflect.
    'game.moveLeft': 'no noun — "noch 3", "3 left"',
    'strip.news.unread': '"ungelesen" and "unread" do not inflect',
    'news.aboutHouse': 'no noun after the figure',
    'news.fresh': 'no noun after the figure',
    'news.newCount': 'no noun after the figure',

    // Abbreviations of the period, which were written the same either way.
    // The hour is the exception and is a pair; see `time.ts`.
    'time.seconds': 'Sek / sec, unchanged either way',
    'time.minutes': 'Min / min, unchanged either way',
    'setup.minutes': 'Min / min, unchanged either way',
    'setup.pace.minutes': 'Min / min, unchanged either way',

    // Counts that cannot be one. Each is bounded somewhere in the code, and
    // a singular nobody can reach is a phrase nobody will ever proof-read.
    'setup.summary.rounds': 'the shortest game the slider offers is ten rounds',
    'lobby.terms': 'the shortest game the slider offers is ten rounds',
    'advice.card.regional.detail': 'the cards that set one run three to five rounds',
    'reject.fleetLimit': 'a limit of one has its own line — see fleetLimitNote',
    'reject.tableFull': 'MAX_PLAYERS is ten',
    'setup.tableFull': 'MAX_PLAYERS is ten',
  }

  it('counts every phrase that holds a count, or says why not', () => {
    const uncounted = entries
      .filter(([key]) => !key.endsWith('.one') && !key.endsWith('.other'))
      .filter(([, phrase]) => phrase.de.includes('{n}') || phrase.en.includes('{n}'))
      .map(([key]) => key)
      .filter((key) => !Object.hasOwn(NOT_COUNTED, key))

    expect(
      uncounted,
      'these hold a count with no singular: give them .one/.other, or list them in NOT_COUNTED with a reason',
    ).toEqual([])
  })

  it('keeps the list of exceptions honest', () => {
    for (const [key, why] of Object.entries(NOT_COUNTED)) {
      expect(Object.hasOwn(STRINGS, key), `${key} no longer exists`).toBe(true)
      const phrase = STRINGS[key as MsgKey]
      expect(
        phrase.de.includes('{n}') || phrase.en.includes('{n}'),
        `${key} no longer holds a count — drop it from NOT_COUNTED (${why})`,
      ).toBe(true)
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
