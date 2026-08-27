import { useMemo, useState } from 'react'
import { Sheet, type SheetSnap } from './Sheet'
import { clockText } from './useNow'
import { portAt } from '@engine/selectors'
import { flagship, type GameState, type PlayerState } from '@engine/state'
import { makeShipIdentity } from '@engine/persona'
import type { EngineContext } from '@engine/context'
import { useT } from '@app/locale'
import { bcp47, named } from '@i18n/locale'

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
  const { t, num, locale } = useT()
  const vessel = player.fleet.find((v) => v.id === vehicleId)
  const sighting = player.knowledge.sightings[vehicleId]
  const here = flagship(player)
  const herePort = portAt(ctx, here.nodeId)

  // Sorted in the language they are shown in, so the list reads alphabetically
  // to whoever is looking at it — Genoa and Genua do not sit in the same place.
  const ports = useMemo(
    () =>
      [...ctx.portsById.values()]
        .map((port) => ({ id: port.id, name: named(port)[locale] }))
        .sort((a, b) => a.name.localeCompare(b.name, bcp47(locale))),
    [ctx, locale],
  )

  // The obvious guess: where she was headed, else where she was last seen.
  const [toPort, setToPort] = useState(
    sighting?.bound ?? sighting?.nodeId ?? vessel?.nodeId ?? herePort ?? '',
  )
  const [destination, setDestination] = useState('')
  const [wantReply, setWantReply] = useState(true)
  const [replyTo, setReplyTo] = useState(herePort ?? '')

  if (!vessel) return null
  // The same seed the reducer uses when she signs her answer, so the letter
  // is addressed to the person who replies to it.
  const master = makeShipIdentity(`${vessel.id}:${state.packId}`)
  const cost = state.config.pigeon.price
  const ready = toPort && destination && toPort !== destination

  return (
    <Sheet
      snap={snap}
      onSnap={onSnap}
      title={t('pigeon.title')}
      subtitle={t(master.captainGender === 'w' ? 'pigeon.to.w' : 'pigeon.to.m', {
        ship: vessel.name,
        // The title is already in the subtitle's phrase, so only the name
        // itself belongs in the hole.
        name: master.captain[locale].replace(/^Kapitänin |^Kapitän |^Master /, ''),
      })}
      footer={
        <button
          className="btn btn-primary w-full"
          disabled={!ready || player.cash < cost}
          onClick={() => onSend(toPort, destination, wantReply ? replyTo : null)}
        >
          {t('pigeon.release', { cost: num(cost) })}
        </button>
      }
    >
      <div className="paper-slip coupon-edge mb-4 px-4 py-4">
        <p className="teletype text-center text-[10px] tracking-[0.25em] text-black/55">
          {t('pigeon.dispatch')}
        </p>
        <p className="mt-2 text-center text-[12px] italic">
          {sighting
            ? t('pigeon.lastReported', {
                port: ports.find((p) => p.id === sighting.nodeId)?.name ?? '—',
                time: clockText(sighting.asOf),
                bound: sighting.bound
                  ? t('pigeon.bound', {
                      port: ports.find((p) => p.id === sighting.bound)?.name ?? '',
                    })
                  : '',
              })
            : t('pigeon.noReport')}
        </p>
      </div>

      <PortChoice
        label={t('pigeon.addressedTo')}
        hint={t('pigeon.addressedTo.hint')}
        ports={ports}
        value={toPort}
        onChange={setToPort}
      />

      <PortChoice
        label={t('pigeon.order')}
        hint={t(master.captainGender === 'w' ? 'pigeon.order.hint.w' : 'pigeon.order.hint.m')}
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
        {t('pigeon.replyPlease')}
      </label>

      {wantReply && (
        <PortChoice
          label={t('pigeon.replyTo')}
          hint={t(
            master.captainGender === 'w' ? 'pigeon.replyTo.hint.w' : 'pigeon.replyTo.hint.m',
          )}
          ports={ports}
          value={replyTo}
          onChange={setReplyTo}
        />
      )}

      <p className="text-ink-faint mt-4 text-[11px] italic">{t('pigeon.noConfirmation')}</p>
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
  const { t } = useT()
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
        placeholder={chosen ? chosen.name : t('pigeon.searchPort')}
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
            <li className="text-ink-faint px-2.5 py-2 text-xs italic">
              {t('pigeon.noSuchPort')}
            </li>
          )}
        </ul>
      )}
      {chosen && !filter.trim() && (
        <p className="text-press mt-1 text-[12px] font-semibold">{chosen.name}</p>
      )}
    </div>
  )
}
