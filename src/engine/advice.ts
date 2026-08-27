import { goodOf, portOf, type EngineContext } from './context'
import { flagship, type GameState, type PlayerState } from './state'
import { buyOffers, marketReport, portAt, saleQuotes, verkaufszwangOpen } from './selectors'
import type { KonjunkturCard, PortId } from './types'
import { exportsAt } from './market'
import { t, tn } from '../i18n'
import { formatNumber, named, type Locale } from '../i18n/locale'

/**
 * The round the Kontormakler walks you through a harbour.
 *
 * The game teaches itself through a person rather than a rules screen. Rather
 * than one hint plus a shortcut past it, the Makler lays the harbour out as an
 * ordered walk — what you are carrying, what is on offer, where it pays — and
 * the single button at the foot of the sheet moves you along. Departure is
 * simply the end of the walk, so there is no way out that skips what is worth
 * seeing.
 *
 * The round is always the same three steps, even where one has nothing to
 * offer. "Nothing for you here today" is worth hearing too, and a step that
 * comes and goes is a step nobody learns to expect — the tabs are this list,
 * so anything that vanishes from it vanishes from under the player's thumb.
 *
 * Kept out of the UI because it is exactly the kind of thing worth testing:
 * "an empty hold in a port that exports something must be walked past the
 * Angebot" is a rule about the game, not about React.
 *
 * He speaks whichever language the reader has chosen, which is why `locale`
 * runs through every function here. The `id` of each stage does not: it is
 * what the tests and the tabs key on, and it stays German because it names a
 * situation rather than saying anything to anybody.
 */

/** The three panels the walk can visit, in the order it visits them. */
export type HarbourStep = 'verkaufen' | 'kaufen' | 'wohin'

export interface Stage {
  readonly step: HarbourStep
  /** As the tab is labelled, so a button naming it is unmistakable. */
  readonly label: string
  /** Stable identifier — what the tests assert on. */
  readonly id: string
  /** One or two sentences, in the Makler's voice. */
  readonly text: string
  /**
   * 'dringend' is for the two mistakes that actually cost a season: leaving
   * with an empty hold, and ignoring a Verkaufszwang.
   */
  readonly urgency: 'ruhig' | 'hinweis' | 'dringend'
}

/*
 * A word wrapped in *...* is set in bold by `Emph`, so the port, the good and
 * the sum can be picked out of a full sentence at a glance without the copy
 * turning into a table. Those asterisks now live in the phrase table rather
 * than here, because which word is worth picking out of a sentence is rarely
 * in the same place in two languages.
 */

export function harbourPlan(
  ctx: EngineContext,
  state: GameState,
  player: PlayerState,
  portId: PortId,
  locale: Locale = 'de',
): readonly Stage[] {
  const money = (n: number) => formatNumber(locale, n)
  const ship = flagship(player)
  const cargo = ship.cargo
  const offers = buyOffers(ctx, state, player, portId)
  const affordable = offers.filter((o) => o.status === 'ok')
  const left = state.config.maxPurchasesPerPort - ship.purchasesThisVisit.length
  const zwang = verkaufszwangOpen(ctx, state, player, portId)

  const LADUNG = t(locale, 'advice.tab.verkaufen')
  const ANGEBOT = t(locale, 'advice.tab.kaufen')
  const WOHIN = t(locale, 'advice.tab.wohin')

  // --- 1. The hold. Always first: it is the question every port opens with.
  const best = saleQuotes(ctx, state, player, portId)
    .filter((q) => q.kind === 'markt' && q.profit > 0)
    .sort((a, b) => b.profit - a.profit)[0]

  const laden: Stage = zwang
    ? {
        step: 'verkaufen',
        label: LADUNG,
        id: 'verkaufszwang',
        text: t(locale, 'advice.verkaufszwang'),
        urgency: 'dringend',
      }
    : best
      ? {
          step: 'verkaufen',
          label: LADUNG,
          id: 'hier-verkaufen',
          text: t(locale, 'advice.hierVerkaufen', {
            good: named(goodOf(ctx, best.item.goodId)),
            price: money(best.price),
            profit: money(best.profit),
          }),
          urgency: 'hinweis',
        }
      : cargo.length > 0
        ? {
            step: 'verkaufen',
            label: LADUNG,
            id: 'nichts-abzusetzen',
            text: tn(locale, 'advice.nichtsAbzusetzen', cargo.length),
            urgency: 'ruhig',
          }
        : {
            step: 'verkaufen',
            label: LADUNG,
            id: 'nichts-an-bord',
            text: t(locale, 'advice.nichtsAnBord'),
            urgency: 'ruhig',
          }

  // --- 2. The quay. Kept even when shut: "nothing for you here today" is
  //        itself worth hearing, and a step that comes and goes is a step
  //        nobody learns to expect.
  let angebot: Stage
  if (left > 0 && affordable.length > 0) {
    const cheapest = [...affordable].sort(
      (a, b) => goodOf(ctx, a.goodId).buy - goodOf(ctx, b.goodId).buy,
    )[0]!
    const good = named(goodOf(ctx, cheapest.goodId))
    const price = money(goodOf(ctx, cheapest.goodId).buy)
    angebot =
      cargo.length === 0
        ? {
            step: 'kaufen',
            label: ANGEBOT,
            id: 'leer-nachladen',
            text: tn(locale, 'advice.leerNachladen', left, { good, price }),
            urgency: 'dringend',
          }
        : {
            step: 'kaufen',
            label: ANGEBOT,
            id: 'nachladen',
            text: tn(locale, 'advice.nachladen', left),
            urgency: 'ruhig',
          }
  } else if (offers.length === 0) {
    angebot = {
      step: 'kaufen',
      label: ANGEBOT,
      id: 'kein-angebot',
      text: t(locale, 'advice.keinAngebot'),
      urgency: 'ruhig',
    }
  } else if (left <= 0) {
    angebot = {
      step: 'kaufen',
      label: ANGEBOT,
      id: 'ladeschluss',
      text: t(locale, 'advice.ladeschluss'),
      urgency: 'ruhig',
    }
  } else {
    angebot = {
      step: 'kaufen',
      label: ANGEBOT,
      id: 'zu-teuer',
      text: t(locale, 'advice.zuTeuer', {
        cheapest: money(Math.min(...offers.map((o) => goodOf(ctx, o.goodId).buy))),
        cash: money(player.cash),
      }),
      urgency: 'hinweis',
    }
  }

  // --- 3. The chart.
  const target = cargo.length > 0 ? marketReport(ctx, state, player, 1)[0] : undefined
  const wohin: Stage =
    cargo.length === 0
      ? {
          step: 'wohin',
          label: WOHIN,
          id: 'nichts-zu-planen',
          text: t(locale, 'advice.nichtsZuPlanen'),
          urgency: 'ruhig',
        }
      : target
        ? {
            step: 'wohin',
            label: WOHIN,
            id: 'weiterfahren',
            text: tn(locale, 'advice.weiterfahren', target.distance, {
              port: target.name,
              profit: money(target.profit),
            }),
            urgency: 'hinweis',
          }
        : {
            step: 'wohin',
            label: WOHIN,
            id: 'kein-markt',
            text: t(locale, 'advice.keinMarkt'),
            urgency: 'hinweis',
          }

  return [laden, angebot, wohin]
}

/** The first thing the Makler has to say — the head of the walk. */
export function harbourAdvice(
  ctx: EngineContext,
  state: GameState,
  player: PlayerState,
  portId: PortId,
  locale: Locale = 'de',
): Stage {
  return harbourPlan(ctx, state, player, portId, locale)[0]!
}

/**
 * Whether casting off right now would waste the voyage: an empty hold, room
 * to buy, and something on the quay the house can pay for.
 */
export function leavingEmptyHanded(
  ctx: EngineContext,
  state: GameState,
  player: PlayerState,
  portId: PortId,
): boolean {
  const ship = flagship(player)
  if (ship.cargo.length > 0) return false
  if (state.config.maxPurchasesPerPort - ship.purchasesThisVisit.length <= 0) return false
  return buyOffers(ctx, state, player, portId).some((o) => o.status === 'ok')
}

// ---------------------------------------------------------------------------
// Arrival
// ---------------------------------------------------------------------------

export interface Greeting {
  readonly headline: string
  /** Two sentences at most: who is speaking, and what this harbour means. */
  readonly body: string
}

/**
 * What the Makler says as the gangway goes down, before any panel opens.
 *
 * Its real job is an introduction — meeting the person first is what makes it
 * obvious afterwards that they are there to be asked. So the offer of help is
 * phrased differently in each port rather than repeating one line 105 times.
 */
const OFFERS = [
  'advice.offer.0',
  'advice.offer.1',
  'advice.offer.2',
  'advice.offer.3',
  'advice.offer.4',
] as const

// ---------------------------------------------------------------------------
// The Konjunktur
// ---------------------------------------------------------------------------

export interface CardOutcome {
  /** The one line worth reading: "Sie erhalten 15.000." */
  readonly headline: string
  /** Who else it touches, and for how long. */
  readonly detail: string
  readonly tone: 'gut' | 'schlecht' | 'neutral'
}

/**
 * What a Konjunkturkarte just did to the player who turned it.
 *
 * The printed card states a rule ("Verkaufspreise + 20 %"), not a consequence,
 * and the money moves without anyone pressing anything — so a player could be
 * charged a Steuer and never work out where their cash went. This says the
 * consequence in the second person, in figures, for the house that drew it.
 *
 * Derived from the effects rather than the printed lines, so a content pack
 * that adds a card gets an explanation for free.
 */
export function konjunkturOutcome(
  ctx: EngineContext,
  player: PlayerState,
  card: KonjunkturCard,
  locale: Locale = 'de',
): CardOutcome {
  const money = (n: number) => formatNumber(locale, n)
  const held = flagship(player).cargo.reduce((sum, item) => sum + item.pricePaid, 0)
  const inPort = portAt(ctx, flagship(player).nodeId) !== null

  for (const effect of card.effects) {
    switch (effect.kind) {
      case 'payoutToDrawer':
        return {
          headline: t(locale, 'advice.card.payout', { amount: money(effect.amount) }),
          detail: t(locale, 'advice.card.payout.detail'),
          tone: 'gut',
        }

      case 'feeForDrawer':
        return {
          headline: t(locale, 'advice.card.fee', { amount: money(effect.amount) }),
          detail: t(locale, 'advice.card.fee.detail'),
          tone: 'schlecht',
        }

      case 'portFeeAllInPort':
        return {
          headline: inPort
            ? t(locale, 'advice.card.fee', { amount: money(effect.amount) })
            : t(locale, 'advice.card.payNothing'),
          detail: t(locale, inPort ? 'advice.card.portFee.detail' : 'advice.card.portFee.atSea'),
          tone: inPort ? 'schlecht' : 'neutral',
        }

      case 'leviedOnAllShips': {
        const due = Math.round((held * effect.percentOfCargoValue) / 100)
        const levy = t(
          locale,
          effect.levy === 'steuer' ? 'advice.card.levy.steuer' : 'advice.card.levy.versicherung',
        )
        return {
          headline:
            due > 0
              ? t(locale, 'advice.card.fee', { amount: money(due) })
              : t(locale, 'advice.card.payNothing'),
          detail:
            due > 0
              ? t(locale, 'advice.card.levy.detail', {
                  levy,
                  percent: effect.percentOfCargoValue,
                  held: money(held),
                })
              : t(locale, 'advice.card.levy.empty', { levy }),
          tone: due > 0 ? 'schlecht' : 'neutral',
        }
      }

      case 'regionalPriceDelta': {
        const up = effect.percent > 0
        return {
          headline: t(locale, 'advice.card.regional', {
            title: effect.title,
            sign: up ? '+' : '−',
            percent: Math.abs(effect.percent),
          }),
          detail: t(locale, 'advice.card.regional.detail', { n: effect.rounds }),
          tone: up ? 'gut' : 'schlecht',
        }
      }

      case 'stormInRegion':
        return {
          headline: effect.title[locale],
          detail: tn(locale, 'advice.card.storm', effect.lose),
          tone: 'schlecht',
        }

      case 'cargoLostByDrawer':
        return {
          headline: effect.title[locale],
          detail:
            held > 0
              ? tn(locale, 'advice.card.cargoLost', effect.lose)
              : t(locale, 'advice.card.cargoLost.empty'),
          tone: held > 0 ? 'schlecht' : 'neutral',
        }

      case 'regionalLevy':
        return {
          headline: t(
            locale,
            effect.sign > 0 ? 'advice.card.regionalLevy.receive' : 'advice.card.regionalLevy.pay',
            { amount: money(effect.amount) },
          ),
          detail: t(locale, 'advice.card.regionalLevy.detail', { title: effect.title }),
          tone: effect.sign > 0 ? 'gut' : 'schlecht',
        }

      case 'salePriceDelta': {
        const up = effect.percent > 0
        return {
          headline: t(locale, 'advice.card.prices', {
            sign: up ? '+' : '−',
            percent: Math.abs(effect.percent),
          }),
          detail: t(locale, up ? 'advice.card.prices.up' : 'advice.card.prices.down'),
          tone: up ? 'gut' : 'schlecht',
        }
      }
    }
  }

  return {
    headline: t(locale, 'advice.card.silent'),
    detail: t(locale, 'advice.card.silent.detail'),
    tone: 'neutral',
  }
}

export function harbourGreeting(
  ctx: EngineContext,
  state: GameState,
  player: PlayerState,
  portId: PortId,
  locale: Locale = 'de',
): Greeting {
  const port = portOf(ctx, portId)
  const ship = flagship(player)
  const daheim = player.homePort === portId

  // Deterministic per harbour, so the same Makler always opens the same way.
  const offer = t(
    locale,
    OFFERS[[...portId].reduce((n, c) => n + c.charCodeAt(0), 0) % OFFERS.length]!,
  )

  const exports = exportsAt(ctx, state, portId).map((id) => named(goodOf(ctx, id))[locale])
  const listed = exports.slice(0, 3).join(', ')
  const ware =
    exports.length === 0
      ? t(locale, 'advice.greeting.exportsNone')
      : t(locale, exports.length > 3 ? 'advice.greeting.exportsMany' : 'advice.greeting.exportsSome', {
          goods: listed,
        })

  const sellsHere = saleQuotes(ctx, state, player, portId).find(
    (q) => q.kind === 'markt' && q.profit > 0,
  )
  const laderaum =
    ship.cargo.length === 0
      ? t(locale, 'advice.greeting.holdEmpty')
      : sellsHere
        ? t(locale, 'advice.greeting.buyerHere', {
            good: named(goodOf(ctx, sellsHere.item.goodId)),
          })
        : tn(locale, 'advice.greeting.noBuyer', ship.cargo.length)

  return {
    headline: t(locale, daheim ? 'advice.greeting.home' : 'advice.greeting.welcome', {
      port: named(port),
    }),
    body: `${offer} ${ware} ${laderaum}`,
  }
}
