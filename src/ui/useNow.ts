import { useEffect, useState } from 'react'

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

/** "in 2 Std 14 Min", "in 47 Min", "in 30 Sek", "jetzt". */
export function untilText(target: number, now: number): string {
  const ms = target - now
  if (ms <= 0) return 'jetzt'
  const totalMinutes = Math.floor(ms / 60_000)
  if (totalMinutes < 1) return `in ${Math.max(1, Math.round(ms / 1000))} Sek`
  if (totalMinutes < 60) return `in ${totalMinutes} Min`
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return minutes === 0 ? `in ${hours} Std` : `in ${hours} Std ${minutes} Min`
}

/** A wall-clock time of day, as a ship's officer would write it. */
export function clockText(at: number): string {
  return new Date(at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
}

/** "3 Std 20 Min" — a plain duration, no preposition. */
export function durationText(ms: number): string {
  if (ms <= 0) return 'abgelaufen'
  const totalMinutes = Math.floor(ms / 60_000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours === 0) return `${minutes} Min`
  return minutes === 0 ? `${hours} Std` : `${hours} Std ${minutes} Min`
}
