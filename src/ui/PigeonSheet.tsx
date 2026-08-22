import { useMemo, useState } from 'react'
import { Sheet, type SheetSnap } from './Sheet'
import { clockText } from './useNow'
import { portAt } from '@engine/selectors'
import { flagship, type GameState, type PlayerState } from '@engine/state'
import type { EngineContext } from '@engine/context'

/**
 * Writing to a captain you cannot see.
 *
 * Three choices, and the game refuses to help with the first: you address the
 * letter to the harbour where you *believe* she lies. If she has already
 * sailed, nobody reads it, and nobody tells you so.
 */
export function PigeonSheet({
  ctx,
  state,
  player,
  vehicleId,
  snap,
  onSnap,
  onSend,
}: {
  ctx: EngineContext
  state: GameState
  player: PlayerState
  vehicleId: string
  snap: SheetSnap
  onSnap: (s: SheetSnap) => void
  onSend: (toPort: string, destination: string, replyTo: string | null) => void
}) {
  const vessel = player.fleet.find((v) => v.id === vehicleId)
  const sighting = player.knowledge.sightings[vehicleId]
  const here = flagship(player)
  const herePort = portAt(ctx, here.nodeId)

  const ports = useMemo(
    () => [...ctx.portsById.values()].sort((a, b) => a.name.localeCompare(b.name, 'de')),
    [ctx],
  )

  // The obvious guess: where she was headed, else where she was last seen.
  const [toPort, setToPort] = useState(
    sighting?.bound ?? sighting?.nodeId ?? vessel?.nodeId ?? herePort ?? '',
  )
  const [destination, setDestination] = useState('')
  const [wantReply, setWantReply] = useState(true)
  const [replyTo, setReplyTo] = useState(herePort ?? '')

  if (!vessel) return null
  const cost = state.config.pigeon.price
  const ready = toPort && destination && toPort !== destination

  return (
    <Sheet
      snap={snap}
      onSnap={onSnap}
      title="Brieftaube"
      subtitle={`An den Kapitän der ${vessel.name}`}
      footer={
        <button
          className="btn btn-primary w-full"
          disabled={!ready || player.cash < cost}
          onClick={() => onSend(toPort, destination, wantReply ? replyTo : null)}
        >
          Taube auflassen · {cost.toLocaleString('de-DE')}
        </button>
      }
    >
      <div className="paper-slip coupon-edge mb-4 px-4 py-4">
        <p className="teletype text-center text-[10px] tracking-[0.25em] text-black/55">
          Depesche
        </p>
        <p className="mt-2 text-center text-[12px] italic">
          {sighting
            ? `Zuletzt gemeldet: ${
                ctx.portsById.get(sighting.nodeId)?.name ?? '—'
              }, Stand ${clockText(sighting.asOf)} Uhr${
                sighting.bound
                  ? `, bestimmt nach ${ctx.portsById.get(sighting.bound)?.name ?? ''}`
                  : ''
              }.`
            : 'Von diesem Schiff liegt keine Meldung vor.'}
        </p>
      </div>

      <PortChoice
        label="Adressiert an"
        hint="Wo vermuten Sie das Schiff? Irren Sie sich, liest den Brief niemand."
        ports={ports}
        value={toPort}
        onChange={setToPort}
      />

      <PortChoice
        label="Order: fahre nach"
        hint="Was der Kapitän tun soll, wenn er den Brief bekommt."
        ports={ports}
        value={destination}
        onChange={setDestination}
      />

      <label className="mt-4 flex items-center gap-2 text-[12px]">
        <input
          type="checkbox"
          checked={wantReply}
          onChange={(e) => setWantReply(e.target.checked)}
          className="accent-press"
        />
        Um Antwort wird gebeten
      </label>

      {wantReply && (
        <PortChoice
          label="Antwort nach"
          hint="Dorthin schickt der Kapitän seine Taube. Sie müssen selbst dort sein, um den Brief zu holen."
          ports={ports}
          value={replyTo}
          onChange={setReplyTo}
        />
      )}

      <p className="text-ink-faint mt-4 text-[11px] italic">
        Ob die Taube ankommt, erfahren Sie nicht. Manche kommen nie an.
      </p>
    </Sheet>
  )
}

function PortChoice({
  label,
  hint,
  ports,
  value,
  onChange,
}: {
  label: string
  hint: string
  ports: readonly { id: string; name: string }[]
  value: string
  onChange: (v: string) => void
}) {
  const [filter, setFilter] = useState('')
  const shown = useMemo(() => {
    const needle = filter.trim().toLowerCase()
    const list = needle
      ? ports.filter((p) => p.name.toLowerCase().includes(needle))
      : ports
    return list.slice(0, 60)
  }, [ports, filter])

  const chosen = ports.find((p) => p.id === value)

  return (
    <div className="mt-4">
      <p className="smallcaps text-ink-soft text-[11px]">{label}</p>
      <p className="text-ink-faint mb-1.5 text-[10px] leading-snug italic">{hint}</p>
      <input
        className="focusable paper-card w-full rounded-md px-2.5 py-2 text-sm outline-none"
        placeholder={chosen ? chosen.name : 'Hafen suchen …'}
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        aria-label={label}
      />
      {filter.trim() && (
        <ul className="paper-card mt-1 max-h-40 overflow-y-auto rounded-md">
          {shown.map((p) => (
            <li key={p.id}>
              <button
                className={`block w-full px-2.5 py-1.5 text-left text-[13px] ${
                  p.id === value ? 'bg-black/10 font-semibold' : 'hover:bg-black/5'
                }`}
                onClick={() => {
                  onChange(p.id)
                  setFilter('')
                }}
              >
                {p.name}
              </button>
            </li>
          ))}
          {shown.length === 0 && (
            <li className="text-ink-faint px-2.5 py-2 text-xs italic">Kein solcher Hafen.</li>
          )}
        </ul>
      )}
      {chosen && !filter.trim() && (
        <p className="text-press mt-1 text-[12px] font-semibold">{chosen.name}</p>
      )}
    </div>
  )
}
