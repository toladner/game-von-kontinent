import { useMemo, useState } from 'react'
import { Sheet, Tabs, type SheetSnap } from './Sheet'
import { CargoHold } from './Cargo'
import { clockText, untilText } from './useNow'
import { arrivalOf, fleetLimitNote, hasShipyard, portAt } from '@engine/selectors'
import { flagship, type GameState, type PlayerState, type VehicleInstance } from '@engine/state'
import type { EngineContext } from '@engine/context'
import { PLAYER_COLORS, playerLabel } from '@app/store'

type Tab = 'flotte' | 'post' | 'notizbuch'

/**
 * The house's own affairs: what it owns, what it has been told, and what the
 * merchant has written down.
 *
 * Under Sicht "realistisch" this is the only place a distant ship exists at
 * all — as a date, a place, and a guess.
 */
export function FleetSheet({
  ctx,
  state,
  player,
  now,
  snap,
  onSnap,
  onBoard,
  onBuy,
  onSendPigeon,
  onCollectMail,
  onWriteNote,
}: {
  ctx: EngineContext
  state: GameState
  player: PlayerState
  now: number
  snap: SheetSnap
  onSnap: (s: SheetSnap) => void
  onBoard: (vehicleId: string) => void
  onBuy: (kindId: string) => void
  onSendPigeon: (vehicleId: string) => void
  onCollectMail: () => void
  onWriteNote: (text: string) => void
}) {
  const fog = state.config.sicht === 'realistisch'
  const [tab, setTab] = useState<Tab>('flotte')
  const colour = PLAYER_COLORS[player.colorIndex % PLAYER_COLORS.length]!
  const here = flagship(player)
  const herePort = here.voyage ? null : portAt(ctx, here.nodeId)

  const waitingHere = herePort ? (player.knowledge.waiting[here.nodeId] ?? []).length : 0
  const unread = useMemo(
    () => Object.values(player.knowledge.waiting).reduce((n, l) => n + l.length, 0),
    [player.knowledge.waiting],
  )

  return (
    <Sheet
      snap={snap}
      onSnap={onSnap}
      title={player.name}
      subtitle={`${playerLabel(player)} · ${player.fleet.length} ${player.fleet.length === 1 ? 'Schiff' : 'Schiffe'}${
        fog ? ` · ${unread} Brief${unread === 1 ? '' : 'e'} unterwegs zu Ihnen` : ''
      }`}
      accent={colour.ink}
    >
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { id: 'flotte', label: 'Flotte', badge: player.fleet.length },
          ...(fog
            ? ([
                { id: 'post', label: 'Post', badge: waitingHere },
                { id: 'notizbuch', label: 'Notizbuch' },
              ] as const)
            : []),
        ]}
      />

      {tab === 'flotte' && (
        <div className="anim-fade">
          <ul className="stagger space-y-2">
            {player.fleet.map((vehicle) => (
              <VesselRow
                key={vehicle.id}
                ctx={ctx}
                state={state}
                player={player}
                vehicle={vehicle}
                aboard={vehicle.id === here.id}
                fog={fog}
                now={now}
                canBoard={
                  !here.voyage && !vehicle.voyage && vehicle.nodeId === here.nodeId
                }
                onBoard={() => onBoard(vehicle.id)}
                onSendPigeon={() => onSendPigeon(vehicle.id)}
              />
            ))}
          </ul>

          {/* A table playing the printed rules has no yard to show at all. */}
          {herePort && hasShipyard(state) && (
            <>
              <h3 className="smallcaps text-ink-soft mt-5 mb-2 text-[11px]">Werft</h3>
              {player.fleet.length >= state.config.maxFleetSize ? (
                <p className="text-ink-faint text-xs italic">
                  {fleetLimitNote(state.config.maxFleetSize)}
                </p>
              ) : (
                <div className="space-y-2">
                  {ctx.pack.vehicles.map((kind) => {
                    const tooDear = player.cash < kind.price
                    return (
                      <button
                        key={kind.id}
                        className="paper-card block w-full rounded-md p-2.5 text-left disabled:opacity-45"
                        disabled={tooDear}
                        onClick={() => onBuy(kind.id)}
                      >
                        <span className="flex items-baseline justify-between gap-2">
                          <span className="text-sm font-semibold">{kind.name}</span>
                          <span className="tnum text-sm">
                            {kind.price.toLocaleString('de-DE')}
                          </span>
                        </span>
                        <span className="text-ink-soft block text-[11px]">
                          {kind.blurb} · Laderaum {kind.capacity ?? '∞'} ·{' '}
                          {kind.speedFactor < 1
                            ? 'schnell'
                            : kind.speedFactor > 1
                              ? 'langsam'
                              : 'normal'}
                          {tooDear && ' · Barmittel reichen nicht'}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {tab === 'post' && (
        <div className="anim-fade">
          {herePort ? (
            waitingHere > 0 ? (
              <button className="btn btn-primary mb-4 w-full" onClick={onCollectMail}>
                {waitingHere} {waitingHere === 1 ? 'Brief' : 'Briefe'} abholen
              </button>
            ) : (
              <p className="text-ink-faint mb-4 text-xs italic">
                Im Postamt von {ctx.portsById.get(here.nodeId)?.name} liegt nichts für Sie.
              </p>
            )
          ) : (
            <p className="text-ink-faint mb-4 text-xs italic">
              Post gibt es nur an Land.
            </p>
          )}

          <h3 className="smallcaps text-ink-soft mb-2 text-[11px]">Gelesene Briefe</h3>
          {player.knowledge.read.length === 0 ? (
            <p className="text-ink-faint text-xs italic">Noch keine Nachricht erhalten.</p>
          ) : (
            <ul className="space-y-2">
              {[...player.knowledge.read].reverse().map((letter) => (
                <li key={letter.id} className="paper-slip torn-bottom px-3 py-2.5">
                  <p className="teletype text-[10px] text-black/60">
                    {ctx.portsById.get(letter.writtenIn)?.name ?? letter.writtenIn}, den{' '}
                    {clockText(letter.writtenAt)} Uhr
                  </p>
                  <p className="mt-1 text-[13px] leading-snug">
                    Die <span className="font-semibold">{letter.vehicleName}</span> liegt hier
                    {letter.sighting.bound
                      ? `, bestimmt nach ${ctx.portsById.get(letter.sighting.bound)?.name ?? ''}`
                      : ' und wartet auf Order'}
                    . {letter.sighting.cargo.length} Posten an Bord.
                  </p>
                  <p className="text-ink-soft mt-1 text-[11px] italic">— {letter.captain}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === 'notizbuch' && (
        <Notebook
          text={player.knowledge.notebook}
          limit={state.config.notebookLimit}
          onWrite={onWriteNote}
        />
      )}
    </Sheet>
  )
}

function VesselRow({
  ctx,
  state,
  player,
  vehicle,
  aboard,
  fog,
  now,
  canBoard,
  onBoard,
  onSendPigeon,
}: {
  ctx: EngineContext
  state: GameState
  player: PlayerState
  vehicle: VehicleInstance
  aboard: boolean
  fog: boolean
  now: number
  canBoard: boolean
  onBoard: () => void
  onSendPigeon: () => void
}) {
  const sighting = player.knowledge.sightings[vehicle.id]
  const believed = vehicle.unseen === true
  const where = ctx.portsById.get(vehicle.nodeId)?.name ?? 'auf See'
  const eta = arrivalOf(state, vehicle)

  return (
    <li className="paper-card rounded-md p-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold">
          {vehicle.name}
          {aboard && (
            <span className="smallcaps text-press ml-2 text-[9px]">Sie sind an Bord</span>
          )}
        </span>
        <span className="text-ink-faint text-[10px]">{vehicle.kind.name}</span>
      </div>

      {believed ? (
        <p className="text-ink-soft mt-0.5 text-[11px] italic">
          Zuletzt gemeldet: {where}
          {sighting?.bound &&
            `, bestimmt nach ${ctx.portsById.get(sighting.bound)?.name ?? ''}`}
          {sighting && ` · Stand ${clockText(sighting.asOf)} Uhr`}
        </p>
      ) : (
        <p className="text-ink-soft mt-0.5 text-[11px]">
          {vehicle.voyage
            ? `Unterwegs nach ${
                ctx.portsById.get(vehicle.voyage.destination)?.name ?? ''
              }${eta ? ` · Ankunft ${untilText(eta, now)}` : ''}`
            : `Liegt in ${where}`}
        </p>
      )}

      {vehicle.cargo.length > 0 && (
        <div className="mt-1.5">
          <CargoHold ctx={ctx} cargo={vehicle.cargo} vehicle={vehicle.kind} size={24} max={6} />
          {believed && (
            <p className="text-ink-faint text-[10px] italic">Ladung nach letzter Meldung.</p>
          )}
        </div>
      )}

      <div className="mt-2 flex gap-2">
        {canBoard && !aboard && (
          <button className="btn btn-sm text-[11px]" onClick={onBoard}>
            Übersteigen
          </button>
        )}
        {fog && !aboard && (
          <button className="btn btn-sm text-[11px]" onClick={onSendPigeon}>
            Taube schicken
          </button>
        )}
      </div>
    </li>
  )
}

function Notebook({
  text,
  limit,
  onWrite,
}: {
  text: string
  limit: number
  onWrite: (t: string) => void
}) {
  const [draft, setDraft] = useState(text)
  const dirty = draft !== text

  return (
    <div className="anim-fade">
      <p className="text-ink-soft mb-2 text-[11px] italic">
        Das Kontor führt kein Verzeichnis Ihrer Schiffe. Was Sie nicht aufschreiben, wissen Sie
        nicht mehr.
      </p>
      <textarea
        className="focusable paper-card teletype w-full resize-none rounded-md p-3 text-[12px] leading-relaxed outline-none"
        rows={10}
        maxLength={limit}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Stella II — 14:20 Lissabon, Order nach Dakar. Taube am 14:25."
        aria-label="Notizbuch"
      />
      <div className="mt-2 flex items-center justify-between gap-3">
        <span className="tnum text-ink-faint text-[10px]">
          {draft.length}/{limit}
        </span>
        <button className="btn btn-sm" disabled={!dirty} onClick={() => onWrite(draft)}>
          Eintragen
        </button>
      </div>
    </div>
  )
}
