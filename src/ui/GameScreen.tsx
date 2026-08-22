import { useEffect, useMemo, useRef, useState } from 'react'
import { Board } from './Board'
import { PortPanel } from './PortPanel'
import { KonjunkturSlip } from './Cards'
import { Portrait } from './Portrait'
import { formatMoney, PLAYER_COLORS, useGame, type LogLine } from '@app/store'
import { legalSteps, portAt, standings } from '@engine/selectors'
import { cargoValue, netWorth, type GameState, type PlayerState } from '@engine/state'
import type { EngineContext } from '@engine/context'

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
  const [sheetOpen, setSheetOpen] = useState(true)

  useEffect(() => {
    if (state.phase === 'port' || state.phase === 'konjunktur') setSheetOpen(true)
  }, [state.phase, state.activeIndex])

  useEffect(() => {
    if (!notice) return
    const t = setTimeout(dismiss, 4200)
    return () => clearTimeout(t)
  }, [notice, dismiss])

  return (
    <div className="flex h-full flex-col lg:flex-row">
      {/* Plan */}
      <div className="relative min-h-0 flex-1">
        <RoundTrack state={state} />
        <Board
          ctx={ctx}
          state={state}
          legalTargets={targets}
          onPick={(to) => dispatch({ type: 'step', to })}
          focusNode={player.ship.nodeId}
        />

        <TurnBanner state={state} player={player} />

        {notice && (
          <div className="pointer-events-none absolute inset-x-0 bottom-24 flex justify-center px-4 lg:bottom-6">
            <p className="paper-card text-rot max-w-md rounded-sm px-3 py-2 text-center text-sm shadow-lg">
              {notice}
            </p>
          </div>
        )}
      </div>

      {/* Kontor */}
      <aside
        className={`paper relative z-10 flex shrink-0 flex-col border-black/20 lg:w-[380px] lg:border-l ${
          sheetOpen ? 'h-[58%] border-t lg:h-auto' : 'h-auto border-t lg:h-auto'
        }`}
      >
        <button
          className="text-ink-soft flex w-full items-center justify-center gap-2 py-1 text-xs lg:hidden"
          onClick={() => setSheetOpen((o) => !o)}
          aria-label={sheetOpen ? 'Kontor einklappen' : 'Kontor aufklappen'}
        >
          <span className="block h-1 w-10 rounded-full bg-black/25" />
        </button>

        <div
          className={`min-h-0 flex-1 flex-col ${sheetOpen ? 'flex' : 'hidden lg:flex'}`}
        >
            {state.phase === 'over' ? (
              <FinalReckoning ctx={ctx} state={state} onNew={abandon} />
            ) : state.phase === 'konjunktur' ? (
              <KonjunkturStep state={state} ctx={ctx} onDraw={() => dispatch({ type: 'drawKonjunktur' })} />
            ) : portId && state.phase === 'port' ? (
              <>
                <PendingCardStrip ctx={ctx} state={state} />
                <PortPanel
                  ctx={ctx}
                  state={state}
                  player={player}
                  portId={portId}
                  onBuy={(goodId) => dispatch({ type: 'buy', goodId })}
                  onSell={(uid) => dispatch({ type: 'sell', uid })}
                  onLeave={() => dispatch({ type: 'endTurn' })}
                />
              </>
            ) : (
              <AtSeaPanel
                ctx={ctx}
                state={state}
                player={player}
                onRoll={() => dispatch({ type: 'roll' })}
                onEnd={() => dispatch({ type: 'endTurn' })}
              />
            )}
        </div>

        <LogStrip log={log} />
      </aside>
    </div>
  )
}

// ---------------------------------------------------------------------------

function TurnBanner({ state, player }: { state: GameState; player: PlayerState }) {
  const color = PLAYER_COLORS[player.colorIndex % PLAYER_COLORS.length]!
  const hint =
    state.phase === 'roll'
      ? 'Würfeln Sie.'
      : state.phase === 'move'
        ? `Noch ${state.movement?.remaining ?? 0} Punkte — wählen Sie die Linie.`
        : state.phase === 'konjunktur'
          ? 'Rotes Feld: Konjunkturkarte abheben.'
          : state.phase === 'port'
            ? 'Kaufen, verkaufen, ablegen.'
            : state.phase === 'endOfTurn'
              ? 'Auf freier See.'
              : ''

  return (
    <div className="paper absolute top-9 left-3 flex max-w-[70%] items-center gap-2.5 rounded-sm px-3 py-2 shadow-lg">
      <Portrait traits={player.persona.portrait} size={38} />
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 text-sm leading-tight font-semibold">
          <span
            className="inline-block h-2.5 w-2.5 shrink-0 rounded-full border border-black/30"
            style={{ background: color.ink }}
          />
          <span className="truncate">{player.name}</span>
        </p>
        <p className="text-ink-soft truncate text-[11px]">{hint}</p>
      </div>
      <div className="border-ink-soft/30 ml-1 shrink-0 border-l pl-2.5 text-right">
        <p className="tnum text-sm leading-tight font-semibold">
          {player.cash.toLocaleString('de-DE')}
        </p>
        <p className="smallcaps text-ink-faint text-[9px]">Barmittel</p>
      </div>
    </div>
  )
}

function RoundTrack({ state }: { state: GameState }) {
  const ref = useRef<HTMLDivElement | null>(null)
  const total = state.config.totalRounds

  useEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>('[data-current="true"]')
    el?.scrollIntoView?.({ block: 'nearest', inline: 'center', behavior: 'smooth' })
  }, [state.round])

  return (
    <div
      ref={ref}
      className="paper absolute inset-x-0 top-0 z-10 flex gap-px overflow-x-auto border-b border-black/25 px-1 py-0.5"
    >
      {Array.from({ length: total }, (_, i) => {
        const n = i + 1
        const red = state.config.redFields.includes(n)
        const now = state.round === n
        return (
          <span
            key={n}
            data-current={now}
            className={`tnum grid h-5 min-w-[22px] shrink-0 place-items-center rounded-[1px] border text-[10px] ${
              red
                ? 'border-black/30 bg-rot text-white'
                : 'border-black/15 bg-white/40 text-ink-soft'
            } ${now ? 'ring-2 ring-offset-1 ring-ink outline-none' : ''}`}
            title={red ? `Runde ${n} — rotes Feld` : `Runde ${n}`}
          >
            {n}
          </span>
        )
      })}
    </div>
  )
}

function AtSeaPanel({
  ctx,
  state,
  player,
  onRoll,
  onEnd,
}: {
  ctx: EngineContext
  state: GameState
  player: PlayerState
  onRoll: () => void
  onEnd: () => void
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="px-4 pt-4">
        <p className="smallcaps text-ink-soft text-[10px]">Auf See</p>
        <h2 className="display letterpress text-2xl leading-tight">{player.persona.house}</h2>
        <p className="text-ink-soft text-xs italic">
          {player.persona.rank} aus {player.persona.origin}
        </p>
        <hr className="rule-double mt-3" />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4">
        <Ledger ctx={ctx} state={state} player={player} />
      </div>

      <div className="border-t border-black/15 px-4 py-3">
        {state.phase === 'roll' && (
          <button className="btn btn-primary w-full text-lg" onClick={onRoll}>
            Würfeln
          </button>
        )}
        {state.phase === 'move' && (
          <div className="text-center">
            <p className="display text-4xl leading-none">{state.movement?.rolled}</p>
            <p className="text-ink-soft mt-1 text-xs">
              Noch {state.movement?.remaining} Punkte — tippen Sie auf einen grünen Punkt.
            </p>
          </div>
        )}
        {state.phase === 'endOfTurn' && (
          <button className="btn btn-primary w-full" onClick={onEnd}>
            Zug beenden
          </button>
        )}
      </div>
    </div>
  )
}

function Ledger({
  ctx,
  state,
  player,
}: {
  ctx: EngineContext
  state: GameState
  player: PlayerState
}) {
  const others = state.players.filter((p) => p.id !== player.id)
  return (
    <div className="py-3">
      <dl className="teletype space-y-1 text-[13px]">
        <Row label="Barmittel" value={formatMoney(player.cash)} />
        <Row label="Warenwert" value={formatMoney(cargoValue(player))} />
        <hr className="rule my-1.5" />
        <Row label="Vermögen" value={formatMoney(netWorth(player))} strong />
      </dl>

      <h3 className="smallcaps text-ink-soft mt-4 mb-1.5 text-[11px]">Laderaum</h3>
      {player.cargo.length === 0 ? (
        <p className="text-ink-faint text-xs italic">Leer. Kein Gewinn ohne Salzwasser.</p>
      ) : (
        <ul className="space-y-0.5 text-[12px]">
          {player.cargo.map((c) => (
            <li key={c.uid} className="flex justify-between gap-2">
              <span>{ctx.goodsById.get(c.goodId)?.name}</span>
              <span className="tnum text-ink-soft">{c.pricePaid.toLocaleString('de-DE')}</span>
            </li>
          ))}
        </ul>
      )}

      <h3 className="smallcaps text-ink-soft mt-4 mb-1.5 text-[11px]">Die Konkurrenz</h3>
      <ul className="space-y-1 text-[12px]">
        {others.map((p) => {
          const color = PLAYER_COLORS[p.colorIndex % PLAYER_COLORS.length]!
          return (
            <li key={p.id} className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full border border-black/30"
                style={{ background: color.ink }}
              />
              <span className="min-w-0 flex-1 truncate">{p.name}</span>
              <span className="tnum text-ink-soft">{netWorth(p).toLocaleString('de-DE')}</span>
            </li>
          )
        })}
      </ul>
    </div>
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

function KonjunkturStep({
  ctx,
  state,
  onDraw,
}: {
  ctx: EngineContext
  state: GameState
  onDraw: () => void
}) {
  const card = state.pendingCard ? ctx.cardsById.get(state.pendingCard.cardId) : null
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="smallcaps text-rot text-xs">Rotes Feld — die Konjunktur spricht mit</p>
      {card ? (
        <KonjunkturSlip card={card} />
      ) : (
        <div className="paper-slip grid h-40 w-64 place-items-center rounded-[2px] shadow-md">
          <span className="smallcaps text-black/40 text-xs tracking-[0.3em]">Konjunktur</span>
        </div>
      )}
      <button className="btn btn-primary" onClick={onDraw}>
        Karte abheben
      </button>
      <p className="text-ink-soft max-w-xs text-xs">
        Vor jedem Verkaufsgeschäft ist in dieser Runde eine Karte abzuheben.
      </p>
    </div>
  )
}

function PendingCardStrip({ ctx, state }: { ctx: EngineContext; state: GameState }) {
  const card = state.pendingCard ? ctx.cardsById.get(state.pendingCard.cardId) : null
  if (!card) return null
  return (
    <div className="border-b border-black/15 px-4 pt-3 pb-2">
      <KonjunkturSlip card={card} />
    </div>
  )
}

function FinalReckoning({
  ctx,
  state,
  onNew,
}: {
  ctx: EngineContext
  state: GameState
  onNew: () => void
}) {
  const table = useMemo(() => standings(state), [state])
  void ctx
  return (
    <div className="flex min-h-0 flex-1 flex-col p-5">
      <p className="smallcaps text-ink-soft text-center text-[10px]">Schlußabrechnung</p>
      <h2 className="display letterpress text-center text-3xl">Wer hat den Handel gemacht?</h2>
      <hr className="rule-double my-4" />
      <ol className="min-h-0 flex-1 space-y-2 overflow-y-auto">
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
      <button className="btn btn-primary mt-4" onClick={onNew}>
        Neue Partie
      </button>
    </div>
  )
}

function LogStrip({ log }: { log: LogLine[] }) {
  const [open, setOpen] = useState(false)
  const tone = {
    neutral: 'text-ink-soft',
    gut: 'text-press',
    schlecht: 'text-rot',
    wichtig: 'text-ink font-semibold',
  } as const

  return (
    <div className="shrink-0 border-t border-black/20">
      <button
        className="smallcaps text-ink-soft flex w-full items-center justify-between px-4 py-1.5 text-[10px]"
        onClick={() => setOpen((o) => !o)}
      >
        <span>Schiffsjournal</span>
        <span>{open ? '▾' : '▴'}</span>
      </button>
      <div className={`overflow-y-auto px-4 ${open ? 'h-40' : 'h-8'} pb-2`}>
        <ul className="space-y-1 text-[11px] leading-snug">
          {log.slice(0, open ? 60 : 1).map((line) => (
            <li key={line.id} className={tone[line.tone]}>
              {line.text}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
