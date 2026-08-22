import { useEffect, useMemo, useState } from 'react'
import { harbourCharacters, harbourGuide, type HarbourCharacter } from '@engine/persona'
import {
  harbourGreeting,
  harbourPlan,
  leavingEmptyHanded,
  type Stage,
} from '@engine/advice'
import {
  buyOffers,
  marketReport,
  saleQuotes,
  sellDestinations,
  verkaufszwangOpen,
} from '@engine/selectors'
import { goodOf, portOf } from '@engine/context'
import type { EngineContext } from '@engine/context'
import { flagship, type GameState, type PlayerState } from '@engine/state'
import { Warenkarte } from './Cards'
import { CargoHold } from './Cargo'
import { Emph } from './Emph'
import { Portrait } from './Portrait'
import { Sheet, Tabs, type SheetSnap } from './Sheet'
import { PLAYER_COLORS } from '@app/store'

type Tab = 'kaufen' | 'verkaufen' | 'kai' | 'wohin'

/**
 * Why a card cannot be taken. "Von einer Warengattung nur eine Karte" binds
 * per harbour, not per hold — the same good is yours again two ports on, so
 * the wording must not suggest the hold is the obstacle.
 */
const BLOCK_TEXT: Record<string, string> = {
  'nicht-im-angebot': 'wird hier nicht geführt',
  ausverkauft: 'Exportbank ausverkauft — beide Karten im Umlauf',
  'kein-geld': 'Barmittel reichen nicht',
  'schon-geladen': 'in diesem Hafen bereits gekauft',
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
  greeting,
  onEnter,
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
  /** The gangway is down but nobody has stepped ashore yet. */
  greeting: boolean
  onEnter: () => void
}) {
  const port = portOf(ctx, portId)
  const country = ctx.pack.map.countries.find((c) => c.id === port.country)
  const offers = buyOffers(ctx, state, player, portId)
  const quotes = saleQuotes(ctx, state, player, portId)
  const zwang = verkaufszwangOpen(ctx, state, player, portId)
  const color = PLAYER_COLORS[player.colorIndex % PLAYER_COLORS.length]!

  const plan = harbourPlan(ctx, state, player, portId)
  const guide = useMemo(() => harbourGuide(portId, ctx.pack.id), [portId, ctx.pack.id])

  // Every call at a harbour starts with the hold: what am I carrying, and
  // does anyone here want it. From there the Makler's button walks the rest.
  const [tab, setTab] = useState<Tab>('verkaufen')
  useEffect(() => setTab('verkaufen'), [portId])

  // Where the walk stands, and what comes after it. Reading the position out
  // of the visible tab rather than a counter means the plan can grow or
  // shrink underfoot — buying the last affordable good drops the Angebot from
  // the walk — without the button ever pointing at a step that is gone.
  const at = plan.findIndex((s) => s.step === tab)
  const stage: Stage | undefined = at >= 0 ? plan[at] : undefined
  const next: Stage | undefined = at >= 0 ? plan[at + 1] : undefined

  const folk = useMemo(
    () => harbourCharacters(portId, state.round, 2, ctx.pack.id),
    [portId, state.round, ctx.pack.id],
  )
  const report = useMemo(
    () => marketReport(ctx, player, 6),
    [ctx, player],
  )

  const left = state.config.maxPurchasesPerPort - flagship(player).purchasesThisVisit.length
  const affordable = offers.filter((o) => o.status === 'ok').length

  // Casting off is only the good outcome with something in the hold, so the
  // button carries weight only then. Leaving empty is a decision, not a step
  // forward, and should not look like the obvious next tap.
  const laden = flagship(player).cargo.length > 0
  const empty = leavingEmptyHanded(ctx, state, player, portId)
  const [confirmEmpty, setConfirmEmpty] = useState(false)
  // Buying something takes the warning away again.
  useEffect(() => {
    if (!empty) setConfirmEmpty(false)
  }, [empty])

  if (greeting) {
    return (
      <Sheet
        snap={snap}
        onSnap={onSnap}
        title={port.name}
        subtitle={country?.name}
        accent={color.ink}
        footer={
          <button className="btn btn-primary w-full text-base" onClick={onEnter}>
            Hafen betreten
          </button>
        }
      >
        <Landfall ctx={ctx} state={state} player={player} portId={portId} guide={guide} />
      </Sheet>
    )
  }

  return (
    <Sheet
      snap={snap}
      onSnap={onSnap}
      title={port.name}
      subtitle={country?.name}
      accent={color.ink}
      footer={
        <button
          className={`btn w-full text-base ${
            confirmEmpty ? 'btn-warn' : next || laden ? 'btn-primary' : ''
          }`}
          onClick={() => {
            // One button, one path: on through the harbour, and out of it at
            // the end. Sailing with an empty hold wastes the whole leg, so
            // that last step costs one extra tap — a warning, not a refusal.
            if (next) return setTab(next.step)
            if (empty && !confirmEmpty) return setConfirmEmpty(true)
            onLeave()
          }}
          disabled={zwang}
        >
          {zwang
            ? 'Erst absetzen — Verkaufszwang'
            : next
              ? `Weiter zu ${next.label}`
              : confirmEmpty
                ? 'Wirklich ohne Ladung ablegen?'
                : empty
                  ? 'Ohne Ladung ablegen'
                  : 'Ablegen'}
        </button>
      }
    >
      {/* Was zählt, in einer Zeile */}
      <div className="teletype mb-3 flex items-center justify-between gap-2 rounded-sm border border-black/15 bg-black/5 px-2.5 py-2 text-[13px]">
        <span>
          <span className="smallcaps text-ink-soft text-[11px]">Kasse</span>{' '}
          <span className="tnum font-bold">{player.cash.toLocaleString('de-DE')}</span>
        </span>
        <span className={left > 0 ? '' : 'text-rot'}>
          <span className="smallcaps text-ink-soft text-[11px]">Einkauf</span>{' '}
          <span className="tnum font-bold">
            {left}/{state.config.maxPurchasesPerPort}
          </span>
        </span>
        <span>
          <span className="smallcaps text-ink-soft text-[11px]">Ladung</span>{' '}
          <span className="tnum font-bold">{flagship(player).cargo.length}</span>
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

      {stage && <GuideNote guide={guide} stage={stage} />}

      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { id: 'verkaufen', label: 'Ladung', badge: flagship(player).cargo.length },
          { id: 'kaufen', label: 'Angebot', badge: affordable },
          { id: 'wohin', label: 'Wohin?' },
          { id: 'kai', label: 'Am Kai' },
        ]}
      />

      {tab === 'verkaufen' && (
        <div className="anim-fade">
          {flagship(player).cargo.length > 0 && (
            <div className="mb-3">
              <CargoHold ctx={ctx} cargo={flagship(player).cargo} vehicle={flagship(player).kind} size={36} />
            </div>
          )}
          {quotes.length === 0 ? (
            <Empty>Der Laderaum ist leer. Kaufen Sie, was hier wächst.</Empty>
          ) : (
            <div className="stagger space-y-2">
              {quotes.map((q) => {
                const elsewhere = sellDestinations(ctx, player, q.item, 2)
                return (
                  <div key={q.item.uid} className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <Warenkarte
                        good={goodOf(ctx, q.item.goodId)}
                        price={q.price}
                        tone={q.profit >= 0 ? 'gut' : 'schlecht'}
                        action="verkaufen"
                        sublabel={
                          q.kind === 'ueberfluss'
                            ? 'Hier selbst geführt — nur Verlustpreis'
                            : `${q.profit >= 0 ? '+' : '−'}${Math.abs(q.profit).toLocaleString('de-DE')} gegenüber Einkauf`
                        }
                        onClick={() => onSell(q.item.uid)}
                      />
                      {q.kind === 'ueberfluss' && elsewhere.length > 0 && (
                        <p className="text-ink-soft mt-1 text-[12px] leading-snug">
                          Besser anderswo:{' '}
                          {elsewhere.map((d, i) => (
                            <span key={d.portId}>
                              {i > 0 && ' · '}
                              <span className="font-semibold">{d.name}</span>{' '}
                              <span className={d.profit >= 0 ? 'text-press' : 'text-rot'}>
                                {d.profit >= 0 ? '+' : '−'}
                                {Math.abs(d.profit).toLocaleString('de-DE')}
                              </span>{' '}
                              <span className="text-ink-faint">({d.distance} Pkt.)</span>
                            </span>
                          ))}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'kaufen' && (
        <div className="anim-fade">
          {left === 0 && (
            <p className="text-ink-soft mb-2 text-center text-[13px] italic">
              Ladeschluß — in einem Hafen dürfen nur zwei Waren gekauft werden.
            </p>
          )}
          <div className="stagger space-y-2">
            {offers.map((offer) => {
              const good = goodOf(ctx, offer.goodId)
              const short = good.buy - player.cash
              return (
                <Warenkarte
                  key={offer.goodId}
                  good={good}
                  disabled={offer.status !== 'ok'}
                  action={offer.status === 'ok' ? 'kaufen' : undefined}
                  sublabel={
                    offer.status === 'ok'
                      ? undefined
                      : offer.status === 'kein-geld'
                        ? `Barmittel reichen nicht — es fehlen ${short.toLocaleString('de-DE')}`
                        : (BLOCK_TEXT[offer.status] ?? offer.status)
                  }
                  onClick={offer.status === 'ok' ? () => onBuy(offer.goodId) : undefined}
                />
              )
            })}
          </div>
        </div>
      )}

      {tab === 'wohin' && <MarketReport ctx={ctx} report={report} cargo={flagship(player).cargo.length} />}

      {tab === 'kai' && (
        <div className="stagger anim-fade space-y-3">
          {folk.map((person) => (
            <div key={person.name} className="flex items-start gap-2.5">
              <Portrait traits={person.portrait} size={40} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] leading-tight">
                  <span className="smallcaps text-ink-soft">{person.role}</span>{' '}
                  <span className="font-semibold">{person.name}</span>
                </p>
                <p className="text-ink-soft text-[14px] leading-snug italic break-words">
                  „{person.line}“
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </Sheet>
  )
}

/**
 * Stepping ashore.
 *
 * Nothing to do here, on purpose: you meet the person before you meet the
 * ledgers. Having shaken hands once, the small portrait in the corner of the
 * trading panel afterwards reads as somebody to ask rather than decoration.
 */
function Landfall({
  ctx,
  state,
  player,
  portId,
  guide,
}: {
  ctx: EngineContext
  state: GameState
  player: PlayerState
  portId: string
  guide: HarbourCharacter
}) {
  const { headline, body } = harbourGreeting(ctx, state, player, portId)
  return (
    <div className="anim-fade flex h-full flex-col items-center justify-center px-2 text-center">
      <Portrait traits={guide.portrait} size={104} />
      <p className="smallcaps text-ink-soft mt-3 text-[11px]">{guide.role}</p>
      <p className="display text-xl leading-tight">{guide.name}</p>
      <hr className="rule my-3 w-24" />
      <h3 className="display letterpress text-2xl leading-tight">{headline}</h3>
      <p className="text-ink-soft mx-auto mt-2.5 max-w-sm text-[15px] leading-relaxed italic">
        „<Emph text={body} />“
      </p>
    </div>
  )
}

/**
 * The one person who is always on the quay when you tie up.
 *
 * They say the single most useful thing about the state you are actually in,
 * and the button beside them opens the panel that acts on it. This is the
 * whole tutorial: no rules screen, just somebody who works here.
 */
function GuideNote({ guide, stage }: { guide: HarbourCharacter; stage: Stage }) {
  const loud = stage.urgency === 'dringend'
  return (
    <div
      className={`paper-slip anim-fade mb-3 flex items-start gap-2.5 rounded-sm px-2.5 py-2.5 ${
        loud ? 'ring-rot/45 ring-2' : ''
      }`}
    >
      <Portrait traits={guide.portrait} size={44} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11px] leading-tight">
          <span className="smallcaps text-black/55">{guide.role}</span>{' '}
          <span className="font-semibold text-black/75">{guide.name}</span>
        </p>
        {/* Green on green: the same press ink the Warenkarten are printed
            with, so the figures the Makler names look like the figures on
            the cards below rather than like a different kind of writing. */}
        <p
          className={`mt-1 text-[15px] leading-snug font-semibold ${
            loud ? 'text-rot' : 'text-press'
          }`}
        >
          <Emph text={stage.text} strong={loud ? 'text-rot font-bold' : 'press-dark font-bold'} />
        </p>
      </div>
    </div>
  )
}

export function MarketReport({
  ctx,
  report,
  cargo,
}: {
  ctx?: EngineContext
  report: readonly import('@engine/selectors').Destination[]
  cargo: number
}) {
  if (cargo === 0) {
    return (
      <div className="anim-fade">
        <Empty>
          Ihr Laderaum ist leer. Kaufen Sie zuerst unter „Angebot“ — danach steht hier, wer
          Ihre Ware nimmt und was sie einbringt.
        </Empty>
      </div>
    )
  }
  if (report.length === 0) {
    return <Empty>Von hier aus ist nichts abzusetzen. Fahren Sie weiter.</Empty>
  }
  return (
    <div className="anim-fade">
      <p className="text-ink-soft mb-2 text-[12px] leading-snug italic">
        Diese Häfen führen Ihre Ware <em>nicht</em> selbst und zahlen daher den vollen Preis.
        Der Betrag ist der Gewinn gegenüber Ihrem Einkauf, die Punkte sind die Entfernung.
      </p>
      <ol className="stagger space-y-1">
        {report.map((d) => (
          <li
            key={d.portId}
            className="paper-card flex items-center gap-2 rounded-[2px] px-2.5 py-1.5"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14px] font-bold">{d.name}</span>
              <span className="text-ink-soft block text-[12px] leading-snug">
                {d.distance} {d.distance === 1 ? 'Punkt' : 'Punkte'} Fahrt · nimmt{' '}
                {ctx
                  ? d.sells
                      .map((x) => ctx.goodsById.get(x.goodId)?.name ?? '')
                      .filter(Boolean)
                      .join(', ')
                  : `${d.sellable} Posten`}
              </span>
            </span>
            {cargo > 0 && (
              <span
                className={`tnum shrink-0 text-right text-[14px] font-bold ${
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
  return <p className="text-ink-faint py-6 text-center text-sm italic">{children}</p>
}
