import { useEffect, useState } from 'react'
import { currentLocale } from '@app/locale'
import { t, tn } from '@i18n'
import { bcp47, type Locale } from '@i18n/locale'

/**
 * The wall clock, for countdowns and for sliding ships between pips.
 *
 * This is presentation only. It never touches game state: online, the server
 * owns the clock; offline, the store ticks the engine itself. Drawing from
 * `Date.now()` here just keeps the picture smooth between ticks.
 */
export function useNow(intervalMs = 1000, active = true): number {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!active) return
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs, active])

  return now
}

/*
 * The four below read the chosen language rather than taking it as an
 * argument. They are called from a couple of dozen places, most of them deep
 * inside a sheet that has no other reason to know what language it is in, and
 * threading a locale through all of them to render "in 2 hrs" would be a great
 * deal of plumbing for a string with one variable in it. Changing language
 * re-renders the tree, so the values follow.
 */

/**
 * "2 Std 14 Min", "47 Min", "30 Sek" — a span with no preposition on it.
 *
 * Both of the functions below want this figure and differ only in what they
 * wrap round it. Written once because the hour has to be counted wherever it
 * turns up, including in the middle of "1 Std 20 Min", and a phrase per unit
 * cannot say that.
 */
function spanText(locale: Locale, ms: number): string {
  const totalMinutes = Math.floor(ms / 60_000)
  if (totalMinutes < 1) {
    return t(locale, 'time.seconds', { n: Math.max(1, Math.round(ms / 1000)) })
  }
  if (totalMinutes < 60) return t(locale, 'time.minutes', { n: totalMinutes })
  const hours = tn(locale, 'time.hours', Math.floor(totalMinutes / 60))
  const minutes = totalMinutes % 60
  return minutes === 0
    ? hours
    : t(locale, 'time.hoursMinutes', {
        hours,
        minutes: t(locale, 'time.minutes', { n: minutes }),
      })
}

/** "in 2 Std 14 Min", "in 47 Min", "in 30 Sek", "jetzt". */
export function untilText(target: number, now: number): string {
  const locale = currentLocale()
  const ms = target - now
  if (ms <= 0) return t(locale, 'time.now')
  return t(locale, 'time.in', { duration: spanText(locale, ms) })
}

/** A wall-clock time of day, as a ship's officer would write it. */
export function clockText(at: number): string {
  return new Date(at).toLocaleTimeString(bcp47(currentLocale()), {
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * The largest unit that is not zero: "5 Tage", "3 Std", "20 Min".
 *
 * For the strip, where the figure has to fit beside the Handelshaus on a
 * telephone. "129 Std 18 Min" is four words to say what "5 Tage" says in two,
 * and nobody plans a season around the eighteen minutes. The exact figure is
 * still there for anyone who taps it — and in the aria-label, where the length
 * costs nothing.
 */
export function roughDuration(ms: number): string {
  const locale = currentLocale()
  if (ms <= 0) return t(locale, 'time.elapsed')
  const minutes = Math.floor(ms / 60_000)
  if (minutes < 60) return t(locale, 'time.minutes', { n: minutes })
  const hours = Math.floor(minutes / 60)
  if (hours < 48) return tn(locale, 'time.hours', hours)
  return tn(locale, 'time.days', Math.floor(hours / 24))
}

/** "3 Std 20 Min" — a plain duration, no preposition. */
export function durationText(ms: number): string {
  const locale = currentLocale()
  if (ms <= 0) return t(locale, 'time.elapsed')
  return spanText(locale, ms)
}
