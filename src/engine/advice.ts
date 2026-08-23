import { goodOf, portOf, type EngineContext } from './context'
import { flagship, type GameState, type PlayerState } from './state'
import { buyOffers, marketReport, portAt, saleQuotes, verkaufszwangOpen } from './selectors'
import type { KonjunkturCard, PortId } from './types'

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

const money = (n: number) => n.toLocaleString('de-DE')

/**
 * Marks a word for emphasis. The UI renders *...* in bold — see Emph — so the
 * port, the good and the sum can be picked out of a full sentence at a glance
 * without the copy turning into a table.
 */
const key = (text: string | number) => `*${text}*`

export function harbourPlan(
  ctx: EngineContext,
  state: GameState,
  player: PlayerState,
  portId: PortId,
): readonly Stage[] {
  const ship = flagship(player)
  const cargo = ship.cargo
  const offers = buyOffers(ctx, state, player, portId)
  const affordable = offers.filter((o) => o.status === 'ok')
  const left = state.config.maxPurchasesPerPort - ship.purchasesThisVisit.length
  const zwang = verkaufszwangOpen(ctx, state, player, portId)

  // --- 1. The hold. Always first: it is the question every port opens with.
  const best = saleQuotes(ctx, state, player, portId)
    .filter((q) => q.kind === 'markt' && q.profit > 0)
    .sort((a, b) => b.profit - a.profit)[0]

  const laden: Stage = zwang
    ? {
        step: 'verkaufen',
        label: 'Ladung',
        id: 'verkaufszwang',
        text: `Die Börse verlangt einen Abschluß: Sie müssen hier ${key('eine Ware absetzen')}, die dieser Hafen nicht selbst führt. Vorher kommen Sie nicht hinaus.`,
        urgency: 'dringend',
      }
    : best
      ? {
          step: 'verkaufen',
          label: 'Ladung',
          id: 'hier-verkaufen',
          text: `${key(goodOf(ctx, best.item.goodId).name)} nimmt man Ihnen hier ab — ${key(money(best.price))}, das sind ${key(money(best.profit))} über Ihrem Einkauf.`,
          urgency: 'hinweis',
        }
      : cargo.length > 0
        ? {
            step: 'verkaufen',
            label: 'Ladung',
            id: 'nichts-abzusetzen',
            text: `Für Ihre ${key(`${cargo.length} ${cargo.length === 1 ? 'Ware' : 'Posten'}`)} zahlt hier niemand den vollen Preis. Heben Sie sie auf.`,
            urgency: 'ruhig',
          }
        : {
            step: 'verkaufen',
            label: 'Ladung',
            id: 'nichts-an-bord',
            text: `Ihr ${key('Laderaum ist leer')} — abzusetzen gibt es hier also nichts.`,
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
    const name = goodOf(ctx, cheapest.goodId).name
    const ab = money(goodOf(ctx, cheapest.goodId).buy)
    angebot =
      cargo.length === 0
        ? {
            step: 'kaufen',
            label: 'Angebot',
            id: 'leer-nachladen',
            text: `Und ${key('leer verdient kein Schiff')}. Hier wird ${key(name)} verladen, ab ${key(ab)}. Nehmen Sie ${left === 1 ? key('noch einen Posten') : `bis zu ${key(`${left} Posten`)}`} mit.`,
            urgency: 'dringend',
          }
        : {
            step: 'kaufen',
            label: 'Angebot',
            id: 'nachladen',
            text: `Hier dürfen Sie noch ${key(left === 1 ? 'eine Ware' : `${left} Waren`)} laden — der Laderaum selbst hat keine Grenze.`,
            urgency: 'ruhig',
          }
  } else if (offers.length === 0) {
    angebot = {
      step: 'kaufen',
      label: 'Angebot',
      id: 'kein-angebot',
      text: `Dieser Hafen führt ${key('nichts aus')}. Zu laden gibt es hier nichts — anderswo schon.`,
      urgency: 'ruhig',
    }
  } else if (left <= 0) {
    angebot = {
      step: 'kaufen',
      label: 'Angebot',
      id: 'ladeschluss',
      text: `${key('Ladeschluß')} — zwei Waren je Hafen, und die haben Sie. Mehr geht hier nicht an Bord.`,
      urgency: 'ruhig',
    }
  } else {
    const billigste = money(Math.min(...offers.map((o) => goodOf(ctx, o.goodId).buy)))
    angebot = {
      step: 'kaufen',
      label: 'Angebot',
      id: 'zu-teuer',
      text: `Was hier verladen wird, ist Ihnen heute zu teuer — das Billigste kostet ${key(billigste)}, Ihre Kasse hält ${key(money(player.cash))}.`,
      urgency: 'hinweis',
    }
  }

  // --- 3. The chart.
  const target = cargo.length > 0 ? marketReport(ctx, player, 1)[0] : undefined
  const wohin: Stage =
    cargo.length === 0
      ? {
          step: 'wohin',
          label: 'Wohin?',
          id: 'nichts-zu-planen',
          text: `Ohne Ladung ist ${key('jeder Hafen gleich weit')}. Kaufen Sie erst etwas, dann lohnt der Blick auf die Karte.`,
          urgency: 'ruhig',
        }
      : target
        ? {
            step: 'wohin',
            label: 'Wohin?',
            id: 'weiterfahren',
            text: `${key(target.name)} führt Ihre Ware nicht selbst und zahlt voll — ${key(money(target.profit))} bei ${key(`${target.distance} ${target.distance === 1 ? 'Punkt' : 'Punkten'}`)} Fahrt.`,
            urgency: 'hinweis',
          }
        : {
            step: 'wohin',
            label: 'Wohin?',
            id: 'kein-markt',
            text: 'Für diese Ladung findet sich von hier aus kein Markt. Fahren Sie trotzdem — anderswo sieht es anders aus.',
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
): Stage {
  return harbourPlan(ctx, state, player, portId)[0]!
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
  'Ich führe hier die Bücher — wenn Sie nicht weiterwissen, fragen Sie mich.',
  'Solange Ihr Schiff hier liegt, stehe ich für Sie am Kai.',
  'Ich kenne jeden Kontrakt in diesem Hafen. Fragen kostet nichts.',
  'Wenn Sie nicht wissen, was zu tun ist: ich bin gleich hier.',
  'Man schickt mich zu jedem fremden Schiff. Heute also zu Ihnen.',
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
): CardOutcome {
  const held = flagship(player).cargo.reduce((sum, item) => sum + item.pricePaid, 0)
  const inPort = portAt(ctx, flagship(player).nodeId) !== null

  for (const effect of card.effects) {
    switch (effect.kind) {
      case 'payoutToDrawer':
        return {
          headline: `Sie erhalten ${money(effect.amount)}.`,
          detail: 'Eine telegrafische Überweisung an Ihr Kontor. Sonst ändert sich nichts.',
          tone: 'gut',
        }

      case 'feeForDrawer':
        return {
          headline: `Sie zahlen ${money(effect.amount)}.`,
          detail: 'Entladegeld, nur für Ihr Schiff. Die Mitspieler bleiben verschont.',
          tone: 'schlecht',
        }

      case 'portFeeAllInPort':
        return {
          headline: inPort ? `Sie zahlen ${money(effect.amount)}.` : 'Sie zahlen nichts.',
          detail: inPort
            ? 'Hafengebühr — fällig für jedes Schiff, das gerade in einem Hafen liegt.'
            : 'Hafengebühr trifft nur Schiffe, die in einem Hafen liegen. Ihres liegt auf See.',
          tone: inPort ? 'schlecht' : 'neutral',
        }

      case 'leviedOnAllShips': {
        const due = Math.round((held * effect.percentOfCargoValue) / 100)
        const label = effect.levy === 'steuer' ? 'Steuer' : 'Versicherung'
        return {
          headline: due > 0 ? `Sie zahlen ${money(due)}.` : 'Sie zahlen nichts.',
          detail:
            due > 0
              ? `${label}: ${effect.percentOfCargoValue} % vom Warenwert Ihrer Ladung (${money(held)}). Gilt für alle Mitspieler.`
              : `${label} bemißt sich am Warenwert an Bord — Ihr Laderaum ist leer, also bleibt es bei null.`,
          tone: due > 0 ? 'schlecht' : 'neutral',
        }
      }

      case 'salePriceDelta': {
        const up = effect.percent > 0
        return {
          headline: `Verkaufspreise ${up ? '+' : '−'}${Math.abs(effect.percent)} %.`,
          detail: up
            ? 'Hausse: alles, was Sie in diesem Hafen absetzen, bringt entsprechend mehr.'
            : 'Baisse: was Sie in diesem Hafen absetzen, bringt entsprechend weniger. Aufheben ist erlaubt.',
          tone: up ? 'gut' : 'schlecht',
        }
      }
    }
  }

  return {
    headline: 'Die Börse schweigt.',
    detail: 'Diese Karte kostet Sie nichts und bringt Ihnen nichts.',
    tone: 'neutral',
  }
}

export function harbourGreeting(
  ctx: EngineContext,
  state: GameState,
  player: PlayerState,
  portId: PortId,
): Greeting {
  const port = portOf(ctx, portId)
  const ship = flagship(player)
  const daheim = player.homePort === portId

  // Deterministic per harbour, so the same Makler always opens the same way.
  const offer = OFFERS[[...portId].reduce((n, c) => n + c.charCodeAt(0), 0) % OFFERS.length]!

  const exports = ctx.exportsOf(portId).map((id) => goodOf(ctx, id).name)
  const named = exports.slice(0, 3).join(', ')
  const ware =
    exports.length === 0
      ? 'Ausgeführt wird von hier nichts.'
      : exports.length > 3
        ? `Von hier gehen ${key(named)} und anderes in alle Welt.`
        : `Von hier gehen ${key(named)} in alle Welt.`

  const sellsHere = saleQuotes(ctx, state, player, portId).find(
    (q) => q.kind === 'markt' && q.profit > 0,
  )
  const laderaum =
    ship.cargo.length === 0
      ? `Ihr ${key('Laderaum ist leer')}.`
      : sellsHere
        ? `Und Ihre ${key(goodOf(ctx, sellsHere.item.goodId).name)} ${key('findet hier einen Abnehmer')}.`
        : `Ihre ${key(`${ship.cargo.length} Posten`)} nimmt hier allerdings niemand.`

  return {
    headline: daheim ? `Wieder daheim in ${port.name}.` : `Willkommen in ${port.name}!`,
    body: `${offer} ${ware} ${laderaum}`,
  }
}
