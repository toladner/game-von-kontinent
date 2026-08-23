import { useEffect, useMemo, useState } from 'react'
import { harbourCharacters, harbourGuide, type HarbourCharacter } from '@engine/persona'
import {
  harbourGreeting,
  harbourPlan,
  leavingEmptyHanded,
  type HarbourStep,
  type Stage,
} from '@engine/advice'
import {
  buyOffers,
  marketReport,
  routeTo,
  sailingTimeMs,
  saleQuotes,
  sellDestinations,
  verkaufszwangOpen,
} from '@engine/selectors'
import { exportsAt } from '@engine/market'
import { durationText } from './useNow'
import { goodOf, portOf } from '@engine/context'
import type { EngineContext } from '@engine/context'
import { flagship, type GameState, type PlayerState } from '@engine/state'
import { Warenkarte } from './Cards'
import { CargoHold } from './Cargo'
import { Emph } from './Emph'
import { Portrait } from './Portrait'
import { Sheet, Tabs, type SheetSnap } from './Sheet'
import { PLAYER_COLORS } from '@app/store'

/**
 * The tabs are the Makler's round, and nothing else.
 *
 * Keeping them one list rather than two is what stops the button losing its
 * place: a tab that is not a step in the round can be stood on, and then
 * "what comes next" has no answer — which is how the foot of the sheet came
 * to offer a departure while standing in the Angebot.
 */
type Tab = HarbourStep

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
  onLookAt,
  markedPort,
  onSetCourse,
  followTab,
  onTabChange,
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
  /** Asked to look at a harbour on the plan; the sheet gets out of the way. */
  onLookAt: (portId: string) => void
  markedPort: string | null
  /** Real-time play: name a harbour on Wohin? and the ship sails there. */
  onSetCourse?: (portId: string) => void
  /**
   * Set when watching somebody else's turn: the panel shown is the one they
   * are on, so the table is looking at the same thing while they decide.
   */
  followTab?: Tab | null
  /** Called when we move ourselves, so the other seats can follow along. */
  onTabChange?: (tab: Tab) => void
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
  const [ownTab, setOwnTab] = useState<Tab>('verkaufen')
  // Announced as well as set, so a watcher who arrives mid-visit is not left
  // looking at whatever panel the last harbour ended on.
  useEffect(() => {
    setOwnTab('verkaufen')
    onTabChange?.('verkaufen')
    // The announcement belongs to the harbour, not to the callback's identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portId])

  // A watcher is shown the active player's panel; whoever holds the wheel
  // keeps their own and reports it onward.
  const following = followTab != null
  const tab = followTab ?? ownTab
  const setTab = (next: Tab) => {
    setOwnTab(next)
    onTabChange?.(next)
  }

  // Where the walk stands, and what comes after it. Reading the position out
  // of the visible tab rather than a counter means the plan can grow or
  // shrink underfoot — buying the last affordable good drops the Angebot from
  // the walk — without the button ever pointing at a step that is gone.
  const at = plan.findIndex((s) => s.step === tab)
  const stage: Stage = plan[Math.max(at, 0)] ?? plan[0]!
  const next: Stage | undefined = plan[Math.max(at, 0) + 1]

  // The round shortens underfoot — buying the harbour out drops the Angebot
  // from it. Step back onto it rather than standing on a panel that is no
  // longer part of the walk.
  useEffect(() => {
    if (at < 0 && plan[0]) setTab(plan[0].step)
  }, [at, plan])

  const report = useMemo(
    () => marketReport(ctx, state, player, 6),
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
        following ? (
          <p className="text-ink-soft py-1 text-center text-[13px]">
            {player.name} ist am Zug — Sie sehen mit.
          </p>
        ) : (
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
          // A Verkaufszwang holds the ship, not the round: walk it all you
          // like, but the last step will not open until the Börse is paid.
          disabled={zwang && !next}
        >
          {next
            ? `Weiter zu ${next.label}`
            : zwang
              ? 'Erst absetzen — Verkaufszwang'
              : confirmEmpty
                ? 'Wirklich ohne Ladung ablegen?'
                : empty
                  ? 'Ohne Ladung ablegen'
                  : 'Ablegen'}
        </button>
        )
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
        items={plan.map((s) => ({
          id: s.step,
          label: s.label,
          ...(s.step === 'verkaufen'
            ? { badge: flagship(player).cargo.length }
            : s.step === 'kaufen'
              ? { badge: affordable }
              : {}),
        }))}
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
                const elsewhere = sellDestinations(ctx, state, player, q.item, 2)
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

      {tab === 'wohin' && (
        <MarketReport
          ctx={ctx}
          report={report}
          cargo={flagship(player).cargo.length}
          onLookAt={onLookAt}
          markedPort={markedPort}
          onSetCourse={onSetCourse}
        />
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
  // One voice overheard on the quay, so a harbour is somewhere and not just
  // a name. The Makler does the talking; this is the room behind them.
  const passerby = harbourCharacters(portId, state.round, 1, ctx.pack.id)[0]

  return (
    <div className="anim-fade flex h-full flex-col items-center justify-center px-2 text-center">
      <Portrait traits={guide.portrait} size={104} />
      <p className="smallcaps text-ink-soft mt-3 text-[11px]">{guide.role}</p>
      <p className="display text-xl leading-tight">{guide.name}</p>
      <h3 className="display letterpress mt-3 text-2xl leading-tight">{headline}</h3>

      {/* The same green slip the Makler speaks from all through the harbour. */}
      <div className="paper-slip mx-auto mt-3 max-w-sm rounded-sm px-3.5 py-3">
        <p className="text-press text-[15px] leading-relaxed font-semibold">
          <Emph text={body} strong="press-dark font-bold" />
        </p>
      </div>

      {passerby && (
        <p className="text-ink-faint mx-auto mt-4 max-w-sm text-[12px] leading-snug italic">
          {passerby.role} {passerby.name}, im Vorbeigehen: „{passerby.line}“
        </p>
      )}
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
/**
 * The Makler always speaks in the same voice.
 *
 * Green on green: the same press ink the Warenkarten are printed with, so the
 * figures named here look like the figures on the cards below rather than a
 * different kind of writing. Urgency shows as a heavier rule around the slip,
 * never as a change of colour — a voice that turns red when it matters is a
 * voice you stop reading when it does not.
 */
function GuideNote({ guide, stage }: { guide: HarbourCharacter; stage: Stage }) {
  return (
    <div
      className={`paper-slip anim-fade mb-3 flex items-start gap-2.5 rounded-sm px-2.5 py-2.5 ${
        stage.urgency === 'dringend' ? 'ring-2 ring-[#12452f]/45' : ''
      }`}
    >
      <Portrait traits={guide.portrait} size={44} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11px] leading-tight">
          <span className="smallcaps text-black/55">{guide.role}</span>{' '}
          <span className="font-semibold text-black/75">{guide.name}</span>
        </p>
        <p className="text-press mt-1 text-[15px] leading-snug font-semibold">
          <Emph text={stage.text} strong="press-dark font-bold" />
        </p>
      </div>
    </div>
  )
}

export function MarketReport({
  ctx,
  report,
  cargo,
  onLookAt,
  markedPort = null,
  onSetCourse,
}: {
  ctx?: EngineContext
  report: readonly import('@engine/selectors').Destination[]
  cargo: number
  onLookAt?: (portId: string) => void
  markedPort?: string | null
  /**
   * Real-time play only: choosing a harbour here is choosing where to sail.
   * There is no die and no counting off — you name the port and the ship
   * makes its own way there while you get on with something else.
   */
  onSetCourse?: (portId: string) => void
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
        {onSetCourse
          ? ' Antippen zeigt den Hafen auf dem Plan; „Kurs setzen“ schickt das Schiff hin.'
          : onLookAt
            ? ' Antippen zeigt den Hafen auf dem Plan.'
            : ''}
      </p>
      <ol className="stagger space-y-1">
        {report.map((d) => (
          <li key={d.portId}>
            <button
              type="button"
              disabled={!onLookAt}
              onClick={() => onLookAt?.(d.portId)}
              aria-pressed={d.portId === markedPort}
              className={`paper-card flex w-full items-center gap-2 rounded-[2px] px-2.5 py-2 text-left transition ${
                onLookAt ? 'hover:-translate-y-0.5 hover:shadow-md' : ''
              } ${d.portId === markedPort ? 'ring-gold ring-2' : ''}`}
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
            </button>
            {onSetCourse && (
              <button
                type="button"
                className="btn btn-sm btn-primary mt-1 w-full text-[13px]"
                onClick={() => onSetCourse(d.portId)}
              >
                Kurs auf {d.name} setzen
              </button>
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

/**
 * A harbour looked at from the sea, before committing to sail there.
 *
 * Tapping a port on the plan used to set a course on the spot, which is a
 * long voyage bought with one careless thumb. It opens this instead: what the
 * place ships, what it would pay for what you are carrying, and how long
 * getting there takes. Only then is there a button to go.
 *
 * The same panel serves a harbour you are looking at while lying in another,
 * so it never assumes your ship is anywhere near it.
 */
export function PortPreviewSheet({
  ctx,
  state,
  player,
  portId,
  snap,
  onSnap,
  onSetCourse,
}: {
  ctx: EngineContext
  state: GameState
  player: PlayerState
  portId: string
  snap: SheetSnap
  onSnap: (s: SheetSnap) => void
  /** Absent when the ship cannot be given a course right now. */
  onSetCourse?: (portId: string) => void
}) {
  const port = portOf(ctx, portId)
  const country = ctx.pack.map.countries.find((c) => c.id === port.country)
  const ship = flagship(player)
  const here = ship.nodeId === portId

  const exports = exportsAt(ctx, state, portId)
  const quotes = saleQuotes(ctx, state, player, portId)
  const earners = quotes.filter((q) => q.kind === 'markt')
  const takings = earners.reduce((sum, q) => sum + q.price, 0)

  const route = here ? [] : routeTo(ctx, ship.nodeId, ship.cameFrom, portId)
  const eta = here ? null : sailingTimeMs(ctx, state, ship, portId)

  return (
    <Sheet
      snap={snap}
      onSnap={onSnap}
      title={port.name}
      subtitle={country?.name}
      footer={
        here ? (
          <p className="text-ink-soft py-1 text-center text-[13px]">Sie liegen bereits hier.</p>
        ) : onSetCourse && route.length > 0 ? (
          <button className="btn btn-primary w-full text-base" onClick={() => onSetCourse(portId)}>
            Kurs auf {port.name} setzen
          </button>
        ) : (
          <p className="text-ink-soft py-1 text-center text-[13px]">
            {route.length === 0 ? 'Dorthin führt keine Linie.' : 'Das Schiff ist unterwegs.'}
          </p>
        )
      }
    >
      {!here && (
        <div className="teletype mb-3 flex items-center justify-between gap-2 rounded-sm border border-black/15 bg-black/5 px-2.5 py-2 text-[13px]">
          <span>
            <span className="smallcaps text-ink-soft text-[11px]">Entfernung</span>{' '}
            <span className="tnum font-bold">
              {route.length} {route.length === 1 ? 'Punkt' : 'Punkte'}
            </span>
          </span>
          {eta !== null && (
            <span>
              <span className="smallcaps text-ink-soft text-[11px]">Fahrt</span>{' '}
              <span className="tnum font-bold">{durationText(eta)}</span>
            </span>
          )}
        </div>
      )}

      <h3 className="smallcaps text-ink-soft mb-1.5 text-[11px]">
        {earners.length > 0 ? 'Nimmt Ihnen ab' : 'Ihre Ladung'}
      </h3>
      {ship.cargo.length === 0 ? (
        <p className="text-ink-faint mb-3 text-[13px] italic">
          Ihr Laderaum ist leer — hier wäre nichts abzusetzen.
        </p>
      ) : earners.length === 0 ? (
        <p className="text-ink-faint mb-3 text-[13px] italic">
          Dieser Hafen führt Ihre Waren selbst. Er zahlte nur den Verlustpreis.
        </p>
      ) : (
        <ul className="mb-3 space-y-0.5 text-[13px]">
          {earners.map((q) => (
            <li key={q.item.uid} className="flex items-baseline justify-between gap-2">
              <span className="min-w-0 flex-1 truncate font-semibold">
                {goodOf(ctx, q.item.goodId).name}
              </span>
              <span className="tnum">{q.price.toLocaleString('de-DE')}</span>
              <span
                className={`tnum w-20 text-right font-bold ${q.profit >= 0 ? 'text-press' : 'text-rot'}`}
              >
                {q.profit >= 0 ? '+' : '−'}
                {Math.abs(q.profit).toLocaleString('de-DE')}
              </span>
            </li>
          ))}
          <li className="flex items-baseline justify-between gap-2 border-t border-black/10 pt-1 font-bold">
            <span className="smallcaps text-[11px]">Erlös</span>
            <span className="tnum">{takings.toLocaleString('de-DE')}</span>
            <span className="w-20" />
          </li>
        </ul>
      )}

      <h3 className="smallcaps text-ink-soft mb-1.5 text-[11px]">Führt aus</h3>
      {exports.length === 0 ? (
        <p className="text-ink-faint text-[13px] italic">Von hier geht nichts hinaus.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[13px]">
          {exports.map((goodId) => {
            const good = goodOf(ctx, goodId)
            return (
              <li key={goodId} className="flex items-baseline justify-between gap-1.5">
                <span className="min-w-0 flex-1 truncate">{good.name}</span>
                <span className="tnum text-ink-soft">{good.buy.toLocaleString('de-DE')}</span>
              </li>
            )
          })}
        </ul>
      )}
    </Sheet>
  )
}
