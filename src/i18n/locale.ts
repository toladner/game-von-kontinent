/**
 * Two languages, one game.
 *
 * The board was printed in German and the game has never had an English
 * edition, so German is the original and English is the translation — not the
 * other way round. That shows up in small places: the title stays as it was
 * printed, the goods keep their German card numbers, and where a harbour has
 * a settled English name it gets it, while the rest keep theirs.
 *
 * This module is deliberately free of React and of anything that only exists
 * in a browser. The reducer runs on a Cloudflare Worker as well as in the
 * page, the service worker composes notification text, and both need to say
 * things in a player's language without dragging a UI framework along.
 */

export type Locale = 'de' | 'en'

export const LOCALES: readonly Locale[] = ['de', 'en']

/** The language's own name for itself, which is how a picker should list it. */
export const LOCALE_NAMES: Record<Locale, string> = {
  de: 'Deutsch',
  en: 'English',
}

export function isLocale(value: unknown): value is Locale {
  return value === 'de' || value === 'en'
}

/**
 * A value that exists in both languages.
 *
 * Used for the content that came off the printed material — goods, cards,
 * countries — where keeping the pair together in one place is what stops a
 * translation from quietly going missing.
 */
export interface Localized<T> {
  readonly de: T
  readonly en: T
}

export function pick<T>(locale: Locale, value: Localized<T> | T): T {
  return isLocalized(value) ? value[locale] : value
}

function isLocalized<T>(value: Localized<T> | T): value is Localized<T> {
  return typeof value === 'object' && value !== null && 'de' in value && 'en' in value
}

/**
 * The language to start in when nobody has chosen yet.
 *
 * German first: it is the game's own language, and a player who has gone to
 * the trouble of finding a 1980s German trading game is more likely to want
 * it than not. Anything that is plainly not German gets English.
 */
export function defaultLocale(languages: readonly string[] = []): Locale {
  for (const tag of languages) {
    const base = tag.toLowerCase().split('-')[0]
    if (base === 'de') return 'de'
    if (base === 'en') return 'en'
  }
  // A Danish or Japanese browser is better served by English than by German.
  return languages.length > 0 ? 'en' : 'de'
}

/**
 * Numbers as a ledger of the period would have set them.
 *
 * The trailing dash after the decimal separator is the bookkeeping convention
 * the original cards use for a round sum — `500.000,—`. English ledgers of
 * the same age did the same thing the other way round, `500,000.—`, so the
 * habit survives the translation and only the separators swap.
 */
export function formatMoney(locale: Locale, amount: number): string {
  return `${formatNumber(locale, amount)}${locale === 'de' ? ',' : '.'}—`
}

export function formatNumber(locale: Locale, amount: number): string {
  return amount.toLocaleString(locale === 'de' ? 'de-DE' : 'en-GB')
}

/**
 * A thing named on the printed material, with an English name folded in.
 *
 * Goods, countries and harbours keep the German exactly as printed and carry
 * the translation, where there is one, in `en`. Most entries have none —
 * Hamburg and Vanille need no help — and those simply read the same in both.
 */
export interface Named {
  readonly name: string
  readonly en?: string
}

export function named(thing: Named): Localized<string> {
  return { de: thing.name, en: thing.en ?? thing.name }
}

/** The tag for `Intl` and for the document's `lang` attribute. */
export function bcp47(locale: Locale): string {
  return locale === 'de' ? 'de-DE' : 'en-GB'
}
