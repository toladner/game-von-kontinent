import { useEffect, useRef } from 'react'
import { currentLocale } from '@app/locale'
import { t } from '@i18n'
import { named } from '@i18n/locale'
import { lookingAway, notify, notifyState } from '@app/notify'
import { voyageEndsAt } from '@engine/selectors'
import { flagship, type GameState, type PlayerState } from '@engine/state'
import type { EngineContext } from '@engine/context'

/**
 * Say something when the ship makes port, and when the season closes.
 *
 * Driven by a timer rather than by watching events go past, because the
 * arrival time is known exactly the moment a course is set: the clock is
 * deterministic, so there is nothing to wait and see about. A timer also
 * still fires in a backgrounded tab, where the websocket may well have been
 * put to sleep and no event would arrive at all.
 *
 * Nothing is said while the player is watching — a notification for something
 * happening on screen in front of them is noise. And each piece of news
 * carries a tag, so the ship arriving is one notification however many times
 * a re-render notices it. The Partieserver sends the same tags for the same
 * two events (`server/index.ts`, `announce`), which is what keeps a push and
 * a timer that both fire from becoming two notices about one ship.
 */
export function useArrivalNotice(
  ctx: EngineContext,
  state: GameState,
  player: PlayerState,
  enabled: boolean,
): void {
  const ship = flagship(player)
  const voyage = ship.voyage
  const destination = voyage?.destination ?? null
  const eta = voyage ? voyageEndsAt(ctx, state, ship) : null

  // Read through a ref inside the timer so a re-render between setting the
  // timer and its firing cannot leave it announcing a stale harbour.
  const latest = useRef({ ctx, destination })
  latest.current = { ctx, destination }

  useEffect(() => {
    if (!enabled || eta === null || destination === null) return
    const wait = eta - Date.now()
    // Already overdue: the arrival happened while the page was away, and the
    // state will show it. Nothing to announce after the fact.
    if (wait <= 0) return

    const timer = setTimeout(() => {
      if (!lookingAway()) return
      const locale = currentLocale()
      const port = latest.current.ctx.portsById.get(latest.current.destination ?? '')
      void notify(
        t(locale, 'notify.arrived.title'),
        t(locale, 'notify.arrived.body', {
          port: port ? named(port)[locale] : t(locale, 'notify.arrived.somewhere'),
        }),
        `ankunft:${latest.current.destination}`,
      )
    }, wait)

    return () => clearTimeout(timer)
  }, [enabled, eta, destination])

  // The season closing is the other thing worth waking someone for: after it
  // there is nothing left to do but read the Schlußabrechnung.
  const endsAt = state.endsAt
  const realtime = state.config.travel === 'echtzeit'
  useEffect(() => {
    if (!enabled || !realtime || endsAt <= 0) return
    const wait = endsAt - Date.now()
    if (wait <= 0) return
    const timer = setTimeout(() => {
      if (!lookingAway()) return
      const locale = currentLocale()
      void notify(
        t(locale, 'notify.seasonOver.title'),
        t(locale, 'notify.seasonOver.body'),
        'saison-ende',
      )
    }, wait)
    return () => clearTimeout(timer)
  }, [enabled, realtime, endsAt])
}

/** Whether notices can be shown at all right now. */
export function noticesReady(): boolean {
  return notifyState() === 'granted'
}
