import { goodOf, portOf, type EngineContext } from './context'
import { flagship, type GameState, type PlayerState } from './state'
import { buyOffers, marketReport, saleQuotes, verkaufszwangOpen } from './selectors'
import type { PortId } from './types'

/**
 * What the Kontormakler on the quay says.
 *
 * The game teaches itself through a person rather than a rules screen: you
 * tie up, someone who works here tells you the one thing worth doing next,
 * and a button takes you straight to it. Nothing here decides anything — it
 * reads the same state the panels read and picks the most useful sentence.
 *
 * Kept out of the UI because it is exactly the kind of thing worth testing:
 * "an empty hold in a port that exports something must send you to Angebot"
 * is a rule about the game, not about React.
 */

export type AdviceTab = 'kaufen' | 'verkaufen' | 'wohin' | 'kai'

export interface Advice {
  /** Stable identifier — used as a key, and what the tests assert on. */
  readonly id: string
  /** One sentence, in the Makler's voice. */
  readonly text: string
  /** Where the button leads, if there is anything to lead to. */
  readonly tab?: AdviceTab
  readonly cta?: string
  /**
   * 'dringend' is for the two mistakes that actually cost a season: leaving
   * with an empty hold, and ignoring a Verkaufszwang.
   */
  readonly urgency: 'ruhig' | 'hinweis' | 'dringend'
}

const money = (n: number) => n.toLocaleString('de-DE')

export function harbourAdvice(
  ctx: EngineContext,
  state: GameState,
  player: PlayerState,
  portId: PortId,
): Advice {
  const ship = flagship(player)
  const cargo = ship.cargo
  const offers = buyOffers(ctx, state, player, portId)
  const affordable = offers.filter((o) => o.status === 'ok')
  const left = state.config.maxPurchasesPerPort - ship.purchasesThisVisit.length

  // 1. The Konjunktur has spoken and the ship may not leave loaded.
  if (verkaufszwangOpen(ctx, state, player, portId)) {
    return {
      id: 'verkaufszwang',
      text: 'Die Börse verlangt einen Abschluß: Sie müssen hier eine Ware absetzen, die dieser Hafen nicht selbst führt. Vorher kommen Sie nicht hinaus.',
      tab: 'verkaufen',
      cta: 'Ladung zeigen',
      urgency: 'dringend',
    }
  }

  // 2. Something aboard fetches a real price right here.
  const quotes = saleQuotes(ctx, state, player, portId)
  const best = quotes
    .filter((q) => q.kind === 'markt' && q.profit > 0)
    .sort((a, b) => b.profit - a.profit)[0]
  if (best) {
    return {
      id: 'hier-verkaufen',
      text: `${goodOf(ctx, best.item.goodId).name} nimmt man Ihnen hier ab — ${money(best.price)}, das sind ${money(best.profit)} über Ihrem Einkauf.`,
      tab: 'verkaufen',
      cta: 'Verkaufen',
      urgency: 'hinweis',
    }
  }

  // 3. The mistake this whole character exists for: selling out and sailing
  //    away empty, which wastes the entire leg.
  if (cargo.length === 0 && left > 0 && affordable.length > 0) {
    const cheapest = [...affordable].sort(
      (a, b) => goodOf(ctx, a.goodId).buy - goodOf(ctx, b.goodId).buy,
    )[0]!
    const name = goodOf(ctx, cheapest.goodId).name
    return {
      id: 'leer-nachladen',
      text: `Ihr Laderaum ist leer — und leer verdient kein Schiff. Hier wird ${name} verladen, ab ${money(goodOf(ctx, cheapest.goodId).buy)}. Nehmen Sie ${left === 1 ? 'noch einen Posten' : `bis zu ${left} Posten`} mit.`,
      tab: 'kaufen',
      cta: 'Angebot ansehen',
      urgency: 'dringend',
    }
  }

  // 4. Empty, and the till cannot help it.
  if (cargo.length === 0 && left > 0 && offers.length > 0) {
    return {
      id: 'leer-kein-geld',
      text: `Was hier verladen wird, ist Ihnen heute zu teuer — das Billigste kostet ${money(Math.min(...offers.map((o) => goodOf(ctx, o.goodId).buy)))}, Ihre Kasse hält ${money(player.cash)}.`,
      tab: 'kaufen',
      cta: 'Angebot ansehen',
      urgency: 'hinweis',
    }
  }

  // 5. Empty and the port has nothing left for this ship.
  if (cargo.length === 0) {
    return {
      id: 'leer-ladeschluss',
      text: left > 0
        ? 'Dieser Hafen führt nichts aus, was Sie laden könnten. Suchen Sie sich einen, der etwas anzubieten hat.'
        : 'Ladeschluß — hier bekommen Sie nichts mehr an Bord. Weiterfahren und anderswo kaufen.',
      tab: 'wohin',
      cta: 'Wohin?',
      urgency: 'hinweis',
    }
  }

  // 6. Loaded, but there is room and money for more.
  if (left > 0 && affordable.length > 0) {
    return {
      id: 'nachladen',
      text: `In diesem Hafen dürfen Sie noch ${left === 1 ? 'eine Ware' : `${left} Waren`} kaufen — der Laderaum selbst hat keine Grenze.`,
      tab: 'kaufen',
      cta: 'Angebot ansehen',
      urgency: 'ruhig',
    }
  }

  // 7. Loaded and done here: where does this cargo actually pay?
  const report = marketReport(ctx, player, 1)
  const target = report[0]
  if (target) {
    return {
      id: 'weiterfahren',
      text: `Hier ist Ihr Geschäft gemacht. ${target.name} führt Ihre Ware nicht selbst und zahlt voll — ${money(target.profit)} bei ${target.distance} ${target.distance === 1 ? 'Punkt' : 'Punkten'} Fahrt.`,
      tab: 'wohin',
      cta: 'Wohin?',
      urgency: 'hinweis',
    }
  }

  // 8. Nothing pressing. The quay still has people on it.
  return {
    id: 'ruhig',
    text: `Ruhiger Tag in ${portOf(ctx, portId).name}. Ihre Ladung wartet auf einen Hafen, der sie braucht.`,
    tab: 'kai',
    cta: 'Am Kai',
    urgency: 'ruhig',
  }
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
        ? `Von hier gehen ${named} und anderes in alle Welt.`
        : `Von hier gehen ${named} in alle Welt.`

  const sellsHere = saleQuotes(ctx, state, player, portId).find(
    (q) => q.kind === 'markt' && q.profit > 0,
  )
  const laderaum =
    ship.cargo.length === 0
      ? 'Ihr Laderaum ist leer.'
      : sellsHere
        ? `Und Ihre ${goodOf(ctx, sellsHere.item.goodId).name} findet hier einen Abnehmer.`
        : `Ihre ${ship.cargo.length} Posten nimmt hier allerdings niemand.`

  return {
    headline: daheim ? `Wieder daheim in ${port.name}.` : `Willkommen in ${port.name}!`,
    body: `${offer} ${ware} ${laderaum}`,
  }
}
