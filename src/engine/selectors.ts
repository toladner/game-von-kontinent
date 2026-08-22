import type { CargoItem, GameState, PlayerState } from './state'
import { activePlayer, netWorth } from './state'
import { goodOf, type EngineContext } from './context'
import { isPort } from './mapbuild'
import type { GoodId, Money, NodeId, PortId } from './types'

/** The port the given ship lies in, or null if it is on open water. */
export function portAt(ctx: EngineContext, nodeId: NodeId): PortId | null {
  const node = ctx.graph.nodesById.get(nodeId)
  return isPort(node) ? node.id : null
}

export function currentPortId(ctx: EngineContext, state: GameState): PortId | null {
  return portAt(ctx, activePlayer(state).ship.nodeId)
}

/**
 * Where the ship may sail next.
 *
 * A ship may not double back on itself. A dead end is the one exception -
 * otherwise a ship at Vancouver or Leningrad would be stuck for good.
 */
export function legalSteps(ctx: EngineContext, player: PlayerState): readonly NodeId[] {
  const all = ctx.graph.neighbours.get(player.ship.nodeId) ?? []
  const forward = all.filter((n) => n !== player.ship.cameFrom)
  return forward.length > 0 ? forward : all
}

export interface SaleQuote {
  readonly item: CargoItem
  readonly price: Money
  /** 'markt' = normal sale, 'ueberfluss' = the port exports it itself. */
  readonly kind: 'markt' | 'ueberfluss'
  readonly profit: Money
}

/**
 * "Der Verkauf jedoch nur solcher Waren, welche in diesem Lande nicht
 * angeboten werden." Selling a good the port exports itself is possible, but
 * only at a loss price of 25 % below what was paid.
 */
export function quoteSale(
  ctx: EngineContext,
  state: GameState,
  item: CargoItem,
  portId: PortId,
): SaleQuote {
  const local = ctx.exportsOf(portId).includes(item.goodId)
  if (local) {
    const price = Math.round(item.pricePaid * state.config.localGlutSaleRate)
    return { item, price, kind: 'ueberfluss', profit: price - item.pricePaid }
  }
  const base = goodOf(ctx, item.goodId).sell
  const price = Math.round(base * (1 + state.saleModifierPercent / 100))
  return { item, price, kind: 'markt', profit: price - item.pricePaid }
}

export function saleQuotes(
  ctx: EngineContext,
  state: GameState,
  player: PlayerState,
  portId: PortId,
): readonly SaleQuote[] {
  return player.cargo.map((item) => quoteSale(ctx, state, item, portId))
}

export type BuyBlock =
  | 'ok'
  | 'nicht-im-angebot'
  | 'ausverkauft'
  | 'kein-geld'
  | 'schon-geladen'
  | 'ladeschluss'

export interface BuyOffer {
  readonly goodId: GoodId
  readonly price: Money
  readonly stock: number
  readonly status: BuyBlock
}

/** Everything this port sells, with the reason it cannot be bought, if any. */
export function buyOffers(
  ctx: EngineContext,
  state: GameState,
  player: PlayerState,
  portId: PortId,
): readonly BuyOffer[] {
  const max = state.config.maxPurchasesPerPort
  return ctx.exportsOf(portId).map((goodId) => {
    const g = goodOf(ctx, goodId)
    const stock = state.bankStock[goodId] ?? 0
    let status: BuyBlock = 'ok'
    if (player.purchasesThisVisit.includes(goodId)) status = 'schon-geladen'
    else if (player.purchasesThisVisit.length >= max) status = 'ladeschluss'
    else if (stock <= 0) status = 'ausverkauft'
    else if (player.cash < g.buy) status = 'kein-geld'
    return { goodId, price: g.buy, stock, status }
  })
}

/**
 * On a red field the player must place at least one good the port does not
 * itself export before leaving. If the hold holds nothing sellable here, the
 * obligation lapses.
 */
export function verkaufszwangOpen(
  ctx: EngineContext,
  state: GameState,
  player: PlayerState,
  portId: PortId,
): boolean {
  if (!state.mustSellForeign) return false
  return player.cargo.some((item) => !ctx.exportsOf(portId).includes(item.goodId))
}

export interface Standing {
  readonly player: PlayerState
  readonly worth: Money
  readonly rank: number
}

export function standings(state: GameState): readonly Standing[] {
  return [...state.players]
    .map((player) => ({ player, worth: netWorth(player) }))
    .sort((a, b) => b.worth - a.worth)
    .map((row, i) => ({ ...row, rank: i + 1 }))
}

export function isRedField(state: GameState): boolean {
  return state.config.redFields.includes(state.round)
}
