import type { ActionResult, GameAction, GameEvent } from './actions'
import type { CargoItem, GameState, PlayerState, VehicleInstance } from './state'
import { flagship } from './state'
import { makePersona, makeShipIdentity } from './persona'
import { goodOf, type EngineContext } from './context'
import { isPort } from './mapbuild'
import { rollDie } from './rng'
import { legalSteps, portAt, quoteSale, routeTo, verkaufszwangOpen } from './selectors'
import type { KonjunkturEffect, Money, NodeId } from './types'

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

const reject = (state: GameState, reason: string): ActionResult => ({
  state,
  events: [{ type: 'rejected', reason }],
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
      const grace = draft.config.levyGracePeriodRounds
      for (let i = 0; i < draft.players.length; i++) {
        const p = draft.players[i]!
        const last = p.levyPaidRound[effect.levy]
        if (last !== null && draft.round - last < grace) {
          events.push({ type: 'levySkipped', playerId: p.id, levy: effect.levy })
          continue
        }
        const value = p.fleet.reduce(
          (sum, v) => sum + v.cargo.reduce((s, c) => s + c.pricePaid, 0),
          0,
        )
        const due = Math.round((value * effect.percentOfCargoValue) / 100)
        chargePlayer(draft, i, due, effect.levy, events)
        patchPlayer(draft, i, {
          levyPaidRound: { ...draft.players[i]!.levyPaidRound, [effect.levy]: draft.round },
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
            skipTurns: 0,
            voyage: null,
          })
          portId = portAt(ctx, dest)
          if (portId) events.push({ type: 'arrived', playerId: player.id, portId })
        }
      }
      if (!portId) continue

      for (const item of start.cargo) {
        const local = ctx.exportsOf(portId).includes(item.goodId)
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

const MAX_PLAYERS = 6

export function applyAction(
  ctx: EngineContext,
  state: GameState,
  action: GameAction,
): ActionResult {
  // The clock comes first, and keeps running in the lobby so that a
  // real-time game has a starting instant to reckon from.
  if (action.type === 'tick') return applyTick(ctx, state, action.at)

  if (state.phase === 'over') return reject(state, 'Das Spiel ist beendet.')

  // Joining and starting stand apart: they are the only actions that do not
  // belong to whoever is currently at the table.
  if (action.type === 'join') return applyJoin(ctx, state, action)
  if (action.type === 'start') return applyStart(state)

  if (state.phase === 'lobby') {
    return reject(state, 'Die Partie hat noch nicht begonnen.')
  }

  const realtime = state.config.travel === 'echtzeit'

  if (realtime) {
    if (action.type === 'roll' || action.type === 'step' || action.type === 'endTurn') {
      return reject(state, 'In der Echtzeitfahrt wird nicht gewürfelt.')
    }
    if (action.type === 'drawKonjunktur') {
      return reject(state, 'Der Weltmarkt dreht die Karten von selbst.')
    }
  } else if (action.type === 'setCourse') {
    return reject(state, 'Kurse werden nur in der Echtzeitfahrt gesetzt.')
  }

  // In real-time play there is no "whose turn"; every action names its actor.
  const by = 'by' in action ? action.by : undefined
  const index = by ? state.players.findIndex((p) => p.id === by) : state.activeIndex
  if (index < 0) return reject(state, 'Unbekannter Kaufmann.')
  if (realtime && !by) return reject(state, 'Es fehlt die Angabe, wer handelt.')
  if (!realtime && by && index !== state.activeIndex) {
    return reject(state, 'Sie sind nicht am Zug.')
  }

  const draft = draftOf(state)
  const events: GameEvent[] = []
  const player = state.players[index]!

  switch (action.type) {
    case 'roll': {
      if (draft.phase !== 'roll') return reject(state, 'Jetzt ist nicht gewürfelt.')
      const [value, rng] = rollDie(draft.rng, draft.config.diceSides)
      draft.rng = rng
      draft.movement = { rolled: value, remaining: value, path: [flagship(player).nodeId] }
      draft.phase = 'move'
      events.push({ type: 'rolled', playerId: player.id, value })
      break
    }

    case 'step': {
      if (draft.phase !== 'move' || !draft.movement) {
        return reject(state, 'Es ist keine Fahrt im Gange.')
      }
      if (!legalSteps(ctx, player).includes(action.to)) {
        return reject(state, 'Dorthin führt keine Linie — oder es wäre ein Pendeln.')
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
      if (draft.phase !== 'konjunktur') return reject(state, 'Keine Karte fällig.')
      const cardId = draft.deck[0]
      if (!cardId) return reject(state, 'Das Päckchen ist leer.')
      // "Die abgehobene Karte wird sodann wieder mit dem Rücken nach oben
      // unter das Kartenpäckchen geschoben."
      draft.deck = [...draft.deck.slice(1), cardId]
      const card = ctx.cardsById.get(cardId)
      if (!card) return reject(state, `Unbekannte Karte ${cardId}`)

      draft.pendingCard = { cardId, drawerId: player.id }
      events.push({ type: 'cardDrawn', playerId: player.id, cardId })
      for (const effect of card.effects) applyEffect(ctx, draft, effect, index, events)
      draft.phase = 'port'
      break
    }

    case 'buy': {
      const buyer = flagship(player)
      if (realtime) {
        if (buyer.voyage) return reject(state, 'Auf See wird nicht gehandelt.')
      } else if (draft.phase !== 'port') {
        return reject(state, 'Das Kontor ist geschlossen.')
      }
      const portId = portAt(ctx, buyer.nodeId)
      if (!portId) return reject(state, 'Ihr Schiff liegt nicht im Hafen.')
      if (!ctx.exportsOf(portId).includes(action.goodId)) {
        return reject(state, 'Diese Ware führt der Hafen nicht aus.')
      }
      if (buyer.purchasesThisVisit.length >= draft.config.maxPurchasesPerPort) {
        return reject(state, 'In einem Hafen dürfen nur zwei Waren gekauft werden.')
      }
      if (buyer.purchasesThisVisit.includes(action.goodId)) {
        return reject(state, 'Von einer Warengattung nur eine Karte.')
      }
      const capacity = buyer.kind.capacity
      if (capacity !== null && buyer.cargo.length >= capacity) {
        return reject(state, `Der Laderaum faßt nur ${capacity} Posten.`)
      }
      if ((draft.bankStock[action.goodId] ?? 0) <= 0) {
        return reject(state, 'Die Exportbank hat keine Karte mehr davon.')
      }
      const g = goodOf(ctx, action.goodId)
      if (player.cash < g.buy) return reject(state, 'Die Barmittel reichen nicht.')

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
        if (seller.voyage) return reject(state, 'Auf See wird nicht gehandelt.')
      } else if (draft.phase !== 'port') {
        return reject(state, 'Das Kontor ist geschlossen.')
      }
      const portId = portAt(ctx, seller.nodeId)
      if (!portId) return reject(state, 'Ihr Schiff liegt nicht im Hafen.')
      const item = seller.cargo.find((c) => c.uid === action.uid)
      if (!item) return reject(state, 'Diese Ware ist nicht an Bord.')

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
      break
    }

    case 'setCourse': {
      if (draft.phase !== 'laufend') return reject(state, 'Die Partie fährt nicht.')
      const ship = flagship(player)
      if (ship.voyage) return reject(state, 'Das Schiff ist bereits unterwegs.')
      const here = portAt(ctx, ship.nodeId)
      if (!here) return reject(state, 'Das Schiff liegt nicht im Hafen.')
      if (action.to === here) return reject(state, 'Sie liegen bereits dort.')

      const route = routeTo(ctx, ship.nodeId, ship.cameFrom, action.to)
      if (route.length === 0) return reject(state, 'Dorthin führt keine Linie.')

      const legMs = draft.config.realtime.minutesPerPip * 60_000
      patchVehicle(draft, index, ship.id, {
        voyage: {
          route,
          legStartedAt: draft.now,
          legArrivesAt: draft.now + legMs,
          destination: action.to,
        },
      })
      events.push({
        type: 'setSail',
        playerId: player.id,
        to: action.to,
        arrivesAt: draft.now + legMs * route.length,
      })
      break
    }

    case 'endTurn': {
      if (draft.phase !== 'port' && draft.phase !== 'endOfTurn') {
        return reject(state, 'Der Zug ist noch nicht zu Ende.')
      }
      const portId = portAt(ctx, flagship(player).nodeId)
      if (portId && verkaufszwangOpen(ctx, state, player, portId)) {
        return reject(
          state,
          'Verkaufszwang: mindestens eine Warengattung, die dieser Hafen nicht führt, muß abgesetzt werden.',
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

  advanceVoyages(ctx, draft, events)
  turnMarket(ctx, draft, events)

  if (draft.endsAt > 0 && draft.now >= draft.endsAt) {
    resolveFinalRun(ctx, draft, events)
  }

  return { state: draft as GameState, events }
}

/** Move every ship as far along its route as the clock allows. */
function advanceVoyages(ctx: EngineContext, draft: Draft, events: GameEvent[]): void {
  const legMs = draft.config.realtime.minutesPerPip * 60_000

  for (let i = 0; i < draft.players.length; i++) {
    for (const start of draft.players[i]!.fleet) {
      let vehicle = start
      let guard = 0

      while (vehicle.voyage && draft.now >= vehicle.voyage.legArrivesAt && guard++ < 5000) {
        const voyage = vehicle.voyage
        const next = voyage.route[0]!
        const rest = voyage.route.slice(1)

        patchVehicle(draft, i, vehicle.id, {
          nodeId: next,
          cameFrom: vehicle.nodeId,
          purchasesThisVisit: rest.length === 0 ? [] : vehicle.purchasesThisVisit,
          voyage:
            rest.length === 0
              ? null
              : {
                  route: rest,
                  legStartedAt: voyage.legArrivesAt,
                  legArrivesAt: voyage.legArrivesAt + legMs,
                  destination: voyage.destination,
                },
        })

        if (rest.length === 0) {
          const portId = portAt(ctx, next)
          if (portId) {
            events.push({ type: 'arrived', playerId: draft.players[i]!.id, portId })
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
 * The world market. Instead of red fields on a round track, a Konjunktur card
 * is turned every so often and stands for everyone until the next one — which
 * is what makes looking in on a running game worth doing.
 */
function turnMarket(ctx: EngineContext, draft: Draft, events: GameEvent[]): void {
  const intervalMs = draft.config.realtime.marketIntervalMinutes * 60_000
  if (intervalMs <= 0) return

  let guard = 0
  while (draft.now - draft.marketSince >= intervalMs && guard++ < 200) {
    const cardId = draft.deck[0]
    if (!cardId) return
    draft.deck = [...draft.deck.slice(1), cardId]
    const card = ctx.cardsById.get(cardId)
    draft.marketSince += intervalMs
    draft.marketCardId = cardId
    if (!card) continue

    // A world card has no single drawer, so what the printed rules charge one
    // player is charged to the whole fleet.
    draft.saleModifierPercent = 0
    for (const effect of card.effects) {
      switch (effect.kind) {
        case 'salePriceDelta':
          draft.saleModifierPercent += effect.percent
          break
        case 'payoutToDrawer':
          for (let i = 0; i < draft.players.length; i++) {
            payPlayer(draft, i, effect.amount, 'telegramm', events)
          }
          break
        case 'feeForDrawer':
          for (let i = 0; i < draft.players.length; i++) {
            chargePlayer(draft, i, effect.amount, 'entladegeld', events)
          }
          break
        default:
          applyEffect(ctx, draft, effect, 0, events)
      }
    }
    events.push({ type: 'marketTurned', cardId })
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
    return reject(state, 'Dieser Kaufmann ist bereits eingetragen.')
  }
  if (state.players.length >= MAX_PLAYERS) {
    return reject(state, `Mehr als ${MAX_PLAYERS} Schiffe fahren nicht.`)
  }
  if (state.phase !== 'lobby' && state.joinPolicy !== 'jederzeit') {
    return reject(state, 'Diese Partie nimmt keine Nachzügler auf.')
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
    skipTurns: 0,
    voyage: null,
    cargo: [],
    purchasesThisVisit: [],
  }

  const player: PlayerState = {
    id: action.playerId,
    name,
    persona: makePersona(name, ctx.pack.id),
    colorIndex: state.players.length,
    cash: draft.config.startingCapital,
    fleet: [firstShip],
    aboard: firstShip.id,
    homePort,
    hasDeparted: false,
    levyPaidRound: { steuer: null, versicherung: null },
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

function applyStart(state: GameState): ActionResult {
  if (state.phase !== 'lobby') return reject(state, 'Die Partie läuft bereits.')
  if (state.players.length < 1) return reject(state, 'Es braucht mindestens einen Kaufmann.')

  const realtime = state.config.travel === 'echtzeit'
  if (realtime && state.now === 0) {
    return reject(state, 'Der Weltuhr fehlt der Anschlag.')
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
