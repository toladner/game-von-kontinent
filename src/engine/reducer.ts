import type { ActionResult, GameAction, GameEvent } from './actions'
import { msg, msgn, type MsgKey, type MsgStem, type Vars } from '../i18n'
import { named, type Localized } from '../i18n/locale'
import type {
  CargoItem,
  GameState,
  Letter,
  MarketWeather,
  Pigeon,
  PlayerState,
  PortClosure,
  Sighting,
  VehicleInstance,
} from './state'
import { flagship } from './state'
import { seeVehicle } from './fog'
import { makePersona, makeShipIdentity } from './persona'
import { nextInt } from './rng'
import { goodOf, type EngineContext } from './context'
import { isPort } from './mapbuild'
import { rollDie } from './rng'
import {
  distancesFrom,
  fleetLimitNote,
  legalSteps,
  castOffMs,
  closureAt,
  continentOf,
  courseOrigin,
  legMsFor,
  portAt,
  quoteSale,
  routeTo,
  verkaufszwangOpen,
  voyageEndsAt,
} from './selectors'
import type { Continent, KonjunkturEffect, Money, NodeId } from './types'
import { exportsAt } from './market'

type Draft = { -readonly [K in keyof GameState]: GameState[K] } & {
  players: PlayerState[]
  bankStock: Record<number, number>
  deck: string[]
}

function draftOf(state: GameState): Draft {
  return {
    ...state,
    players: [...state.players],
    bankStock: { ...state.bankStock },
    deck: [...state.deck],
  }
}

function patchPlayer(draft: Draft, index: number, patch: Partial<PlayerState>): void {
  const current = draft.players[index]
  if (!current) throw new Error(`No player at ${index}`)
  draft.players[index] = { ...current, ...patch }
}

/** Replace one vessel in a house's fleet. */
function patchVehicle(
  draft: Draft,
  index: number,
  vehicleId: string,
  patch: Partial<VehicleInstance>,
): void {
  const player = draft.players[index]
  if (!player) throw new Error(`No player at ${index}`)
  draft.players[index] = {
    ...player,
    fleet: player.fleet.map((v) => (v.id === vehicleId ? { ...v, ...patch } : v)),
  }
}

/** Patch the vessel the merchant is aboard. */
function patchShip(draft: Draft, index: number, patch: Partial<VehicleInstance>): void {
  const player = draft.players[index]
  if (!player) throw new Error(`No player at ${index}`)
  patchVehicle(draft, index, flagship(player).id, patch)
}

/**
 * Refuse an order, naming the reason by key rather than by sentence.
 *
 * The words are chosen where the refusal is read, not where it is decided —
 * see `GameEvent['rejected']`. Passing a `MsgKey` rather than a string means
 * a typo here is a compile error rather than a key rendered at a player.
 */
const reject = (state: GameState, key: MsgKey, vars?: Vars): ActionResult => ({
  state,
  events: [{ type: 'rejected', reason: msg(key, vars) }],
})

/** The same, for a refusal that names a number of things. */
const rejectN = (
  state: GameState,
  key: MsgStem,
  n: number,
  vars?: Vars,
): ActionResult => ({
  state,
  events: [{ type: 'rejected', reason: msgn(key, n, vars) }],
})

// ---------------------------------------------------------------------------
// Money
// ---------------------------------------------------------------------------

/**
 * Take money off a player, selling cargo to the Exportbank at the loss price
 * if the till cannot cover it:
 *
 * "Hat sich ein Spieler so sehr verausgabt, daß er solche Leistungen mit
 * seinen Barmitteln nicht mehr bezahlen kann, muß er zum Verlustpreis von
 * 75 % des Einkaufswertes Waren an die Exportbank verkaufen."
 */
function chargePlayer(
  draft: Draft,
  index: number,
  amount: Money,
  reason: 'steuer' | 'versicherung' | 'hafengebuehr' | 'entladegeld' | 'schaden',
  events: GameEvent[],
): void {
  if (amount <= 0) return
  let player = draft.players[index]!
  let guard = 0

  // The whole house answers for a debt, not just the ship the merchant
  // happens to be standing on.
  for (;;) {
    if (player.cash >= amount || guard++ > 200) break
    let bestVehicle: VehicleInstance | null = null
    let bestItem: CargoItem | null = null
    for (const vehicle of player.fleet) {
      for (const item of vehicle.cargo) {
        if (!bestItem || item.pricePaid > bestItem.pricePaid) {
          bestItem = item
          bestVehicle = vehicle
        }
      }
    }
    if (!bestItem || !bestVehicle) break

    const price = Math.round(bestItem.pricePaid * draft.config.distressSaleRate)
    draft.bankStock[bestItem.goodId] = (draft.bankStock[bestItem.goodId] ?? 0) + 1
    patchVehicle(draft, index, bestVehicle.id, {
      cargo: bestVehicle.cargo.filter((c) => c.uid !== bestItem!.uid),
    })
    patchPlayer(draft, index, { cash: draft.players[index]!.cash + price })
    events.push({
      type: 'sold',
      playerId: player.id,
      goodId: bestItem.goodId,
      price,
      profit: price - bestItem.pricePaid,
      kind: 'notverkauf',
    })
    player = draft.players[index]!
  }

  const paid = Math.min(amount, player.cash)
  patchPlayer(draft, index, { cash: player.cash - paid })
  events.push({ type: 'paid', playerId: player.id, amount: paid, reason })
}

function payPlayer(
  draft: Draft,
  index: number,
  amount: Money,
  reason: 'telegramm' | 'schaden',
  events: GameEvent[],
): void {
  const player = draft.players[index]!
  patchPlayer(draft, index, { cash: player.cash + amount })
  events.push({ type: 'received', playerId: player.id, amount, reason })
}

// ---------------------------------------------------------------------------
// Konjunktur effects
// ---------------------------------------------------------------------------

/**
 * Whether a ship has actually left the quay.
 *
 * A course may be set while the cargo is still being worked, and for that
 * stretch she is alongside with her hatches open — so the merchant may keep
 * trading and change their mind. Only once she has cast off is she at sea.
 */
function atSea(state: GameState, vehicle: VehicleInstance): boolean {
  const voyage = vehicle.voyage
  if (!voyage) return false
  return state.now >= voyage.departsAt
}


/**
 * Throw cargo overboard, dearest first.
 *
 * Dearest first because losing the cheapest posten would make a storm an
 * inconvenience; this way it is news. Silent when the hold is empty — there
 * is nothing to report and nothing to lose.
 *
 * Named by ship rather than by house: a storm is weather, and weather finds
 * the vessel that sailed into it. This used to reach for the flagship, which
 * meant a merchant could keep a second ship in the same gale and watch it
 * come through untouched.
 */
function jettison(
  draft: Draft,
  index: number,
  vehicleId: string,
  count: number,
  reason: Localized<string>,
  events: GameEvent[],
): void {
  const player = draft.players[index]!
  const ship = player.fleet.find((v) => v.id === vehicleId)
  if (!ship || ship.cargo.length === 0) return

  const doomed = [...ship.cargo].sort((a, b) => b.pricePaid - a.pricePaid).slice(0, count)
  const lost = new Set(doomed.map((c) => c.uid))
  patchVehicle(draft, index, ship.id, { cargo: ship.cargo.filter((c) => !lost.has(c.uid)) })

  for (const item of doomed) {
    draft.bankStock[item.goodId] = (draft.bankStock[item.goodId] ?? 0) + 1
    events.push({
      type: 'cargoLost',
      playerId: player.id,
      goodId: item.goodId,
      value: item.pricePaid,
      reason,
    })
  }
}

/**
 * Spoil cargo without taking it, dearest first.
 *
 * The gentler half of heavy weather, and the more interesting one. A sunk
 * posten is a number going down and nothing further to decide; a soaked one
 * is still in the hold, still yours to place, and worth half — so it becomes
 * a question of which harbour will take it and whether it is worth the
 * freight. Already-spoiled cargo is passed over: a bale can only be ruined
 * once, and hitting it twice would quietly make the second storm a no-op.
 */
function spoil(
  draft: Draft,
  index: number,
  vehicleId: string,
  count: number,
  reason: Localized<string>,
  events: GameEvent[],
): void {
  const player = draft.players[index]!
  const ship = player.fleet.find((v) => v.id === vehicleId)
  if (!ship) return

  const sound = ship.cargo.filter((c) => !c.damaged)
  if (sound.length === 0) return

  const hit = new Set(
    [...sound].sort((a, b) => b.pricePaid - a.pricePaid).slice(0, count).map((c) => c.uid),
  )
  patchVehicle(draft, index, ship.id, {
    cargo: ship.cargo.map((c) => (hit.has(c.uid) ? { ...c, damaged: true } : c)),
  })

  for (const item of ship.cargo) {
    if (!hit.has(item.uid)) continue
    events.push({ type: 'cargoDamaged', playerId: player.id, goodId: item.goodId, reason })
  }
}

/**
 * Hold a ship up at sea.
 *
 * Every leg is timed from the one before it, so pushing the leg she is on
 * pushes the whole rest of the voyage with it — which is what being blown off
 * a headland actually does. A ship still alongside is not affected: she is in
 * shelter, and the weather is a reason to stay there.
 */
function holdUp(
  draft: Draft,
  index: number,
  vehicleId: string,
  minutes: number,
  reason: Localized<string>,
  events: GameEvent[],
): void {
  const player = draft.players[index]!
  const ship = player.fleet.find((v) => v.id === vehicleId)
  if (!ship?.voyage) return
  if (!atSea(draft as GameState, ship)) return

  patchVehicle(draft, index, ship.id, {
    voyage: { ...ship.voyage, legArrivesAt: ship.voyage.legArrivesAt + minutes * 60_000 },
  })
  events.push({ type: 'heldUp', playerId: player.id, minutes, reason })
}

/**
 * What the standing world card does to one ship, when that ship does the
 * thing the card is about.
 *
 * In round play every Konjunktur card is drawn by somebody, at a quayside,
 * on arrival. That is what makes its wording sensible: you pay the Entladegeld
 * because you are unloading, you take the Telegramm because the wire is
 * addressed to your house, you pay the Hafengebühr because your ship is lying
 * in a harbour. Real-time play has no drawer — a card turns every twenty
 * minutes and stands for the whole world — and the first answer to that was
 * to charge and pay the entire fleet wherever it happened to be. Which is how
 * a merchant three days out into the Atlantic came to be billed for unloading.
 *
 * So the card stands, and settles with each ship at the quayside instead:
 * dues and telegrams when she berths, the unloading fee when she actually
 * lands cargo. Once each per card, so waiting one out is a real choice and
 * not merely a delay. What the card does to prices needs no ship and is
 * applied the moment it turns, exactly as before.
 */
function settleStandingCard(
  ctx: EngineContext,
  draft: Draft,
  index: number,
  vehicle: VehicleInstance,
  trigger: 'berth' | 'unload',
  events: GameEvent[],
): void {
  const card = draft.marketCardId ? ctx.cardsById.get(draft.marketCardId) : null
  if (!card) return
  if (!portAt(ctx, vehicle.nodeId)) return
  if (atSea(draft as GameState, vehicle)) return

  const playerId = draft.players[index]!.id
  for (const effect of card.effects) {
    // A telegram is addressed to a house; dues and fees are charged to the
    // ship that incurred them, so a second vessel pays its own.
    const subject = effect.kind === 'payoutToDrawer' ? playerId : vehicle.id
    const key = `${effect.kind}:${subject}`
    if (draft.marketSettled.includes(key)) continue

    if (effect.kind === 'payoutToDrawer' && trigger === 'berth') {
      payPlayer(draft, index, effect.amount, 'telegramm', events)
    } else if (effect.kind === 'portFeeAllInPort' && trigger === 'berth') {
      chargePlayer(draft, index, effect.amount, 'hafengebuehr', events)
    } else if (effect.kind === 'feeForDrawer' && trigger === 'unload') {
      chargePlayer(draft, index, effect.amount, 'entladegeld', events)
    } else {
      continue
    }
    draft.marketSettled = [...draft.marketSettled, key]
  }
}

/**
 * Every ship lying in, or sailing through, one part of the world.
 *
 * Weather is the one thing in this game that asks where you are rather than
 * whose turn it is, and it has to ask it of hulls and not of houses: a
 * merchant with two ships has one in the gale and one in Hamburg.
 */
function forEachShipIn(
  ctx: EngineContext,
  draft: Draft,
  continent: Continent,
  hit: (index: number, ship: VehicleInstance) => void,
): void {
  for (let i = 0; i < draft.players.length; i++) {
    for (const ship of [...draft.players[i]!.fleet]) {
      if (continentOf(ctx, ship.nodeId) !== continent) continue
      hit(i, ship)
    }
  }
}

/**
 * Lift the quarantines that have run their course, and say so.
 *
 * Announced rather than silently dropped: a harbour that shut with a headline
 * has to open with one, or a merchant who took the gamble and sailed there
 * anyway has no way of knowing whether it came off.
 */
function reopenPorts(
  draft: Draft,
  lapsed: (c: PortClosure) => boolean,
  events: GameEvent[],
): void {
  if (draft.closures.length === 0) return
  const open = draft.closures.filter(lapsed)
  if (open.length === 0) return
  draft.closures = draft.closures.filter((c) => !lapsed(c))
  for (const c of open) events.push({ type: 'portReopened', portId: c.portId })
}

/**
 * Hang a price notice over the market until it lapses.
 *
 * Shared by the two that settle rather than strike: weather over an ocean and
 * a report on one ware. Both need the same expiry sum, and the round game and
 * the real-time game count "vier Runden" differently — rounds on the track,
 * turns of the market on the clock. Doing that twice invited them to drift.
 *
 * A new notice replaces the one it overlaps: two coffee reports in a row are
 * the market changing its mind, not the market twice as excited.
 */
function settleWeather(
  draft: Draft,
  entry: Omit<MarketWeather, 'untilRound' | 'untilTime'>,
  rounds: number,
  events: GameEvent[],
): void {
  const realtime = draft.config.travel === 'echtzeit'
  const same = (w: MarketWeather) =>
    w.continent === entry.continent && w.goodId === entry.goodId && w.category === entry.category

  draft.weather = [
    ...draft.weather.filter((w) => !same(w)),
    {
      ...entry,
      untilRound: realtime ? null : draft.round + rounds,
      untilTime: realtime
        ? draft.now + rounds * draft.config.realtime.marketIntervalMinutes * 60_000
        : null,
    },
  ]
  events.push({
    type: 'weatherSet',
    continent: entry.continent ?? '',
    percent: entry.percent,
    title: entry.title,
  })
}

function applyEffect(
  ctx: EngineContext,
  draft: Draft,
  effect: KonjunkturEffect,
  drawerIndex: number,
  events: GameEvent[],
): void {
  switch (effect.kind) {
    case 'salePriceDelta':
      draft.saleModifierPercent += effect.percent
      return

    case 'payoutToDrawer':
      payPlayer(draft, drawerIndex, effect.amount, 'telegramm', events)
      return

    case 'regionalPriceDelta':
      // Weather, not a single transaction: it hangs over the continent until
      // it lapses, and every sale made there meanwhile feels it.
      settleWeather(
        draft,
        {
          id: `w${draft.seq}:${effect.continent}`,
          title: effect.title,
          continent: effect.continent,
          goodId: null,
          category: null,
          percent: effect.percent,
        },
        effect.rounds,
        events,
      )
      return

    case 'portClosed': {
      // Which harbour is drawn rather than printed, so one card works on every
      // plan. Harbours already shut are passed over: closing Rio twice would
      // waste the card and read, in the news, as a second outbreak in a town
      // that is already sealed.
      const open = ctx.pack.map.nodes
        .filter(isPort)
        .map((n) => n.id)
        .filter(
          (id) =>
            continentOf(ctx, id) === effect.continent &&
            !draft.closures.some((c) => c.portId === id),
        )
      if (open.length === 0) return

      const [choice, rng] = nextInt(draft.rng, open.length)
      draft.rng = rng
      const portId = open[choice]!
      const port = ctx.portsById.get(portId)
      // "Yellow fever in Rio" has to be sayable in both languages, and the
      // harbour's own name may differ between them — Genua and Genoa are the
      // same quay. So the headline is composed twice rather than once.
      const headline: Localized<string> = port
        ? {
            de: `${effect.title.de} in ${named(port).de}`,
            en: `${effect.title.en} in ${named(port).en}`,
          }
        : { de: `${effect.title.de} in ${portId}`, en: `${effect.title.en} in ${portId}` }
      const realtime = draft.config.travel === 'echtzeit'

      draft.closures = [
        ...draft.closures,
        {
          id: `q${draft.seq}:${portId}`,
          title: headline,
          portId,
          untilRound: realtime ? null : draft.round + effect.rounds,
          untilTime: realtime
            ? draft.now + effect.rounds * draft.config.realtime.marketIntervalMinutes * 60_000
            : null,
        },
      ]
      events.push({ type: 'portClosed', portId, title: headline })
      return
    }

    case 'goodPriceDelta': {
      // The same machinery, asking what is in the hold instead of where the
      // ship is. One notice per ware or per column, so a second harvest
      // report supersedes the first rather than stacking on top of it.
      const scope = effect.scope
      settleWeather(
        draft,
        {
          id: `w${draft.seq}:${scope.good ?? scope.gruppe}`,
          title: effect.title,
          continent: null,
          goodId: scope.good ?? null,
          category: scope.gruppe ?? null,
          percent: effect.percent,
        },
        effect.rounds,
        events,
      )
      return
    }

    case 'stormInRegion': {
      forEachShipIn(ctx, draft, effect.continent, (i, ship) =>
        jettison(draft, i, ship.id, effect.lose, effect.title, events),
      )
      return
    }

    case 'cargoDamagedInRegion': {
      forEachShipIn(ctx, draft, effect.continent, (i, ship) =>
        spoil(draft, i, ship.id, effect.count, effect.title, events),
      )
      return
    }

    case 'delayInRegion': {
      forEachShipIn(ctx, draft, effect.continent, (i, ship) => {
        if (draft.config.travel === 'echtzeit') {
          holdUp(draft, i, ship.id, effect.minutes, effect.title, events)
          return
        }
        // Round play has no clock to push, so the same weather costs a turn
        // hove to — the machinery a collision already uses. Only the ship the
        // merchant is sailing has turns to lose.
        if (ship.id !== flagship(draft.players[i]!).id) return
        patchVehicle(draft, i, ship.id, { skipTurns: ship.skipTurns + 1 })
        events.push({
          type: 'heldUp',
          playerId: draft.players[i]!.id,
          minutes: effect.minutes,
          reason: effect.title,
        })
      })
      return
    }

    case 'cargoLostByDrawer': {
      // In round play the card was turned by somebody, and it is theirs. A
      // world card in real time has no drawer, and answering that with
      // `drawerIndex` — nought, always — meant a fire in the hold broke out
      // aboard the first house to have sat down, every single time. So the
      // deck picks a laden ship instead, out of the game's own dice.
      if (draft.config.travel !== 'echtzeit') {
        jettison(draft, drawerIndex, flagship(draft.players[drawerIndex]!).id, effect.lose, effect.title, events)
        return
      }
      const laden: Array<[number, string]> = []
      for (let i = 0; i < draft.players.length; i++) {
        for (const ship of draft.players[i]!.fleet) {
          if (ship.cargo.length > 0) laden.push([i, ship.id])
        }
      }
      if (laden.length === 0) return
      const [choice, rng] = nextInt(draft.rng, laden.length)
      draft.rng = rng
      const [index, vehicleId] = laden[choice]!
      jettison(draft, index, vehicleId, effect.lose, effect.title, events)
      return
    }

    case 'regionalLevy': {
      for (let i = 0; i < draft.players.length; i++) {
        // One payment per house, however many of its ships are lying there:
        // this is a harbour's bill to a merchant, not to a hull.
        const there = draft.players[i]!.fleet.some((ship) => {
          const portId = portAt(ctx, ship.nodeId)
          return portId !== null && continentOf(ctx, portId) === effect.continent
        })
        if (!there) continue
        if (effect.sign > 0) payPlayer(draft, i, effect.amount, 'telegramm', events)
        else chargePlayer(draft, i, effect.amount, 'hafengebuehr', events)
      }
      return
    }

    case 'feeForDrawer':
      chargePlayer(draft, drawerIndex, effect.amount, 'entladegeld', events)
      return

    case 'portFeeAllInPort': {
      // "für alle in einem Hafen stehenden Schiffe"
      for (let i = 0; i < draft.players.length; i++) {
        const p = draft.players[i]!
        if (portAt(ctx, flagship(p).nodeId)) {
          chargePlayer(draft, i, effect.amount, 'hafengebuehr', events)
        }
      }
      return
    }

    case 'leviedOnAllShips': {
      // Valid for every player, in port or at sea, but only once per grace
      // period: "Innerhalb von 5 Runden ist eine Steuer- bzw.
      // Versicherungsvorschreibung nur je einmal zu begleichen."
      //
      // This one is charged at sea on purpose, and is the only card that is:
      // it is a tenth of the cargo lying in the hold, so an empty ship pays
      // nothing and a laden one pays wherever she is. Cargo in transit is
      // precisely what a marine insurer writes a premium against.
      //
      // Real-time play has to count the grace period on the clock. It used to
      // count rounds here too — but the round never turns in a real-time game,
      // so `round - last` was always nought, and each levy was charged once
      // and then silently suppressed for the rest of the season.
      const realtime = draft.config.travel === 'echtzeit'
      const grace = draft.config.levyGracePeriodRounds
      const graceMs = grace * draft.config.realtime.marketIntervalMinutes * 60_000
      for (let i = 0; i < draft.players.length; i++) {
        const p = draft.players[i]!
        const lastAt = p.levyPaidAt[effect.levy]
        const lastRound = p.levyPaidRound[effect.levy]
        const tooSoon = realtime
          ? lastAt !== null && draft.now - lastAt < graceMs
          : lastRound !== null && draft.round - lastRound < grace
        if (tooSoon) {
          events.push({ type: 'levySkipped', playerId: p.id, levy: effect.levy })
          continue
        }
        const value = p.fleet.reduce(
          (sum, v) => sum + v.cargo.reduce((s, c) => s + c.pricePaid, 0),
          0,
        )
        const due = Math.round((value * effect.percentOfCargoValue) / 100)
        chargePlayer(draft, i, due, effect.levy, events)
        const settled = draft.players[i]!
        patchPlayer(draft, i, {
          ...(realtime
            ? { levyPaidAt: { ...settled.levyPaidAt, [effect.levy]: draft.now } }
            : { levyPaidRound: { ...settled.levyPaidRound, [effect.levy]: draft.round } }),
        })
      }
      return
    }
  }
}

// ---------------------------------------------------------------------------
// Movement
// ---------------------------------------------------------------------------

function resolveArrival(ctx: EngineContext, draft: Draft, events: GameEvent[]): void {
  const index = draft.activeIndex
  const player = draft.players[index]!
  const node = flagship(player).nodeId
  const portId = portAt(ctx, node)

  draft.movement = null
  draft.saleModifierPercent = 0
  patchShip(draft, index, { purchasesThisVisit: [] })

  if (!portId) {
    // "Steht ein Schiff auf freier See ... und es kommt ein zweites Schiff auf
    // dem gleichen Punkt zu stehen, so bedeutet dies einen Zusammenstoß."
    const victimIndex = draft.players.findIndex(
      (p, i) => i !== index && flagship(p).nodeId === node,
    )
    if (victimIndex >= 0) {
      const victim = draft.players[victimIndex]!
      const value = flagship(victim).cargo.reduce((s, c) => s + c.pricePaid, 0)
      const damages = Math.round(value * draft.config.collisionDamageRate)
      chargePlayer(draft, index, damages, 'schaden', events)
      payPlayer(draft, victimIndex, damages, 'schaden', events)
      patchShip(draft, index, { skipTurns: draft.config.collisionPenaltyTurns })
      events.push({
        type: 'collision',
        playerId: player.id,
        victimId: victim.id,
        damages,
      })
    }
    draft.phase = 'endOfTurn'
    draft.mustSellForeign = false
    events.push({ type: 'stoppedAtSea', playerId: player.id })
    return
  }

  // "Die Reiseroute, die ein Schiff nimmt, bleibt dem Spieler überlassen."
  // A port call is a fresh start: the line the ship came in on is open again,
  // so a captain may put about and go back the way they came. Only turning on
  // the spot at sea stays barred, which is what the Anleitung's ban on
  // "Pendeln" is really about.
  patchShip(draft, index, {
    cameFrom: null,
    portCalls: (flagship(draft.players[index]!).portCalls ?? 0) + 1,
  })

  events.push({ type: 'arrived', playerId: player.id, portId })

  const red = draft.config.redFields.includes(draft.round)
  if (red) {
    // The card is turned before any selling is done.
    draft.phase = 'konjunktur'
    draft.mustSellForeign = true
  } else {
    draft.phase = 'port'
    draft.mustSellForeign = false
  }
}

/** Shortest way to any port, without turning the ship around on the spot. */
function pathToNearestPort(
  ctx: EngineContext,
  from: NodeId,
  cameFrom: NodeId | null,
): NodeId[] {
  const start = ctx.graph.neighbours.get(from) ?? []
  const first = start.filter((n) => n !== cameFrom)
  const seeds = first.length > 0 ? first : start

  const queue: NodeId[][] = seeds.map((n) => [n])
  const seen = new Set<NodeId>([from, ...seeds])

  while (queue.length > 0) {
    const path = queue.shift()!
    const head = path[path.length - 1]!
    if (isPort(ctx.graph.nodesById.get(head))) return path
    for (const next of ctx.graph.neighbours.get(head) ?? []) {
      if (seen.has(next)) continue
      seen.add(next)
      queue.push([...path, next])
    }
  }
  return []
}

/**
 * "In der letzten Runde haben die Schiffe ohne Würfelwurf den nächsten Hafen
 * in Fahrtrichtung anzulaufen und absetzbare Waren zum normalen Preis, Waren,
 * die in diesem Hafen angeboten werden um 75 % des Einkaufspreises, zu
 * verkaufen."
 */
function resolveFinalRun(ctx: EngineContext, draft: Draft, events: GameEvent[]): void {
  for (let i = 0; i < draft.players.length; i++) {
    const player = draft.players[i]!
    // Every vessel of the house runs for the nearest harbour and sells up.
    for (const start of player.fleet) {
      let portId = portAt(ctx, start.nodeId)

      if (!portId) {
        const path = pathToNearestPort(ctx, start.nodeId, start.cameFrom)
        if (path.length > 0) {
          const dest = path[path.length - 1]!
          const before = path.length > 1 ? path[path.length - 2]! : start.nodeId
          patchVehicle(draft, i, start.id, {
            nodeId: dest,
            cameFrom: before,
            portCalls: (start.portCalls ?? 0) + 1,
            skipTurns: 0,
            voyage: null,
          })
          portId = portAt(ctx, dest)
          if (portId) events.push({ type: 'arrived', playerId: player.id, portId })
        }
      }
      if (!portId) continue

      for (const item of start.cargo) {
        const local = exportsAt(ctx, draft as GameState, portId).includes(item.goodId)
        const price = local
          ? Math.round(item.pricePaid * draft.config.finalRoundGlutSaleRate)
          : goodOf(ctx, item.goodId).sell
        draft.bankStock[item.goodId] = (draft.bankStock[item.goodId] ?? 0) + 1
        events.push({
          type: 'sold',
          playerId: player.id,
          goodId: item.goodId,
          price,
          profit: price - item.pricePaid,
          kind: 'schluss',
        })
        patchPlayer(draft, i, { cash: draft.players[i]!.cash + price })
      }
      patchVehicle(draft, i, start.id, { cargo: [], voyage: null })
    }
  }

  draft.phase = 'over'
  draft.movement = null
  events.push({ type: 'gameOver' })
}

function advanceTurn(ctx: EngineContext, draft: Draft, events: GameEvent[]): void {
  const finished = draft.players[draft.activeIndex]!
  patchPlayer(draft, draft.activeIndex, { hasDeparted: true })
  patchShip(draft, draft.activeIndex, { purchasesThisVisit: [] })
  events.push({ type: 'turnEnded', playerId: finished.id })

  draft.pendingCard = null
  draft.movement = null
  draft.saleModifierPercent = 0
  draft.mustSellForeign = false

  const count = draft.players.length
  for (let guard = 0; guard < count * 4; guard++) {
    draft.activeIndex = (draft.activeIndex + 1) % count

    // The Kegelfigur moves on whenever play comes back round to the starter.
    if (draft.activeIndex === draft.startPlayerIndex) {
      draft.round += 1
      // ...and on the round track in round play.
      draft.weather = draft.weather.filter(
        (w) => w.untilRound === null || w.untilRound >= draft.round,
      )
      reopenPorts(draft, (c) => c.untilRound !== null && c.untilRound < draft.round, events)
      if (draft.round > draft.config.totalRounds) {
        resolveFinalRun(ctx, draft, events)
        return
      }
      events.push({
        type: 'roundStarted',
        round: draft.round,
        red: draft.config.redFields.includes(draft.round),
      })
    }

    const next = draft.players[draft.activeIndex]!
    if (flagship(next).skipTurns > 0) {
      patchShip(draft, draft.activeIndex, { skipTurns: flagship(next).skipTurns - 1 })
      events.push({ type: 'turnEnded', playerId: next.id })
      continue
    }

    draft.phase = next.hasDeparted ? 'roll' : 'port'
    return
  }
}

// ---------------------------------------------------------------------------
// The reducer
// ---------------------------------------------------------------------------

/**
 * How many houses may sit at one table.
 *
 * The box holds six sets of pieces and the printed game stops there; this is
 * not the printed game. Exported because three other places used to carry
 * their own copy of the number — the names screen, the seal colours, and the
 * start berths a cut-down map has to guarantee — and a table that can seat
 * ten but only deal six harbours is worse than one that seats six.
 */
export const MAX_PLAYERS = 10

export function applyAction(
  ctx: EngineContext,
  state: GameState,
  action: GameAction,
): ActionResult {
  // The clock comes first, and keeps running in the lobby so that a
  // real-time game has a starting instant to reckon from.
  if (action.type === 'tick') return applyTick(ctx, state, action.at)

  if (state.phase === 'over') return reject(state, 'reject.gameOver')

  // Joining and starting stand apart: they are the only actions that do not
  // belong to whoever is currently at the table.
  if (action.type === 'join') return applyJoin(ctx, state, action)
  if (action.type === 'start') return applyStart(state)
  // Above the lobby check on purpose: waiting for the table to fill is
  // exactly when there is something to say.
  if (action.type === 'telegramm') return applyTelegramm(state, action)

  if (state.phase === 'lobby') {
    return reject(state, 'reject.notStarted')
  }

  const realtime = state.config.travel === 'echtzeit'

  if (realtime) {
    if (action.type === 'roll' || action.type === 'step' || action.type === 'endTurn') {
      return reject(state, 'reject.noDiceInRealtime')
    }
    if (action.type === 'drawKonjunktur') {
      return reject(state, 'reject.marketTurnsItself')
    }
  } else if (action.type === 'setCourse') {
    return reject(state, 'reject.courseRealtimeOnly')
  }

  // In real-time play there is no "whose turn"; every action names its actor.
  const by = 'by' in action ? action.by : undefined
  const index = by ? state.players.findIndex((p) => p.id === by) : state.activeIndex
  if (index < 0) return reject(state, 'reject.unknownMerchant')
  if (realtime && !by) return reject(state, 'reject.actorMissing')
  if (!realtime && by && index !== state.activeIndex) {
    return reject(state, 'reject.notYourTurn')
  }

  const draft = draftOf(state)
  const events: GameEvent[] = []
  const player = state.players[index]!

  switch (action.type) {
    case 'roll': {
      if (draft.phase !== 'roll') return reject(state, 'reject.notRollPhase')
      const [value, rng] = rollDie(draft.rng, draft.config.diceSides)
      draft.rng = rng
      draft.movement = { rolled: value, remaining: value, path: [flagship(player).nodeId] }
      draft.phase = 'move'
      events.push({ type: 'rolled', playerId: player.id, value })
      break
    }

    case 'step': {
      if (draft.phase !== 'move' || !draft.movement) {
        return reject(state, 'reject.noVoyage')
      }
      if (!legalSteps(ctx, player).includes(action.to)) {
        return reject(state, 'reject.noLineOrShuttle')
      }
      patchShip(draft, index, {
        nodeId: action.to,
        cameFrom: flagship(player).nodeId,
      })
      draft.movement = {
        rolled: draft.movement.rolled,
        remaining: draft.movement.remaining - 1,
        path: [...draft.movement.path, action.to],
      }
      events.push({ type: 'moved', playerId: player.id, to: action.to })
      if (draft.movement.remaining === 0) resolveArrival(ctx, draft, events)
      break
    }

    case 'drawKonjunktur': {
      if (draft.phase !== 'konjunktur') return reject(state, 'reject.noCardDue')
      const cardId = draft.deck[0]
      if (!cardId) return reject(state, 'reject.deckEmpty')
      // "Die abgehobene Karte wird sodann wieder mit dem Rücken nach oben
      // unter das Kartenpäckchen geschoben."
      draft.deck = [...draft.deck.slice(1), cardId]
      const card = ctx.cardsById.get(cardId)
      if (!card) return reject(state, 'reject.unknownCard', { id: cardId })

      draft.pendingCard = { cardId, drawerId: player.id }
      events.push({ type: 'cardDrawn', playerId: player.id, cardId })
      for (const effect of card.effects) applyEffect(ctx, draft, effect, index, events)
      draft.phase = 'port'
      break
    }

    case 'buy': {
      const buyer = flagship(player)
      if (realtime) {
        if (atSea(draft as GameState, buyer)) {
          return reject(state, 'reject.noTradeAtSea')
        }
      } else if (draft.phase !== 'port') {
        return reject(state, 'reject.kontorClosed')
      }
      const portId = portAt(ctx, buyer.nodeId)
      if (!portId) return reject(state, 'reject.yourShipNotInPort')
      const barred = closureAt(draft as GameState, portId)
      if (barred) return reject(state, 'reject.portBarred', { title: barred.title })
      if (!exportsAt(ctx, draft as GameState, portId).includes(action.goodId)) {
        return reject(state, 'reject.notExportedHere')
      }
      if (buyer.purchasesThisVisit.length >= draft.config.maxPurchasesPerPort) {
        return reject(state, 'reject.twoGoodsPerPort')
      }
      if (buyer.purchasesThisVisit.includes(action.goodId)) {
        return reject(state, 'reject.oneOfEachKind')
      }
      const capacity = buyer.kind.capacity
      if (capacity !== null && buyer.cargo.length >= capacity) {
        return rejectN(state, 'reject.holdFull', capacity)
      }
      if ((draft.bankStock[action.goodId] ?? 0) <= 0) {
        return reject(state, 'reject.bankOutOfCards')
      }
      const g = goodOf(ctx, action.goodId)
      if (player.cash < g.buy) return reject(state, 'reject.insufficientFunds')

      const item: CargoItem = {
        uid: `c${draft.seq}-${action.goodId}`,
        goodId: action.goodId,
        pricePaid: g.buy,
        boughtAt: portId,
        boughtRound: draft.round,
      }
      draft.bankStock[action.goodId] = (draft.bankStock[action.goodId] ?? 0) - 1
      patchPlayer(draft, index, { cash: player.cash - g.buy })
      patchVehicle(draft, index, buyer.id, {
        cargo: [...buyer.cargo, item],
        purchasesThisVisit: [...buyer.purchasesThisVisit, action.goodId],
      })
      events.push({ type: 'bought', playerId: player.id, goodId: action.goodId, price: g.buy })
      break
    }

    case 'sell': {
      const seller = flagship(player)
      if (realtime) {
        if (atSea(draft as GameState, seller)) {
          return reject(state, 'reject.noTradeAtSea')
        }
      } else if (draft.phase !== 'port') {
        return reject(state, 'reject.kontorClosed')
      }
      const portId = portAt(ctx, seller.nodeId)
      if (!portId) return reject(state, 'reject.yourShipNotInPort')
      const shut = closureAt(draft as GameState, portId)
      if (shut) return reject(state, 'reject.portBarred', { title: shut.title })
      const item = seller.cargo.find((c) => c.uid === action.uid)
      if (!item) return reject(state, 'reject.notAboard')

      const quote = quoteSale(ctx, state, item, portId)
      draft.bankStock[item.goodId] = (draft.bankStock[item.goodId] ?? 0) + 1
      patchPlayer(draft, index, { cash: player.cash + quote.price })
      patchVehicle(draft, index, seller.id, {
        cargo: seller.cargo.filter((c) => c.uid !== action.uid),
      })
      events.push({
        type: 'sold',
        playerId: player.id,
        goodId: item.goodId,
        price: quote.price,
        profit: quote.profit,
        kind: quote.kind,
      })
      if (quote.kind === 'markt') draft.mustSellForeign = false
      if (realtime) {
        // Something has actually been landed, which is the moment a standing
        // Entladegeld is about.
        const unloaded = draft.players[index]!.fleet.find((v) => v.id === seller.id)
        if (unloaded) settleStandingCard(ctx, draft, index, unloaded, 'unload', events)
      }
      break
    }

    case 'setCourse': {
      if (draft.phase !== 'laufend') return reject(state, 'reject.gameNotRunning')
      const ship = action.vehicleId
        ? (player.fleet.find((v) => v.id === action.vehicleId) ?? null)
        : flagship(player)
      if (!ship) return reject(state, 'reject.notYourShip')
      if (draft.config.sicht === 'realistisch' && ship.id !== flagship(player).id) {
        // You can only give an order to a captain you can actually speak to.
        if (flagship(player).voyage || ship.nodeId !== flagship(player).nodeId) {
          return reject(state, 'reject.needPigeon')
        }
      }
      /*
       * A course may be changed while she is still alongside: the hatches are
       * open, the merchant may trade, and shutting them out of the one
       * decision that matters would be an odd place to draw the line.
       *
       * And it may be changed again once she has sailed. A voyage runs for
       * hours here, prices move while it does, and a house that hears of a
       * better market has every right to act on it. What it cannot do is turn
       * her round in open water — that is `courseOrigin`'s business, and it
       * is why the leg under way below is left exactly as it stands.
       */
      const sailing = atSea(draft as GameState, ship)
      if (!sailing) {
        const here = portAt(ctx, ship.nodeId)
        if (!here) return reject(state, 'reject.shipNotInPort')
        if (action.to === here) return reject(state, 'reject.alreadyThere')
      } else if (action.to === ship.voyage!.destination) {
        return reject(state, 'reject.alreadyOnThatCourse')
      }

      const origin = courseOrigin(draft as GameState, ship)
      const onward = routeTo(ctx, origin.node, origin.cameFrom, action.to)
      // Nothing onward means one of two things: no line leads there at all,
      // or the mark she is already running to is the harbour now wanted — in
      // which case the new course is simply a very short one.
      if (onward.length === 0 && origin.node !== action.to) {
        return reject(state, 'reject.noLine')
      }

      if (!sailing) {
        const legMs = legMsFor(ctx, draft as GameState, ship, ship.nodeId, onward[0]!)
        // She is still alongside until the cargo is worked; the first leg only
        // begins when she casts off, which is why the delay lands here rather
        // than as a separate phase nobody would think to look for.
        const castOff = castOffMs(draft as GameState, ship)
        patchVehicle(draft, index, ship.id, {
          voyage: {
            route: onward,
            plan: [ship.nodeId, ...onward],
            legStartedAt: draft.now + castOff,
            legArrivesAt: draft.now + castOff + legMs,
            destination: action.to,
            departsAt: draft.now + castOff,
          },
        })
      } else {
        const under = ship.voyage!
        const route = origin.node === action.to ? [action.to] : [origin.node, ...onward]
        /*
         * The leg she is on is untouched: she is on it, and its arrival is
         * what the whole clock hangs from. Only what lies beyond the next
         * mark is rewritten. The chart still wants the water already under
         * her keel, so the plan keeps everything up to where she is and takes
         * the new course from there.
         */
        const passed = under.plan.indexOf(ship.nodeId)
        const behind = passed >= 0 ? under.plan.slice(0, passed + 1) : [ship.nodeId]
        patchVehicle(draft, index, ship.id, {
          voyage: { ...under, route, plan: [...behind, ...route], destination: action.to },
        })
      }

      const ordered = draft.players[index]!.fleet.find((v) => v.id === ship.id)!
      events.push({
        type: 'setSail',
        playerId: player.id,
        to: action.to,
        // Summed leg by leg off the voyage as it now stands. Multiplying one
        // leg by the route length was right only while every leg cost the
        // same, which stopped being true when voyages started being charged
        // by the sea mile — and is wrong outright for a course laid at sea,
        // where the first leg was priced from a different pair of marks.
        arrivesAt: voyageEndsAt(ctx, draft as GameState, ordered) ?? draft.now,
      })
      break
    }

    case 'buyVehicle': {
      // Checked before anything else: a table playing the printed rules has no
      // yard at all, and the reason differs from a house that is simply full.
      if (draft.config.maxFleetSize <= 1) {
        return reject(state, ...fleetLimitNote(draft.config.maxFleetSize))
      }
      const buyerShip = flagship(player)
      if (atSea(draft as GameState, buyerShip)) {
        return reject(state, 'reject.noYardAtSea')
      }
      const yard = portAt(ctx, buyerShip.nodeId)
      if (!yard) return reject(state, 'reject.yardsInPortOnly')

      const kind = ctx.pack.vehicles.find((v) => v.id === action.kindId)
      if (!kind) return reject(state, 'reject.yardDoesNotStock')
      if (player.cash < kind.price) return reject(state, 'reject.insufficientFunds')
      if (player.fleet.length >= draft.config.maxFleetSize) {
        return reject(state, ...fleetLimitNote(draft.config.maxFleetSize))
      }

      const identity = makeShipIdentity(`${player.id}:${player.fleet.length}:${ctx.pack.id}`)
      const bought: VehicleInstance = {
        id: `${player.id}-v${player.fleet.length + 1}`,
        name: identity.name,
        kind,
        nodeId: buyerShip.nodeId,
        cameFrom: null,
        portCalls: buyerShip.portCalls,
        skipTurns: 0,
        voyage: null,
        cargo: [],
        purchasesThisVisit: [],
      }
      patchPlayer(draft, index, {
        cash: player.cash - kind.price,
        fleet: [...player.fleet, bought],
        knowledge: {
          ...player.knowledge,
          // You watched her handed over, so you know where she lies.
          sightings: {
            ...player.knowledge.sightings,
            [bought.id]: {
              vehicleId: bought.id,
              nodeId: bought.nodeId,
              asOf: draft.now,
              place: yard,
              bound: null,
              cargo: [],
              firsthand: true,
            },
          },
        },
      })
      events.push({
        type: 'vehicleBought',
        playerId: player.id,
        vehicleId: bought.id,
        name: bought.name,
        price: kind.price,
      })
      break
    }

    case 'sendPigeon': {
      if (draft.config.sicht !== 'realistisch') {
        return reject(state, 'reject.noPigeonNeeded')
      }
      const sender = flagship(player)
      if (sender.voyage) return reject(state, 'reject.pigeonsAshoreOnly')
      const loft = portAt(ctx, sender.nodeId)
      if (!loft) return reject(state, 'reject.noLoft')

      const target = player.fleet.find((v) => v.id === action.vehicleId)
      if (!target) return reject(state, 'reject.notYourShip')
      if (target.id === sender.id) {
        return reject(state, 'reject.tellCaptainYourself')
      }
      if (player.cash < draft.config.pigeon.price) {
        return reject(state, 'reject.loftUnpaid')
      }

      // The bird flies where you address it. Whether she is there is your
      // problem, and you will not be told either way.
      const toNode = action.toPort
      if (!portAt(ctx, toNode)) {
        return reject(state, 'reject.noPigeonRoute')
      }

      patchPlayer(draft, index, { cash: player.cash - draft.config.pigeon.price })
      releasePigeon(ctx, draft, index, {
        kind: 'befehl',
        toNode,
        fromNode: sender.nodeId,
        order: {
          vehicleId: target.id,
          destination: action.destination,
          replyTo: action.replyTo ?? null,
        },
      })
      events.push({ type: 'pigeonSent', playerId: player.id, toNode, kind: 'befehl' })
      break
    }

    case 'collectMail': {
      const reader = flagship(player)
      if (reader.voyage) return reject(state, 'reject.mailAshoreOnly')
      const here = portAt(ctx, reader.nodeId)
      if (!here) return reject(state, 'reject.mailInPortOnly')

      const waiting = player.knowledge.waiting[reader.nodeId] ?? []
      if (waiting.length === 0) return reject(state, 'reject.noMail')

      // A letter is news of a date, not of now: it updates the belief only if
      // it is fresher than what is already known.
      let sightings = player.knowledge.sightings
      for (const letter of waiting) {
        const known = sightings[letter.vehicleId]
        if (!known || letter.sighting.asOf > known.asOf) {
          sightings = { ...sightings, [letter.vehicleId]: letter.sighting }
        }
      }

      const remaining = { ...player.knowledge.waiting }
      delete remaining[reader.nodeId]

      patchPlayer(draft, index, {
        knowledge: {
          ...player.knowledge,
          sightings,
          waiting: remaining,
          read: [...player.knowledge.read, ...waiting],
        },
      })
      events.push({ type: 'mailCollected', playerId: player.id, count: waiting.length })
      break
    }

    case 'writeNote': {
      patchPlayer(draft, index, {
        knowledge: {
          ...player.knowledge,
          notebook: action.text.slice(0, draft.config.notebookLimit),
        },
      })
      break
    }

    case 'boardVehicle': {
      const current = flagship(player)
      const target = player.fleet.find((v) => v.id === action.vehicleId)
      if (!target) return reject(state, 'reject.notYourShip')
      if (target.id === current.id) break
      if (current.voyage || target.voyage) {
        return reject(state, 'reject.switchInPortOnly')
      }
      if (current.nodeId !== target.nodeId) {
        return reject(state, 'reject.shipElsewhere')
      }
      patchPlayer(draft, index, { aboard: target.id })
      events.push({ type: 'boarded', playerId: player.id, vehicleId: target.id })
      break
    }

    case 'endTurn': {
      if (draft.phase !== 'port' && draft.phase !== 'endOfTurn') {
        return reject(state, 'reject.turnNotOver')
      }
      const portId = portAt(ctx, flagship(player).nodeId)
      if (portId && verkaufszwangOpen(ctx, state, player, portId)) {
        return reject(
          state,
          'reject.verkaufszwang',
        )
      }
      advanceTurn(ctx, draft, events)
      break
    }
  }

  draft.seq += 1
  return { state: draft as GameState, events }
}

/**
 * The world clock.
 *
 * Everything that happens by itself — ships arriving, the market turning, the
 * season closing — happens here, driven by an absolute timestamp carried in
 * the action. A client that has been asleep for six hours folds the same
 * ticks and lands on exactly the same state as one that watched throughout.
 */
function applyTick(ctx: EngineContext, state: GameState, at: number): ActionResult {
  if (at <= state.now) return { state, events: [] }

  const draft = draftOf(state)
  const events: GameEvent[] = []
  draft.now = at
  draft.seq += 1

  if (draft.config.travel !== 'echtzeit' || draft.phase !== 'laufend') {
    return { state: draft as GameState, events }
  }

  // Weather blows itself out on the clock in real-time play, and a quarantine
  // is lifted the same way.
  draft.weather = draft.weather.filter((w) => w.untilTime === null || w.untilTime > draft.now)
  reopenPorts(draft, (c) => c.untilTime !== null && c.untilTime <= draft.now, events)

  advanceVoyages(ctx, draft, events)
  if (draft.config.sicht === 'realistisch') {
    resolvePigeons(ctx, draft, events)
  }
  refreshSightings(ctx, draft)
  turnMarket(ctx, draft, events)

  if (draft.endsAt > 0 && draft.now >= draft.endsAt) {
    resolveFinalRun(ctx, draft, events)
  }

  return { state: draft as GameState, events }
}

/** Move every ship as far along its route as the clock allows. */
function advanceVoyages(ctx: EngineContext, draft: Draft, events: GameEvent[]): void {
  for (let i = 0; i < draft.players.length; i++) {
    for (const start of draft.players[i]!.fleet) {
      let vehicle = start
      let guard = 0

      while (vehicle.voyage && draft.now >= vehicle.voyage.legArrivesAt && guard++ < 5000) {
        const voyage = vehicle.voyage
        const next = voyage.route[0]!
        const rest = voyage.route.slice(1)
        // Each leg is priced from the segment it actually covers, so the one
        // being started here is next -> rest[0], not the one just finished.
        const legMs =
          rest.length === 0 ? 0 : legMsFor(ctx, draft as GameState, vehicle, next, rest[0]!)

        patchVehicle(draft, i, vehicle.id, {
          nodeId: next,
          cameFrom: vehicle.nodeId,
          purchasesThisVisit: rest.length === 0 ? [] : vehicle.purchasesThisVisit,
          portCalls:
            rest.length === 0 ? (vehicle.portCalls ?? 0) + 1 : vehicle.portCalls,
          voyage:
            rest.length === 0
              ? null
              : {
                  route: rest,
                  // Carried unchanged: the chart wants the whole voyage,
                  // including the water already under the keel.
                  plan: voyage.plan,
                  legStartedAt: voyage.legArrivesAt,
                  legArrivesAt: voyage.legArrivesAt + legMs,
                  destination: voyage.destination,
                  departsAt: 0,
                },
        })

        if (rest.length === 0) {
          const portId = portAt(ctx, next)
          if (portId) {
            // Same as in round play: making port frees the ship to sail back
            // out the way it came in.
            patchVehicle(draft, i, vehicle.id, { cameFrom: null })
            events.push({ type: 'arrived', playerId: draft.players[i]!.id, portId })
            // Berthing is what a standing Hafengebühr charges for and what a
            // standing Telegramm needs in order to reach anyone.
            const berthed = draft.players[i]!.fleet.find((v) => v.id === vehicle.id)
            if (berthed) settleStandingCard(ctx, draft, i, berthed, 'berth', events)
          }
        }

        const refreshed = draft.players[i]!.fleet.find((v) => v.id === vehicle.id)
        if (!refreshed) break
        vehicle = refreshed
      }
    }
  }
}

/**
 * What a merchant can see with their own eyes: the deck under their feet and
 * anything tied up in the same harbour. Recorded as first-hand news.
 */
function refreshSightings(ctx: EngineContext, draft: Draft): void {
  if (draft.config.sicht !== 'realistisch') return

  for (let i = 0; i < draft.players.length; i++) {
    const player = draft.players[i]!
    const eyes = flagship(player)
    const here = eyes.voyage ? null : eyes.nodeId
    const place = here ? portAt(ctx, here) : null

    let sightings = player.knowledge.sightings
    let changed = false
    for (const vehicle of player.fleet) {
      const alongside = vehicle.id === eyes.id || (here !== null && vehicle.nodeId === here)
      if (!alongside) continue
      sightings = { ...sightings, [vehicle.id]: seeVehicle(vehicle, draft.now, place) }
      changed = true
    }
    if (changed) {
      patchPlayer(draft, i, { knowledge: { ...player.knowledge, sightings } })
    }
  }
}

/**
 * Birds land. An order only takes effect if the ship is actually where the
 * sender believed it to be — and either way, nobody is told.
 */
function resolvePigeons(ctx: EngineContext, draft: Draft, events: GameEvent[]): void {
  const landed = draft.pigeons.filter((p) => draft.now >= p.arrivesAt)
  if (landed.length === 0) return
  draft.pigeons = draft.pigeons.filter((p) => draft.now < p.arrivesAt)

  for (const pigeon of landed) {
    // A bird that was never going to make it simply does not.
    if (pigeon.doomed) continue

    const index = draft.players.findIndex((p) => p.id === pigeon.playerId)
    if (index < 0) continue
    const player = draft.players[index]!

    if (pigeon.kind === 'befehl' && pigeon.order) {
      const ship = player.fleet.find((v) => v.id === pigeon.order!.vehicleId)
      // The captain must be where the letter was addressed, and free to sail.
      if (!ship || ship.nodeId !== pigeon.toNode || ship.voyage) continue

      const route = routeTo(ctx, ship.nodeId, ship.cameFrom, pigeon.order.destination)
      if (route.length > 0) {
        const legMs = legMsFor(ctx, draft as GameState, ship, ship.nodeId, route[0]!)
        const castOff = castOffMs(draft as GameState, ship)
        patchVehicle(draft, index, ship.id, {
          voyage: {
            route,
            plan: [ship.nodeId, ...route],
            legStartedAt: draft.now + castOff,
            legArrivesAt: draft.now + castOff + legMs,
            destination: pigeon.order.destination,
            departsAt: draft.now + castOff,
          },
        })
      }

      // If an answer was asked for, the captain writes one before casting off.
      if (pigeon.order.replyTo) {
        const fresh = draft.players[index]!.fleet.find((v) => v.id === ship.id) ?? ship
        releasePigeon(ctx, draft, index, {
          kind: 'bericht',
          toNode: pigeon.order.replyTo,
          fromNode: ship.nodeId,
          letter: writeLetter(ctx, draft, fresh, ship.nodeId),
        })
      }
      continue
    }

    if (pigeon.kind === 'bericht' && pigeon.letter) {
      // The letter waits at the harbour until it is fetched in person.
      const waiting = player.knowledge.waiting[pigeon.toNode] ?? []
      patchPlayer(draft, index, {
        knowledge: {
          ...player.knowledge,
          waiting: { ...player.knowledge.waiting, [pigeon.toNode]: [...waiting, pigeon.letter] },
        },
      })
    }
  }
  void events
}

function writeLetter(
  ctx: EngineContext,
  draft: Draft,
  vehicle: VehicleInstance,
  writtenIn: string,
): Letter {
  const identity = makeShipIdentity(`${vehicle.id}:${draft.packId}`)
  const sighting: Sighting = {
    vehicleId: vehicle.id,
    nodeId: vehicle.nodeId,
    asOf: draft.now,
    place: portAt(ctx, writtenIn),
    bound: vehicle.voyage?.destination ?? null,
    cargo: vehicle.cargo,
    firsthand: false,
  }
  return {
    id: `brief-${draft.seq}-${vehicle.id}`,
    vehicleId: vehicle.id,
    vehicleName: vehicle.name,
    captain: identity.captain,
    writtenAt: draft.now,
    writtenIn,
    sighting,
  }
}

/** Put a bird in the air, and decide there and then whether it will arrive. */
function releasePigeon(
  ctx: EngineContext,
  draft: Draft,
  playerIndex: number,
  spec: {
    kind: 'befehl' | 'bericht'
    toNode: string
    fromNode: string
    order?: Pigeon['order']
    letter?: Letter
  },
): void {
  const distances = distancesFrom(ctx, spec.fromNode, null)
  const pips = distances.get(spec.toNode) ?? 20
  const flightMs = Math.max(1, pips) * draft.config.pigeon.minutesPerPip * 60_000

  // The seeded generator decides now, so every device agrees about a bird
  // that never arrives.
  const [roll, rng] = nextInt(draft.rng, 100)
  draft.rng = rng

  draft.pigeons = [
    ...draft.pigeons,
    {
      id: `taube-${draft.seq}-${draft.pigeons.length}`,
      playerId: draft.players[playerIndex]!.id,
      kind: spec.kind,
      toNode: spec.toNode,
      sentAt: draft.now,
      arrivesAt: draft.now + flightMs,
      doomed: roll < draft.config.pigeon.lossPercent,
      ...(spec.order ? { order: spec.order } : {}),
      ...(spec.letter ? { letter: spec.letter } : {}),
    },
  ]
}

/**
 * The world market. Instead of red fields on a round track, a Konjunktur card
 * is turned every so often and stands for everyone until the next one — which
 * is what makes looking in on a running game worth doing.
 *
 * It does not speak every time it is asked. A notice standing without a break
 * from one to the next made the Konjunktur into wallpaper: something was
 * always in force, so nothing was news, and the market never simply was what
 * the register said it was. Half the sessions now pass in silence, the last
 * notice lapses with them, and a card arriving is an event again.
 */
function turnMarket(ctx: EngineContext, draft: Draft, events: GameEvent[]): void {
  const intervalMs = draft.config.realtime.marketIntervalMinutes * 60_000
  if (intervalMs <= 0) return

  let guard = 0
  while (draft.now - draft.marketSince >= intervalMs && guard++ < 200) {
    draft.marketSince += intervalMs

    // The roll comes before the draw, so a quiet session costs the deck
    // nothing: the same card is still on top when the market next speaks.
    const [roll, rng] = nextInt(draft.rng, 100)
    draft.rng = rng
    if (roll >= draft.config.realtime.marketChancePercent) {
      const lapsed = draft.marketCardId
      draft.marketCardId = null
      draft.saleModifierPercent = 0
      draft.marketSettled = []
      // Only worth saying if something was standing. Announcing silence where
      // there was already silence is how a news sheet loses its reader.
      if (lapsed) events.push({ type: 'marketCalm', cardId: lapsed })
      continue
    }

    const cardId = draft.deck[0]
    if (!cardId) return
    draft.deck = [...draft.deck.slice(1), cardId]
    const card = ctx.cardsById.get(cardId)
    draft.marketCardId = cardId
    if (!card) continue

    draft.saleModifierPercent = 0
    draft.marketSettled = []
    for (const effect of card.effects) {
      switch (effect.kind) {
        case 'salePriceDelta':
          // Prices need no ship: the new level stands at once, for everyone.
          draft.saleModifierPercent += effect.percent
          break
        case 'payoutToDrawer':
        case 'feeForDrawer':
        case 'portFeeAllInPort':
          // Money changes hands at a quayside, so these wait for one. Ships
          // already berthed settle now; the rest as they come in, or as they
          // unload. See `settleStandingCard`.
          break
        default:
          applyEffect(ctx, draft, effect, 0, events)
      }
    }
    events.push({ type: 'marketTurned', cardId })

    for (let i = 0; i < draft.players.length; i++) {
      for (const vehicle of draft.players[i]!.fleet) {
        settleStandingCard(ctx, draft, i, vehicle, 'berth', events)
      }
    }
  }
}

/**
 * A latecomer is dealt the next harbour from the shuffled pool and the full
 * starting capital, and provisions on their first turn exactly like everyone
 * else — `hasDeparted: false` does that work.
 */
function applyJoin(
  ctx: EngineContext,
  state: GameState,
  action: Extract<GameAction, { type: 'join' }>,
): ActionResult {
  if (state.players.some((p) => p.id === action.playerId)) {
    return reject(state, 'reject.nameTaken')
  }
  if (state.players.length >= MAX_PLAYERS) {
    return reject(state, 'reject.tableFull', { n: MAX_PLAYERS })
  }
  if (state.phase !== 'lobby' && state.joinPolicy !== 'jederzeit') {
    return reject(state, 'reject.noLatecomers')
  }

  const draft = draftOf(state)
  const name = action.name.trim() || `Kaufmann ${state.players.length + 1}`

  const pool = [...draft.startPortPool]
  const homePort = pool.shift() ?? ctx.pack.map.startPorts[0]!
  draft.startPortPool = pool.length > 0 ? pool : [...ctx.pack.map.startPorts]

  const identity = makeShipIdentity(`${action.playerId}:0:${ctx.pack.id}`)
  const firstShip: VehicleInstance = {
    id: `${action.playerId}-v1`,
    name: identity.name,
    kind: draft.config.startingVehicle,
    nodeId: homePort,
    cameFrom: null,
    portCalls: 1,
    skipTurns: 0,
    voyage: null,
    cargo: [],
    purchasesThisVisit: [],
  }

  const player: PlayerState = {
    id: action.playerId,
    name,
    persona: makePersona(name, ctx.pack.id, action.gender),
    colorIndex: state.players.length,
    cash: draft.config.startingCapital,
    fleet: [firstShip],
    aboard: firstShip.id,
    homePort,
    hasDeparted: false,
    levyPaidRound: { steuer: null, versicherung: null },
    levyPaidAt: { steuer: null, versicherung: null },
    knowledge: {
      sightings: {
        [firstShip.id]: {
          vehicleId: firstShip.id,
          nodeId: homePort,
          asOf: draft.now,
          place: homePort,
          bound: null,
          cargo: [],
          firsthand: true,
        },
      },
      waiting: {},
      read: [],
      notebook: '',
    },
  }

  draft.players = [...draft.players, player]
  if (draft.hostId === null) draft.hostId = player.id
  draft.seq += 1

  return {
    state: draft as GameState,
    events: [
      {
        type: 'playerJoined',
        playerId: player.id,
        name,
        portId: homePort,
        midGame: state.phase !== 'lobby',
      },
    ],
  }
}

/** As many characters as the Post would put on one form. */
export const TELEGRAM_LIMIT = 160

/**
 * A telegram: one line from one house to the whole table.
 *
 * It touches nothing — no cash, no cargo, no clock — which is why it sits up
 * with `join` and `start` instead of down in the switch. It is not a move, so
 * it waits for no turn and no phase; all it leaves behind is an entry in the
 * Börsenblatt, and since the Börsenblatt is folded out of the log, that entry
 * reaches every device and survives every reload without a word of new
 * plumbing.
 *
 * Nothing here rings a telephone. An arrival and the close of the season are
 * worth waking somebody for; a message is not, and a game that buzzes every
 * time a player says "moin" gets its notifications turned off for good.
 */
function applyTelegramm(
  state: GameState,
  action: Extract<GameAction, { type: 'telegramm' }>,
): ActionResult {
  const sender = state.players.find((p) => p.id === action.by)
  if (!sender) return reject(state, 'reject.onlyAtTableMayWire')

  // One line, as a telegram is. Newlines and runs of space collapse, so no
  // message can rearrange the page it lands on.
  const text = action.text.replace(/\s+/g, ' ').trim().slice(0, TELEGRAM_LIMIT)
  if (!text) return reject(state, 'reject.emptyTelegram')

  // The state is untouched: this is the one action that only says something.
  return { state, events: [{ type: 'telegramm', playerId: sender.id, text }] }
}

function applyStart(state: GameState): ActionResult {
  if (state.phase !== 'lobby') return reject(state, 'reject.alreadyRunning')
  if (state.players.length < 1) return reject(state, 'reject.needOneMerchant')

  const realtime = state.config.travel === 'echtzeit'
  if (realtime && state.now === 0) {
    return reject(state, 'reject.clockNotSet')
  }

  const draft = draftOf(state)
  draft.activeIndex = 0
  draft.startPlayerIndex = 0
  draft.round = 1
  draft.seq += 1

  if (realtime) {
    draft.phase = 'laufend'
    draft.startedAt = draft.now
    draft.marketSince = draft.now
    draft.endsAt = draft.now + draft.config.realtime.durationHours * 3_600_000
  } else {
    draft.phase = 'port' // everyone provisions in their Ausgangshafen first
  }

  return { state: draft as GameState, events: [{ type: 'gameStarted' }] }
}

/** Fold a whole action list - used by replays, tests and save files. */
export function replay(
  ctx: EngineContext,
  initial: GameState,
  actions: readonly GameAction[],
): GameState {
  return actions.reduce((s, a) => applyAction(ctx, s, a).state, initial)
}
