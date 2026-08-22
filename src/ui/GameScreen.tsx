import { useEffect, useMemo, useState } from 'react'
import { Board } from './Board'
import { PortSheet, MarketReport } from './PortPanel'
import { KonjunkturSlip } from './Cards'
import { Portrait } from './Portrait'
import { PlayerHUD, RoundPill, useCountUp } from './PlayerHUD'
import { Die } from './Dice'
import { CargoHold } from './Cargo'
import { Sheet, Tabs, type SheetSnap } from './Sheet'
import { formatMoney, PLAYER_COLORS, useGame, type LogLine } from '@app/store'
import { legalSteps, marketReport, portAt, standings } from '@engine/selectors'
import { cargoValue, netWorth, type GameState, type PlayerState } from '@engine/state'
import type { EngineContext } from '@engine/context'

type SheetKind = 'port' | 'kontor' | 'runde' | 'konjunktur' | 'ende' | null

export function GameScreen() {
  const ctx = useGame((s) => s.ctx)
  const state = useGame((s) => s.state)!
  const dispatch = useGame((s) => s.dispatch)
  const notice = useGame((s) => s.notice)
  const dismiss = useGame((s) => s.dismissNotice)
  const log = useGame((s) => s.log)
  const abandon = useGame((s) => s.abandon)

  const player = state.players[state.activeIndex]!
  const portId = portAt(ctx, player.ship.nodeId)
  const targets = state.phase === 'move' ? legalSteps(ctx, player) : []

  const [kind, setKind] = useState<SheetKind>(null)
  const [snap, setSnap] = useState<SheetSnap>('peek')

  // The harbour opens itself; everything else waits to be asked for.
  useEffect(() => {
    if (state.phase === 'port') {
      setKind('port')
      setSnap('peek')
    } else if (state.phase === 'konjunktur') {
      setKind('konjunktur')
      setSnap('peek')
    } else if (state.phase === 'over') {
      setKind('ende')
      setSnap('full')
    } else {
      setKind(null)
    }
  }, [state.phase, state.activeIndex])

  useEffect(() => {
    if (!notice) return
    const t = setTimeout(dismiss, 4200)
    return () => clearTimeout(t)
  }, [notice, dismiss])

  const open = (k: SheetKind) => {
    setKind(k)
    setSnap('peek')
  }
  const close = (s: SheetSnap) => {
    if (s === 'closed') setKind(null)
    else setSnap(s)
  }

  const highlights = useMemo(
    () => marketReport(ctx, player, 5).map((d) => d.portId),
    [ctx, player],
  )

  return (
    <div className="relative h-full w-full overflow-hidden">
      <Board
        ctx={ctx}
        state={state}
        legalTargets={targets}
        onPick={(to) => dispatch({ type: 'step', to })}
        focusNode={player.ship.nodeId}
        highlightPorts={state.phase === 'move' ? [] : highlights}
      />

      {/* Kopfzeile */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-2 px-3"
        style={{ paddingTop: 'calc(var(--safe-t) + 0.6rem)' }}
      >
        <PlayerHUD
          ctx={ctx}
          player={player}
          cargoCount={player.cargo.length}
          purchasesLeft={
            state.phase === 'port'
              ? state.config.maxPurchasesPerPort - player.purchasesThisVisit.length
              : null
          }
          onOpen={() => open('kontor')}
        />
        <RoundPill
          round={state.round}
          total={state.config.totalRounds}
          red={state.config.redFields.includes(state.round)}
          onOpen={() => open('runde')}
        />
      </div>

      <ActionBar
        state={state}
        hidden={kind !== null && snap === 'full'}
        onRoll={() => dispatch({ type: 'roll' })}
        onEnd={() => dispatch({ type: 'endTurn' })}
        onOpenPort={() => open('port')}
        onDraw={() => dispatch({ type: 'drawKonjunktur' })}
      />

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

      {kind === 'runde' && (
        <RoundSheet state={state} snap={snap} onSnap={close} onAbandon={abandon} />
      )}

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
        <button className="btn px-8 py-3 text-base shadow-xl" onClick={onOpenPort}>
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
      title={player.persona.house}
      subtitle={`${player.persona.rank} aus ${player.persona.origin}`}
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
            Laderaum · {player.vehicle.name}
          </h3>
          <CargoHold ctx={ctx} cargo={player.cargo} vehicle={player.vehicle} size={38} />
          {player.cargo.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-[12px]">
              {player.cargo.map((c) => (
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

      {tab === 'wohin' && <MarketReport report={report} cargo={player.cargo.length} />}

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
              <p className="text-ink-soft truncate text-[11px]">{row.player.persona.house}</p>
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
