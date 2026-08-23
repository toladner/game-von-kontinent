import type { CargoItem, GameState, PlayerState } from './state'
import { activePlayer, flagship, netWorth, type VehicleInstance } from './state'
import { goodOf, type EngineContext } from './context'
import { edgeKey, isPort } from './mapbuild'
import { exportsAt, sellPriceAt } from './market'
import type { GoodId, Money, NodeId, PortId } from './types'

/** The port the given ship lies in, or null if it is on open water. */
export function portAt(ctx: EngineContext, nodeId: NodeId): PortId | null {
  const node = ctx.graph.nodesById.get(nodeId)
  return isPort(node) ? node.id : null
}

export function currentPortId(ctx: EngineContext, state: GameState): PortId | null {
  return portAt(ctx, flagship(activePlayer(state)).nodeId)
}

/**
 * Where the ship may sail next.
 *
 * A ship may not double back on itself. A dead end is the one exception -
 * otherwise a ship at Vancouver or Leningrad would be stuck for good.
 */
export function legalSteps(ctx: EngineContext, player: PlayerState): readonly NodeId[] {
  const all = ctx.graph.neighbours.get(flagship(player).nodeId) ?? []
  const forward = all.filter((n) => n !== flagship(player).cameFrom)
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
  const local = exportsAt(ctx, state, portId).includes(item.goodId)
  if (local) {
    const price = Math.round(item.pricePaid * state.config.localGlutSaleRate)
    return { item, price, kind: 'ueberfluss', profit: price - item.pricePaid }
  }
  const base = sellPriceAt(ctx, state, portId, item.goodId)
  const price = Math.round(base * (1 + state.saleModifierPercent / 100))
  return { item, price, kind: 'markt', profit: price - item.pricePaid }
}

export function saleQuotes(
  ctx: EngineContext,
  state: GameState,
  player: PlayerState,
  portId: PortId,
): readonly SaleQuote[] {
  return flagship(player).cargo.map((item) => quoteSale(ctx, state, item, portId))
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
  return exportsAt(ctx, state, portId).map((goodId) => {
    const g = goodOf(ctx, goodId)
    const stock = state.bankStock[goodId] ?? 0
    let status: BuyBlock = 'ok'
    const capacity = flagship(player).kind.capacity
    if (flagship(player).purchasesThisVisit.includes(goodId)) status = 'schon-geladen'
    else if (capacity !== null && flagship(player).cargo.length >= capacity) status = 'laderaum-voll'
    else if (flagship(player).purchasesThisVisit.length >= max) status = 'ladeschluss'
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
  return flagship(player).cargo.some(
    (item) => !exportsAt(ctx, state, portId).includes(item.goodId),
  )
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
  /** Exactly which of your goods it takes, and for what. */
  readonly sells: readonly { readonly goodId: GoodId; readonly price: Money; readonly profit: Money }[]
  /** Goods this port exports that are not already in the hold. */
  readonly offers: number
}

/** Where one particular piece of cargo fetches the most, per point of sailing. */
export interface SellDestination {
  readonly portId: PortId
  readonly name: string
  readonly distance: number
  readonly price: Money
  readonly profit: Money
}

/**
 * The best harbours for a single good.
 *
 * This is the question a player actually asks after buying something: not
 * "which ports are near" but "who wants this, and is it worth the voyage".
 */
export function sellDestinations(
  ctx: EngineContext,
  state: GameState,
  player: PlayerState,
  item: CargoItem,
  limit = 3,
): readonly SellDestination[] {
  const ship = flagship(player)
  const dist = distancesFrom(ctx, ship.nodeId, ship.cameFrom)

  const rows: SellDestination[] = []
  for (const port of ctx.portsById.values()) {
    const distance = dist.get(port.id)
    if (distance === undefined || distance === 0) continue
    // A port that ships it itself will only pay a loss price.
    if (exportsAt(ctx, state, port.id).includes(item.goodId)) continue
    const price = sellPriceAt(ctx, state, port.id, item.goodId)
    rows.push({
      portId: port.id,
      name: port.name,
      distance,
      price,
      profit: price - item.pricePaid,
    })
  }
  // Under 'fest' the price is the same everywhere and nearness decides;
  // under 'entfernung' a long haul can be worth the extra sea, so rank by
  // what is actually earned and let distance break the tie.
  return rows
    .sort((a, b) => b.profit - a.profit || a.distance - b.distance)
    .slice(0, limit)
}

/**
 * How long this vessel needs for one leg, in milliseconds.
 *
 * Time is charged by the sea mile rather than by the hop. The graph knows the
 * great-circle length of every segment, and a leg is billed against the
 * median segment, so `minutesPerPip` still reads as "how long an ordinary hop
 * takes" while the run from Lissabon to the Azores properly costs more than
 * a coastal step. `speedFactor` then makes a Großfrachter the lumberer it is.
 *
 * Ships still sit at a node for the whole leg, so nothing about this disturbs
 * the collision rule: two vessels are on the same point or they are not.
 */
export function legMsFor(
  ctx: EngineContext,
  state: GameState,
  vehicle: VehicleInstance,
  from: NodeId,
  to: NodeId,
): number {
  const km = ctx.graph.edgeKm.get(edgeKey(from, to))
  const relative = km && ctx.graph.typicalKm > 0 ? km / ctx.graph.typicalKm : 1
  return (
    state.config.realtime.minutesPerPip * relative * (vehicle.kind.speedFactor || 1) * 60_000
  )
}

/**
 * When a voyage in progress reaches its destination.
 *
 * The leg under way has a known arrival; the rest are priced from the map,
 * so the estimate stays honest on a route whose legs differ in length.
 */
export function voyageEndsAt(
  ctx: EngineContext,
  state: GameState,
  vehicle: VehicleInstance,
): number | null {
  const voyage = vehicle.voyage
  if (!voyage) return null
  let at = voyage.legArrivesAt
  // route[0] is where this leg lands; everything after it is still to sail.
  for (let i = 0; i < voyage.route.length - 1; i++) {
    at += legMsFor(ctx, state, vehicle, voyage.route[i]!, voyage.route[i + 1]!)
  }
  return at
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
  state: GameState,
  player: PlayerState,
  limit = 6,
): readonly Destination[] {
  const dist = distancesFrom(ctx, flagship(player).nodeId, flagship(player).cameFrom)
  const held = new Set(flagship(player).cargo.map((c) => c.goodId))

  const rows: Destination[] = []
  for (const port of ctx.portsById.values()) {
    const distance = dist.get(port.id)
    if (distance === undefined || distance === 0) continue

    const exports = exportsAt(ctx, state, port.id)
    let proceeds = 0
    let profit = 0
    const sells: { goodId: GoodId; price: Money; profit: Money }[] = []
    for (const item of flagship(player).cargo) {
      if (exports.includes(item.goodId)) continue // only a loss price there
      const price = sellPriceAt(ctx, state, port.id, item.goodId)
      proceeds += price
      profit += price - item.pricePaid
      sells.push({ goodId: item.goodId, price, profit: price - item.pricePaid })
    }

    rows.push({
      portId: port.id,
      name: port.name,
      distance,
      proceeds,
      profit,
      sellable: sells.length,
      sells,
      offers: exports.filter((g) => !held.has(g)).length,
    })
  }

  const score = (d: Destination) =>
    flagship(player).cargo.length > 0 ? d.profit / (d.distance + 2) : d.offers / (d.distance + 2)

  return rows
    .filter((d) => (flagship(player).cargo.length > 0 ? d.sellable > 0 : d.offers > 0))
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
export function nextEventAt(ctx: EngineContext, state: GameState): number | null {
  if (state.config.travel !== 'echtzeit' || state.phase !== 'laufend') return null

  const times: number[] = []

  for (const p of state.players) {
    for (const vehicle of p.fleet) {
      const voyage = vehicle.voyage
      // One tick at the final arrival walks a ship through every leg at once.
      if (voyage) {
        times.push(voyageEndsAt(ctx, state, vehicle) ?? voyage.legArrivesAt)
      }
    }
  }
  if (state.config.realtime.marketIntervalMinutes > 0) {
    times.push(state.marketSince + state.config.realtime.marketIntervalMinutes * 60_000)
  }
  if (state.endsAt > 0) times.push(state.endsAt)

  const future = times.filter((t) => t > state.now)
  return future.length > 0 ? Math.min(...future) : null
}

/** Arrival time of the whole voyage, not just the current leg. */
export function arrivalAt(
  ctx: EngineContext,
  state: GameState,
  player: PlayerState,
): number | null {
  return voyageEndsAt(ctx, state, flagship(player))
}

export function arrivalOf(
  ctx: EngineContext,
  state: GameState,
  vehicle: VehicleInstance,
): number | null {
  return voyageEndsAt(ctx, state, vehicle)
}

export function isRedField(state: GameState): boolean {
  return state.config.redFields.includes(state.round)
}

/**
 * Whether this table has a shipyard at all.
 *
 * The original game gives every house one steamer and no way to buy another,
 * so a limit of one means the yard is not merely full — it does not exist.
 */
export function hasShipyard(state: GameState): boolean {
  return state.config.maxFleetSize > 1
}

/** Why the yard will not sell, in words that fit the setting. */
export function fleetLimitNote(maxFleetSize: number): string {
  return maxFleetSize <= 1
    ? 'Ein Haus, ein Schiff — so will es die Anleitung.'
    : `Mehr als ${maxFleetSize} Schiffe verwaltet kein Haus.`
}
