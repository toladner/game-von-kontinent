import { pick, type Locale, type Localized } from './locale'

/**
 * The smallest translator that does the job.
 *
 * There is no i18next here on purpose. The strings have to be readable from
 * three places that are not a React tree — the reducer, the Cloudflare Worker
 * that runs it, and the service worker that writes notifications — and every
 * key has to be present in both languages or the build should fail. Keeping
 * each phrase as a `{ de, en }` pair in a plain object gets both: the type
 * checker will not let a German line be added without its English twin, and
 * an unknown key is a compile error rather than a string that renders as
 * `reject.noLine` in front of a player.
 *
 * The cost is no lazy namespace loading and no plural rules beyond one/other.
 * Two languages that both count the same way do not need more.
 */

/**
 * What goes into a phrase's holes.
 *
 * A hole is often filled with something that is itself in two languages — a
 * card's headline, a good, a country. Letting a variable be a localized pair
 * and resolving it here is what stops every call site from having to know the
 * locale just to hand over a noun.
 *
 * One naming rule, which a test enforces: a hole holding a bare number the
 * reader will count is always called `{n}`, and a phrase containing `{n}` is
 * either half of a one/other pair or is listed as a deliberate exception.
 * Anything under any other name is text that was counted somewhere else —
 * a ready-made "3 Meldungen", a sum of money, a harbour — and needs no
 * counting here. It is what lets a phrase carry two counts at once.
 */
export type Var = string | number | Localized<string>

export type Vars = Record<string, Var>

/** One phrase, in both languages. */
export type Phrase = Localized<string>

/** A catalogue is a flat map of dotted keys to phrases. */
export type Catalog = Readonly<Record<string, Phrase>>

/**
 * Which half of a pair a count calls for.
 *
 * German and English agree on the rule — one is one, and everything else,
 * nought included, is the other — so there is one function here and no table
 * of language rules. It is exported because the choice has to be made in two
 * places: in `tn`, where a component renders a phrase, and in `msgn`, where
 * the engine puts a count into a message it will not be rendering itself.
 */
export function plural(n: number): 'one' | 'other' {
  return n === 1 ? 'one' : 'other'
}

/**
 * Fill `{name}` holes.
 *
 * A hole with nothing to put in it is left standing rather than blanked, so a
 * missing variable shows up as `{port}` on screen during development instead
 * of as a sentence with a gap in the middle that reads almost fine.
 */
export function interpolate(locale: Locale, text: string, vars?: Vars): string {
  if (!vars) return text
  return text.replace(/\{(\w+)\}/g, (whole, name: string) => {
    const value = vars[name]
    if (value === undefined) return whole
    return typeof value === 'object' ? pick(locale, value) : String(value)
  })
}

/**
 * Build a translator bound to one catalogue.
 *
 * Returned rather than exported directly so the catalogue's key union flows
 * into the signature: `t('reject.noLinee')` will not compile.
 */
export function translator<C extends Catalog>(catalog: C) {
  type Key = keyof C & string

  /**
   * The stem of a one/other pair.
   *
   * `advice.nachladen` is not itself a phrase — `advice.nachladen.one` and
   * `.other` are — so `tn` must not accept plain keys and `t` must not accept
   * stems. Deriving the stems from the catalogue keeps that honest: adding
   * only half of a pair makes every call site for it stop compiling.
   */
  type Stem = {
    [K in Key]: K extends `${infer B}.one` ? B : never
  }[Key]

  function t(locale: Locale, key: Key, vars?: Vars): string {
    const phrase = catalog[key]
    // Only reachable when a key is fetched from data rather than written out
    // — a card id, say. The key itself is a better thing to show than nothing.
    if (!phrase) return key
    return interpolate(locale, phrase[locale], vars)
  }

  /**
   * One or many. Looks up `key.one` or `key.other` and passes `n` along, so
   * `{n} Punkt` / `{n} Punkte` needs no counting at the call site.
   */
  function tn(locale: Locale, key: Stem, n: number, vars?: Vars): string {
    return t(locale, `${key}.${plural(n)}` as Key, { n, ...vars })
  }

  return { t, tn }
}
