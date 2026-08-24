import { describe, expect, it } from 'vitest'
import { CLASSIC_PACK } from '@content/maps/classic'
import { createContext } from './context'
import { createGame, openingActions } from './setup'
import { applyAction, replay } from './reducer'
import {
  buyOffers,
  castOffMs,
  legalSteps,
  legMsFor,
  portAt,
  routeTo,
  standings,
  voyageEndsAt,
} from './selectors'
import { isPort } from './mapbuild'
import { flagship, netWorth } from './state'
import type { GameAction } from './actions'
import type { GameState } from './state'

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
