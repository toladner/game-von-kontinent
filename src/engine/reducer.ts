import type { ActionResult, GameAction, GameEvent } from './actions'
import type { CargoItem, GameState, PlayerState } from './state'
import { activePlayer } from './state'
import { makePersona } from './persona'
import { goodOf, type EngineContext } from './context'
import { isPort } from './mapbuild'
import { rollDie } from './rng'
import { legalSteps, portAt, quoteSale, verkaufszwangOpen } from './selectors'
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

  while (player.cash < amount && player.cargo.length > 0) {
    // Liquidate the most valuable piece first - fewest forced sales.
    const sorted = [...player.cargo].sort((a, b) => b.pricePaid - a.pricePaid)
    const item = sorted[0]!
    const price = Math.round(item.pricePaid * draft.config.distressSaleRate)
    draft.bankStock[item.goodId] = (draft.bankStock[item.goodId] ?? 0) + 1
    patchPlayer(draft, index, {
      cash: player.cash + price,
      cargo: player.cargo.filter((c) => c.uid !== item.uid),
    })
    events.push({
      type: 'sold',
      playerId: player.id,
      goodId: item.goodId,
      price,
      profit: price - item.pricePaid,
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
        if (portAt(ctx, p.ship.nodeId)) {
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
        const value = p.cargo.reduce((s, c) => s + c.pricePaid, 0)
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
  const node = player.ship.nodeId
  const portId = portAt(ctx, node)

  draft.movement = null
  draft.saleModifierPercent = 0
  patchPlayer(draft, index, { purchasesThisVisit: [] })

  if (!portId) {
    // "Steht ein Schiff auf freier See ... und es kommt ein zweites Schiff auf
    // dem gleichen Punkt zu stehen, so bedeutet dies einen Zusammenstoß."
    const victimIndex = draft.players.findIndex(
      (p, i) => i !== index && p.ship.nodeId === node,
    )
    if (victimIndex >= 0) {
      const victim = draft.players[victimIndex]!
      const value = victim.cargo.reduce((s, c) => s + c.pricePaid, 0)
      const damages = Math.round(value * draft.config.collisionDamageRate)
      chargePlayer(draft, index, damages, 'schaden', events)
      payPlayer(draft, victimIndex, damages, 'schaden', events)
      patchPlayer(draft, index, {
        ship: { ...draft.players[index]!.ship, skipTurns: draft.config.collisionPenaltyTurns },
      })
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
    let portId = portAt(ctx, player.ship.nodeId)

    if (!portId) {
      const path = pathToNearestPort(ctx, player.ship.nodeId, player.ship.cameFrom)
      if (path.length > 0) {
        const dest = path[path.length - 1]!
        const before = path.length > 1 ? path[path.length - 2]! : player.ship.nodeId
        patchPlayer(draft, i, { ship: { nodeId: dest, cameFrom: before, skipTurns: 0 } })
        portId = portAt(ctx, dest)
        if (portId) events.push({ type: 'arrived', playerId: player.id, portId })
      }
    }
    if (!portId) continue

    for (const item of draft.players[i]!.cargo) {
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
      patchPlayer(draft, i, {
        cash: draft.players[i]!.cash + price,
      })
    }
    patchPlayer(draft, i, { cargo: [] })
  }

  draft.phase = 'over'
  draft.movement = null
  events.push({ type: 'gameOver' })
}

function advanceTurn(ctx: EngineContext, draft: Draft, events: GameEvent[]): void {
  const finished = draft.players[draft.activeIndex]!
  patchPlayer(draft, draft.activeIndex, { hasDeparted: true, purchasesThisVisit: [] })
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
    if (next.ship.skipTurns > 0) {
      patchPlayer(draft, draft.activeIndex, {
        ship: { ...next.ship, skipTurns: next.ship.skipTurns - 1 },
      })
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
  if (state.phase === 'over') return reject(state, 'Das Spiel ist beendet.')

  // Joining and starting stand apart: they are the only actions that do not
  // belong to whoever is currently at the table.
  if (action.type === 'join') return applyJoin(ctx, state, action)
  if (action.type === 'start') return applyStart(state)

  if (state.phase === 'lobby') {
    return reject(state, 'Die Partie hat noch nicht begonnen.')
  }

  const draft = draftOf(state)
  const events: GameEvent[] = []
  const index = draft.activeIndex
  const player = activePlayer(state)

  switch (action.type) {
    case 'roll': {
      if (draft.phase !== 'roll') return reject(state, 'Jetzt ist nicht gewürfelt.')
      const [value, rng] = rollDie(draft.rng, draft.config.diceSides)
      draft.rng = rng
      draft.movement = { rolled: value, remaining: value, path: [player.ship.nodeId] }
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
      patchPlayer(draft, index, {
        ship: { nodeId: action.to, cameFrom: player.ship.nodeId, skipTurns: player.ship.skipTurns },
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
      if (draft.phase !== 'port') return reject(state, 'Das Kontor ist geschlossen.')
      const portId = portAt(ctx, player.ship.nodeId)
      if (!portId) return reject(state, 'Ihr Schiff liegt nicht im Hafen.')
      if (!ctx.exportsOf(portId).includes(action.goodId)) {
        return reject(state, 'Diese Ware führt der Hafen nicht aus.')
      }
      if (player.purchasesThisVisit.length >= draft.config.maxPurchasesPerPort) {
        return reject(state, 'In einem Hafen dürfen nur zwei Waren gekauft werden.')
      }
      if (player.purchasesThisVisit.includes(action.goodId)) {
        return reject(state, 'Von einer Warengattung nur eine Karte.')
      }
      const capacity = player.vehicle.capacity
      if (capacity !== null && player.cargo.length >= capacity) {
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
      patchPlayer(draft, index, {
        cash: player.cash - g.buy,
        cargo: [...player.cargo, item],
        purchasesThisVisit: [...player.purchasesThisVisit, action.goodId],
      })
      events.push({ type: 'bought', playerId: player.id, goodId: action.goodId, price: g.buy })
      break
    }

    case 'sell': {
      if (draft.phase !== 'port') return reject(state, 'Das Kontor ist geschlossen.')
      const portId = portAt(ctx, player.ship.nodeId)
      if (!portId) return reject(state, 'Ihr Schiff liegt nicht im Hafen.')
      const item = player.cargo.find((c) => c.uid === action.uid)
      if (!item) return reject(state, 'Diese Ware ist nicht an Bord.')

      const quote = quoteSale(ctx, state, item, portId)
      draft.bankStock[item.goodId] = (draft.bankStock[item.goodId] ?? 0) + 1
      patchPlayer(draft, index, {
        cash: player.cash + quote.price,
        cargo: player.cargo.filter((c) => c.uid !== action.uid),
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

    case 'endTurn': {
      if (draft.phase !== 'port' && draft.phase !== 'endOfTurn') {
        return reject(state, 'Der Zug ist noch nicht zu Ende.')
      }
      const portId = portAt(ctx, player.ship.nodeId)
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

  const player: PlayerState = {
    id: action.playerId,
    name,
    persona: makePersona(name, ctx.pack.id),
    colorIndex: state.players.length,
    cash: draft.config.startingCapital,
    cargo: [],
    ship: { nodeId: homePort, cameFrom: null, skipTurns: 0 },
    vehicle: draft.config.startingVehicle,
    homePort,
    purchasesThisVisit: [],
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

  const draft = draftOf(state)
  draft.phase = 'port' // everyone provisions in their Ausgangshafen first
  draft.activeIndex = 0
  draft.startPlayerIndex = 0
  draft.round = 1
  draft.seq += 1

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
