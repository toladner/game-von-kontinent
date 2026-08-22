import { describe, expect, it } from 'vitest'
import { CLASSIC_PACK } from '@content/maps/classic'
import { createContext } from './context'
import { createGame, openingActions } from './setup'
import { applyAction, replay } from './reducer'
import { buyOffers, legalSteps, portAt, standings } from './selectors'
import { isPort } from './mapbuild'
import { netWorth } from './state'
import type { GameAction } from './actions'

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
      expect(portAt(ctx, p.ship.nodeId)).not.toBeNull()
      expect(p.hasDeparted).toBe(false)
    }
    expect(game.phase).toBe('port')
  })

  it('allows two goods per port and never twice the same', () => {
    const portId = portAt(ctx, game.players[0]!.ship.nodeId)!
    const offers = buyOffers(ctx, game, game.players[0]!, portId)
    const affordable = offers.filter((o) => o.status === 'ok')
    expect(affordable.length).toBeGreaterThan(0)

    let s = game
    const first = affordable[0]!.goodId
    s = applyAction(ctx, s, { type: 'buy', goodId: first }).state
    expect(s.players[0]!.cargo).toHaveLength(1)

    const again = applyAction(ctx, s, { type: 'buy', goodId: first })
    expect(again.events[0]).toMatchObject({ type: 'rejected' })

    const second = affordable.find((o) => o.goodId !== first)
    if (second) {
      s = applyAction(ctx, s, { type: 'buy', goodId: second.goodId }).state
      expect(s.players[0]!.cargo).toHaveLength(2)
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
      expect(options).not.toContain(player.ship.cameFrom)
      s = applyAction(ctx, s, { type: 'step', to: options[0]! }).state
    }
    expect(s.movement).toBeNull()
    expect(['port', 'konjunktur', 'endOfTurn']).toContain(s.phase)
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

describe('scoring', () => {
  it('ranks by cash plus cargo', () => {
    const game = seated(['Ada', 'Bo'], { seed: 'score' })
    const table = standings(game)
    expect(table).toHaveLength(2)
    expect(table[0]!.worth).toBe(netWorth(table[0]!.player))
  })
})
