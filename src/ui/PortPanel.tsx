import { useMemo } from 'react'
import { harbourCharacters } from '@engine/persona'
import { buyOffers, saleQuotes, verkaufszwangOpen } from '@engine/selectors'
import { goodOf, portOf } from '@engine/context'
import type { EngineContext } from '@engine/context'
import type { GameState, PlayerState } from '@engine/state'
import { Warenkarte } from './Cards'
import { Portrait } from './Portrait'

const BLOCK_TEXT: Record<string, string> = {
  'nicht-im-angebot': 'wird hier nicht geführt',
  ausverkauft: 'Exportbank ausverkauft',
  'kein-geld': 'Barmittel reichen nicht',
  'schon-geladen': 'bereits an Bord',
  ladeschluß: 'Ladeschluß',
  ladeschluss: 'Ladeschluß — zwei Waren je Hafen',
}

export function PortPanel({
  ctx,
  state,
  player,
  portId,
  onBuy,
  onSell,
  onLeave,
}: {
  ctx: EngineContext
  state: GameState
  player: PlayerState
  portId: string
  onBuy: (goodId: number) => void
  onSell: (uid: string) => void
  onLeave: () => void
}) {
  const port = portOf(ctx, portId)
  const country = ctx.pack.map.countries.find((c) => c.id === port.country)
  const offers = buyOffers(ctx, state, player, portId)
  const quotes = saleQuotes(ctx, state, player, portId)
  const zwang = verkaufszwangOpen(ctx, state, player, portId)

  const folk = useMemo(
    () => harbourCharacters(portId, state.round, 2, ctx.pack.id),
    [portId, state.round, ctx.pack.id],
  )

  const modifier = state.saleModifierPercent

  return (
    <div className="flex h-full flex-col">
      <header className="px-4 pt-4">
        <p className="smallcaps text-ink-soft text-[10px]">Im Hafen von</p>
        <h2 className="display letterpress text-2xl leading-tight">{port.name}</h2>
        <p className="text-ink-soft text-xs italic">{country?.name}</p>
        <hr className="rule-double mt-3" />
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        {/* Am Kai */}
        <section className="mt-3 space-y-2">
          {folk.map((person) => (
            <div key={person.name} className="flex items-start gap-2.5">
              <Portrait traits={person.portrait} size={38} />
              <div className="min-w-0">
                <p className="text-[11px] leading-tight">
                  <span className="smallcaps text-ink-soft">{person.role}</span>{' '}
                  <span className="text-ink-faint">·</span>{' '}
                  <span className="font-semibold">{person.name}</span>
                </p>
                <p className="text-ink-soft text-[12px] leading-snug italic">
                  „{person.line}“
                </p>
              </div>
            </div>
          ))}
        </section>

        {modifier !== 0 && (
          <p
            className={`mt-3 text-center text-xs ${modifier > 0 ? 'text-press' : 'text-rot'}`}
          >
            Weltmarkt: Verkaufspreise {modifier > 0 ? '+' : '−'} {Math.abs(modifier)} %
          </p>
        )}

        {zwang && (
          <p className="text-rot mt-3 rounded-sm border border-rot/40 bg-rot/5 px-2 py-1.5 text-center text-xs">
            Verkaufszwang: mindestens eine Ware absetzen, die dieser Hafen nicht selbst führt.
          </p>
        )}

        {/* Ladung */}
        <section className="mt-5">
          <h3 className="smallcaps text-ink-soft mb-2 text-[11px]">
            Ihre Ladung {player.cargo.length > 0 && `(${player.cargo.length})`}
          </h3>
          {quotes.length === 0 ? (
            <p className="text-ink-faint text-xs italic">Der Laderaum ist leer.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {quotes.map((q) => (
                <Warenkarte
                  key={q.item.uid}
                  good={goodOf(ctx, q.item.goodId)}
                  price={q.price}
                  tone={q.profit >= 0 ? 'gut' : 'schlecht'}
                  action="verkaufen"
                  sublabel={
                    q.kind === 'ueberfluss'
                      ? 'Hier selbst geführt — nur Verlustpreis'
                      : `${q.profit >= 0 ? 'Gewinn' : 'Verlust'} ${Math.abs(q.profit).toLocaleString('de-DE')}`
                  }
                  onClick={() => onSell(q.item.uid)}
                />
              ))}
            </div>
          )}
        </section>

        {/* Angebot */}
        <section className="mt-5">
          <h3 className="smallcaps text-ink-soft mb-2 text-[11px]">
            Ausfuhrgüter dieses Landes
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {offers.map((offer) => (
              <Warenkarte
                key={offer.goodId}
                good={goodOf(ctx, offer.goodId)}
                disabled={offer.status !== 'ok'}
                action={offer.status === 'ok' ? 'kaufen' : undefined}
                sublabel={
                  offer.status === 'ok'
                    ? `noch ${offer.stock} Kärtchen`
                    : (BLOCK_TEXT[offer.status] ?? offer.status)
                }
                onClick={offer.status === 'ok' ? () => onBuy(offer.goodId) : undefined}
              />
            ))}
          </div>
        </section>
      </div>

      <footer className="border-t border-black/15 px-4 py-3">
        <button className="btn btn-primary w-full" onClick={onLeave} disabled={zwang}>
          Ablegen
        </button>
      </footer>
    </div>
  )
}
