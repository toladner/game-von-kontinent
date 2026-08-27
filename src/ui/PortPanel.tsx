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
  courseOrigin,
  marketReport,
  routeTo,
  sailingTimeMs,
  saleQuotes,
  sellDestinations,
  verkaufszwangOpen,
  voyageTimesFrom,
  closureAt,
} from '@engine/selectors'
import { exportsAt } from '@engine/market'
import { durationText } from './useNow'
import { goodOf, portOf } from '@engine/context'
import type { EngineContext } from '@engine/context'
import { flagship, type GameState, type PlayerState, type VehicleInstance } from '@engine/state'
import { Warenkarte } from './Cards'
import { CargoHold } from './Cargo'
import { Emph } from './Emph'
import { Portrait } from './Portrait'
import { Sheet, Tabs, type SheetSnap } from './Sheet'
import { PLAYER_COLORS } from '@app/store'
import { useT, type Translate } from '@app/locale'
import { named, type Localized } from '@i18n/locale'
import type { MsgKey } from '@i18n'

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
/**
 * A harbour shut, said once and plainly at the head of the sheet.
 *
 * Without it the only sign is every ware in the Angebot carrying the same
 * refusal, which reads as a bug rather than as news. Shown on the preview
 * sheet as well, because that is where the decision to sail there is made —
 * and it deliberately does not stop anyone: the quarantine may be lifted
 * before the ship arrives, and betting on that is the interesting part.
 */
function SperrBand({ closure }: { closure: { title: Localized<string> } | null }) {
  const { t, locale } = useT()
  if (!closure) return null
  return (
    <div className="border-rot/40 bg-rot/10 mb-3 rounded-sm border px-2.5 py-2">
      <p className="smallcaps text-rot text-[11px] tracking-[0.18em]">{t('port.closure')}</p>
      <p className="mt-0.5 text-[13px] leading-snug font-semibold">{closure.title[locale]}</p>
      <p className="text-ink-soft mt-0.5 text-[12px] leading-snug">{t('port.closure.note')}</p>
    </div>
  )
}

/** Why a card cannot be taken, keyed by the reason the engine gives. */
const BLOCK_TEXT: Record<string, MsgKey> = {
  gesperrt: 'port.block.gesperrt',
  'nicht-im-angebot': 'port.block.nicht-im-angebot',
  ausverkauft: 'port.block.ausverkauft',
  'kein-geld': 'port.block.kein-geld',
  'schon-geladen': 'port.block.schon-geladen',
  ladeschluss: 'port.block.ladeschluss',
  'laderaum-voll': 'port.block.laderaum-voll',
}

/** A signed figure, as the sheet sets them: −  rather than a hyphen. */
function signed(t: Translate, value: number): string {
  return `${value >= 0 ? '+' : '−'}${t.num(Math.abs(value))}`
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
  onOpenPort,
  onShowMap,
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
  /** Open a harbour's card without committing to sail to it. */
  onOpenPort?: (portId: string) => void
  /**
   * Real-time play: get the sheet out of the way so a harbour can be picked
   * off the plan instead of out of the list.
   */
  onShowMap?: () => void
  /**
   * Set when watching somebody else's turn: the panel shown is the one they
   * are on, so the table is looking at the same thing while they decide.
   */
  followTab?: Tab | null
  /** Called when we move ourselves, so the other seats can follow along. */
  onTabChange?: (tab: Tab) => void
}) {
  const T = useT()
  const { t, tn, num, locale } = T
  const port = portOf(ctx, portId)
  const country = ctx.pack.map.countries.find((c) => c.id === port.country)
  const offers = buyOffers(ctx, state, player, portId)
  const quotes = saleQuotes(ctx, state, player, portId)
  const zwang = verkaufszwangOpen(ctx, state, player, portId)
  const color = PLAYER_COLORS[player.colorIndex % PLAYER_COLORS.length]!

  const plan = harbourPlan(ctx, state, player, portId, locale)
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
        title={named(port)[locale]}
        subtitle={country && named(country)[locale]}
        accent={color.ink}
        footer={
          <button className="btn btn-primary w-full text-base" onClick={onEnter}>
            {t('port.enter')}
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
      title={named(port)[locale]}
      subtitle={country && named(country)[locale]}
      accent={color.ink}
      footer={
        following ? (
          <p className="text-ink-soft py-1 text-center text-[13px]">
            {t('port.watching', { name: player.name })}
          </p>
        ) : (
        <button
          className={`btn w-full text-base ${
            confirmEmpty
              ? 'btn-warn'
              : // Opening the plan is not the end of anything — the voyage is
                // still unchosen — so it does not get the weight of a
                // finishing move.
                onShowMap && !next
                ? ''
                : next || laden
                  ? 'btn-primary'
                  : ''
          }`}
          onClick={() => {
            // One button, one path: on through the harbour, and out of it at
            // the end. Sailing with an empty hold wastes the whole leg, so
            // that last step costs one extra tap — a warning, not a refusal.
            if (next) return setTab(next.step)
            // In real-time play there is no turn to end. The walk finishes at
            // the chart, where a harbour has to be named — so the last button
            // opens the plan rather than pretending to cast off.
            if (onShowMap) return onShowMap()
            if (empty && !confirmEmpty) return setConfirmEmpty(true)
            onLeave()
          }}
          // A Verkaufszwang holds the ship, not the round: walk it all you
          // like, but the last step will not open until the Börse is paid.
          disabled={zwang && !next}
        >
          {next
            ? t('port.next', { step: next.label })
            : onShowMap
              ? t('port.chooseOnMap')
              : zwang
                ? t('port.mustSellFirst')
                : confirmEmpty
                  ? t('port.sailEmpty.confirm')
                  : empty
                    ? t('port.sailEmpty')
                    : t('port.sail')}
        </button>
        )
      }
    >
      <SperrBand closure={closureAt(state, portId)} />

      {/* Was zählt, in einer Zeile */}
      <div className="teletype mb-3 flex items-center justify-between gap-2 rounded-sm border border-black/15 bg-black/5 px-2.5 py-2 text-[13px]">
        <span>
          <span className="smallcaps text-ink-soft text-[11px]">{t('port.cash')}</span>{' '}
          <span className="tnum font-bold">{num(player.cash)}</span>
        </span>
        <span className={left > 0 ? '' : 'text-rot'}>
          <span className="smallcaps text-ink-soft text-[11px]">{t('port.purchases')}</span>{' '}
          <span className="tnum font-bold">
            {left}/{state.config.maxPurchasesPerPort}
          </span>
        </span>
        <span>
          <span className="smallcaps text-ink-soft text-[11px]">{t('port.cargo')}</span>{' '}
          <span className="tnum font-bold">{flagship(player).cargo.length}</span>
        </span>
      </div>

      {state.saleModifierPercent !== 0 && (
        <p
          className={`anim-fade mb-3 text-center text-xs ${
            state.saleModifierPercent > 0 ? 'text-press' : 'text-rot'
          }`}
        >
          {t('port.worldMarket', {
            sign: state.saleModifierPercent > 0 ? '+' : '−',
            percent: Math.abs(state.saleModifierPercent),
          })}
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
            <Empty>{t('port.sell.holdEmpty')}</Empty>
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
                        action={t('port.sell.action')}
                        sublabel={
                          // Havarie first: it halves whatever the sale would
                          // otherwise have been, so it is the fact that
                          // decides whether to place the posten here at all.
                          q.item.damaged
                            ? t(
                                q.kind === 'ueberfluss'
                                  ? 'port.sell.damagedAndGlut'
                                  : 'port.sell.damaged',
                              )
                            : q.kind === 'ueberfluss'
                              ? t('port.sell.glut')
                              : t('port.sell.margin', {
                                  sign: q.profit >= 0 ? '+' : '−',
                                  amount: num(Math.abs(q.profit)),
                                })
                        }
                        onClick={() => onSell(q.item.uid)}
                      />
                      {q.kind === 'ueberfluss' && elsewhere.length > 0 && (
                        <p className="text-ink-soft mt-1 text-[12px] leading-snug">
                          {t('port.sell.betterElsewhere')}{' '}
                          {elsewhere.map((d, i) => (
                            <span key={d.portId}>
                              {i > 0 && ' · '}
                              <span className="font-semibold">{d.name[locale]}</span>{' '}
                              <span className={d.profit >= 0 ? 'text-press' : 'text-rot'}>
                                {signed(T, d.profit)}
                              </span>{' '}
                              <span className="text-ink-faint">
                                {tn('port.sell.pips', d.distance)}
                              </span>
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
                  action={offer.status === 'ok' ? t('port.buy.action') : undefined}
                  sublabel={
                    offer.status === 'ok'
                      ? undefined
                      : offer.status === 'kein-geld'
                        ? t('port.buy.short', { amount: num(short) })
                        : BLOCK_TEXT[offer.status]
                          ? t(BLOCK_TEXT[offer.status]!)
                          : offer.status
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
          onOpenPort={onOpenPort}
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
  const { t, locale } = useT()
  const { headline, body } = harbourGreeting(ctx, state, player, portId, locale)
  // One voice overheard on the quay, so a harbour is somewhere and not just
  // a name. The Makler does the talking; this is the room behind them.
  const passerby = harbourCharacters(portId, state.round, 1, ctx.pack.id)[0]

  return (
    <div className="anim-fade flex h-full flex-col items-center justify-center px-2 text-center">
      <Portrait traits={guide.portrait} size={104} />
      <p className="smallcaps text-ink-soft mt-3 text-[11px]">{guide.role[locale]}</p>
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
          {t('landfall.passerby', {
            role: passerby.role,
            name: passerby.name,
            line: passerby.line,
          })}
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
  const { locale } = useT()
  return (
    <div
      className={`paper-slip anim-fade mb-3 flex items-start gap-2.5 rounded-sm px-2.5 py-2.5 ${
        stage.urgency === 'dringend' ? 'ring-2 ring-[#12452f]/45' : ''
      }`}
    >
      <Portrait traits={guide.portrait} size={44} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11px] leading-tight">
          <span className="smallcaps text-black/55">{guide.role[locale]}</span>{' '}
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
  onOpenPort,
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
  /** Show the harbour's own card, as tapping it on the plan would. */
  onOpenPort?: (portId: string) => void
}) {
  const T = useT()
  const { t, tn, locale } = T
  if (cargo === 0) {
    return (
      <div className="anim-fade">
        <Empty>{t('report.holdEmpty')}</Empty>
      </div>
    )
  }
  if (report.length === 0) {
    return <Empty>{t('report.nothingReachable')}</Empty>
  }
  return (
    <div className="anim-fade">
      <p className="text-ink-soft mb-2 text-[12px] leading-snug italic">
        <Emph text={t('report.note')} strong="italic font-normal" />
        {onSetCourse ? t('report.note.course') : onLookAt ? t('report.note.look') : ''}
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
              <span className="block truncate text-[14px] font-bold">{d.name[locale]}</span>
              <span className="text-ink-soft block text-[12px] leading-snug">
                {/* Points are the rule; hours are what a player is actually
                    deciding about once ships sail on a clock, so the clock
                    takes the word "Fahrt" when there is one to take it. */}
                {tn('ui.pip', d.distance)}
                {d.travelMs === undefined
                  ? t('report.takes')
                  : t('report.takesWithClock', { duration: durationText(d.travelMs) })}
                {ctx
                  ? d.sells
                      .map((x) => {
                        const good = ctx.goodsById.get(x.goodId)
                        return good ? named(good)[locale] : ''
                      })
                      .filter(Boolean)
                      .join(', ')
                  : tn('report.lots', d.sellable)}
                {/* A harbour that takes part of the hold is a different kind
                    of choice, not a worse version of the same one — so it
                    says so rather than leaving it to be inferred from a list
                    of names the reader would have to count. */}
                {cargo > d.sellable && (
                  <span className="text-rot">
                    {tn('report.staysAboard', cargo - d.sellable)}
                  </span>
                )}
              </span>
            </span>
            {cargo > 0 && (
              <span
                className={`tnum shrink-0 text-right text-[14px] font-bold ${
                  d.profit >= 0 ? 'text-press' : 'text-rot'
                }`}
              >
                {signed(T, d.profit)}
              </span>
            )}
            </button>
            {onSetCourse && (
              // Look before you leap: the same card the plan gives you, from
              // a list entry, so a long voyage is never bought sight unseen.
              <div className="mt-1 flex gap-1.5">
                {onOpenPort && (
                  <button
                    type="button"
                    className="btn btn-sm shrink-0 text-[13px]"
                    onClick={() => onOpenPort(d.portId)}
                  >
                    {t('report.open')}
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-sm btn-primary flex-1 text-[13px]"
                  onClick={() => onSetCourse(d.portId)}
                >
                  {t('report.setCourse', { port: d.name })}
                </button>
              </div>
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
  const T = useT()
  const { t, tn, num, locale } = T
  const port = portOf(ctx, portId)
  const country = ctx.pack.map.countries.find((c) => c.id === port.country)
  const ship = flagship(player)

  /*
   * A ship at sea can still be given a new destination, but not from where
   * she floats: she runs on to the mark ahead of her first. So everything
   * quoted here — the distance, the hours, the button — is reckoned from
   * that mark, and the run to it is added back on at the end.
   */
  const origin = courseOrigin(state, ship)
  const sailing = origin.node !== ship.nodeId
  const here = !sailing && ship.nodeId === portId
  const bound = sailing && ship.voyage!.destination === portId

  const exports = exportsAt(ctx, state, portId)
  const quotes = saleQuotes(ctx, state, player, portId)
  const earners = quotes.filter((q) => q.kind === 'markt')
  const takings = earners.reduce((sum, q) => sum + q.price, 0)

  // The ship as she will be at that mark, so the map is walked from there.
  const asFrom: VehicleInstance = sailing
    ? { ...ship, nodeId: origin.node, cameFrom: origin.cameFrom, voyage: null }
    : ship
  const route = here
    ? []
    : origin.node === portId
      ? [portId]
      : routeTo(ctx, origin.node, origin.cameFrom, portId)
  const eta =
    route.length === 0
      ? null
      : sailing
        ? origin.at - state.now + (voyageTimesFrom(ctx, state, asFrom).get(portId) ?? 0)
        : sailingTimeMs(ctx, state, ship, portId)

  return (
    <Sheet
      snap={snap}
      onSnap={onSnap}
      title={named(port)[locale]}
      subtitle={country && named(country)[locale]}
      footer={
        here ? (
          <p className="text-ink-soft py-1 text-center text-[13px]">{t('preview.alreadyHere')}</p>
        ) : bound ? (
          <p className="text-ink-soft py-1 text-center text-[13px]">{t('preview.alreadyBound')}</p>
        ) : onSetCourse && route.length > 0 ? (
          <button className="btn btn-primary w-full text-base" onClick={() => onSetCourse(portId)}>
            {t(sailing ? 'preview.changeCourse' : 'preview.setCourse', { port: named(port) })}
          </button>
        ) : (
          <p className="text-ink-soft py-1 text-center text-[13px]">
            {t(route.length === 0 ? 'preview.noLine' : 'preview.underWay')}
          </p>
        )
      }
    >
      <SperrBand closure={closureAt(state, portId)} />

      {!here && (
        <div className="mb-3">
          <div className="teletype flex items-center justify-between gap-2 rounded-sm border border-black/15 bg-black/5 px-2.5 py-2 text-[13px]">
            <span>
              <span className="smallcaps text-ink-soft text-[11px]">
                {t('preview.distance')}
              </span>{' '}
              <span className="tnum font-bold">{tn('ui.pip', route.length)}</span>
            </span>
            {eta !== null && (
              <span>
                <span className="smallcaps text-ink-soft text-[11px]">{t('preview.passage')}</span>{' '}
                <span className="tnum font-bold">{durationText(eta)}</span>
              </span>
            )}
          </div>
          {/* Sonst wirkt die Fahrtzeit zu lang: sie enthält den Punkt, den das
              Schiff noch anlaufen muß, ehe der neue Kurs überhaupt gilt. */}
          {sailing && !bound && route.length > 0 && (
            <p className="text-ink-soft mt-1 text-[12px] leading-snug italic">
              {t('preview.noTurningBack')}
            </p>
          )}
        </div>
      )}

      <h3 className="smallcaps text-ink-soft mb-1.5 text-[11px]">
        {t(earners.length > 0 ? 'preview.willTake' : 'preview.yourCargo')}
      </h3>
      {ship.cargo.length === 0 ? (
        <p className="text-ink-faint mb-3 text-[13px] italic">{t('preview.holdEmpty')}</p>
      ) : earners.length === 0 ? (
        <p className="text-ink-faint mb-3 text-[13px] italic">{t('preview.shipsItItself')}</p>
      ) : (
        <ul className="mb-3 space-y-0.5 text-[13px]">
          {earners.map((q) => (
            <li key={q.item.uid} className="flex items-baseline justify-between gap-2">
              <span className="min-w-0 flex-1 truncate font-semibold">
                {named(goodOf(ctx, q.item.goodId))[locale]}
              </span>
              <span className="tnum">{num(q.price)}</span>
              <span
                className={`tnum w-20 text-right font-bold ${q.profit >= 0 ? 'text-press' : 'text-rot'}`}
              >
                {signed(T, q.profit)}
              </span>
            </li>
          ))}
          <li className="flex items-baseline justify-between gap-2 border-t border-black/10 pt-1 font-bold">
            <span className="smallcaps text-[11px]">{t('port.sell.proceeds')}</span>
            <span className="tnum">{num(takings)}</span>
            <span className="w-20" />
          </li>
        </ul>
      )}

      <h3 className="smallcaps text-ink-soft mb-1.5 text-[11px]">{t('preview.exports')}</h3>
      {exports.length === 0 ? (
        <p className="text-ink-faint text-[13px] italic">{t('preview.exportsNone')}</p>
      ) : (
        <ul className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[13px]">
          {exports.map((goodId) => {
            const good = goodOf(ctx, goodId)
            return (
              <li key={goodId} className="flex items-baseline justify-between gap-1.5">
                <span className="min-w-0 flex-1 truncate">{named(good)[locale]}</span>
                <span className="tnum text-ink-soft">{num(good.buy)}</span>
              </li>
            )
          })}
        </ul>
      )}
    </Sheet>
  )
}
