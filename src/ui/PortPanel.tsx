import { useMemo, useState } from 'react'
import { harbourCharacters } from '@engine/persona'
import { buyOffers, marketReport, saleQuotes, verkaufszwangOpen } from '@engine/selectors'
import { goodOf, portOf } from '@engine/context'
import type { EngineContext } from '@engine/context'
import type { GameState, PlayerState } from '@engine/state'
import { Warenkarte } from './Cards'
import { CargoHold } from './Cargo'
import { Portrait } from './Portrait'
import { Sheet, Tabs, type SheetSnap } from './Sheet'
import { PLAYER_COLORS } from '@app/store'

type Tab = 'kaufen' | 'verkaufen' | 'kai' | 'wohin'

const BLOCK_TEXT: Record<string, string> = {
  'nicht-im-angebot': 'wird hier nicht geführt',
  ausverkauft: 'Exportbank ausverkauft',
  'kein-geld': 'Barmittel reichen nicht',
  'schon-geladen': 'bereits an Bord',
  ladeschluss: 'Ladeschluß — zwei Waren je Hafen',
  'laderaum-voll': 'Laderaum voll',
}

export function PortSheet({
  ctx,
  state,
  player,
  portId,
  snap,
  onSnap,
  onBuy,
  onSell,
  onLeave,
}: {
  ctx: EngineContext
  state: GameState
  player: PlayerState
  portId: string
  snap: SheetSnap
  onSnap: (s: SheetSnap) => void
  onBuy: (goodId: number) => void
  onSell: (uid: string) => void
  onLeave: () => void
}) {
  const port = portOf(ctx, portId)
  const country = ctx.pack.map.countries.find((c) => c.id === port.country)
  const offers = buyOffers(ctx, state, player, portId)
  const quotes = saleQuotes(ctx, state, player, portId)
  const zwang = verkaufszwangOpen(ctx, state, player, portId)
  const color = PLAYER_COLORS[player.colorIndex % PLAYER_COLORS.length]!

  const [tab, setTab] = useState<Tab>(player.cargo.length > 0 ? 'verkaufen' : 'kaufen')

  const folk = useMemo(
    () => harbourCharacters(portId, state.round, 2, ctx.pack.id),
    [portId, state.round, ctx.pack.id],
  )
  const report = useMemo(
    () => marketReport(ctx, player, 6),
    [ctx, player],
  )

  const left = state.config.maxPurchasesPerPort - player.purchasesThisVisit.length
  const affordable = offers.filter((o) => o.status === 'ok').length

  return (
    <Sheet
      snap={snap}
      onSnap={onSnap}
      title={port.name}
      subtitle={country?.name}
      accent={color.ink}
      footer={
        <button className="btn btn-primary w-full text-base" onClick={onLeave} disabled={zwang}>
          {zwang ? 'Erst absetzen — Verkaufszwang' : 'Ablegen'}
        </button>
      }
    >
      {/* Was zählt, in einer Zeile */}
      <div className="teletype mb-3 flex items-center justify-between gap-2 rounded-sm border border-black/15 bg-black/5 px-2.5 py-1.5 text-[11px]">
        <span>
          <span className="smallcaps text-ink-soft">Kasse</span>{' '}
          <span className="tnum font-bold">{player.cash.toLocaleString('de-DE')}</span>
        </span>
        <span className={left > 0 ? '' : 'text-rot'}>
          <span className="smallcaps text-ink-soft">Einkauf</span>{' '}
          <span className="tnum font-bold">
            {left}/{state.config.maxPurchasesPerPort}
          </span>
        </span>
        <span>
          <span className="smallcaps text-ink-soft">Ladung</span>{' '}
          <span className="tnum font-bold">{player.cargo.length}</span>
        </span>
      </div>

      {state.saleModifierPercent !== 0 && (
        <p
          className={`anim-fade mb-3 text-center text-xs ${
            state.saleModifierPercent > 0 ? 'text-press' : 'text-rot'
          }`}
        >
          Weltmarkt: Verkaufspreise {state.saleModifierPercent > 0 ? '+' : '−'}{' '}
          {Math.abs(state.saleModifierPercent)} %
        </p>
      )}

      {zwang && (
        <p className="text-rot border-rot/40 bg-rot/5 anim-fade mb-3 rounded-sm border px-2 py-1.5 text-center text-xs">
          Verkaufszwang: eine Ware absetzen, die dieser Hafen nicht selbst führt.
        </p>
      )}

      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { id: 'verkaufen', label: 'Ladung', badge: player.cargo.length },
          { id: 'kaufen', label: 'Angebot', badge: affordable },
          { id: 'wohin', label: 'Wohin?' },
          { id: 'kai', label: 'Am Kai' },
        ]}
      />

      {tab === 'verkaufen' && (
        <div className="anim-fade">
          {player.cargo.length > 0 && (
            <div className="mb-3">
              <CargoHold ctx={ctx} cargo={player.cargo} vehicle={player.vehicle} size={36} />
            </div>
          )}
          {quotes.length === 0 ? (
            <Empty>Der Laderaum ist leer. Kaufen Sie, was hier wächst.</Empty>
          ) : (
            <div className="stagger grid grid-cols-2 gap-2">
              {quotes.map((q) => (
                <Warenkarte
                  key={q.item.uid}
                  good={goodOf(ctx, q.item.goodId)}
                  price={q.price}
                  tone={q.profit >= 0 ? 'gut' : 'schlecht'}
                  action="verkaufen"
                  sublabel={
                    q.kind === 'ueberfluss'
                      ? 'Hier selbst geführt — Verlustpreis'
                      : `${q.profit >= 0 ? '+' : '−'}${Math.abs(q.profit).toLocaleString('de-DE')}`
                  }
                  onClick={() => onSell(q.item.uid)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'kaufen' && (
        <div className="anim-fade">
          {left === 0 && (
            <p className="text-ink-soft mb-2 text-center text-xs italic">
              Ladeschluß — in einem Hafen dürfen nur zwei Waren gekauft werden.
            </p>
          )}
          <div className="stagger grid grid-cols-2 gap-2">
            {offers.map((offer) => {
              const good = goodOf(ctx, offer.goodId)
              return (
                <Warenkarte
                  key={offer.goodId}
                  good={good}
                  disabled={offer.status !== 'ok'}
                  action={offer.status === 'ok' ? 'kaufen' : undefined}
                  sublabel={
                    offer.status === 'ok'
                      ? `danach ${(player.cash - good.buy).toLocaleString('de-DE')}`
                      : (BLOCK_TEXT[offer.status] ?? offer.status)
                  }
                  onClick={offer.status === 'ok' ? () => onBuy(offer.goodId) : undefined}
                />
              )
            })}
          </div>
        </div>
      )}

      {tab === 'wohin' && <MarketReport report={report} cargo={player.cargo.length} />}

      {tab === 'kai' && (
        <div className="stagger anim-fade space-y-3">
          {folk.map((person) => (
            <div key={person.name} className="flex items-start gap-2.5">
              <Portrait traits={person.portrait} size={40} />
              <div className="min-w-0">
                <p className="text-[11px] leading-tight">
                  <span className="smallcaps text-ink-soft">{person.role}</span>{' '}
                  <span className="font-semibold">{person.name}</span>
                </p>
                <p className="text-ink-soft text-[13px] leading-snug italic">„{person.line}“</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </Sheet>
  )
}

export function MarketReport({
  report,
  cargo,
}: {
  report: readonly import('@engine/selectors').Destination[]
  cargo: number
}) {
  if (report.length === 0) {
    return <Empty>Von hier aus ist nichts zu holen. Fahren Sie weiter.</Empty>
  }
  return (
    <div className="anim-fade">
      <p className="text-ink-soft mb-2 text-[11px] italic">
        {cargo > 0
          ? 'Wo Ihre Ladung zum vollen Preis abgesetzt werden kann:'
          : 'Häfen mit reichlich Ausfuhrgütern in der Nähe:'}
      </p>
      <ol className="stagger space-y-1">
        {report.map((d) => (
          <li
            key={d.portId}
            className="paper-card flex items-center gap-2 rounded-[2px] px-2.5 py-1.5"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-semibold">{d.name}</span>
              <span className="text-ink-soft text-[10px]">
                {d.distance} {d.distance === 1 ? 'Punkt' : 'Punkte'} Fahrt
                {cargo > 0 ? ` · ${d.sellable} Posten` : ` · ${d.offers} Waren`}
              </span>
            </span>
            {cargo > 0 && (
              <span
                className={`tnum shrink-0 text-right text-[13px] font-bold ${
                  d.profit >= 0 ? 'text-press' : 'text-rot'
                }`}
              >
                {d.profit >= 0 ? '+' : '−'}
                {Math.abs(d.profit).toLocaleString('de-DE')}
              </span>
            )}
          </li>
        ))}
      </ol>
    </div>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-ink-faint py-6 text-center text-xs italic">{children}</p>
}
