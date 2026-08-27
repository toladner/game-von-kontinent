import type { CargoItem, GameState, PlayerState, PortClosure } from './state'
import { activePlayer, flagship, netWorth, type VehicleInstance } from './state'
import { goodOf, type EngineContext } from './context'
import { edgeKey, isPort } from './mapbuild'
import { exportsAt, sellPriceAt } from './market'
import type { Continent, GoodId, KonjunkturCard, Money, NodeId, PortId } from './types'

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
/**
 * Which continent a node lies off.
 *
 * A harbour knows its country and the country its continent. A sea node has
 * neither, so it is taken to belong to the harbour its lane starts from —
 * generated ids are `sea:<a>~<b>:<i>`, which makes that a lookup rather than
 * a search, and puts a ship squarely in one region or the other for as long
 * as it is on that lane. Every card in the erweiterte Konjunktur that asks
 * where a ship is asks it through here.
 */
export function continentOf(ctx: EngineContext, nodeId: NodeId): Continent | null {
  const direct = ctx.portsById.get(nodeId)
  const portId = direct
    ? nodeId
    : nodeId.startsWith('sea:')
      ? nodeId.slice(4).split('~')[0]
      : undefined
  const port = portId ? ctx.portsById.get(portId) : undefined
  if (!port) return null
  return ctx.pack.map.countries.find((c) => c.id === port.country)?.continent ?? null
}

export function quoteSale(
  ctx: EngineContext,
  state: GameState,
  item: CargoItem,
  portId: PortId,
): SaleQuote {
  // Weather damage is a discount on whatever the sale would otherwise have
  // been, not a kind of sale in itself: a spoiled posten the port exports
  // anyway is still an Überfluß sale, and a spoiled foreign one still
  // discharges the Verkaufszwang.
  const spoiled = (price: number) =>
    item.damaged ? Math.round(price * state.config.damagedSaleRate) : price

  const local = exportsAt(ctx, state, portId).includes(item.goodId)
  if (local) {
    const price = spoiled(Math.round(item.pricePaid * state.config.localGlutSaleRate))
    return { item, price, kind: 'ueberfluss', profit: price - item.pricePaid }
  }
  const base = sellPriceAt(ctx, state, portId, item.goodId)
  const price = spoiled(Math.round(base * (1 + state.saleModifierPercent / 100)))
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
  | 'gesperrt'
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
  const shut = closureAt(state, portId) !== null
  return exportsAt(ctx, state, portId).map((goodId) => {
    const g = goodOf(ctx, goodId)
    const stock = state.bankStock[goodId] ?? 0
    let status: BuyBlock = 'ok'
    const capacity = flagship(player).kind.capacity
    if (shut) status = 'gesperrt'
    else if (flagship(player).purchasesThisVisit.includes(goodId)) status = 'schon-geladen'
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
/**
 * Whether this harbour is shut, and by what.
 *
 * Null on every map and in every game not playing the erweiterte Konjunktur,
 * which is nearly all of them — so the empty list is checked first and the
 * rest of the engine can call this freely.
 */
export function closureAt(state: GameState, portId: PortId): PortClosure | null {
  if (state.closures.length === 0) return null
  return state.closures.find((c) => c.portId === portId) ?? null
}

export function verkaufszwangOpen(
  ctx: EngineContext,
  state: GameState,
  player: PlayerState,
  portId: PortId,
): boolean {
  if (!state.mustSellForeign) return false
  // A shut Kontor cannot be sold to, so the obligation lapses rather than
  // stranding a merchant on a red field in a quarantined harbour.
  if (closureAt(state, portId)) return false
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
  /**
   * Real milliseconds to get there, cast-off included. Only set in real-time
   * play — in round play a voyage costs throws, not hours, and quoting a
   * duration would be inventing one.
   */
  readonly travelMs?: number
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
 * How long this vessel lies alongside before she can sail.
 *
 * The course may be set the instant a merchant decides, but the cargo still
 * has to be worked and the hatches closed. Charged against the same clock as
 * the sea legs, so changing the pace of the game moves both together.
 */
export function castOffMs(state: GameState, vehicle: VehicleInstance): number {
  const pips = state.config.realtime.portCallPips ?? 0
  return pips * state.config.realtime.minutesPerPip * (vehicle.kind.speedFactor || 1) * 60_000
}

/**
 * Where a new course begins, and when.
 *
 * A ship lying alongside lays it from the berth she is in, and a ship whose
 * cargo is still being worked counts as lying alongside: nothing has been
 * cast off yet, so the whole voyage may be torn up.
 *
 * Once she is at sea it is a different question. A merchant may change his
 * mind — word of a better price does not wait for a ship to make port — but
 * she cannot put about between two marks with nothing to turn on. So she
 * runs on to the mark ahead of her and the new course is laid from there,
 * with `cameFrom` following her, since the same rule bars her from doubling
 * straight back the way she came.
 *
 * `at` is the instant that course starts being sailed, which is what any
 * estimate of it has to be reckoned from.
 */
export function courseOrigin(
  state: GameState,
  vehicle: VehicleInstance,
): { node: NodeId; cameFrom: NodeId | null; at: number } {
  const voyage = vehicle.voyage
  if (!voyage || state.now < voyage.departsAt) {
    return { node: vehicle.nodeId, cameFrom: vehicle.cameFrom, at: state.now }
  }
  return { node: voyage.route[0]!, cameFrom: vehicle.nodeId, at: voyage.legArrivesAt }
}

/**
 * Travel time from a ship's berth to every node it can reach, in ms.
 *
 * Walks the same breadth-first tree `routeTo` walks — fewest pips wins, and
 * ties are broken the same way — and adds up the real cost of each leg along
 * the way. It has to be the same tree: a cheaper path measured in hours is no
 * use as an estimate if the ship is going to sail the shorter one in pips.
 *
 * Cast-off is not included; callers that are quoting a departure add it.
 */
export function voyageTimesFrom(
  ctx: EngineContext,
  state: GameState,
  vehicle: VehicleInstance,
): ReadonlyMap<NodeId, number> {
  const from = vehicle.nodeId
  const all = ctx.graph.neighbours.get(from) ?? []
  const forward = all.filter((n) => n !== vehicle.cameFrom)
  const seeds = forward.length > 0 ? forward : all

  const times = new Map<NodeId, number>([[from, 0]])
  for (const seed of seeds) {
    if (!times.has(seed)) times.set(seed, legMsFor(ctx, state, vehicle, from, seed))
  }

  let frontier = [...seeds]
  while (frontier.length > 0) {
    const next: NodeId[] = []
    for (const node of frontier) {
      const so_far = times.get(node)!
      for (const neighbour of ctx.graph.neighbours.get(node) ?? []) {
        if (times.has(neighbour)) continue
        times.set(neighbour, so_far + legMsFor(ctx, state, vehicle, node, neighbour))
        next.push(neighbour)
      }
    }
    frontier = next
  }
  return times
}

/**
 * What a voyage to `target` would cost in real time, if ordered now.
 *
 * Cast-off included, because from the merchant's point of view the wait
 * alongside is part of getting there. Null when there is no route, or when
 * the ship is already at sea and cannot be given a new destination.
 */
export function sailingTimeMs(
  ctx: EngineContext,
  state: GameState,
  vehicle: VehicleInstance,
  target: PortId,
): number | null {
  if (vehicle.nodeId === target) return null
  const sailing = voyageTimesFrom(ctx, state, vehicle).get(target)
  if (sailing === undefined) return null
  return castOffMs(state, vehicle) + sailing
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
  const ship = flagship(player)
  const dist = distancesFrom(ctx, ship.nodeId, ship.cameFrom)
  const held = new Set(ship.cargo.map((c) => c.goodId))
  // Computed once for the whole chart rather than per harbour: one traversal
  // instead of a hundred.
  const clock = state.config.travel === 'echtzeit' ? voyageTimesFrom(ctx, state, ship) : null
  const castOff = clock ? castOffMs(state, ship) : 0

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

    const sailing = clock?.get(port.id)
    rows.push({
      portId: port.id,
      name: port.name,
      distance,
      ...(sailing === undefined ? {} : { travelMs: castOff + sailing }),
      proceeds,
      profit,
      sellable: sells.length,
      sells,
      offers: exports.filter((g) => !held.has(g)).length,
    })
  }

  const score = (d: Destination) =>
    flagship(player).cargo.length > 0 ? d.profit / (d.distance + 2) : d.offers / (d.distance + 2)

  const usable = rows
    .filter((d) => (flagship(player).cargo.length > 0 ? d.sellable > 0 : d.offers > 0))
    .sort((a, b) => score(b) - score(a))

  const inHold = ship.cargo.length

  // Under fixed prices a good fetches the same figure in every harbour, so
  // profit is flat and the only question is which is nearest — the best few
  // by score are exactly the right answer.
  if (state.config.preise !== 'entfernung') {
    // Sorted again at the end: making room for the awkward options writes
    // them in wherever a slot came free, which is no order at all.
    return [...withAwkwardOptions(usable.slice(0, limit), usable, limit, inHold)].sort(
      (a, b) => score(b) - score(a),
    )
  }

  /*
   * Under distance pricing the far harbours pay more, so ranking by score
   * alone hands back six variations of "sail a long way" and the decision
   * makes itself. The interesting question is what the extra sea is worth,
   * and that can only be weighed against something close by — so the list is
   * spread over the range of distances actually available and then read from
   * near to far, which is the order the comparison wants to be read in.
   */
  const worthwhile = efficientFrontier(usable)
  const spread = withAwkwardOptions(
    spreadByDistance(worthwhile, limit),
    usable,
    limit,
    inHold,
  )
  return [...spread].sort((a, b) => a.distance - b.distance)
}

/**
 * Make room for harbours that will not take the whole hold.
 *
 * Ranking by what a place pays quietly favours the ports that buy everything,
 * and a chart made only of those turns the decision into "which of these is
 * nearest". A port that takes one posten of two is a different kind of choice
 * — sell the tea here and carry the wool on, or hold both for somewhere that
 * wants the pair — and it is worth a place even when the arithmetic likes it
 * less. Two of them, so the awkward option is a real branch to weigh rather
 * than a single oddity easily read as a mistake.
 *
 * Only when the hold actually has something to split, and only as far as the
 * chart has not already offered them by itself.
 */
function withAwkwardOptions(
  chosen: readonly Destination[],
  candidates: readonly Destination[],
  limit: number,
  held: number,
  want = 2,
): readonly Destination[] {
  if (held < 2 || chosen.length === 0) return chosen
  const missing = want - chosen.filter((d) => d.sellable < held).length
  if (missing <= 0) return chosen

  const taken = new Set(chosen.map((d) => d.portId))
  // Candidates arrive best-first, so these are the best of their kind.
  const extras = candidates
    .filter((d) => d.sellable > 0 && d.sellable < held && !taken.has(d.portId))
    .slice(0, missing)
  if (extras.length === 0) return chosen

  const out = [...chosen]
  for (const extra of extras) {
    if (out.length < limit) {
      out.push(extra)
      continue
    }
    // Displace the last harbour that would buy the whole hold, so the obvious
    // answer keeps the top of the list and only its spare copies give way.
    const victim = out.map((d) => d.sellable >= held).lastIndexOf(true)
    if (victim < 0) break
    out[victim] = extra
  }
  return out
}

/**
 * Drop every destination that some nearer harbour already beats.
 *
 * The price rise flattens out at the ceiling, so past a certain distance the
 * extra sea buys nothing — and a list offering Acapulco at sixty-two pips for
 * the same money as Laurenço-Marques at thirty-seven is offering a choice
 * nobody would make. What is left is the frontier: every harbour on it is
 * either closer or richer than every other, so each row is a real decision.
 */
function efficientFrontier(byScore: readonly Destination[]): readonly Destination[] {
  const kept: Destination[] = []
  let best = -Infinity
  for (const row of [...byScore].sort((a, b) => a.distance - b.distance)) {
    if (row.profit <= best) continue
    kept.push(row)
    best = row.profit
  }
  // Handed back best-first, because that is what the spread expects.
  return kept.sort(
    (a, b) => b.profit / (b.distance + 2) - a.profit / (a.distance + 2),
  )
}

/**
 * Pick `limit` destinations covering the whole range of distances on offer.
 *
 * The candidates arrive best-first. They are split into as many distance
 * bands as there are slots, and the best of each band is taken in turn; any
 * slot left over by an empty band falls back to the next best overall, so a
 * map with nothing far away still returns a full list.
 */
function spreadByDistance(
  candidates: readonly Destination[],
  limit: number,
): readonly Destination[] {
  if (candidates.length <= limit) return candidates

  const distances = candidates.map((d) => d.distance)
  const near = Math.min(...distances)
  const far = Math.max(...distances)
  if (far === near) return candidates.slice(0, limit)

  const bands: Destination[][] = Array.from({ length: limit }, () => [])
  for (const row of candidates) {
    const share = (row.distance - near) / (far - near)
    bands[Math.min(limit - 1, Math.floor(share * limit))]!.push(row)
  }

  const picked: Destination[] = []
  const taken = new Set<string>()
  for (const band of bands) {
    const best = band[0]
    if (!best) continue
    picked.push(best)
    taken.add(best.portId)
  }
  for (const row of candidates) {
    if (picked.length >= limit) break
    if (taken.has(row.portId)) continue
    picked.push(row)
    taken.add(row.portId)
  }
  return picked.slice(0, limit)
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

/** Whether a world card is worth having drawn. */
export type Tenor = 'gut' | 'gemischt' | 'schlecht'

/**
 * Read the temper of a Konjunkturkarte off its effects.
 *
 * The deck carries no such field and the printed cards never needed one: a
 * merchant reading "Verkaufspreise + 25 %" knows at a glance what he is
 * holding. On a screen the glance is worth having back, so it is counted —
 * every effect once, for the house or against it.
 *
 * A card that does both at once lands in the middle, which is honestly where
 * it belongs: Hafengebühr charges 5.000 and lifts every price by a fifth, and
 * whether that was a good morning depends on what is in your hold.
 */
export function konjunkturTenor(card: KonjunkturCard): Tenor {
  let sum = 0
  for (const effect of card.effects) {
    switch (effect.kind) {
      case 'salePriceDelta':
      case 'regionalPriceDelta':
      case 'goodPriceDelta':
        sum += Math.sign(effect.percent)
        break
      case 'payoutToDrawer':
        sum += 1
        break
      case 'regionalLevy':
        sum += effect.sign
        break
      case 'leviedOnAllShips':
      case 'portFeeAllInPort':
      case 'feeForDrawer':
      case 'stormInRegion':
      case 'cargoDamagedInRegion':
      case 'cargoLostByDrawer':
      case 'delayInRegion':
      case 'portClosed':
        sum -= 1
        break
    }
  }
  return sum > 0 ? 'gut' : sum < 0 ? 'schlecht' : 'gemischt'
}
