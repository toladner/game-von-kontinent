import type { ActionResult, GameAction, GameEvent } from './actions'
import type {
  CargoItem,
  GameState,
  Letter,
  Pigeon,
  PlayerState,
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
  legMsFor,
  portAt,
  quoteSale,
  routeTo,
  verkaufszwangOpen,
} from './selectors'
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

  // "Die Reiseroute, die ein Schiff nimmt, bleibt dem Spieler überlassen."
  // A port call is a fresh start: the line the ship came in on is open again,
  // so a captain may put about and go back the way they came. Only turning on
  // the spot at sea stays barred, which is what the Anleitung's ban on
  // "Pendeln" is really about.
  patchShip(draft, index, { cameFrom: null })

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
      const ship = action.vehicleId
        ? (player.fleet.find((v) => v.id === action.vehicleId) ?? null)
        : flagship(player)
      if (!ship) return reject(state, 'Dieses Schiff gehört nicht zu Ihrem Haus.')
      if (draft.config.sicht === 'realistisch' && ship.id !== flagship(player).id) {
        // You can only give an order to a captain you can actually speak to.
        if (flagship(player).voyage || ship.nodeId !== flagship(player).nodeId) {
          return reject(state, 'Zu diesem Kapitän müssen Sie eine Taube schicken.')
        }
      }
      if (ship.voyage) return reject(state, 'Das Schiff ist bereits unterwegs.')
      const here = portAt(ctx, ship.nodeId)
      if (!here) return reject(state, 'Das Schiff liegt nicht im Hafen.')
      if (action.to === here) return reject(state, 'Es liegt bereits dort.')

      const route = routeTo(ctx, ship.nodeId, ship.cameFrom, action.to)
      if (route.length === 0) return reject(state, 'Dorthin führt keine Linie.')

      const legMs = legMsFor(ctx, draft as GameState, ship, ship.nodeId, route[0]!)
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

    case 'buyVehicle': {
      // Checked before anything else: a table playing the printed rules has no
      // yard at all, and the reason differs from a house that is simply full.
      if (draft.config.maxFleetSize <= 1) {
        return reject(state, fleetLimitNote(draft.config.maxFleetSize))
      }
      const buyerShip = flagship(player)
      if (buyerShip.voyage) return reject(state, 'Auf See kauft man kein Schiff.')
      const yard = portAt(ctx, buyerShip.nodeId)
      if (!yard) return reject(state, 'Werften gibt es nur im Hafen.')

      const kind = ctx.pack.vehicles.find((v) => v.id === action.kindId)
      if (!kind) return reject(state, 'Dieses Schiff führt die Werft nicht.')
      if (player.cash < kind.price) return reject(state, 'Die Barmittel reichen nicht.')
      if (player.fleet.length >= draft.config.maxFleetSize) {
        return reject(state, fleetLimitNote(draft.config.maxFleetSize))
      }

      const identity = makeShipIdentity(`${player.id}:${player.fleet.length}:${ctx.pack.id}`)
      const bought: VehicleInstance = {
        id: `${player.id}-v${player.fleet.length + 1}`,
        name: identity.name,
        kind,
        nodeId: buyerShip.nodeId,
        cameFrom: null,
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
        return reject(state, 'Befehle wirken hier ohne Umweg über eine Taube.')
      }
      const sender = flagship(player)
      if (sender.voyage) return reject(state, 'Tauben steigen nur an Land auf.')
      const loft = portAt(ctx, sender.nodeId)
      if (!loft) return reject(state, 'Hier gibt es keinen Taubenschlag.')

      const target = player.fleet.find((v) => v.id === action.vehicleId)
      if (!target) return reject(state, 'Dieses Schiff gehört nicht zu Ihrem Haus.')
      if (target.id === sender.id) {
        return reject(state, 'Sie stehen an Bord — sagen Sie es dem Kapitän selbst.')
      }
      if (player.cash < draft.config.pigeon.price) {
        return reject(state, 'Der Taubenschlag will bezahlt werden.')
      }

      // The bird flies where you address it. Whether she is there is your
      // problem, and you will not be told either way.
      const toNode = action.toPort
      if (!portAt(ctx, toNode)) {
        return reject(state, 'Dorthin fliegt keine Taube.')
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
      if (reader.voyage) return reject(state, 'Post gibt es nur an Land.')
      const here = portAt(ctx, reader.nodeId)
      if (!here) return reject(state, 'Post gibt es nur im Hafen.')

      const waiting = player.knowledge.waiting[reader.nodeId] ?? []
      if (waiting.length === 0) return reject(state, 'Es liegt nichts für Sie bereit.')

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
      if (!target) return reject(state, 'Dieses Schiff gehört nicht zu Ihrem Haus.')
      if (target.id === current.id) break
      if (current.voyage || target.voyage) {
        return reject(state, 'Man wechselt das Schiff nur im Hafen.')
      }
      if (current.nodeId !== target.nodeId) {
        return reject(state, 'Dieses Schiff liegt in einem anderen Hafen.')
      }
      patchPlayer(draft, index, { aboard: target.id })
      events.push({ type: 'boarded', playerId: player.id, vehicleId: target.id })
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
            // Same as in round play: making port frees the ship to sail back
            // out the way it came in.
            patchVehicle(draft, i, vehicle.id, { cameFrom: null })
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
        patchVehicle(draft, index, ship.id, {
          voyage: {
            route,
            legStartedAt: draft.now,
            legArrivesAt: draft.now + legMs,
            destination: pigeon.order.destination,
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
    persona: makePersona(name, ctx.pack.id, action.gender),
    colorIndex: state.players.length,
    cash: draft.config.startingCapital,
    fleet: [firstShip],
    aboard: firstShip.id,
    homePort,
    hasDeparted: false,
    levyPaidRound: { steuer: null, versicherung: null },
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
