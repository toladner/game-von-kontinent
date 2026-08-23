import type { EngineContext } from './context'
import { goodOf } from './context'
import type { GameState } from './state'
import type { GoodId, Money, PortId } from './types'
import { nextInt, type RngState } from './rng'

/**
 * What a harbour offers, and what it pays.
 *
 * The printed game answers both questions from a fixed table: Hamburg ships
 * these six goods, and every good has one Verkaufspreis good anywhere. Two
 * table options loosen that, and both of them turn a lookup into a question
 * about the state of *this* game — which is why they live here rather than on
 * the context, where the answer could only ever depend on the content pack.
 *
 *   Angebot 'zufaellig'  - which goods a port exports is rolled from the seed.
 *   Preise  'entfernung' - a good is worth more the further it has been
 *                          carried from the nearest harbour that ships it.
 */

/**
 * A sale at the very doorstep of a source fetches this share of the printed
 * price; every pip of sea between here and the nearest exporter adds
 * `PER_PIP` on top, up to `CEILING`.
 *
 * The floor is below 1 on purpose. If distance could only ever add, the
 * option would be a blanket pay rise; making the short haul a poor sale is
 * what turns "how far have I carried this" into a decision.
 */
const FLOOR = 0.7
const PER_PIP = 0.09
const CEILING = 2.0

/** Prices are quoted in whole thousands, as the Warenkarten are printed. */
const round1000 = (n: number) => Math.round(n / 1000) * 1000

/**
 * The goods this harbour ships out.
 *
 * Falls through to the content pack unless the table rolled its own trade
 * routes, in which case the rolled list is part of the game state and travels
 * with the save, the replay and the wire.
 */
export function exportsAt(
  ctx: EngineContext,
  state: GameState,
  portId: PortId,
): readonly GoodId[] {
  return state.exports?.[portId] ?? ctx.exportsOf(portId)
}

/**
 * Roll a fresh set of trade routes.
 *
 * Each harbour keeps the *number* of goods the pack gave it, so the map's
 * shape — busy entrepôts, thin outposts — survives the shuffle even though
 * the cargo does not. Every good is then guaranteed a home, because a good
 * that no harbour ships is a card that can never be bought and a sale price
 * that can never be tested.
 */
export function rollExports(
  ctx: EngineContext,
  rng: RngState,
): [Record<string, GoodId[]>, RngState] {
  const goods = ctx.pack.goods.map((g) => g.id)
  const ports = [...ctx.portsById.keys()].sort()
  const out: Record<string, GoodId[]> = {}
  let r = rng

  for (const portId of ports) {
    const want = Math.max(1, ctx.exportsOf(portId).length)
    const picked: GoodId[] = []
    // Sampling without replacement: a harbour shipping the same good twice
    // would break "von einer Warengattung nur eine Karte" in a silly way.
    const pool = [...goods]
    for (let i = 0; i < want && pool.length > 0; i++) {
      const [index, next] = nextInt(r, pool.length)
      r = next
      picked.push(pool.splice(index, 1)[0]!)
    }
    out[portId] = picked.sort((a, b) => a - b)
  }

  // Anything nobody ships gets a berth, so all 72 cards stay in play.
  const placed = new Set(Object.values(out).flat())
  for (const goodId of goods) {
    if (placed.has(goodId)) continue
    const [index, next] = nextInt(r, ports.length)
    r = next
    const portId = ports[index]!
    out[portId] = [...out[portId]!, goodId].sort((a, b) => a - b)
  }

  return [out, r]
}

/**
 * Hop distance from every harbour to the nearest one that ships `goodId`.
 *
 * A multi-source breadth-first search over the sea lanes: seed the queue with
 * every exporter at zero and flood outwards. Memoised against the export
 * table it was computed from, so a game pays for each good once however often
 * the Wohin? panel is redrawn.
 */
const sourceDistances = new WeakMap<object, Map<GoodId, ReadonlyMap<string, number>>>()

export function distanceToSource(
  ctx: EngineContext,
  state: GameState,
  goodId: GoodId,
): ReadonlyMap<string, number> {
  // Keyed on whatever decides the answer: the rolled table, or the pack.
  const key: object = state.exports ?? ctx.pack
  let perGood = sourceDistances.get(key)
  if (!perGood) {
    perGood = new Map()
    sourceDistances.set(key, perGood)
  }
  const cached = perGood.get(goodId)
  if (cached) return cached

  const dist = new Map<string, number>()
  const queue: string[] = []
  for (const portId of ctx.portsById.keys()) {
    if (exportsAt(ctx, state, portId).includes(goodId)) {
      dist.set(portId, 0)
      queue.push(portId)
    }
  }

  for (let head = 0; head < queue.length; head++) {
    const at = queue[head]!
    const d = dist.get(at)!
    for (const next of ctx.graph.neighbours.get(at) ?? []) {
      if (dist.has(next)) continue
      dist.set(next, d + 1)
      queue.push(next)
    }
  }

  perGood.set(goodId, dist)
  return dist
}

/**
 * What this harbour pays for one unit of a good, ignoring the Konjunktur.
 *
 * Under 'fest' this is simply the printed Verkaufspreis. Under 'entfernung'
 * it climbs with the sea between here and the nearest place the good is
 * loaded, which is the whole point of carrying it a long way.
 *
 * Says nothing about whether a sale is *allowed* — a harbour that ships the
 * good itself pays a glut price instead, and that rule is applied by the
 * caller in `quoteSale`.
 */
export function sellPriceAt(
  ctx: EngineContext,
  state: GameState,
  portId: PortId,
  goodId: GoodId,
): Money {
  const card = goodOf(ctx, goodId).sell
  let price = card

  if (state.config.preise === 'entfernung') {
    const hops = distanceToSource(ctx, state, goodId).get(portId)
    // Unreachable from any source: nothing to price against, so pay the card.
    if (hops !== undefined) price = card * Math.min(CEILING, FLOOR + PER_PIP * hops)
  }

  const wind = weatherOver(ctx, state, portId)
  if (wind !== 0) price = price * (1 + wind / 100)

  return round1000(price)
}

/**
 * The regional price weather over a harbour, as a percentage.
 *
 * Zero unless the erweiterte Konjunktur is in play and a card has settled
 * something over this continent. Expiry is handled where time passes; this
 * only reads.
 */
export function weatherOver(ctx: EngineContext, state: GameState, portId: PortId): number {
  if (state.weather.length === 0) return 0
  const port = ctx.portsById.get(portId)
  if (!port) return 0
  const continent = ctx.pack.map.countries.find((c) => c.id === port.country)?.continent
  if (!continent) return 0
  return state.weather
    .filter((w) => w.continent === continent)
    .reduce((sum, w) => sum + w.percent, 0)
}
