import { describe, expect, it } from 'vitest'
import { CLASSIC_PACK } from '@content/maps/classic'
import { createContext } from './context'
import { createGame, openingActions } from './setup'
import { applyAction, replay } from './reducer'
import { buyOffers, portAt, quoteSale, saleQuotes } from './selectors'
import { flagship, type GameState } from './state'
import { distanceToSource, exportsAt, sellPriceAt } from './market'
import type { NewGameOptions } from './setup'

const ctx = createContext(CLASSIC_PACK)

function table(options: NewGameOptions = {}): GameState {
  return replay(ctx, createGame(ctx, { seed: 'markt', ...options }), openingActions(['Ada', 'Bo']))
}

const allPorts = () => [...ctx.portsById.keys()]

describe('Angebot "zufällig"', () => {
  it('leaves the printed Warenverzeichnis alone under "fest"', () => {
    const s = table()
    expect(s.exports).toBeNull()
    for (const portId of allPorts()) {
      expect(exportsAt(ctx, s, portId)).toEqual(ctx.exportsOf(portId))
    }
  })

  it('deals every harbour a different hand, and records it in the state', () => {
    const s = table({ angebot: 'zufaellig' })
    expect(s.exports).not.toBeNull()

    // Not merely a copy of the pack under another name.
    const changed = allPorts().filter(
      (id) => exportsAt(ctx, s, id).join(',') !== ctx.exportsOf(id).join(','),
    )
    expect(changed.length).toBeGreaterThan(allPorts().length / 2)
  })

  it('keeps each harbour the size the map made it', () => {
    // A thin outpost stays thin and an entrepôt stays busy: the cargo is
    // shuffled, the shape of the map is not.
    const s = table({ angebot: 'zufaellig' })
    for (const portId of allPorts()) {
      const want = Math.max(1, ctx.exportsOf(portId).length)
      expect(exportsAt(ctx, s, portId).length, portId).toBeGreaterThanOrEqual(want)
    }
  })

  it('gives every one of the 72 goods somewhere to be bought', () => {
    // A good nobody ships is a card that can never enter play.
    const s = table({ angebot: 'zufaellig' })
    const offered = new Set(allPorts().flatMap((id) => [...exportsAt(ctx, s, id)]))
    for (const good of CLASSIC_PACK.goods) {
      expect(offered.has(good.id), `${good.name} is nowhere on offer`).toBe(true)
    }
  })

  it('never lists the same good twice in one harbour', () => {
    const s = table({ angebot: 'zufaellig' })
    for (const portId of allPorts()) {
      const list = exportsAt(ctx, s, portId)
      expect(new Set(list).size, portId).toBe(list.length)
    }
  })

  it('is decided by the seed, so a replay deals the same routes', () => {
    const a = table({ angebot: 'zufaellig' })
    const b = table({ angebot: 'zufaellig' })
    expect(JSON.stringify(a.exports)).toEqual(JSON.stringify(b.exports))

    const other = replay(
      ctx,
      createGame(ctx, { seed: 'ein-anderer-wurf', angebot: 'zufaellig' }),
      openingActions(['Ada', 'Bo']),
    )
    expect(JSON.stringify(other.exports)).not.toEqual(JSON.stringify(a.exports))
  })

  it('actually governs what can be bought', () => {
    // The rolled table is not decoration: the quay obeys it.
    const s = table({ angebot: 'zufaellig' })
    const portId = portAt(ctx, flagship(s.players[0]!).nodeId)!
    const offered = buyOffers(ctx, s, s.players[0]!, portId).map((o) => o.goodId)
    expect([...offered].sort()).toEqual([...exportsAt(ctx, s, portId)].sort())
  })
})

describe('Preise "Entfernung"', () => {
  it('pays the printed Verkaufspreis everywhere under "fest"', () => {
    const s = table()
    for (const portId of allPorts().slice(0, 20)) {
      for (const good of CLASSIC_PACK.goods.slice(0, 10)) {
        expect(sellPriceAt(ctx, s, portId, good.id)).toBe(good.sell)
      }
    }
  })

  it('pays more the further a good has come from its nearest source', () => {
    const s = table({ preise: 'entfernung' })
    const good = CLASSIC_PACK.goods[22]! // Getreide, shipped from many places
    const dist = distanceToSource(ctx, s, good.id)

    const priced = allPorts()
      .map((id) => ({ id, hops: dist.get(id) ?? 0, price: sellPriceAt(ctx, s, id, good.id) }))
      .filter((row) => row.hops > 0)
      .sort((a, b) => a.hops - b.hops)

    expect(priced.length).toBeGreaterThan(5)
    const nearest = priced[0]!
    const furthest = priced[priced.length - 1]!
    expect(furthest.hops).toBeGreaterThan(nearest.hops)
    expect(furthest.price).toBeGreaterThan(nearest.price)

    // And it never runs away: the ceiling holds at twice the card.
    for (const row of priced) expect(row.price).toBeLessThanOrEqual(good.sell * 2)
  })

  it('makes a sale on the source’s doorstep worse than the card', () => {
    // The point of the option is that carrying it far is the earner, which
    // only bites if carrying it barely anywhere is not.
    const s = table({ preise: 'entfernung' })
    const good = CLASSIC_PACK.goods[22]!
    const dist = distanceToSource(ctx, s, good.id)
    const doorstep = allPorts().find((id) => dist.get(id) === 1)
    if (!doorstep) return
    expect(sellPriceAt(ctx, s, doorstep, good.id)).toBeLessThan(good.sell)
  })

  it('still pays only the glut price where the harbour ships it itself', () => {
    // Distance never overrides "Waren, die in diesem Hafen angeboten werden".
    const s = table({ preise: 'entfernung' })
    const portId = portAt(ctx, flagship(s.players[0]!).nodeId)!
    const offer = buyOffers(ctx, s, s.players[0]!, portId).find((o) => o.status === 'ok')!
    const loaded = applyAction(ctx, s, { type: 'buy', goodId: offer.goodId }).state

    const item = flagship(loaded.players[0]!).cargo[0]!
    const quote = quoteSale(ctx, loaded, item, portId)
    expect(quote.kind).toBe('ueberfluss')
    expect(quote.price).toBe(Math.round(item.pricePaid * loaded.config.localGlutSaleRate))
  })

  it('reaches the quotes a player is actually shown', () => {
    const fest = table()
    const fern = table({ preise: 'entfernung' })
    const portId = portAt(ctx, flagship(fest.players[0]!).nodeId)!

    const buy = (s: GameState) => {
      const offer = buyOffers(ctx, s, s.players[0]!, portId).find((o) => o.status === 'ok')!
      return applyAction(ctx, s, { type: 'buy', goodId: offer.goodId }).state
    }
    const a = buy(fest)
    const b = buy(fern)

    // Somewhere other than where it was loaded, the two modes must disagree.
    const elsewhere = allPorts().find(
      (id) => !exportsAt(ctx, b, id).includes(flagship(b.players[0]!).cargo[0]!.goodId),
    )!
    const priceIn = (s: GameState) => saleQuotes(ctx, s, s.players[0]!, elsewhere)[0]!.price
    expect(priceIn(a)).not.toBe(priceIn(b))
  })
})
