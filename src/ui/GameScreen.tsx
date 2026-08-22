import { useEffect, useMemo, useRef, useState } from 'react'
import { Board } from './Board'
import { PortSheet, MarketReport } from './PortPanel'
import { KonjunkturSlip } from './Cards'
import { Portrait } from './Portrait'
import { PlayerHUD, RoundPill, useCountUp } from './PlayerHUD'
import { Die } from './Dice'
import { CargoHold } from './Cargo'
import { Sheet, Tabs, type SheetSnap } from './Sheet'
import { FleetSheet } from './FleetSheet'
import { PigeonSheet } from './PigeonSheet'
import { formatMoney, PLAYER_COLORS, playerLabel, useGame, type LogLine } from '@app/store'
import { arrivalAt, legalSteps, marketReport, portAt, standings } from '@engine/selectors'
import {
  cargoValue,
  flagship,
  netWorth,
  type GameState,
  type PlayerState,
} from '@engine/state'
import type { EngineContext } from '@engine/context'
import { clockText, durationText, untilText, useNow } from './useNow'
import { PLAYER_COLORS as COLORS } from '@app/store'

type SheetKind = 'port' | 'kontor' | 'runde' | 'konjunktur' | 'ende' | 'flotte' | 'taube' | null

export function GameScreen() {
  const ctx = useGame((s) => s.ctx)
  const state = useGame((s) => s.state)!
  const dispatch = useGame((s) => s.dispatch)
  const notice = useGame((s) => s.notice)
  const dismiss = useGame((s) => s.dismissNotice)
  const log = useGame((s) => s.log)
  const abandon = useGame((s) => s.abandon)

  const acting = useGame((s) => s.acting())
  const setActing = useGame((s) => s.setActing)
  const net = useGame((s) => s.net)

  const realtime = state.config.travel === 'echtzeit'
  const now = useNow(1000, realtime)

  // Round play follows the turn; real-time play follows whoever this device
  // is commanding.
  const player = (realtime ? acting : state.players[state.activeIndex]) ?? state.players[0]!
  const voyage = flagship(player).voyage ?? null
  const portId = voyage ? null : portAt(ctx, flagship(player).nodeId)
  const targets = state.phase === 'move' ? legalSteps(ctx, player) : []

  const [kind, setKind] = useState<SheetKind>(null)
  const [snap, setSnap] = useState<SheetSnap>('peek')
  const [pigeonFor, setPigeonFor] = useState<string | null>(null)
  const [greeting, setGreeting] = useState(true)

  /**
   * A new harbour under the keel, or the wheel in somebody else's hands: the
   * Makler comes aboard before the ledgers do. Kept out here rather than in
   * the sheet so that closing and reopening it mid-visit does not repeat the
   * welcome.
   */
  useEffect(() => {
    setGreeting(portId !== null)
  }, [portId, player.id])

  // The harbour opens itself; everything else waits to be asked for.
  useEffect(() => {
    if (realtime) {
      // The plan stays uncovered unless something is asked for; arriving in
      // harbour offers a button rather than taking over the screen.
      if (state.phase === 'over') {
        setKind('ende')
        setSnap('full')
      } else if (!portId) {
        setKind((k) => (k === 'port' ? null : k))
      }
      return
    }
    if (state.phase === 'port') {
      setKind('port')
      setSnap('full')
    } else if (state.phase === 'konjunktur') {
      setKind('konjunktur')
      setSnap('peek')
    } else if (state.phase === 'over') {
      setKind('ende')
      setSnap('full')
    } else {
      setKind(null)
    }
  }, [state.phase, state.activeIndex, realtime, portId])

  useEffect(() => {
    if (!notice) return
    const t = setTimeout(dismiss, 4200)
    return () => clearTimeout(t)
  }, [notice, dismiss])

  const open = (k: SheetKind) => {
    setKind(k)
    // Buying and selling wants the whole sheet; the rest is a glance.
    setSnap(k === 'port' ? 'full' : 'peek')
  }
  const close = (s: SheetSnap) => {
    if (s === 'closed') setKind(null)
    else setSnap(s)
  }

  const highlights = useMemo(
    () => marketReport(ctx, player, 5).map((d) => d.portId),
    [ctx, player],
  )

  // Recentre the plan whenever the turn passes or another ship takes the helm,
  // so nobody has to go looking for their own vessel.
  const focusKey = realtime
    ? `${player.id}:${portId ?? 'see'}`
    : `${state.round}:${state.activeIndex}`
  const focusNonce = useFocusNonce(focusKey)

  const waitingMail = portId ? (player.knowledge.waiting[flagship(player).nodeId] ?? []).length : 0

  return (
    <div className="relative h-full w-full overflow-hidden">
      <Board
        ctx={ctx}
        state={state}
        legalTargets={targets}
        onPick={(to) => dispatch({ type: 'step', to })}
        focusNode={flagship(player).nodeId}
        highlightPorts={state.phase === 'move' ? [] : highlights}
        now={now}
        focusNonce={focusNonce}
        course={voyage ? [flagship(player).nodeId, ...voyage.route] : []}
        {...(realtime && portId
          ? { onPickPort: (to: string) => to !== portId && dispatch({ type: 'setCourse', to }) }
          : {})}
      />

      {/* Kopfzeile */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-2 px-3"
        style={{ paddingTop: 'calc(var(--safe-t) + 0.6rem)' }}
      >
        <PlayerHUD
          ctx={ctx}
          player={player}
          cargoCount={flagship(player).cargo.length}
          purchasesLeft={
            state.phase === 'port'
              ? state.config.maxPurchasesPerPort - flagship(player).purchasesThisVisit.length
              : null
          }
          onOpen={() => open('kontor')}
        />
        <FleetPill
          count={player.fleet.length}
          waiting={waitingMail}
          onOpen={() => open('flotte')}
        />
        {realtime ? (
          <ClockPill state={state} now={now} onOpen={() => open('runde')} />
        ) : (
          <RoundPill
            round={state.round}
            total={state.config.totalRounds}
            red={state.config.redFields.includes(state.round)}
            onOpen={() => open('runde')}
          />
        )}
      </div>

      {realtime ? (
        <RealtimeBar
          ctx={ctx}
          state={state}
          player={player}
          now={now}
          hidden={kind !== null}
          onOpenPort={() => open('port')}
        />
      ) : (
        <ActionBar
          state={state}
          hidden={kind !== null}
          onRoll={() => dispatch({ type: 'roll' })}
          onEnd={() => dispatch({ type: 'endTurn' })}
          onOpenPort={() => open('port')}
          onDraw={() => dispatch({ type: 'drawKonjunktur' })}
        />
      )}

      {realtime && !net && kind === null && state.players.length > 1 && (
        <HelmSwitcher players={state.players} current={player.id} onPick={setActing} />
      )}

      {notice && (
        <div className="pointer-events-none absolute inset-x-0 bottom-32 z-40 flex justify-center px-4">
          <p className="paper-card text-rot anim-rise max-w-md rounded-sm px-3 py-2 text-center text-sm shadow-lg">
            {notice}
          </p>
        </div>
      )}

      {kind === 'port' && portId && (
        <PortSheet
          ctx={ctx}
          state={state}
          player={player}
          portId={portId}
          snap={snap}
          onSnap={close}
          onBuy={(goodId) => dispatch({ type: 'buy', goodId })}
          onSell={(uid) => dispatch({ type: 'sell', uid })}
          onLeave={() => dispatch({ type: 'endTurn' })}
          greeting={greeting}
          onEnter={() => setGreeting(false)}
        />
      )}

      {kind === 'flotte' && (
        <FleetSheet
          ctx={ctx}
          state={state}
          player={player}
          now={now}
          snap={snap}
          onSnap={close}
          onBoard={(vehicleId) => dispatch({ type: 'boardVehicle', vehicleId })}
          onBuy={(kindId) => dispatch({ type: 'buyVehicle', kindId })}
          onSendPigeon={(vehicleId) => {
            setPigeonFor(vehicleId)
            setKind('taube')
            setSnap('full')
          }}
          onCollectMail={() => dispatch({ type: 'collectMail' })}
          onWriteNote={(text) => dispatch({ type: 'writeNote', text })}
        />
      )}

      {kind === 'taube' && pigeonFor && (
        <PigeonSheet
          ctx={ctx}
          state={state}
          player={player}
          vehicleId={pigeonFor}
          snap={snap}
          onSnap={close}
          onSend={(toPort, destination, replyTo) => {
            dispatch({ type: 'sendPigeon', vehicleId: pigeonFor, toPort, destination, replyTo })
            setPigeonFor(null)
            setKind('flotte')
            setSnap('peek')
          }}
        />
      )}

      {kind === 'kontor' && (
        <KontorSheet
          ctx={ctx}
          state={state}
          player={player}
          log={log}
          snap={snap}
          onSnap={close}
        />
      )}

      {kind === 'runde' &&
        (realtime ? (
          <SeasonSheet
            ctx={ctx}
            state={state}
            now={now}
            snap={snap}
            onSnap={close}
            onAbandon={abandon}
          />
        ) : (
          <RoundSheet state={state} snap={snap} onSnap={close} onAbandon={abandon} />
        ))}

      {kind === 'konjunktur' && (
        <KonjunkturSheet
          ctx={ctx}
          state={state}
          snap={snap}
          onSnap={close}
          onDraw={() => dispatch({ type: 'drawKonjunktur' })}
        />
      )}

      {kind === 'ende' && (
        <FinalSheet state={state} snap={snap} onSnap={close} onNew={abandon} />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------

/** The house's own affairs, and any letters lying at this quay. */
function FleetPill({
  count,
  waiting,
  onOpen,
}: {
  count: number
  waiting: number
  onOpen: () => void
}) {
  return (
    <button
      onClick={onOpen}
      className="paper anim-rise pointer-events-auto relative flex items-center gap-1.5 rounded-lg px-3 py-1.5 shadow-lg"
      aria-label={`Flotte: ${count} Schiffe${waiting > 0 ? `, ${waiting} Briefe` : ''}`}
    >
      <span className="text-base leading-none" aria-hidden>
        ⚓
      </span>
      <span className="tnum text-base leading-none font-bold">{count}</span>
      {waiting > 0 && (
        <span className="bg-rot absolute -top-1 -right-1 grid h-4 min-w-4 place-items-center rounded-full px-1 text-[9px] font-bold text-white">
          {waiting}
        </span>
      )}
    </button>
  )
}

/** Counts up whenever the key changes, to trigger a one-off camera move. */
function useFocusNonce(key: string): number {
  const [nonce, setNonce] = useState(0)
  const previous = useRef(key)
  useEffect(() => {
    if (previous.current !== key) {
      previous.current = key
      setNonce((n) => n + 1)
    }
  }, [key])
  return nonce
}

function ActionBar({
  state,
  hidden,
  onRoll,
  onEnd,
  onOpenPort,
  onDraw,
}: {
  state: GameState
  hidden: boolean
  onRoll: () => void
  onEnd: () => void
  onOpenPort: () => void
  onDraw: () => void
}) {
  if (hidden) return null

  const wrap = (children: React.ReactNode) => (
    <div
      className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center px-4 lg:right-[400px]"
      style={{ paddingBottom: 'calc(var(--safe-b) + 1rem)' }}
    >
      <div className="pointer-events-auto anim-rise">{children}</div>
    </div>
  )

  switch (state.phase) {
    case 'roll':
      return wrap(
        <button className="btn btn-primary px-10 py-3 text-lg shadow-xl" onClick={onRoll}>
          Würfeln
        </button>,
      )

    case 'move':
      return wrap(
        <div className="paper flex items-center gap-3 rounded-xl px-3 py-2 shadow-xl">
          <Die value={state.movement?.rolled ?? 1} size={44} />
          <div className="pr-1">
            <p className="tnum text-lg leading-none font-bold">
              noch {state.movement?.remaining}
            </p>
            <p className="text-ink-soft text-[11px]">grünen Punkt antippen</p>
          </div>
        </div>,
      )

    case 'endOfTurn':
      return wrap(
        <button className="btn btn-primary px-8 py-3 text-base shadow-xl" onClick={onEnd}>
          Zug beenden
        </button>,
      )

    case 'port':
      return wrap(
        <button className="btn btn-primary px-8 py-3 text-base shadow-xl" onClick={onOpenPort}>
          Hafen öffnen
        </button>,
      )

    case 'konjunktur':
      return wrap(
        <button className="btn btn-danger px-8 py-3 text-base shadow-xl" onClick={onDraw}>
          Konjunkturkarte abheben
        </button>,
      )

    default:
      return null
  }
}

/** Time left in the season, and what the world market is doing. */
function ClockPill({
  state,
  now,
  onOpen,
}: {
  state: GameState
  now: number
  onOpen: () => void
}) {
  const left = state.endsAt - now
  const closing = left < 15 * 60_000
  return (
    <button
      onClick={onOpen}
      className={`paper anim-rise pointer-events-auto flex items-center gap-2 rounded-lg px-3 py-1.5 shadow-lg ${
        closing ? 'text-rot' : ''
      }`}
      aria-label={`Noch ${durationText(left)} Saison`}
    >
      <span className="smallcaps text-[10px]">Saison</span>
      <span className="tnum text-base leading-none font-bold">{durationText(left)}</span>
      {state.saleModifierPercent !== 0 && (
        <span
          className={`tnum text-[11px] font-bold ${
            state.saleModifierPercent > 0 ? 'text-press' : 'text-rot'
          }`}
        >
          {state.saleModifierPercent > 0 ? '+' : '−'}
          {Math.abs(state.saleModifierPercent)}%
        </span>
      )}
    </button>
  )
}

/** What the commanded ship is doing right now, and the one thing to do next. */
function RealtimeBar({
  ctx,
  state,
  player,
  now,
  hidden,
  onOpenPort,
}: {
  ctx: EngineContext
  state: GameState
  player: PlayerState
  now: number
  hidden: boolean
  onOpenPort: () => void
}) {
  if (hidden || state.phase === 'over') return null

  const voyage = flagship(player).voyage ?? null
  const wrap = (children: React.ReactNode) => (
    <div
      className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center px-4 lg:right-[400px]"
      style={{ paddingBottom: 'calc(var(--safe-b) + 1rem)' }}
    >
      <div className="pointer-events-auto anim-rise">{children}</div>
    </div>
  )

  if (voyage) {
    const eta = arrivalAt(state, player) ?? now
    const destination = ctx.portsById.get(voyage.destination)?.name ?? voyage.destination
    return wrap(
      <div className="paper flex items-center gap-3 rounded-xl px-4 py-2.5 shadow-xl">
        <span className="text-2xl" aria-hidden>
          ⛴
        </span>
        <div>
          <p className="text-sm leading-tight font-semibold">Kurs auf {destination}</p>
          <p className="text-ink-soft text-[11px]">
            Ankunft {untilText(eta, now)} · {clockText(eta)} Uhr
          </p>
        </div>
      </div>,
    )
  }

  return wrap(
    <div className="paper flex items-center gap-3 rounded-xl px-3 py-2 shadow-xl">
      <button className="btn btn-primary" onClick={onOpenPort}>
        Hafen
      </button>
      <p className="text-ink-soft max-w-[10rem] text-[11px] leading-snug">
        Einen Hafen auf dem Plan antippen, um Kurs zu setzen.
      </p>
    </div>,
  )
}

/** Local real-time games command several ships from one device. */
function HelmSwitcher({
  players,
  current,
  onPick,
}: {
  players: readonly PlayerState[]
  current: string
  onPick: (id: string) => void
}) {
  return (
    <div
      className="pointer-events-none absolute inset-x-0 z-20 flex justify-center px-4"
      style={{ bottom: 'calc(var(--safe-b) + 5.5rem)' }}
    >
      <div className="paper pointer-events-auto flex gap-1 rounded-full px-1.5 py-1 shadow-lg">
        {players.map((p) => {
          const color = COLORS[p.colorIndex % COLORS.length]!
          const active = p.id === current
          return (
            <button
              key={p.id}
              onClick={() => onPick(p.id)}
              className={`btn-sm rounded-full px-2.5 text-[11px] ${
                active ? 'text-white' : 'text-ink-soft'
              }`}
              style={active ? { background: color.ink } : undefined}
              aria-pressed={active}
            >
              {p.name}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function SeasonSheet({
  ctx,
  state,
  now,
  snap,
  onSnap,
  onAbandon,
}: {
  ctx: EngineContext
  state: GameState
  now: number
  snap: SheetSnap
  onSnap: (s: SheetSnap) => void
  onAbandon: () => void
}) {
  const card = state.marketCardId ? ctx.cardsById.get(state.marketCardId) : null
  const nextTurn = state.marketSince + state.config.realtime.marketIntervalMinutes * 60_000

  return (
    <Sheet
      snap={snap}
      onSnap={onSnap}
      title="Die Saison"
      subtitle={`Schluß ${clockText(state.endsAt)} Uhr · noch ${durationText(state.endsAt - now)}`}
    >
      <h3 className="smallcaps text-ink-soft mb-2 text-[11px]">Weltmarkt</h3>
      {card ? (
        <KonjunkturSlip card={card} />
      ) : (
        <p className="text-ink-faint text-xs italic">
          Noch keine Notierung. Die erste Karte fällt {untilText(nextTurn, now)}.
        </p>
      )}
      <p className="text-ink-soft mt-3 text-center text-[11px]">
        Nächste Notierung {untilText(nextTurn, now)}
      </p>

      <h3 className="smallcaps text-ink-soft mt-5 mb-2 text-[11px]">Die Flotte</h3>
      <ul className="space-y-1.5 text-[12px]">
        {state.players.map((p) => {
          const color = COLORS[p.colorIndex % COLORS.length]!
          const eta = arrivalAt(state, p)
          const ship = flagship(p)
          const where = ship.voyage
            ? `unterwegs nach ${ctx.portsById.get(ship.voyage.destination)?.name ?? ''}`
            : `liegt in ${ctx.portsById.get(ship.nodeId)?.name ?? 'See'}`
          return (
            <li key={p.id} className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full border border-black/30"
                style={{ background: color.ink }}
              />
              <span className="min-w-0 flex-1 truncate">
                {p.name} — <span className="text-ink-soft">{where}</span>
              </span>
              {eta && <span className="tnum text-ink-faint">{untilText(eta, now)}</span>}
            </li>
          )
        })}
      </ul>

      <button className="btn btn-danger mt-6 w-full" onClick={onAbandon}>
        Partie verlassen
      </button>
    </Sheet>
  )
}

function KontorSheet({
  ctx,
  state,
  player,
  log,
  snap,
  onSnap,
}: {
  ctx: EngineContext
  state: GameState
  player: PlayerState
  log: LogLine[]
  snap: SheetSnap
  onSnap: (s: SheetSnap) => void
}) {
  const [tab, setTab] = useState<'kasse' | 'wohin' | 'journal'>('kasse')
  const color = PLAYER_COLORS[player.colorIndex % PLAYER_COLORS.length]!
  const worth = useCountUp(netWorth(player))
  const report = useMemo(() => marketReport(ctx, player, 6), [ctx, player])

  return (
    <Sheet
      snap={snap}
      onSnap={onSnap}
      title={player.name}
      subtitle={playerLabel(player)}
      accent={color.ink}
    >
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { id: 'kasse', label: 'Kasse' },
          { id: 'wohin', label: 'Wohin?' },
          { id: 'journal', label: 'Journal' },
        ]}
      />

      {tab === 'kasse' && (
        <div className="anim-fade">
          <dl className="teletype space-y-1 text-[13px]">
            <Row label="Barmittel" value={formatMoney(player.cash)} />
            <Row label="Warenwert" value={formatMoney(cargoValue(player))} />
            <hr className="rule my-1.5" />
            <Row label="Vermögen" value={formatMoney(worth)} strong />
          </dl>

          <h3 className="smallcaps text-ink-soft mt-4 mb-1.5 text-[11px]">
            Laderaum · {flagship(player).kind.name}
          </h3>
          <CargoHold ctx={ctx} cargo={flagship(player).cargo} vehicle={flagship(player).kind} size={38} />
          {flagship(player).cargo.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-[12px]">
              {flagship(player).cargo.map((c) => (
                <li key={c.uid} className="flex justify-between gap-2">
                  <span>{ctx.goodsById.get(c.goodId)?.name}</span>
                  <span className="tnum text-ink-soft">
                    {c.pricePaid.toLocaleString('de-DE')}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <h3 className="smallcaps text-ink-soft mt-4 mb-1.5 text-[11px]">Die Konkurrenz</h3>
          <ul className="space-y-1 text-[12px]">
            {state.players
              .filter((p) => p.id !== player.id)
              .map((p) => {
                const c = PLAYER_COLORS[p.colorIndex % PLAYER_COLORS.length]!
                return (
                  <li key={p.id} className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full border border-black/30"
                      style={{ background: c.ink }}
                    />
                    <span className="min-w-0 flex-1 truncate">{p.name}</span>
                    <span className="tnum text-ink-soft">
                      {netWorth(p).toLocaleString('de-DE')}
                    </span>
                  </li>
                )
              })}
          </ul>
        </div>
      )}

      {tab === 'wohin' && <MarketReport ctx={ctx} report={report} cargo={flagship(player).cargo.length} />}

      {tab === 'journal' && (
        <ul className="anim-fade space-y-1.5 text-[12px] leading-snug">
          {log.slice(0, 60).map((line) => (
            <li
              key={line.id}
              className={
                line.tone === 'gut'
                  ? 'text-press'
                  : line.tone === 'schlecht'
                    ? 'text-rot'
                    : line.tone === 'wichtig'
                      ? 'font-semibold'
                      : 'text-ink-soft'
              }
            >
              {line.text}
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  )
}

function RoundSheet({
  state,
  snap,
  onSnap,
  onAbandon,
}: {
  state: GameState
  snap: SheetSnap
  onSnap: (s: SheetSnap) => void
  onAbandon: () => void
}) {
  return (
    <Sheet
      snap={snap}
      onSnap={onSnap}
      title={`Runde ${state.round}`}
      subtitle={`von ${state.config.totalRounds} · rote Felder bringen die Konjunktur ins Spiel`}
    >
      <div className="flex flex-wrap gap-1">
        {Array.from({ length: state.config.totalRounds }, (_, i) => {
          const n = i + 1
          const red = state.config.redFields.includes(n)
          const now = state.round === n
          const past = state.round > n
          return (
            <span
              key={n}
              className={`tnum grid h-7 w-7 place-items-center rounded-[2px] border text-[11px] ${
                red ? 'bg-rot border-black/30 text-white' : 'border-black/15 bg-white/50'
              } ${past ? 'opacity-40' : ''} ${now ? 'ring-ink ring-2 ring-offset-1' : ''}`}
            >
              {n}
            </span>
          )
        })}
      </div>
      <button className="btn btn-danger mt-6 w-full" onClick={onAbandon}>
        Partie aufgeben
      </button>
    </Sheet>
  )
}

function KonjunkturSheet({
  ctx,
  state,
  snap,
  onSnap,
  onDraw,
}: {
  ctx: EngineContext
  state: GameState
  snap: SheetSnap
  onSnap: (s: SheetSnap) => void
  onDraw: () => void
}) {
  const card = state.pendingCard ? ctx.cardsById.get(state.pendingCard.cardId) : null
  return (
    <Sheet
      snap={snap}
      onSnap={onSnap}
      title="Rotes Feld"
      subtitle="Vor dem Verkauf ist eine Karte abzuheben"
      footer={
        !card ? (
          <button className="btn btn-primary w-full" onClick={onDraw}>
            Karte abheben
          </button>
        ) : undefined
      }
    >
      {card ? (
        <div className="anim-deal">
          <KonjunkturSlip card={card} />
        </div>
      ) : (
        <div className="paper-slip mx-auto grid h-36 w-60 place-items-center rounded-[2px] shadow-md">
          <span className="smallcaps text-xs tracking-[0.3em] text-black/40">Konjunktur</span>
        </div>
      )}
    </Sheet>
  )
}

function FinalSheet({
  state,
  snap,
  onSnap,
  onNew,
}: {
  state: GameState
  snap: SheetSnap
  onSnap: (s: SheetSnap) => void
  onNew: () => void
}) {
  const table = useMemo(() => standings(state), [state])
  return (
    <Sheet
      snap={snap}
      onSnap={onSnap}
      title="Schlußabrechnung"
      subtitle="Wer hat den Handel gemacht?"
      footer={
        <button className="btn btn-primary w-full" onClick={onNew}>
          Neue Partie
        </button>
      }
    >
      <ol className="stagger space-y-2">
        {table.map((row) => (
          <li key={row.player.id} className="paper-card flex items-center gap-3 rounded-sm p-2.5">
            <span className="display w-6 text-center text-xl">{row.rank}</span>
            <Portrait traits={row.player.persona.portrait} size={40} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{row.player.name}</p>
              <p className="text-ink-soft truncate text-[11px]">{playerLabel(row.player)}</p>
            </div>
            <span className="tnum text-sm font-bold">{formatMoney(row.worth)}</span>
          </li>
        ))}
      </ol>
    </Sheet>
  )
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="smallcaps text-ink-soft">{label}</dt>
      <dd className={`tnum ${strong ? 'font-bold' : ''}`}>{value}</dd>
    </div>
  )
}
