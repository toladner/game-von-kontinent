import { useEffect, useRef, useState } from 'react'
import { Portrait } from './Portrait'
import { CargoHold } from './Cargo'
import type { PlayerState } from '@engine/state'
import type { EngineContext } from '@engine/context'
import { PLAYER_COLORS } from '@app/store'

/** Rolls a figure up or down so money visibly moves. */
export function useCountUp(value: number, ms = 520): number {
  const [shown, setShown] = useState(value)
  const from = useRef(value)
  const raf = useRef(0)

  useEffect(() => {
    const start = performance.now()
    const a = from.current
    const b = value
    if (a === b) return

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms)
      const eased = 1 - (1 - t) ** 3
      setShown(Math.round(a + (b - a) * eased))
      if (t < 1) raf.current = requestAnimationFrame(tick)
      else from.current = b
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [value, ms])

  return shown
}

/**
 * Always on screen, top left, in the active player's colour: who is playing,
 * what they can spend, what they are carrying. The three things that were
 * impossible to find before.
 */
export function PlayerHUD({
  ctx,
  player,
  cargoCount,
  purchasesLeft,
  onOpen,
}: {
  ctx: EngineContext
  player: PlayerState
  cargoCount: number
  purchasesLeft: number | null
  onOpen: () => void
}) {
  const color = PLAYER_COLORS[player.colorIndex % PLAYER_COLORS.length]!
  const cash = useCountUp(player.cash)
  const [flash, setFlash] = useState(false)
  const previous = useRef(player.cash)

  useEffect(() => {
    if (previous.current !== player.cash) {
      previous.current = player.cash
      setFlash(true)
      const t = setTimeout(() => setFlash(false), 900)
      return () => clearTimeout(t)
    }
  }, [player.cash])

  return (
    <button
      onClick={onOpen}
      className="paper anim-rise pointer-events-auto flex max-w-[min(78vw,22rem)] items-center gap-2.5 rounded-lg border-l-4 py-2 pr-3 pl-2.5 text-left shadow-lg"
      style={{ borderLeftColor: color.ink }}
      aria-label={`${player.name}, ${player.cash.toLocaleString('de-DE')} Einheiten. Kontor öffnen.`}
    >
      <span
        className="shrink-0 rounded-full ring-2 ring-offset-1"
        style={{ boxShadow: `0 0 0 2px ${color.ink}` }}
      >
        <Portrait traits={player.persona.portrait} size={40} />
      </span>

      <span className="min-w-0">
        <span className="block truncate text-[13px] leading-tight font-semibold">
          {player.name}
        </span>
        <span
          className={`tnum block rounded-sm text-lg leading-tight font-bold ${flash ? 'anim-flash' : ''}`}
        >
          {cash.toLocaleString('de-DE')}
        </span>
        <span className="text-ink-soft block text-[10px] leading-tight">
          {cargoCount === 0 ? 'Laderaum leer' : `${cargoCount} Posten an Bord`}
          {purchasesLeft !== null && ` · ${purchasesLeft} Kauf frei`}
        </span>
        {cargoCount > 0 && (
          <span className="mt-1 block">
            <CargoHold ctx={ctx} cargo={player.cargo} vehicle={player.vehicle} size={22} max={5} />
          </span>
        )}
      </span>
    </button>
  )
}

/** The Kegelfigur, shrunk to a pill. Tap for the whole track. */
export function RoundPill({
  round,
  total,
  red,
  onOpen,
}: {
  round: number
  total: number
  red: boolean
  onOpen: () => void
}) {
  return (
    <button
      onClick={onOpen}
      className={`paper anim-rise pointer-events-auto flex items-center gap-1.5 rounded-lg px-3 py-1.5 shadow-lg ${
        red ? 'text-rot' : ''
      }`}
      aria-label={`Runde ${round} von ${total}${red ? ', rotes Feld' : ''}`}
    >
      {red && <span className="bg-rot h-2.5 w-2.5 shrink-0 rounded-full" aria-hidden />}
      <span className="smallcaps text-[10px]">Runde</span>
      <span className="tnum text-base leading-none font-bold">{round}</span>
      <span className="text-ink-faint text-[10px]">/{total}</span>
    </button>
  )
}
