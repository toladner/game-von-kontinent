import { describe, expect, it } from 'vitest'
import { createContext } from '../../engine/context'
import { createGame, openingActions } from '../../engine/setup'
import { MAX_PLAYERS, replay } from '../../engine/reducer'
import { buyOffers, portAt, routeTo } from '../../engine/selectors'
import { flagship } from '../../engine/state'
import { isPort } from '../../engine/mapbuild'
import type { ContentPack } from '../../engine/types'
import { CLASSIC_PACK } from './classic'
import { WELT_PACK } from './welt'
import { REGION_PACKS, REGIONS } from './regions'

const PACKS: readonly ContentPack[] = [CLASSIC_PACK, WELT_PACK, ...REGION_PACKS]

/**
 * Every plan has to be playable, not merely well typed. A regional map is cut
 * out of the world map by machine, so the ways it can go wrong are exactly
 * the ways a cut goes wrong: a harbour left unreachable, a good nobody
 * sells, a starting berth on an island of one.
 */
describe.each(PACKS.map((p) => [p.id, p] as const))('the %s plan', (_id, pack) => {
  const ctx = createContext(pack)
  const ports = [...ctx.portsById.keys()]

  it('has harbours, goods and somewhere to start', () => {
    expect(ports.length).toBeGreaterThan(8)
    expect(pack.goods.length).toBeGreaterThan(8)
    // A berth apiece for a full table. A plan that seats fewer than the
    // rules allow would deal two houses the same harbour.
    expect(pack.map.startPorts.length).toBeGreaterThanOrEqual(MAX_PLAYERS)
    expect(new Set(pack.map.startPorts).size).toBe(pack.map.startPorts.length)
  })

  it('connects every harbour to every other by sea', () => {
    const start = ports[0]!
    const seen = new Set([start])
    const queue = [start]
    for (let head = 0; head < queue.length; head++) {
      for (const next of ctx.graph.neighbours.get(queue[head]!) ?? []) {
        if (seen.has(next)) continue
        seen.add(next)
        queue.push(next)
      }
    }
    expect(ports.filter((id) => !seen.has(id))).toEqual([])
  })

  it('gives every harbour something to export', () => {
    for (const id of ports) {
      expect(ctx.exportsOf(id).length, `${id} exports nothing`).toBeGreaterThan(0)
    }
  })

  it('only lets a harbour export goods this plan actually has', () => {
    // The cut drops goods with no source left; a harbour still naming one
    // would offer a card that cannot be priced.
    for (const id of ports) {
      for (const goodId of ctx.exportsOf(id)) {
        expect(ctx.goodsById.has(goodId), `${id} exports unknown good ${goodId}`).toBe(true)
      }
    }
  })

  it('keeps every starting berth on the map', () => {
    for (const id of pack.map.startPorts) {
      expect(ctx.portsById.has(id), `start port ${id} is not on this plan`).toBe(true)
    }
  })

  it('keeps sea nodes as plain chain links', () => {
    for (const node of pack.map.nodes) {
      if (isPort(node)) continue
      expect((ctx.graph.neighbours.get(node.id) ?? []).length, node.id).toBe(2)
    }
  })

  it('opens a table and sells a good on the first turn', () => {
    const s = replay(ctx, createGame(ctx, { seed: `probe-${pack.id}` }), openingActions(['Ada', 'Bo']))
    expect(s.phase).toBe('port')
    const portId = portAt(ctx, flagship(s.players[0]!).nodeId)!
    expect(buyOffers(ctx, s, s.players[0]!, portId).some((o) => o.status === 'ok')).toBe(true)
  })
})

describe('the world plan', () => {
  const ctx = createContext(WELT_PACK)

  it('reaches Asia and Australia from the printed board', () => {
    for (const id of ['schanghai', 'yokohama', 'sydney', 'singapur', 'bombay']) {
      expect(ctx.portsById.has(id), id).toBe(true)
      expect(routeTo(ctx, 'hamburg', null, id).length, `no route Hamburg -> ${id}`).toBeGreaterThan(0)
    }
  })

  it('keeps every harbour of the printed board', () => {
    const classic = createContext(CLASSIC_PACK)
    for (const id of classic.portsById.keys()) {
      expect(ctx.portsById.has(id), `${id} went missing from the world plan`).toBe(true)
    }
  })

  it('carries all ninety Warenkarten', () => {
    expect(WELT_PACK.goods).toHaveLength(90)
    const ids = WELT_PACK.goods.map((g) => g.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const g of WELT_PACK.goods) expect(g.sell, g.name).toBeGreaterThan(g.buy)
  })

  it('offers both ways east, the canal and the Cape', () => {
    // Suez is short and busy, the Cape long and empty; the choice between
    // them is only a choice if both are on the plan.
    const viaCanal = routeTo(ctx, 'portsaid', null, 'aden').length
    const viaCape = routeTo(ctx, 'kapstadt', null, 'fremantle').length
    expect(viaCanal).toBeGreaterThan(0)
    expect(viaCape).toBeGreaterThan(0)
    expect(viaCape).toBeGreaterThan(viaCanal)
  })
})

describe('the regional plans', () => {
  it('are each a genuine subset of the world plan', () => {
    const welt = createContext(WELT_PACK)
    for (const pack of REGION_PACKS) {
      const ctx = createContext(pack)
      for (const id of ctx.portsById.keys()) {
        expect(welt.portsById.has(id), `${pack.id}: ${id} is not on the world plan`).toBe(true)
      }
      expect(ctx.portsById.size).toBeLessThan(welt.portsById.size)
    }
  })

  it('names every region it advertises', () => {
    expect(REGION_PACKS).toHaveLength(REGIONS.length)
    for (const spec of REGIONS) {
      expect(REGION_PACKS.some((p) => p.id === spec.id), spec.id).toBe(true)
    }
  })

  it('cuts Europe down to Europe', () => {
    const ctx = createContext(REGION_PACKS.find((p) => p.id === 'europa')!)
    expect(ctx.portsById.has('hamburg')).toBe(true)
    expect(ctx.portsById.has('newyork')).toBe(false)
    expect(ctx.portsById.has('sydney')).toBe(false)
  })

  it('keeps Asia and Australia together, since neither stands alone', () => {
    const ctx = createContext(REGION_PACKS.find((p) => p.id === 'asien')!)
    expect(ctx.portsById.has('singapur')).toBe(true)
    expect(ctx.portsById.has('sydney')).toBe(true)
    expect(ctx.portsById.has('hamburg')).toBe(false)
  })
})
