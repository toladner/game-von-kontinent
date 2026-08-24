import { describe, expect, it } from 'vitest'
import { CLASSIC_PACK } from '@content/maps/classic'
import { createContext } from './context'
import { createGame, openingActions } from './setup'
import { applyAction, replay } from './reducer'
import {
  buyOffers,
  castOffMs,
  closureAt,
  continentOf,
  legalSteps,
  legMsFor,
  portAt,
  quoteSale,
  routeTo,
  standings,
  verkaufszwangOpen,
  voyageEndsAt,
} from './selectors'
import { isPort } from './mapbuild'
import { exportsAt, sellPriceAt } from './market'
import { flagship, netWorth } from './state'
import type { GameAction } from './actions'
import type { GameState } from './state'
import type { Continent, KonjunkturCard } from './types'

const ctx = createContext(CLASSIC_PACK)

/** Open a table, seat the given traders and start play. */
function seated(names: string[], options: Parameters<typeof createGame>[1] = {}) {
  return replay(ctx, createGame(ctx, options), openingActions(names))
}

describe('content', () => {
  it('holds all 72 Warenkarten with sane prices', () => {
    expect(CLASSIC_PACK.goods).toHaveLength(72)
    for (const g of CLASSIC_PACK.goods) {
      expect(g.sell).toBeGreaterThan(g.buy)
    }
  })

  it('holds the 27 Konjunktur cards', () => {
    expect(CLASSIC_PACK.konjunktur).toHaveLength(27)
  })

  it('only lets ports export goods that exist', () => {
    for (const port of ctx.portsById.values()) {
      for (const id of ctx.exportsOf(port.id)) {
        expect(ctx.goodsById.has(id), `${port.name} exports unknown good ${id}`).toBe(true)
      }
    }
  })

  it('gives every port at least one export', () => {
    for (const port of ctx.portsById.values()) {
      expect(ctx.exportsOf(port.id).length, `${port.name} exports nothing`).toBeGreaterThan(0)
    }
  })
})

describe('map', () => {
  it('connects every port to every other by sea', () => {
    const start = 'hamburg'
    const seen = new Set<string>([start])
    const queue = [start]
    while (queue.length > 0) {
      const at = queue.shift()!
      for (const next of ctx.graph.neighbours.get(at) ?? []) {
        if (seen.has(next)) continue
        seen.add(next)
        queue.push(next)
      }
    }
    const unreachable = [...ctx.portsById.keys()].filter((id) => !seen.has(id))
    expect(unreachable).toEqual([])
  })

  it('spaces the pips so no leg is absurdly long', () => {
    const counts = new Map<string, number>()
    for (const lane of CLASSIC_PACK.map.lanes) {
      counts.set(lane.a, (counts.get(lane.a) ?? 0) + 1)
    }
    // Sea nodes are pure chain links: at most two lanes each.
    for (const node of CLASSIC_PACK.map.nodes) {
      if (isPort(node)) continue
      const degree = (ctx.graph.neighbours.get(node.id) ?? []).length
      expect(degree).toBe(2)
    }
  })
})

describe('a turn', () => {
  const game = seated(['Ada', 'Bo'], { seed: 'test-1' })

  it('starts every ship in a harbour with 500.000', () => {
    for (const p of game.players) {
      expect(p.cash).toBe(500_000)
      expect(portAt(ctx, flagship(p).nodeId)).not.toBeNull()
      expect(p.hasDeparted).toBe(false)
    }
    expect(game.phase).toBe('port')
  })

  it('allows two goods per port and never twice the same', () => {
    const portId = portAt(ctx, flagship(game.players[0]!).nodeId)!
    const offers = buyOffers(ctx, game, game.players[0]!, portId)
    const affordable = offers.filter((o) => o.status === 'ok')
    expect(affordable.length).toBeGreaterThan(0)

    let s = game
    const first = affordable[0]!.goodId
    s = applyAction(ctx, s, { type: 'buy', goodId: first }).state
    expect(flagship(s.players[0]!).cargo).toHaveLength(1)

    const again = applyAction(ctx, s, { type: 'buy', goodId: first })
    expect(again.events[0]).toMatchObject({ type: 'rejected' })

    const second = affordable.find((o) => o.goodId !== first)
    if (second) {
      s = applyAction(ctx, s, { type: 'buy', goodId: second.goodId }).state
      expect(flagship(s.players[0]!).cargo).toHaveLength(2)
      const third = affordable.find((o) => o.goodId !== first && o.goodId !== second.goodId)
      if (third) {
        const blocked = applyAction(ctx, s, { type: 'buy', goodId: third.goodId })
        expect(blocked.events[0]).toMatchObject({ type: 'rejected' })
      }
    }
  })

  it('rolls, sails the full throw and never turns on the spot', () => {
    let s = applyAction(ctx, game, { type: 'endTurn' }).state // Ada provisions
    s = applyAction(ctx, s, { type: 'endTurn' }).state // Bo provisions
    expect(s.phase).toBe('roll')

    const rolled = applyAction(ctx, s, { type: 'roll' })
    s = rolled.state
    expect(s.phase).toBe('move')
    const value = s.movement!.rolled
    expect(value).toBeGreaterThanOrEqual(1)
    expect(value).toBeLessThanOrEqual(6)

    for (let i = 0; i < value; i++) {
      const player = s.players[s.activeIndex]!
      const options = legalSteps(ctx, player)
      expect(options).not.toContain(flagship(player).cameFrom)
      s = applyAction(ctx, s, { type: 'step', to: options[0]! }).state
    }
    expect(s.movement).toBeNull()
    expect(['port', 'konjunktur', 'endOfTurn']).toContain(s.phase)
  })

  /**
   * Sail on, taking the first legal line each time, until somebody is standing
   * in a harbour with the wheel in their hands.
   */
  function sailUntilPort(start: GameState): GameState {
    // Everyone begins tied up in their home port with cameFrom already null,
    // so cast off first — otherwise this returns before a single line is
    // sailed and proves nothing.
    let s = start
    while (s.phase === 'port') s = applyAction(ctx, s, { type: 'endTurn' }).state

    for (let guard = 0; guard < 400 && s.phase !== 'port'; guard++) {
      const player = s.players[s.activeIndex]!
      switch (s.phase) {
        case 'roll':
          s = applyAction(ctx, s, { type: 'roll' }).state
          break
        case 'move':
          s = applyAction(ctx, s, { type: 'step', to: legalSteps(ctx, player)[0]! }).state
          break
        case 'konjunktur':
          s = applyAction(ctx, s, { type: 'drawKonjunktur' }).state
          break
        default:
          s = applyAction(ctx, s, { type: 'endTurn' }).state
      }
    }
    return s
  }

  it('lets a ship put about once it has made port', () => {
    // "Die Reiseroute ... bleibt dem Spieler überlassen." A full port call
    // earns the right to leave the way you came in; only the flinch at sea is
    // forbidden. Before this, cameFrom survived the visit and the ship was
    // shoved onward whether the captain liked it or not.
    const inPort = sailUntilPort(seated(['Ada', 'Bo'], { seed: 'kehrtwende' }))
    expect(inPort.phase).toBe('port')

    const player = inPort.players[inPort.activeIndex]!
    const ship = flagship(player)
    expect(portAt(ctx, ship.nodeId)).toBeTruthy()
    expect(ship.cameFrom).toBeNull()

    // Every line out of the harbour is open, the arrival line included.
    const all = ctx.graph.neighbours.get(ship.nodeId) ?? []
    expect(all.length).toBeGreaterThan(0)
    expect([...legalSteps(ctx, player)].sort()).toEqual([...all].sort())
  })

  it('still refuses to let a ship turn round in open water', () => {
    let s = seated(['Ada', 'Bo'], { seed: 'kehrtwende' })
    s = applyAction(ctx, s, { type: 'endTurn' }).state
    s = applyAction(ctx, s, { type: 'endTurn' }).state
    s = applyAction(ctx, s, { type: 'roll' }).state

    const player = s.players[s.activeIndex]!
    const first = legalSteps(ctx, player)[0]!
    s = applyAction(ctx, s, { type: 'step', to: first }).state

    const moved = s.players[s.activeIndex]!
    if (s.phase === 'move' && !portAt(ctx, flagship(moved).nodeId)) {
      expect(flagship(moved).cameFrom).not.toBeNull()
      expect(legalSteps(ctx, moved)).not.toContain(flagship(moved).cameFrom)
    }
  })
})

describe('determinism', () => {
  it('replays to exactly the same state', () => {
    const a = seated(['Ada', 'Bo'], { seed: 'seed-42' })
    const script: GameAction[] = [{ type: 'endTurn' }, { type: 'endTurn' }, { type: 'roll' }]
    const first = replay(ctx, a, script)
    const b = seated(['Ada', 'Bo'], { seed: 'seed-42' })
    const second = replay(ctx, b, script)
    expect(JSON.stringify(first)).toEqual(JSON.stringify(second))
  })

  it('gives the same trader for the same name', () => {
    const a = seated(['Tobias'], { seed: 'x' })
    const b = seated(['Tobias'], { seed: 'y' })
    expect(a.players[0]!.persona).toEqual(b.players[0]!.persona)
  })
})

describe('real-time sailing', () => {
  const T0 = 1_800_000_000_000
  const MIN = 60_000

  /** A running real-time table with one trader aboard. */
  const afloat = () =>
    replay(ctx, createGame(ctx, { seed: 'rt', travel: 'echtzeit', minutesPerPip: 1, durationHours: 2 }), [
      { type: 'tick', at: T0 },
      { type: 'join', playerId: 'a', name: 'Ada' },
      { type: 'join', playerId: 'b', name: 'Bo' },
      { type: 'start' },
    ])

  it('runs on a clock, not a round track', () => {
    const s = afloat()
    expect(s.phase).toBe('laufend')
    expect(s.now).toBe(T0)
    expect(s.endsAt).toBe(T0 + 2 * 3_600_000)
  })

  it('never reads the wall clock: the same ticks give the same game', () => {
    const script: GameAction[] = [{ type: 'tick', at: T0 + 30 * MIN }]
    const a = replay(ctx, afloat(), script)
    const b = replay(ctx, afloat(), script)
    expect(JSON.stringify(a)).toEqual(JSON.stringify(b))
  })

  it('sails a course over real time and arrives by itself', () => {
    let s = afloat()
    const from = flagship(s.players[0]!).nodeId
    const target = [...ctx.portsById.keys()].find((id) => {
      if (id === from) return false
      const r = routeTo(ctx, from, null, id)
      return r.length >= 2 && r.length <= 6
    })!

    s = applyAction(ctx, s, { type: 'setCourse', to: target, by: 'a' }).state
    expect(flagship(s.players[0]!).voyage!.destination).toBe(target)

    // Legs are priced by the sea mile now, so ask the map how long this
    // voyage takes rather than assuming a minute a hop.
    const eta = voyageEndsAt(ctx, s, flagship(s.players[0]!))!
    expect(eta).toBeGreaterThan(T0)

    // Halfway there, still at sea.
    s = applyAction(ctx, s, { type: 'tick', at: T0 + Math.floor((eta - T0) / 2) }).state
    expect(flagship(s.players[0]!).voyage).not.toBeNull()
    expect(portAt(ctx, flagship(s.players[0]!).nodeId)).not.toBe(target)

    // Come back later: the ship is in harbour without anyone watching.
    const arrived = applyAction(ctx, s, { type: 'tick', at: eta + MIN })
    expect(flagship(arrived.state.players[0]!).nodeId).toBe(target)
    expect(flagship(arrived.state.players[0]!).voyage ?? null).toBeNull()
    expect(arrived.events.some((e) => e.type === 'arrived')).toBe(true)
  })

  it('charges by the sea mile, not by the hop', () => {
    // A flat cost per hop made the Atlantic as quick as the Channel. The map
    // knows how far every lane runs, so the clock should too.
    const s = afloat()
    const ship = flagship(s.players[0]!)
    const lanes = [...ctx.graph.edgeKm.entries()].sort((a, b) => a[1] - b[1])
    const [shortest] = lanes[0]!
    const [longest] = lanes[lanes.length - 1]!
    const split = (key: string) => key.split('|') as [string, string]

    const quick = legMsFor(ctx, s, ship, ...split(shortest))
    const slow = legMsFor(ctx, s, ship, ...split(longest))
    expect(slow).toBeGreaterThan(quick)
    // And the difference is the distance, not a rounding wobble.
    expect(slow / quick).toBeGreaterThan(2)
  })

  it('keeps minutesPerPip meaning "an ordinary hop"', () => {
    // Times are billed against the median lane, so the setting a player picks
    // still describes a typical leg however uneven the map is.
    const s = afloat()
    const ship = flagship(s.players[0]!)
    const median = ctx.graph.typicalKm
    const lane = [...ctx.graph.edgeKm.entries()].find(([, km]) => km === median)!
    const [a, b] = lane[0].split('|') as [string, string]
    expect(legMsFor(ctx, s, ship, a, b)).toBeCloseTo(1 * (ship.kind.speedFactor || 1) * 60_000, 0)
  })

  it('keeps the ship alongside while the cargo is worked', () => {
    // Setting a course is instant; casting off is not. A break-bulk freighter
    // spent days in port, and the game charges a short parcel call for it.
    let s = afloat()
    const from = flagship(s.players[0]!).nodeId
    const target = [...ctx.portsById.keys()].find((id) => {
      if (id === from) return false
      const r = routeTo(ctx, from, null, id)
      return r.length >= 2 && r.length <= 6
    })!

    s = applyAction(ctx, s, { type: 'setCourse', to: target, by: 'a' }).state
    const voyage = flagship(s.players[0]!).voyage!
    expect(voyage.departsAt).toBeGreaterThan(T0)

    // Still tied up a moment later, and still where she was.
    const loading = applyAction(ctx, s, { type: 'tick', at: voyage.departsAt - 1000 }).state
    expect(flagship(loading.players[0]!).nodeId).toBe(from)
    expect(flagship(loading.players[0]!).voyage).not.toBeNull()
  })

  it('lets a merchant keep trading until she casts off', () => {
    // The hatches are still open, so a change of mind is allowed — and a
    // course set by mistake should not lock the quay.
    let s = afloat()
    const here = portAt(ctx, flagship(s.players[0]!).nodeId)!
    const target = [...ctx.portsById.keys()].find(
      (id) => id !== here && routeTo(ctx, flagship(s.players[0]!).nodeId, null, id).length >= 2,
    )!
    s = applyAction(ctx, s, { type: 'setCourse', to: target, by: 'a' }).state

    const offer = buyOffers(ctx, s, s.players[0]!, here).find((o) => o.status === 'ok')!
    const bought = applyAction(ctx, s, { type: 'buy', goodId: offer.goodId, by: 'a' })
    expect(bought.events.some((e) => e.type === 'rejected')).toBe(false)
    expect(flagship(bought.state.players[0]!).cargo).toHaveLength(1)

    // Once she is away, the quay is shut.
    const departs = flagship(s.players[0]!).voyage!.departsAt
    const sailed = applyAction(ctx, bought.state, { type: 'tick', at: departs + 1000 }).state
    const second = buyOffers(ctx, sailed, sailed.players[0]!, here).find(
      (o) => o.goodId !== offer.goodId && o.status === 'ok',
    )
    if (second) {
      const refused = applyAction(ctx, sailed, { type: 'buy', goodId: second.goodId, by: 'a' })
      expect(refused.events.some((e) => e.type === 'rejected')).toBe(true)
    }
  })

  it('lets a course be changed while she is still alongside', () => {
    let s = afloat()
    const from = flagship(s.players[0]!).nodeId
    const reachable = [...ctx.portsById.keys()].filter(
      (id) => id !== portAt(ctx, from) && routeTo(ctx, from, null, id).length >= 2,
    )
    const [first, second] = [reachable[0]!, reachable[1]!]

    s = applyAction(ctx, s, { type: 'setCourse', to: first, by: 'a' }).state
    expect(flagship(s.players[0]!).voyage!.destination).toBe(first)

    const changed = applyAction(ctx, s, { type: 'setCourse', to: second, by: 'a' })
    expect(changed.events.some((e) => e.type === 'rejected')).toBe(false)
    expect(flagship(changed.state.players[0]!).voyage!.destination).toBe(second)

    // Once she has cast off, the decision is made.
    const departs = flagship(changed.state.players[0]!).voyage!.departsAt
    const sailed = applyAction(ctx, changed.state, { type: 'tick', at: departs + 1000 }).state
    const late = applyAction(ctx, sailed, { type: 'setCourse', to: first, by: 'a' })
    expect(late.events.some((e) => e.type === 'rejected')).toBe(true)
  })

  it('reports an arrival time that matches the voyage it describes', () => {
    // The announced ETA multiplied one leg by the route length, which stopped
    // being true the moment legs were charged by the sea mile.
    let s = afloat()
    const from = flagship(s.players[0]!).nodeId
    const target = [...ctx.portsById.keys()].find((id) => {
      if (id === portAt(ctx, from)) return false
      const r = routeTo(ctx, from, null, id)
      return r.length >= 3 && r.length <= 6
    })!

    const ordered = applyAction(ctx, s, { type: 'setCourse', to: target, by: 'a' })
    const announced = ordered.events.find((e) => e.type === 'setSail')
    expect(announced?.type).toBe('setSail')
    s = ordered.state

    const actual = voyageEndsAt(ctx, s, flagship(s.players[0]!))!
    if (announced?.type === 'setSail') {
      expect(announced.arrivesAt).toBeCloseTo(actual, -3)
    }
  })

  it('turns a lumbering ship round more slowly', () => {
    const s = afloat()
    const ship = flagship(s.players[0]!)
    const slow = { ...ship, kind: { ...ship.kind, speedFactor: 2 } }
    expect(castOffMs(s, slow)).toBeCloseTo(castOffMs(s, ship) * 2, 5)
  })

  it('will not trade from the open sea', () => {
    let s = afloat()
    const from = flagship(s.players[0]!).nodeId
    const target = [...ctx.portsById.keys()].find(
      (id) => id !== from && routeTo(ctx, from, null, id).length >= 3,
    )!
    s = applyAction(ctx, s, { type: 'setCourse', to: target, by: 'a' }).state
    s = applyAction(ctx, s, { type: 'tick', at: T0 + MIN }).state

    const goodId = ctx.exportsOf(portAt(ctx, from)!)[0]!
    const refused = applyAction(ctx, s, { type: 'buy', goodId, by: 'a' })
    expect(refused.events[0]).toMatchObject({ type: 'rejected' })
  })

  it('lets both traders act without waiting for a turn', () => {
    const s = afloat()
    const portOfA = portAt(ctx, flagship(s.players[0]!).nodeId)!
    const portOfB = portAt(ctx, flagship(s.players[1]!).nodeId)!

    const afterA = applyAction(ctx, s, { type: 'buy', goodId: ctx.exportsOf(portOfA)[0]!, by: 'a' })
    expect(flagship(afterA.state.players[0]!).cargo).toHaveLength(1)

    // Bo does not have to wait for Ada to finish.
    const afterB = applyAction(ctx, afterA.state, {
      type: 'buy',
      goodId: ctx.exportsOf(portOfB)[0]!,
      by: 'b',
    })
    expect(flagship(afterB.state.players[1]!).cargo).toHaveLength(1)
  })

  it('turns the world market on its own schedule', () => {
    const s = afloat()
    expect(s.marketCardId).toBeNull()
    const later = applyAction(ctx, s, {
      type: 'tick',
      at: T0 + s.config.realtime.marketIntervalMinutes * MIN,
    })
    expect(later.state.marketCardId).not.toBeNull()
    expect(later.events.some((e) => e.type === 'marketTurned')).toBe(true)
  })

  it('closes the season on time and settles every hold', () => {
    const s = afloat()
    const done = applyAction(ctx, s, { type: 'tick', at: T0 + 3 * 3_600_000 })
    expect(done.state.phase).toBe('over')
    for (const p of done.state.players) expect(flagship(p).cargo).toHaveLength(0)
    expect(standings(done.state)).toHaveLength(2)
  })
})

/**
 * A Konjunktur card with nobody to draw it.
 *
 * In round play the card is turned by a merchant standing on a quay, which is
 * what its wording takes for granted. Real-time play turns one for the whole
 * world every twenty minutes, and charging the entire fleet the moment it
 * turned put an unloading fee on ships in mid-ocean. A standing card settles
 * with a ship when that ship does the thing the card is about, and not before.
 */
describe('the world market in real time', () => {
  const T0 = 1_800_000_000_000
  const MIN = 60_000
  const INTERVAL = CLASSIC_PACK.config.realtime.marketIntervalMinutes

  const afloat = () =>
    replay(
      ctx,
      createGame(ctx, { seed: 'markt', travel: 'echtzeit', minutesPerPip: 1, durationHours: 8 }),
      [
        { type: 'tick', at: T0 },
        { type: 'join', playerId: 'a', name: 'Ada' },
        { type: 'join', playerId: 'b', name: 'Bo' },
        { type: 'start' },
      ],
    )

  /** The one card in the deck carrying a given effect. */
  const cardWith = (kind: string) =>
    CLASSIC_PACK.konjunktur.find((c) => c.effects.some((e) => e.kind === kind))!

  /**
   * Turn the market once, with a chosen card on top of the deck.
   *
   * By backdating the last turn rather than jumping the clock forward, so
   * that a ship put to sea for one of these tests is still at sea when the
   * card lands on her.
   */
  const turn = (s: GameState, cardId: string) =>
    applyAction(
      ctx,
      {
        ...s,
        deck: [cardId, ...s.deck.filter((d) => d !== cardId)],
        marketSince: s.now - INTERVAL * MIN,
      },
      { type: 'tick', at: s.now + 1000 },
    )

  /** Send a ship out of harbour and leave her there, at sea. */
  const putToSea = (s: GameState, by: string): GameState => {
    const index = s.players.findIndex((p) => p.id === by)
    const from = flagship(s.players[index]!).nodeId
    const target = [...ctx.portsById.keys()].find(
      (id) => id !== portAt(ctx, from) && routeTo(ctx, from, null, id).length >= 6,
    )!
    const ordered = applyAction(ctx, s, { type: 'setCourse', to: target, by }).state
    const away = flagship(ordered.players[index]!).voyage!.departsAt
    const sailed = applyAction(ctx, ordered, { type: 'tick', at: away + 1000 }).state
    expect(flagship(sailed.players[index]!).voyage).not.toBeNull()
    return sailed
  }

  const cashOf = (s: GameState, by: string) => s.players.find((p) => p.id === by)!.cash

  it('does not bill a ship at sea for unloading', () => {
    // The complaint this is all about: an Entladegeld while three days out.
    const s = putToSea(afloat(), 'a')
    const before = cashOf(s, 'a')

    const fee = cardWith('feeForDrawer')
    const turned = turn(s, fee.id)
    expect(turned.state.marketCardId).toBe(fee.id)
    expect(cashOf(turned.state, 'a')).toBe(before)
    expect(turned.events.some((e) => e.type === 'paid' && e.reason === 'entladegeld')).toBe(false)
  })

  it('charges it when cargo actually comes ashore, once per ship', () => {
    let s = afloat()
    const here = portAt(ctx, flagship(s.players[0]!).nodeId)!
    // Two lots aboard, so a second sale can show the fee is not per lot.
    for (const offer of buyOffers(ctx, s, s.players[0]!, here)
      .filter((o) => o.status === 'ok')
      .slice(0, 2)) {
      s = applyAction(ctx, s, { type: 'buy', goodId: offer.goodId, by: 'a' }).state
    }
    const lots = flagship(s.players[0]!).cargo
    expect(lots).toHaveLength(2)

    const fee = cardWith('feeForDrawer')
    const charge = fee.effects.find((e) => e.kind === 'feeForDrawer')!
    const amount = charge.kind === 'feeForDrawer' ? charge.amount : 0
    s = turn(s, fee.id).state

    // Berthed, and nothing landed yet: nothing owed yet either.
    const beforeSelling = cashOf(s, 'a')

    const first = applyAction(ctx, s, { type: 'sell', uid: lots[0]!.uid, by: 'a' })
    expect(first.events.some((e) => e.type === 'paid' && e.reason === 'entladegeld')).toBe(true)

    const second = applyAction(ctx, first.state, { type: 'sell', uid: lots[1]!.uid, by: 'a' })
    expect(second.events.some((e) => e.type === 'paid' && e.reason === 'entladegeld')).toBe(false)

    // Sale proceeds aside, the fee came off exactly once.
    const proceeds = [...first.events, ...second.events].reduce(
      (sum, e) => sum + (e.type === 'sold' ? e.price : 0),
      0,
    )
    expect(cashOf(second.state, 'a')).toBe(beforeSelling + proceeds - amount)
  })

  it('does not deliver a telegram to the open sea', () => {
    const s = putToSea(afloat(), 'a')
    const atSeaBefore = cashOf(s, 'a')
    const inPortBefore = cashOf(s, 'b')

    const turned = turn(s, cardWith('payoutToDrawer').id)
    // Bo is tied up alongside and takes it at once; Ada cannot be reached.
    expect(cashOf(turned.state, 'b')).toBeGreaterThan(inPortBefore)
    expect(cashOf(turned.state, 'a')).toBe(atSeaBefore)
  })

  it('delivers it when she makes port, and only once', () => {
    let s = putToSea(afloat(), 'a')
    s = turn(s, cardWith('payoutToDrawer').id).state
    const before = cashOf(s, 'a')

    const eta = voyageEndsAt(ctx, s, flagship(s.players[0]!))!
    // Short of the market's next turn, so the same card is still standing.
    expect(eta).toBeLessThan(s.marketSince + INTERVAL * MIN)

    const arrived = applyAction(ctx, s, { type: 'tick', at: eta + 1000 })
    expect(flagship(arrived.state.players[0]!).voyage ?? null).toBeNull()
    const wires = arrived.events.filter((e) => e.type === 'received' && e.reason === 'telegramm')
    expect(wires).toHaveLength(1)
    expect(cashOf(arrived.state, 'a')).toBeGreaterThan(before)
  })

  it('charges harbour dues to whoever is lying in a harbour', () => {
    const s = putToSea(afloat(), 'a')
    const atSeaBefore = cashOf(s, 'a')
    const inPortBefore = cashOf(s, 'b')

    const turned = turn(s, cardWith('portFeeAllInPort').id)
    expect(cashOf(turned.state, 'b')).toBeLessThan(inPortBefore)
    expect(cashOf(turned.state, 'a')).toBe(atSeaBefore)
  })

  it('keeps charging the levy every so often, not once a season', () => {
    // The grace period counted rounds, and a real-time game has no rounds:
    // `round - last` was always nought, so each levy was charged once and
    // then quietly suppressed for the rest of the season.
    let s = afloat()
    const here = portAt(ctx, flagship(s.players[0]!).nodeId)!
    const offer = buyOffers(ctx, s, s.players[0]!, here).find((o) => o.status === 'ok')!
    s = applyAction(ctx, s, { type: 'buy', goodId: offer.goodId, by: 'a' }).state

    const levy = CLASSIC_PACK.konjunktur.find((c) => c.title === 'Steuer')!
    const first = turn(s, levy.id)
    expect(first.events.some((e) => e.type === 'paid' && e.reason === 'steuer')).toBe(true)

    // Straight away again: still inside the grace period.
    const again = turn(first.state, levy.id)
    expect(again.events.some((e) => e.type === 'levySkipped')).toBe(true)

    // And once the grace has run out, it is due once more.
    const graceMs = CLASSIC_PACK.config.levyGracePeriodRounds * INTERVAL * MIN
    const waited = applyAction(ctx, again.state, {
      type: 'tick',
      at: again.state.now + graceMs,
    }).state
    const third = turn(waited, levy.id)
    expect(third.events.some((e) => e.type === 'paid' && e.reason === 'steuer')).toBe(true)
  })

  it('still moves prices for everyone the moment it turns', () => {
    // The part that always worked, and has to go on working: a Hausse needs
    // no ship to be anywhere in particular.
    const hausse = CLASSIC_PACK.konjunktur.find((c) => c.title === 'Hausse')!
    const turned = turn(afloat(), hausse.id)
    expect(turned.state.saleModifierPercent).toBeGreaterThan(0)
  })

  it('starts each card with a clean slate', () => {
    const s = turn(afloat(), cardWith('portFeeAllInPort').id).state
    expect(s.marketSettled.length).toBeGreaterThan(0)

    const next = turn(s, CLASSIC_PACK.konjunktur.find((c) => c.title === 'Hausse')!.id)
    expect(next.state.marketSettled).toHaveLength(0)
  })
})

describe('scoring', () => {
  it('ranks by cash plus cargo', () => {
    const game = seated(['Ada', 'Bo'], { seed: 'score' })
    const table = standings(game)
    expect(table).toHaveLength(2)
    expect(table[0]!.worth).toBe(netWorth(table[0]!.player))
  })
})

describe('the shipyard', () => {
  it('is closed under the printed rules — one house, one ship', () => {
    const state = seated(['Ada', 'Bo'], { seed: 'werft' })
    expect(state.config.maxFleetSize).toBe(1)

    const before = state.players[0]!.cash
    const after = applyAction(ctx, state, { type: 'buyVehicle', kindId: 'kuestenschoner' })

    expect(after.state.players[0]!.fleet).toHaveLength(1)
    expect(after.state.players[0]!.cash).toBe(before)
    expect(after.events.some((e) => e.type === 'rejected')).toBe(true)
  })

  it('opens only when a variant asks for a fleet', () => {
    const state = seated(['Ada', 'Bo'], { seed: 'werft', maxFleetSize: 2 })
    const after = applyAction(ctx, state, { type: 'buyVehicle', kindId: 'kuestenschoner' })

    expect(after.state.players[0]!.fleet).toHaveLength(2)

    // And it stops at the limit the variant named.
    const third = applyAction(ctx, after.state, {
      type: 'buyVehicle',
      kindId: 'kuestenschoner',
    })
    expect(third.state.players[0]!.fleet).toHaveLength(2)
  })

  it('prices a second ship against a season, not against one cargo', () => {
    // A house must empty its till for the cheapest hull and trade its way up
    // to anything larger — otherwise a fleet is just a first-turn purchase.
    const capital = CLASSIC_PACK.config.startingCapital
    const prices = CLASSIC_PACK.vehicles.map((v) => v.price).sort((a, b) => a - b)

    expect(prices[0]).toBeGreaterThan(capital * 0.8)
    for (const price of prices.slice(1)) expect(price).toBeGreaterThan(capital * 2)
  })
})

describe('what a hold may carry', () => {
  /** Move the merchant's ship, the way a completed voyage would. */
  function moveTo(state: GameState, portId: string): GameState {
    const p = state.players[0]!
    return {
      ...state,
      players: [
        {
          ...p,
          fleet: p.fleet.map((v, i) =>
            i === 0 ? { ...v, nodeId: portId, purchasesThisVisit: [] } : v,
          ),
        },
        ...state.players.slice(1),
      ],
    }
  }

  it('sets no limit on the hold — the Anleitung names none', () => {
    // "Jeder Spieler kann in jedem angelaufenen Hafen Waren dieses Landes
    // kaufen um sie auf seiner Weiterfahrt in einem späteren Hafen ... zu
    // verkaufen." No capacity appears anywhere in the rules.
    expect(CLASSIC_PACK.config.startingVehicle.capacity).toBeNull()

    let state = seated(['Ada'], { seed: 'stapeln', startingCapital: 5_000_000 })
    let bought = 0
    for (const portId of [...ctx.portsById.keys()].slice(0, 12)) {
      state = moveTo(state, portId)
      // Recompute after each purchase: two per harbour is the standing limit.
      for (;;) {
        const offer = buyOffers(ctx, state, state.players[0]!, portId).find(
          (o) => o.status === 'ok',
        )
        if (!offer) break
        const after = applyAction(ctx, state, { type: 'buy', goodId: offer.goodId })
        expect(after.events.some((e) => e.type === 'rejected')).toBe(false)
        state = after.state
        bought += 1
      }
    }

    expect(bought).toBeGreaterThan(8)
    expect(flagship(state.players[0]!).cargo).toHaveLength(bought)
  })

  it('allows two per harbour, and only one card of a kind while you are there', () => {
    const state = seated(['Ada'], { seed: 'zwei' })
    const port = portAt(ctx, flagship(state.players[0]!).nodeId)!
    const offers = buyOffers(ctx, state, state.players[0]!, port).filter((o) => o.status === 'ok')

    const first = applyAction(ctx, state, { type: 'buy', goodId: offers[0]!.goodId }).state
    // The same kind is shut here, but the harbour is not.
    const again = buyOffers(ctx, first, first.players[0]!, port)
    expect(again.find((o) => o.goodId === offers[0]!.goodId)!.status).toBe('schon-geladen')
    expect(again.some((o) => o.status === 'ok')).toBe(true)

    const second = applyAction(ctx, first, { type: 'buy', goodId: offers[1]!.goodId }).state
    // Now the harbour is shut too.
    for (const offer of buyOffers(ctx, second, second.players[0]!, port)) {
      expect(['ladeschluss', 'schon-geladen']).toContain(offer.status)
    }
  })

  it('lets the same good be bought again in the next port that exports it', () => {
    // "von einer Warengattung nur eine Karte" binds per harbour, and the bank
    // holds two copies — so a second is legitimately obtainable elsewhere.
    let state = seated(['Ada'], { seed: 'nochmal', startingCapital: 5_000_000 })
    const port = portAt(ctx, flagship(state.players[0]!).nodeId)!
    const goodId = buyOffers(ctx, state, state.players[0]!, port).find(
      (o) => o.status === 'ok',
    )!.goodId

    state = applyAction(ctx, state, { type: 'buy', goodId }).state

    const elsewhere = [...ctx.portsById.keys()].find(
      (id) => id !== port && ctx.exportsOf(id).includes(goodId),
    )
    if (!elsewhere) return // this good has a single source; nothing to prove

    state = moveTo(state, elsewhere)
    const after = applyAction(ctx, state, { type: 'buy', goodId })
    expect(after.events.some((e) => e.type === 'rejected')).toBe(false)
    expect(flagship(after.state.players[0]!).cargo.filter((c) => c.goodId === goodId)).toHaveLength(
      2,
    )
  })
})

/**
 * Weather that asks where you are.
 *
 * The printed 27 move every price on the board at once, which on a plan with
 * five oceans makes it never matter where a ship actually is. The erweiterte
 * Konjunktur picks out a part of the world instead, and heavy weather there
 * comes in three severities: it can take cargo, spoil cargo, or cost nothing
 * but time — which in a real-time season is the dearest of the three.
 *
 * Cards are taken from the real deck rather than made up for the test: the
 * market only deals ids it can find in the pack, so an invented card turns
 * into no card at all and every assertion below would pass by doing nothing.
 */
describe('weather over one part of the world', () => {
  const T0 = 1_800_000_000_000
  const MIN = 60_000
  const deck = CLASSIC_PACK.konjunkturErweitert!

  const seatedRealtime = (seed = 'wetter') =>
    replay(
      ctx,
      createGame(ctx, {
        seed,
        travel: 'echtzeit',
        minutesPerPip: 1,
        durationHours: 8,
        konjunktur: 'erweitert',
      }),
      [
        { type: 'tick', at: T0 },
        { type: 'join', playerId: 'a', name: 'Ada' },
        { type: 'join', playerId: 'b', name: 'Bo' },
        { type: 'start' },
      ],
    )

  /** A real card of the given kind, aimed at the given part of the world. */
  const cardFor = (kind: string, continent: Continent): KonjunkturCard =>
    deck.find(
      (c) =>
        c.effects.length === 1 &&
        c.effects.some((e) => e.kind === kind && 'continent' in e && e.continent === continent),
    )!

  /** Load a ship up, so weather has something to ruin. */
  const laden = (s: GameState, by: string): GameState => {
    const index = s.players.findIndex((p) => p.id === by)
    let out = s
    const here = portAt(ctx, flagship(out.players[index]!).nodeId)!
    for (const offer of buyOffers(ctx, out, out.players[index]!, here).filter(
      (o) => o.status === 'ok',
    )) {
      out = applyAction(ctx, out, { type: 'buy', goodId: offer.goodId, by }).state
    }
    return out
  }

  /** Which part of the world a house's ship is in. */
  const whereabouts = (s: GameState, by: string): Continent =>
    continentOf(ctx, flagship(s.players.find((p) => p.id === by)!).nodeId)!

  /** Turn a chosen card for the whole world, without moving the clock on. */
  const turn = (s: GameState, card: KonjunkturCard) =>
    applyAction(
      ctx,
      {
        ...s,
        deck: [card.id, ...s.deck.filter((d) => d !== card.id)],
        marketSince: s.now - s.config.realtime.marketIntervalMinutes * MIN,
      },
      { type: 'tick', at: s.now + 1000 },
    )

  const damagedOf = (s: GameState, i: number) =>
    flagship(s.players[i]!).cargo.filter((c) => c.damaged)

  it('has a Havarie and an Aufenthalt for every ocean on the plan', () => {
    // Otherwise the weather would only ever find some of the map, and a
    // merchant could sit out the whole season in a corner nothing reaches.
    const seen = new Set(CLASSIC_PACK.map.countries.map((c) => c.continent))
    for (const continent of seen) {
      expect(cardFor('cargoDamagedInRegion', continent)).toBeTruthy()
      expect(cardFor('delayInRegion', continent)).toBeTruthy()
    }
  })

  it('spoils cargo instead of sinking it, and it stays in the hold', () => {
    const s = laden(seatedRealtime(), 'a')
    const before = flagship(s.players[0]!).cargo
    expect(before.length).toBeGreaterThan(0)

    const hit = turn(s, cardFor('cargoDamagedInRegion', whereabouts(s, 'a')))
    const after = flagship(hit.state.players[0]!).cargo

    // Still aboard — that is the whole point of the card.
    expect(after).toHaveLength(before.length)
    expect(after.filter((c) => c.damaged).length).toBeGreaterThan(0)
    expect(hit.events.some((e) => e.type === 'cargoDamaged')).toBe(true)
    expect(hit.events.some((e) => e.type === 'cargoLost')).toBe(false)
  })

  it('halves what a spoiled posten fetches', () => {
    const s = laden(seatedRealtime(), 'a')
    const here = portAt(ctx, flagship(s.players[0]!).nodeId)!
    const clean = new Map(
      flagship(s.players[0]!).cargo.map((c) => [c.uid, quoteSale(ctx, s, c, here).price]),
    )

    const hit = turn(s, cardFor('cargoDamagedInRegion', whereabouts(s, 'a'))).state
    const spoiled = damagedOf(hit, 0)
    expect(spoiled.length).toBeGreaterThan(0)

    for (const item of spoiled) {
      expect(quoteSale(ctx, hit, item, here).price).toBe(
        Math.round(clean.get(item.uid)! * ctx.pack.config.damagedSaleRate),
      )
    }
  })

  it('does not ruin the same bale twice', () => {
    // Hitting an already-spoiled posten would quietly make the second storm
    // a no-op, and worse: it would always be the dearest cargo that shrugged
    // the weather off, because that is the one a storm reaches for first.
    const s = laden(seatedRealtime(), 'a')
    const card = cardFor('cargoDamagedInRegion', whereabouts(s, 'a'))

    const first = turn(s, card)
    const alreadyHit = new Set(damagedOf(first.state, 0).map((c) => c.goodId))
    expect(alreadyHit.size).toBeGreaterThan(0)

    const second = turn(first.state, card)
    for (const e of second.events) {
      if (e.type === 'cargoDamaged') expect(alreadyHit.has(e.goodId)).toBe(false)
    }
  })

  it('leaves ships in other oceans alone', () => {
    const s = laden(seatedRealtime(), 'a')
    const here = whereabouts(s, 'a')
    const elsewhere = [...new Set(CLASSIC_PACK.map.countries.map((c) => c.continent))].find(
      (c) => c !== here && cardFor('cargoDamagedInRegion', c),
    )!

    const hit = turn(s, cardFor('cargoDamagedInRegion', elsewhere))
    expect(damagedOf(hit.state, 0)).toHaveLength(0)
  })

  it('holds up a ship at sea, and lets one in harbour ride it out', () => {
    let s = seatedRealtime()
    const from = flagship(s.players[0]!).nodeId
    const target = [...ctx.portsById.keys()].find(
      (id) => id !== portAt(ctx, from) && routeTo(ctx, from, null, id).length >= 6,
    )!
    s = applyAction(ctx, s, { type: 'setCourse', to: target, by: 'a' }).state
    const departs = flagship(s.players[0]!).voyage!.departsAt
    s = applyAction(ctx, s, { type: 'tick', at: departs + 1000 }).state

    const eta = voyageEndsAt(ctx, s, flagship(s.players[0]!))!
    const card = cardFor('delayInRegion', continentOf(ctx, flagship(s.players[0]!).nodeId)!)
    const effect = card.effects[0]!
    const minutes = effect.kind === 'delayInRegion' ? effect.minutes : 0
    expect(minutes).toBeGreaterThan(0)

    const held = turn(s, card)
    expect(voyageEndsAt(ctx, held.state, flagship(held.state.players[0]!))).toBe(
      eta + minutes * MIN,
    )
    expect(held.events.some((e) => e.type === 'heldUp')).toBe(true)
    // Bo never left the quay, so there was nothing to hold up.
    expect(flagship(held.state.players[1]!).voyage ?? null).toBeNull()
  })

  it('sets a fire in somebody’s hold, not always the first house’s', () => {
    // With no drawer to be, this reached for `drawerIndex` — nought, always —
    // so Seeräuberei, Feuer im Laderaum and Wassereinbruch each broke out
    // aboard whoever happened to have sat down first, every single time.
    const fire = deck.find((c) => c.effects.some((e) => e.kind === 'cargoLostByDrawer'))!
    const victims = new Set<string>()

    for (const seed of ['f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8']) {
      const s = laden(laden(seatedRealtime(seed), 'a'), 'b')
      for (const e of turn(s, fire).events) {
        if (e.type === 'cargoLost') victims.add(e.playerId)
      }
    }
    expect(victims.size).toBe(2)
  })

  it('finds the second ship of a fleet, not only the one the merchant is on', () => {
    // Weather is weather: it reaches whatever is floating in it. Reaching for
    // the flagship meant a house with two hulls in the same gale watched one
    // of them come through it untouched.
    let s = replay(
      ctx,
      createGame(ctx, {
        seed: 'flotte',
        travel: 'echtzeit',
        minutesPerPip: 1,
        durationHours: 8,
        konjunktur: 'erweitert',
        maxFleetSize: 2,
      }),
      [
        { type: 'tick', at: T0 },
        { type: 'join', playerId: 'a', name: 'Ada' },
        { type: 'join', playerId: 'b', name: 'Bo' },
        { type: 'start' },
      ],
    )
    s = applyAction(ctx, s, { type: 'buyVehicle', kindId: 'kuestenschoner', by: 'a' }).state
    const fleet = s.players[0]!.fleet
    expect(fleet).toHaveLength(2)
    // Both lie in the same harbour, so the same weather covers both.
    expect(fleet[1]!.nodeId).toBe(fleet[0]!.nodeId)

    // Load the second ship, which is not the one Ada is sailing aboard.
    const here = portAt(ctx, fleet[1]!.nodeId)!
    s = applyAction(ctx, s, { type: 'boardVehicle', vehicleId: fleet[1]!.id, by: 'a' }).state
    for (const offer of buyOffers(ctx, s, s.players[0]!, here).filter((o) => o.status === 'ok')) {
      s = applyAction(ctx, s, { type: 'buy', goodId: offer.goodId, by: 'a' }).state
    }
    s = applyAction(ctx, s, { type: 'boardVehicle', vehicleId: fleet[0]!.id, by: 'a' }).state

    const second = () => s.players[0]!.fleet.find((v) => v.id === fleet[1]!.id)!
    expect(second().cargo.length).toBeGreaterThan(0)

    const hit = turn(s, cardFor('cargoDamagedInRegion', whereabouts(s, 'a')))
    const after = hit.state.players[0]!.fleet.find((v) => v.id === fleet[1]!.id)!
    expect(after.cargo.filter((c) => c.damaged).length).toBeGreaterThan(0)
  })

  it('blows itself out in a season, not in a working day', () => {
    // "für 4 Runden" was read as four hours in real-time play, which on a
    // season of three is weather that never lifts.
    const s = seatedRealtime()
    const card = cardFor('regionalPriceDelta', 'europa')
    const effect = card.effects[0]!
    const rounds = effect.kind === 'regionalPriceDelta' ? effect.rounds : 0

    const blown = turn(s, card).state
    const weather = blown.weather[0]!
    expect(weather.untilTime).toBe(
      blown.now + rounds * blown.config.realtime.marketIntervalMinutes * MIN,
    )
    // Well short of the whole season, which is what makes it weather.
    expect(weather.untilTime! - blown.now).toBeLessThan(blown.endsAt - blown.startedAt)
  })
})

/**
 * The Warenbericht.
 *
 * Every other card in the deck asks where a merchant is. This one asks what is
 * in the hold, and pays no attention to geography at all — which is the first
 * reason in the game to have read the Warenverzeichnis.
 */
describe('a report on one ware', () => {
  const T0 = 1_800_000_000_000
  const MIN = 60_000
  const deck = CLASSIC_PACK.konjunkturErweitert!

  const afloat = () =>
    replay(
      ctx,
      createGame(ctx, {
        seed: 'bericht',
        travel: 'echtzeit',
        minutesPerPip: 1,
        durationHours: 8,
        konjunktur: 'erweitert',
      }),
      [
        { type: 'tick', at: T0 },
        { type: 'join', playerId: 'a', name: 'Ada' },
        { type: 'start' },
      ],
    )

  const turn = (s: GameState, card: KonjunkturCard) =>
    applyAction(
      ctx,
      {
        ...s,
        deck: [card.id, ...s.deck.filter((d) => d !== card.id)],
        marketSince: s.now - s.config.realtime.marketIntervalMinutes * MIN,
      },
      { type: 'tick', at: s.now + 1000 },
    )

  /** The first card that moves the named ware, and by how much. */
  const reportOn = (good: number) =>
    deck.find((c) =>
      c.effects.some((e) => e.kind === 'goodPriceDelta' && e.scope.good === good && e.percent > 0),
    )!

  /** Somewhere that does not export the ware, so it prices at the market. */
  const marketFor = (s: GameState, goodId: number) =>
    [...ctx.portsById.keys()].find((p) => !exportsAt(ctx, s, p).includes(goodId))!

  it('lifts that ware in every harbour on the plan', () => {
    const s = afloat()
    const kaffee = 29
    const card = reportOn(kaffee)
    const effect = card.effects.find((e) => e.kind === 'goodPriceDelta')!
    const percent = effect.kind === 'goodPriceDelta' ? effect.percent : 0

    // Three harbours on different coasts, all of which buy it at the market.
    const harbours = [...ctx.portsById.keys()]
      .filter((p) => !exportsAt(ctx, s, p).includes(kaffee))
      .slice(0, 3)
    const before = harbours.map((p) => sellPriceAt(ctx, s, p, kaffee))

    const after = turn(s, card).state
    for (const [i, port] of harbours.entries()) {
      expect(sellPriceAt(ctx, after, port, kaffee)).toBeGreaterThan(before[i]!)
      // And by the amount the card names, whichever coast it is.
      expect(sellPriceAt(ctx, after, port, kaffee) / before[i]!).toBeCloseTo(1 + percent / 100, 1)
    }
  })

  it('leaves every other ware exactly where it was', () => {
    const s = afloat()
    const kaffee = 29
    const port = marketFor(s, kaffee)
    const others = CLASSIC_PACK.goods
      .filter((g) => g.id !== kaffee && !exportsAt(ctx, s, port).includes(g.id))
      .slice(0, 8)
    const before = others.map((g) => sellPriceAt(ctx, s, port, g.id))

    const after = turn(s, reportOn(kaffee)).state
    for (const [i, g] of others.entries()) {
      // Kaffee is a Genußmittel, so its neighbours in the register must not
      // move either — a single-ware report is not a report on the column.
      expect(sellPriceAt(ctx, after, port, g.id)).toBe(before[i]!)
    }
  })

  it('moves a whole column of the register when the card says so', () => {
    const s = afloat()
    const card = deck.find((c) =>
      c.effects.some(
        (e) => e.kind === 'goodPriceDelta' && e.scope.gruppe === 'genuss' && e.percent > 0,
      ),
    )!
    const port = [...ctx.portsById.keys()].find((p) => {
      const here = exportsAt(ctx, s, p)
      return CLASSIC_PACK.goods.filter((g) => g.category === 'genuss' && !here.includes(g.id))
        .length >= 2
    })!
    const column = CLASSIC_PACK.goods
      .filter((g) => g.category === 'genuss' && !exportsAt(ctx, s, port).includes(g.id))
      .slice(0, 3)
    const before = column.map((g) => sellPriceAt(ctx, s, port, g.id))

    const after = turn(s, card).state
    for (const [i, g] of column.entries()) {
      expect(sellPriceAt(ctx, after, port, g.id)).toBeGreaterThan(before[i]!)
    }
  })

  it('adds to the weather over an ocean rather than replacing it', () => {
    // Two separate pieces of news, and a coffee sale in Hamburg feels both.
    const s = afloat()
    const kaffee = 29
    const region = deck.find((c) =>
      c.effects.some(
        (e) => e.kind === 'regionalPriceDelta' && e.continent === 'europa' && e.percent > 0,
      ),
    )!
    const port = [...ctx.portsById.keys()].find(
      (p) => continentOf(ctx, p) === 'europa' && !exportsAt(ctx, s, p).includes(kaffee),
    )!

    const one = turn(s, region).state
    const both = turn(one, reportOn(kaffee)).state

    expect(both.weather).toHaveLength(2)
    expect(sellPriceAt(ctx, both, port, kaffee)).toBeGreaterThan(
      sellPriceAt(ctx, one, port, kaffee),
    )
  })

  it('changes its mind rather than shouting twice', () => {
    // A second report on the same ware supersedes the first; stacking them
    // would let one lucky shuffle put coffee up eighty per cent.
    const s = afloat()
    const kaffee = 29
    const card = reportOn(kaffee)
    const once = turn(s, card).state
    const twice = turn(once, card).state

    expect(twice.weather.filter((w) => w.goodId === kaffee)).toHaveLength(1)
    const port = marketFor(s, kaffee)
    expect(sellPriceAt(ctx, twice, port, kaffee)).toBe(sellPriceAt(ctx, once, port, kaffee))
  })

  it('lapses on the clock like any other notice', () => {
    const s = afloat()
    const card = reportOn(29)
    const set = turn(s, card).state
    expect(set.weather).toHaveLength(1)

    // Long enough that the market turns a few more cards on the way, so ask
    // whether *this* notice lifted rather than whether the sky is empty.
    const notice = set.weather[0]!
    const later = applyAction(ctx, set, { type: 'tick', at: notice.untilTime! + 1000 })
    expect(later.state.weather.some((w) => w.id === notice.id)).toBe(false)
  })

  it('names wares the plan actually carries', () => {
    // A report on a ware no harbour on this map deals in is a dud card.
    const named = deck.flatMap((c) =>
      c.effects.flatMap((e) =>
        e.kind === 'goodPriceDelta' && e.scope.good !== undefined ? [e.scope.good] : [],
      ),
    )
    expect(named.length).toBeGreaterThan(0)
    for (const goodId of named) {
      expect(CLASSIC_PACK.goods.some((g) => g.id === goodId)).toBe(true)
    }
  })
})

/**
 * The Hafensperre.
 *
 * The one card that changes the shape of the plan rather than the numbers on
 * it. A route that was obvious stops being obvious, and a ship already bound
 * there has a decision to make — because sailing on is still allowed, and the
 * quarantine may well be lifted before she arrives.
 */
describe('a harbour shut to trade', () => {
  const T0 = 1_800_000_000_000
  const MIN = 60_000
  const deck = CLASSIC_PACK.konjunkturErweitert!
  const shutCards = deck.filter((c) => c.effects.some((e) => e.kind === 'portClosed'))

  const afloat = (seed = 'sperre') =>
    replay(
      ctx,
      createGame(ctx, {
        seed,
        travel: 'echtzeit',
        minutesPerPip: 1,
        durationHours: 8,
        konjunktur: 'erweitert',
      }),
      [
        { type: 'tick', at: T0 },
        { type: 'join', playerId: 'a', name: 'Ada' },
        { type: 'start' },
      ],
    )

  const turn = (s: GameState, card: KonjunkturCard) =>
    applyAction(
      ctx,
      {
        ...s,
        deck: [card.id, ...s.deck.filter((d) => d !== card.id)],
        marketSince: s.now - s.config.realtime.marketIntervalMinutes * MIN,
      },
      { type: 'tick', at: s.now + 1000 },
    )

  /** Shut the harbour Ada is actually lying in, whichever card reaches it. */
  const shutHerIn = (s: GameState) => {
    const here = portAt(ctx, flagship(s.players[0]!).nodeId)!
    const continent = continentOf(ctx, here)!
    const card = shutCards.find((c) =>
      c.effects.some((e) => e.kind === 'portClosed' && e.continent === continent),
    )!
    // Which harbour is drawn, so keep turning it until it lands on this one.
    // Every draw shuts a different harbour, so this terminates.
    let out = s
    for (let guard = 0; guard < 60; guard++) {
      out = turn(out, card).state
      if (out.closures.some((c) => c.portId === here)) return { state: out, portId: here }
    }
    throw new Error('never shut the harbour under test')
  }

  it('shuts one harbour, names it, and leaves the rest open', () => {
    const s = afloat()
    const card = shutCards[0]!
    const effect = card.effects.find((e) => e.kind === 'portClosed')!
    const continent = effect.kind === 'portClosed' ? effect.continent : 'europa'

    const shut = turn(s, card)
    expect(shut.state.closures).toHaveLength(1)
    const closure = shut.state.closures[0]!
    expect(continentOf(ctx, closure.portId)).toBe(continent)
    // The news has to say which, or nobody can act on it.
    expect(shut.events.some((e) => e.type === 'portClosed' && e.portId === closure.portId)).toBe(
      true,
    )
    expect(closure.title).toContain(ctx.portsById.get(closure.portId)!.name)
  })

  it('refuses both sides of the counter while it stands', () => {
    const { state, portId } = shutHerIn(afloat())
    expect(closureAt(state, portId)).not.toBeNull()

    const goodId = ctx.exportsOf(portId)[0]!
    const bought = applyAction(ctx, state, { type: 'buy', goodId, by: 'a' })
    expect(bought.events.some((e) => e.type === 'rejected')).toBe(true)
    expect(flagship(bought.state.players[0]!).cargo).toHaveLength(0)

    // And selling, for a hold loaded before the harbour shut.
    const laden = {
      ...state,
      players: state.players.map((p, i) =>
        i === 0
          ? {
              ...p,
              fleet: p.fleet.map((v, j) =>
                j === 0
                  ? {
                      ...v,
                      cargo: [
                        {
                          uid: 'x1',
                          goodId: CLASSIC_PACK.goods[0]!.id,
                          pricePaid: 100_000,
                          boughtAt: portId,
                          boughtRound: 1,
                        },
                      ],
                    }
                  : v,
              ),
            }
          : p,
      ),
    }
    const sold = applyAction(ctx, laden, { type: 'sell', uid: 'x1', by: 'a' })
    expect(sold.events.some((e) => e.type === 'rejected')).toBe(true)
  })

  it('says so on every offer, so the sheet reads as news not as a fault', () => {
    const { state, portId } = shutHerIn(afloat())
    const offers = buyOffers(ctx, state, state.players[0]!, portId)
    expect(offers.length).toBeGreaterThan(0)
    for (const o of offers) expect(o.status).toBe('gesperrt')
  })

  it('lets the Verkaufszwang lapse rather than stranding a merchant', () => {
    // A red field puts a ship under an obligation to sell before it may
    // leave. Land on one in a quarantined harbour and that obligation can
    // never be met — the round game would simply stop.
    const { state, portId } = shutHerIn(afloat())
    const laden = {
      ...state,
      mustSellForeign: true,
      players: state.players.map((p, i) =>
        i === 0
          ? {
              ...p,
              fleet: p.fleet.map((v, j) =>
                j === 0
                  ? {
                      ...v,
                      cargo: [
                        {
                          uid: 'x1',
                          // Something this harbour does not itself export, so
                          // the obligation would otherwise be live.
                          goodId: CLASSIC_PACK.goods.find(
                            (g) => !ctx.exportsOf(portId).includes(g.id),
                          )!.id,
                          pricePaid: 100_000,
                          boughtAt: portId,
                          boughtRound: 1,
                        },
                      ],
                    }
                  : v,
              ),
            }
          : p,
      ),
    }
    expect(verkaufszwangOpen(ctx, laden, laden.players[0]!, portId)).toBe(false)
  })

  it('still lets a ship sail there, because the sperre may be lifted', () => {
    let shut = afloat()
    const card = shutCards[0]!
    const from = flagship(shut.players[0]!).nodeId

    // Keep drawing until the shut harbour is one this ship could actually be
    // sent to, so the test cannot pass by having nothing to try.
    let target: string | null = null
    for (let guard = 0; guard < 60 && target === null; guard++) {
      shut = turn(shut, card).state
      const candidate = shut.closures[shut.closures.length - 1]!.portId
      if (portAt(ctx, from) !== candidate && routeTo(ctx, from, null, candidate).length > 0) {
        target = candidate
      }
    }
    expect(target).not.toBeNull()

    const ordered = applyAction(ctx, shut, { type: 'setCourse', to: target!, by: 'a' })
    expect(ordered.events.some((e) => e.type === 'rejected')).toBe(false)
    expect(flagship(ordered.state.players[0]!).voyage!.destination).toBe(target!)
  })

  it('opens again on time, and says that too', () => {
    const s = afloat()
    const shut = turn(s, shutCards[0]!).state
    const closure = shut.closures[0]!

    const later = applyAction(ctx, shut, { type: 'tick', at: closure.untilTime! + 1000 })
    expect(later.state.closures.some((c) => c.id === closure.id)).toBe(false)
    expect(
      later.events.some((e) => e.type === 'portReopened' && e.portId === closure.portId),
    ).toBe(true)
  })

  it('does not shut a harbour that is already shut', () => {
    // Two outbreaks in a sealed town waste the card and read as nonsense.
    let s = afloat()
    const card = shutCards[0]!
    const effect = card.effects.find((e) => e.kind === 'portClosed')!
    const continent = effect.kind === 'portClosed' ? effect.continent : 'europa'
    const there = ctx.pack.map.nodes.filter(
      (n) => ctx.portsById.has(n.id) && continentOf(ctx, n.id) === continent,
    ).length

    for (let i = 0; i < there + 3; i++) s = turn(s, card).state
    expect(new Set(s.closures.map((c) => c.portId)).size).toBe(s.closures.length)
    expect(s.closures.length).toBeLessThanOrEqual(there)
  })

  it('settles a shut harbour at the end of the season all the same', () => {
    // The bank clears every hold when the season closes. A quarantine that
    // survived that would leave cargo permanently unsellable and a merchant
    // scored as though they had thrown it away.
    const { state, portId } = shutHerIn(afloat())
    const laden = {
      ...state,
      players: state.players.map((p, i) =>
        i === 0
          ? {
              ...p,
              fleet: p.fleet.map((v, j) =>
                j === 0
                  ? {
                      ...v,
                      cargo: [
                        {
                          uid: 'x1',
                          goodId: CLASSIC_PACK.goods.find(
                            (g) => !ctx.exportsOf(portId).includes(g.id),
                          )!.id,
                          pricePaid: 100_000,
                          boughtAt: portId,
                          boughtRound: 1,
                        },
                      ],
                    }
                  : v,
              ),
            }
          : p,
      ),
    }
    const over = applyAction(ctx, laden, { type: 'tick', at: laden.endsAt + 1000 })
    expect(over.state.phase).toBe('over')
    expect(flagship(over.state.players[0]!).cargo).toHaveLength(0)
  })
})
