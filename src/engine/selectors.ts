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
  | 'laderaum-voll'

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
    const capacity = player.vehicle.capacity
    if (player.purchasesThisVisit.includes(goodId)) status = 'schon-geladen'
    else if (capacity !== null && player.cargo.length >= capacity) status = 'laderaum-voll'
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

// ---------------------------------------------------------------------------
// Marktbericht — "where should I sail?"
// ---------------------------------------------------------------------------

export interface Destination {
  readonly portId: PortId
  readonly name: string
  /** Sea miles in pips, i.e. how many dice points away. */
  readonly distance: number
  /** What the hold would fetch there at market prices. */
  readonly proceeds: Money
  /** Proceeds minus what was paid for the goods that would sell. */
  readonly profit: Money
  /** How many pieces of cargo this port would take at market price. */
  readonly sellable: number
  /** Goods this port exports that are not already in the hold. */
  readonly offers: number
}

/** Distance in pips from a node to every other node, honouring the no-turn rule. */
export function distancesFrom(
  ctx: EngineContext,
  from: NodeId,
  cameFrom: NodeId | null,
): ReadonlyMap<NodeId, number> {
  const all = ctx.graph.neighbours.get(from) ?? []
  const forward = all.filter((n) => n !== cameFrom)
  const seeds = forward.length > 0 ? forward : all

  const dist = new Map<NodeId, number>([[from, 0]])
  let frontier = seeds.filter((n) => !dist.has(n))
  for (const n of frontier) dist.set(n, 1)

  let step = 1
  while (frontier.length > 0) {
    step += 1
    const next: NodeId[] = []
    for (const node of frontier) {
      for (const neighbour of ctx.graph.neighbours.get(node) ?? []) {
        if (dist.has(neighbour)) continue
        dist.set(neighbour, step)
        next.push(neighbour)
      }
    }
    frontier = next
  }
  return dist
}

/**
 * The sea road from here to a named harbour, without turning on the spot.
 * Returns the nodes to be passed, destination last, or [] if unreachable.
 */
export function routeTo(
  ctx: EngineContext,
  from: NodeId,
  cameFrom: NodeId | null,
  target: PortId,
): NodeId[] {
  if (from === target) return []
  const all = ctx.graph.neighbours.get(from) ?? []
  const forward = all.filter((n) => n !== cameFrom)
  const seeds = forward.length > 0 ? forward : all

  const previous = new Map<NodeId, NodeId>()
  const seen = new Set<NodeId>([from, ...seeds])
  let frontier = [...seeds]
  if (seeds.includes(target)) return [target]

  while (frontier.length > 0) {
    const next: NodeId[] = []
    for (const node of frontier) {
      for (const neighbour of ctx.graph.neighbours.get(node) ?? []) {
        if (seen.has(neighbour)) continue
        seen.add(neighbour)
        previous.set(neighbour, node)
        if (neighbour === target) {
          const path: NodeId[] = [target]
          let at = target
          while (previous.has(at)) {
            at = previous.get(at)!
            path.unshift(at)
          }
          return path
        }
        next.push(neighbour)
      }
    }
    frontier = next
  }
  return []
}

/**
 * The Kontor's advice: which harbours are worth steering for, given what is
 * in the hold right now. Sorted by yield per point of sailing, because a fat
 * profit twenty pips away is worth less than a fair one next door.
 */
export function marketReport(
  ctx: EngineContext,
  player: PlayerState,
  limit = 6,
): readonly Destination[] {
  const dist = distancesFrom(ctx, player.ship.nodeId, player.ship.cameFrom)
  const held = new Set(player.cargo.map((c) => c.goodId))

  const rows: Destination[] = []
  for (const port of ctx.portsById.values()) {
    const distance = dist.get(port.id)
    if (distance === undefined || distance === 0) continue

    const exports = ctx.exportsOf(port.id)
    let proceeds = 0
    let profit = 0
    let sellable = 0
    for (const item of player.cargo) {
      if (exports.includes(item.goodId)) continue // only a loss price there
      const price = goodOf(ctx, item.goodId).sell
      proceeds += price
      profit += price - item.pricePaid
      sellable += 1
    }

    rows.push({
      portId: port.id,
      name: port.name,
      distance,
      proceeds,
      profit,
      sellable,
      offers: exports.filter((g) => !held.has(g)).length,
    })
  }

  const score = (d: Destination) =>
    player.cargo.length > 0 ? d.profit / (d.distance + 2) : d.offers / (d.distance + 2)

  return rows
    .filter((d) => (player.cargo.length > 0 ? d.sellable > 0 : d.offers > 0))
    .sort((a, b) => score(b) - score(a))
    .slice(0, limit)
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

/**
 * The next instant at which the world changes by itself: a ship makes port,
 * the market turns, or the season closes.
 *
 * The server sleeps until then instead of ticking on a timer, so a game that
 * nobody is watching costs nothing and the action log stays short.
 */
export function nextEventAt(state: GameState): number | null {
  if (state.config.travel !== 'echtzeit' || state.phase !== 'laufend') return null

  const legMs = state.config.realtime.minutesPerPip * 60_000
  const times: number[] = []

  for (const p of state.players) {
    const voyage = p.ship.voyage
    // One tick at the final arrival walks the ship through every leg at once.
    if (voyage) times.push(voyage.legArrivesAt + legMs * (voyage.route.length - 1))
  }
  if (state.config.realtime.marketIntervalMinutes > 0) {
    times.push(state.marketSince + state.config.realtime.marketIntervalMinutes * 60_000)
  }
  if (state.endsAt > 0) times.push(state.endsAt)

  const future = times.filter((t) => t > state.now)
  return future.length > 0 ? Math.min(...future) : null
}

/** Arrival time of the whole voyage, not just the current leg. */
export function arrivalAt(state: GameState, player: PlayerState): number | null {
  const voyage = player.ship.voyage
  if (!voyage) return null
  const legMs = state.config.realtime.minutesPerPip * 60_000
  return voyage.legArrivesAt + legMs * (voyage.route.length - 1)
}

export function isRedField(state: GameState): boolean {
  return state.config.redFields.includes(state.round)
}
