import { useEffect, useRef, useState } from 'react'
import { PortraitRing } from './Portrait'
import { CargoHold } from './Cargo'
import { flagship, type PlayerState } from '@engine/state'
import type { EngineContext } from '@engine/context'
import { PLAYER_COLORS } from '@app/store'
import { useT } from '@app/locale'

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
  rank,
  onOpen,
}: {
  ctx: EngineContext
  player: PlayerState
  cargoCount: number
  purchasesLeft: number | null
  /** Place in the standings by Vermögen, so "how am I doing" is never a guess. */
  rank: number | null
  onOpen: () => void
}) {
  const { t, tn, num } = useT()
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

  // Darf schrumpfen: die Leiste rechts hat Vorrang, weil sie sonst umbricht.
  // Name und Ladung werden dann abgeschnitten, die Kasse steht.
  return (
    <button
      onClick={onOpen}
      className="paper anim-rise pointer-events-auto flex min-w-0 max-w-[min(78vw,22rem)] shrink items-center gap-2.5 rounded-lg border-l-4 py-2 pr-3 pl-2.5 text-left shadow-lg"
      style={{ borderLeftColor: color.ink }}
      aria-label={t('game.house.aria', {
        place: rank !== null ? t('game.house.place', { rank }) : '',
        name: player.name,
        cash: num(player.cash),
      })}
    >
      <PortraitRing traits={player.persona.portrait} ink={color.ink} size={40} />

      <span className="min-w-0">
        {/* The rank rides with the name rather than in a corner of its own:
            "3. Ada" reads as one fact, and it is the fact players ask for. */}
        <span className="flex items-baseline gap-1 text-[13px] leading-tight font-semibold">
          {rank !== null && <span className="tnum text-ink-soft shrink-0">{rank}.</span>}
          <span className="truncate">{player.name}</span>
        </span>
        <span
          className={`tnum block rounded-sm text-lg leading-tight font-bold ${flash ? 'anim-flash' : ''}`}
        >
          {num(cash)}
        </span>
        {/* Beide Zeilen schneiden ab statt zu wachsen. Sonst diktieren sie
            die Mindestbreite der Karte — die Ladeluken allein sind über
            hundert Pixel, die nicht kleiner werden können — und die Kopfzeile
            bricht auf jedem Telefon um, obwohl der Platz gereicht hätte. */}
        <span className="text-ink-soft block truncate text-[10px] leading-tight">
          {cargoCount === 0 ? t('hud.holdEmpty') : tn('hud.aboard', cargoCount)}
          {purchasesLeft !== null && ` · ${tn('hud.purchasesLeft', purchasesLeft)}`}
        </span>
        {cargoCount > 0 && (
          <span className="mt-1 block overflow-hidden">
            <CargoHold ctx={ctx} cargo={flagship(player).cargo} vehicle={flagship(player).kind} size={22} max={5} />
          </span>
        )}
      </span>
    </button>
  )
}
