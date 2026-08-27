import { create } from 'zustand'
import {
  bcp47,
  defaultLocale,
  formatMoney,
  formatNumber,
  isLocale,
  type Locale,
} from '@i18n/locale'
import {
  STRINGS,
  t as translate,
  tn as translateN,
  type MsgKey,
  type MsgStem,
  type Message,
} from '@i18n'
import type { Vars } from '@i18n/t'

/**
 * The chosen language, kept in its own little store.
 *
 * Deliberately not part of the game store. Which language a person reads is a
 * property of the person, not of the game: it survives leaving a table, it is
 * the same for every game on the device, and a table played across several
 * devices may well have each seat reading a different one. Keeping it apart
 * also keeps the dependency one-way — the game store reaches in here to
 * compose its journal, and nothing here knows a game exists.
 */

const LOCALE_KEY = 'vkzk.locale'

function stored(): Locale {
  try {
    const saved = localStorage.getItem(LOCALE_KEY)
    if (isLocale(saved)) return saved
  } catch {
    // Private mode. Fall through to what the browser says it prefers.
  }
  return defaultLocale(typeof navigator === 'undefined' ? [] : navigator.languages)
}

interface LocaleStore {
  readonly locale: Locale
  setLocale: (locale: Locale) => void
}

export const useLocaleStore = create<LocaleStore>((set) => ({
  locale: stored(),
  setLocale: (locale) => {
    try {
      localStorage.setItem(LOCALE_KEY, locale)
    } catch {
      // The choice still applies to this session; it just won't be remembered.
    }
    applyToDocument(locale)
    set({ locale })
  },
}))

/** What the rest of the app calls when it is not inside a component. */
export function currentLocale(): Locale {
  return useLocaleStore.getState().locale
}

/**
 * Tell the page itself which language it is in.
 *
 * Not decoration: it is what a screen reader picks a voice from, and what the
 * browser's own translate offer keys off. Hyphenation follows it too, which
 * German cares about more than English does.
 */
export function applyToDocument(locale: Locale): void {
  if (typeof document === 'undefined') return
  document.documentElement.lang = bcp47(locale)
}

export interface Translate {
  readonly locale: Locale
  /** One phrase, holes filled. */
  readonly t: (key: MsgKey, vars?: Vars) => string
  /** One phrase, chosen by count, with `{n}` already supplied. */
  readonly tn: (key: MsgStem, n: number, vars?: Vars) => string
  /** A pre-composed message from the engine. */
  readonly render: (message: Message) => string
  /** A sum, set as a ledger of the period would set it. */
  readonly money: (amount: number) => string
  /** A plain number, grouped for the language. */
  readonly num: (amount: number) => string
}

/**
 * The one hook a component needs.
 *
 * Bundling the number formatting in with the phrases is not tidiness: a sum
 * printed with German separators inside an English sentence is exactly the
 * kind of seam that makes a translation feel machine-made, and the only
 * reliable way to stop it is to make the correct formatter the nearest one to
 * hand.
 */
export function useT(): Translate {
  const locale = useLocaleStore((s) => s.locale)
  return {
    locale,
    t: (key, vars) => translate(locale, key, vars),
    tn: (key, n, vars) => translateN(locale, key, n, vars),
    render: (message) => translate(locale, message.key, message.vars),
    money: (amount) => formatMoney(locale, amount),
    num: (amount) => formatNumber(locale, amount),
  }
}

/** Whether a key exists — used by the tests that check the two lists match. */
export function hasKey(key: string): key is MsgKey {
  return key in STRINGS
}
