import type { Catalog } from '../t'

/**
 * Durations, as a ship's officer would write them.
 *
 * German abbreviates hours "Std" and minutes "Min"; English of the same period
 * wrote "hrs" and "min". Both are kept short because the longest of these has
 * to fit beside the merchant house on a telephone.
 */
export const TIME = {
  'time.now': { de: 'jetzt', en: 'now' },
  'time.elapsed': { de: 'abgelaufen', en: 'elapsed' },
  'time.in.seconds': { de: 'in {n} Sek', en: 'in {n} sec' },
  'time.in.minutes': { de: 'in {n} Min', en: 'in {n} min' },
  'time.in.hours': { de: 'in {n} Std', en: 'in {n} hrs' },
  'time.in.hoursMinutes': { de: 'in {h} Std {m} Min', en: 'in {h} hrs {m} min' },
  'time.minutes': { de: '{n} Min', en: '{n} min' },
  'time.hours': { de: '{n} Std', en: '{n} hrs' },
  'time.hoursMinutes': { de: '{h} Std {m} Min', en: '{h} hrs {m} min' },
  'time.days': { de: '{n} Tage', en: '{n} days' },
} satisfies Catalog
