import type { Catalog } from '../t'

/**
 * Durations, as a ship's officer would write them.
 *
 * German abbreviates hours "Std" and minutes "Min"; English of the same period
 * wrote "hrs" and "min". Both are kept short because the longest of these has
 * to fit beside the merchant house on a telephone.
 *
 * The abbreviations part company over counting. German writes "1 Std" and
 * "2 Std" alike, so the hour is a pair for the sake of the English alone —
 * which is the case worth writing down, because the temptation is to look at
 * the German, see nothing to inflect, and leave the pair unwritten.
 *
 * "in" is a frame of its own rather than a prefix on each unit. The units are
 * assembled — an hour and a minute stand side by side in "1 Std 20 Min", and
 * the hour there has to be counted just as it is when it stands alone — so a
 * separate "in {n} Std" would be a fourth phrase to keep in step with three
 * others for no gain.
 */
export const TIME = {
  'time.now': { de: 'jetzt', en: 'now' },
  'time.elapsed': { de: 'abgelaufen', en: 'elapsed' },
  'time.in': { de: 'in {duration}', en: 'in {duration}' },
  'time.seconds': { de: '{n} Sek', en: '{n} sec' },
  'time.minutes': { de: '{n} Min', en: '{n} min' },
  'time.hours.one': { de: '{n} Std', en: '{n} hr' },
  'time.hours.other': { de: '{n} Std', en: '{n} hrs' },
  /** Both halves counted already; this only puts them in order. */
  'time.hoursMinutes': { de: '{hours} {minutes}', en: '{hours} {minutes}' },
  'time.days.one': { de: '{n} Tag', en: '{n} day' },
  'time.days.other': { de: '{n} Tage', en: '{n} days' },
} satisfies Catalog
