import { useMemo, useState } from 'react'
import { Sheet, Tabs, type SheetSnap } from './Sheet'
import { CargoHold } from './Cargo'
import { clockText, untilText } from './useNow'
import { arrivalOf, fleetLimitNote, hasShipyard, portAt } from '@engine/selectors'
import { flagship, type GameState, type PlayerState, type VehicleInstance } from '@engine/state'
import type { EngineContext } from '@engine/context'
import { PLAYER_COLORS, playerLabel } from '@app/store'
import { useT } from '@app/locale'
import { named } from '@i18n/locale'
import { Emph } from './Emph'

type Tab = 'flotte' | 'post' | 'notizbuch'

/** A harbour by name, in the reader's language, falling back to its id. */
function portName(ctx: EngineContext, id: string, locale: 'de' | 'en'): string {
  const port = ctx.portsById.get(id)
  return port ? named(port)[locale] : id
}

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
  const { t, tn, num, locale } = useT()
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
      subtitle={[
        playerLabel(player),
        tn('fleet.subtitle.ships', player.fleet.length),
        ...(fog ? [tn('fleet.subtitle.mail', unread)] : []),
      ].join(' · ')}
      accent={colour.ink}
    >
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { id: 'flotte', label: t('fleet.tab.fleet'), badge: player.fleet.length },
          ...(fog
            ? ([
                { id: 'post', label: t('fleet.tab.mail'), badge: waitingHere },
                { id: 'notizbuch', label: t('fleet.tab.notebook') },
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
              <h3 className="smallcaps text-ink-soft mt-5 mb-2 text-[11px]">
                {t('fleet.yard')}
              </h3>
              {player.fleet.length >= state.config.maxFleetSize ? (
                <p className="text-ink-faint text-xs italic">
                  {t(...fleetLimitNote(state.config.maxFleetSize))}
                </p>
              ) : (
                <div className="space-y-2">
                  {ctx.pack.vehicles.map((kind) => {
                    const tooDear = player.cash < kind.price
                    return (
                      <button
                        key={kind.id}
                        className={`block w-full rounded-md p-2.5 text-left ${
                          tooDear ? 'card-dead' : 'paper-card'
                        }`}
                        disabled={tooDear}
                        onClick={() => onBuy(kind.id)}
                      >
                        <span className="flex items-baseline justify-between gap-2">
                          <span className="text-sm font-semibold">{kind.name[locale]}</span>
                          <span className="tnum text-sm">{num(kind.price)}</span>
                        </span>
                        <span className="text-ink-soft block text-[11px]">
                          {[
                            kind.blurb?.[locale],
                            t('fleet.yard.hold', { capacity: kind.capacity ?? '∞' }),
                            t(
                              kind.speedFactor < 1
                                ? 'fleet.yard.fast'
                                : kind.speedFactor > 1
                                  ? 'fleet.yard.slow'
                                  : 'fleet.yard.normal',
                            ),
                            ...(tooDear ? [t('fleet.yard.tooDear')] : []),
                          ]
                            .filter(Boolean)
                            .join(' · ')}
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
                {tn('fleet.mail.collect', waitingHere)}
              </button>
            ) : (
              <p className="text-ink-faint mb-4 text-xs italic">
                {t('fleet.mail.nothingHere', { port: portName(ctx, here.nodeId, locale) })}
              </p>
            )
          ) : (
            <p className="text-ink-faint mb-4 text-xs italic">{t('fleet.mail.ashoreOnly')}</p>
          )}

          <h3 className="smallcaps text-ink-soft mb-2 text-[11px]">{t('fleet.mail.read')}</h3>
          {player.knowledge.read.length === 0 ? (
            <p className="text-ink-faint text-xs italic">{t('fleet.mail.none')}</p>
          ) : (
            <ul className="space-y-2">
              {[...player.knowledge.read].reverse().map((letter) => (
                <li key={letter.id} className="paper-slip torn-bottom px-3 py-2.5">
                  <p className="teletype text-[10px] text-black/60">
                    {t('fleet.mail.dateline', {
                      port: portName(ctx, letter.writtenIn, locale),
                      time: clockText(letter.writtenAt),
                    })}
                  </p>
                  <p className="mt-1 text-[13px] leading-snug">
                    <Emph
                      text={t('fleet.mail.body', {
                        ship: letter.vehicleName,
                        lots: letter.sighting.cargo.length,
                        bound: letter.sighting.bound
                          ? t('fleet.mail.bound', {
                              port: portName(ctx, letter.sighting.bound, locale),
                            })
                          : t('fleet.mail.awaitingOrders'),
                      })}
                    />
                  </p>
                  <p className="text-ink-soft mt-1 text-[11px] italic">— {letter.captain[locale]}</p>
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
  const { t, locale } = useT()
  const sighting = player.knowledge.sightings[vehicle.id]
  const believed = vehicle.unseen === true
  const where = ctx.portsById.get(vehicle.nodeId)
    ? portName(ctx, vehicle.nodeId, locale)
    : t('fleet.atSea')
  const eta = arrivalOf(ctx, state, vehicle)

  return (
    <li className="paper-card rounded-md p-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold">
          {vehicle.name}
          {aboard && (
            <span className="smallcaps text-press ml-2 text-[9px]">{t('fleet.aboard')}</span>
          )}
        </span>
        <span className="text-ink-faint text-[10px]">{vehicle.kind.name[locale]}</span>
      </div>

      {believed ? (
        <p className="text-ink-soft mt-0.5 text-[11px] italic">
          {t('fleet.lastReported', { where })}
          {sighting?.bound &&
            t('fleet.mail.bound', { port: portName(ctx, sighting.bound, locale) })}
          {sighting && t('fleet.asOf', { time: clockText(sighting.asOf) })}
        </p>
      ) : (
        <p className="text-ink-soft mt-0.5 text-[11px]">
          {vehicle.voyage
            ? t('fleet.boundFor', {
                port: portName(ctx, vehicle.voyage.destination, locale),
              }) + (eta ? t('fleet.arriving', { when: untilText(eta, now) }) : '')
            : t('fleet.lyingIn', { port: where })}
        </p>
      )}

      {vehicle.cargo.length > 0 && (
        <div className="mt-1.5">
          <CargoHold ctx={ctx} cargo={vehicle.cargo} vehicle={vehicle.kind} size={24} max={6} />
          {believed && (
            <p className="text-ink-faint text-[10px] italic">{t('fleet.cargoAsReported')}</p>
          )}
        </div>
      )}

      <div className="mt-2 flex gap-2">
        {canBoard && !aboard && (
          <button className="btn btn-sm text-[11px]" onClick={onBoard}>
            {t('fleet.board')}
          </button>
        )}
        {fog && !aboard && (
          <button className="btn btn-sm text-[11px]" onClick={onSendPigeon}>
            {t('fleet.sendPigeon')}
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
  const { t } = useT()
  const [draft, setDraft] = useState(text)
  const dirty = draft !== text

  return (
    <div className="anim-fade">
      <p className="text-ink-soft mb-2 text-[11px] italic">{t('fleet.notebook.note')}</p>
      <textarea
        className="focusable paper-card teletype w-full resize-none rounded-md p-3 text-[12px] leading-relaxed outline-none"
        rows={10}
        maxLength={limit}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={t('fleet.notebook.placeholder')}
        aria-label={t('fleet.notebook.label')}
      />
      <div className="mt-2 flex items-center justify-between gap-3">
        <span className="tnum text-ink-faint text-[10px]">
          {draft.length}/{limit}
        </span>
        <button className="btn btn-sm" disabled={!dirty} onClick={() => onWrite(draft)}>
          {t('fleet.notebook.save')}
        </button>
      </div>
    </div>
  )
}
