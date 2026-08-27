import { describe, expect, it } from 'vitest'
import { CLASSIC_PACK } from '@content/maps/classic'
import { createContext } from './context'
import { createGame, openingActions } from './setup'
import { applyAction, replay } from './reducer'
import {
  buyOffers,
  marketReport,
  portAt,
  quoteSale,
  sailingTimeMs,
  saleQuotes,
  voyageEndsAt,
} from './selectors'
import { flagship, type GameState } from './state'
import { distanceToSource, exportsAt, sellPriceAt } from './market'
import type { KonjunkturCard } from './types'
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
    // Assert rather than skip: a silent return here would mean this test
    // stopped checking anything the day the map changed.
    const doorstep = allPorts().find((id) => dist.get(id) === 1)
    expect(doorstep, 'no harbour one hop from a source').toBeTruthy()
    expect(sellPriceAt(ctx, s, doorstep!, good.id)).toBeLessThan(good.sell)
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

describe('Konjunktur "erweitert"', () => {
  const deck = (s: GameState) => s.deck.length

  it('leaves the printed deck alone under "klassisch"', () => {
    const s = table()
    expect(deck(s)).toBe(CLASSIC_PACK.konjunktur.length)
  })

  it('shuffles in the weather cards under "erweitert"', () => {
    const s = table({ konjunktur: 'erweitert' })
    expect(deck(s)).toBeGreaterThan(CLASSIC_PACK.konjunktur.length)
    // The printed cards are still in there: this adds, it does not replace.
    for (const card of CLASSIC_PACK.konjunktur) {
      expect(s.deck.includes(card.id), card.title.de).toBe(true)
    }
  })

  it('hangs weather over one continent and prices it there only', () => {
    const s = table({ konjunktur: 'erweitert' })
    const withWind: GameState = {
      ...s,
      weather: [
        {
          id: 'w1',
          title: { de: 'Hausse in Europa', en: 'Boom in Europe' },
          continent: 'europa',
          goodId: null,
          category: null,
          percent: 50,
          untilRound: s.round + 3,
          untilTime: null,
        },
      ],
    }
    const good = CLASSIC_PACK.goods[21]! // Getreide
    const inEurope = sellPriceAt(ctx, withWind, 'hamburg', good.id)
    const elsewhere = sellPriceAt(ctx, withWind, 'newyork', good.id)

    expect(inEurope).toBeGreaterThan(good.sell)
    expect(elsewhere).toBe(good.sell)
  })

  it('lets the weather blow out when its rounds are up', () => {
    const s = table({ konjunktur: 'erweitert' })
    const withWind: GameState = {
      ...s,
      weather: [
        {
          id: 'w1',
          title: { de: 'Baisse in Europa', en: 'Slump in Europe' },
          continent: 'europa',
          goodId: null,
          category: null,
          percent: -30,
          untilRound: s.round,
          untilTime: null,
        },
      ],
    }
    // Play on until the round track moves past it.
    let next = withWind
    for (let i = 0; i < 12 && next.round <= withWind.round; i++) {
      next = applyAction(ctx, next, { type: 'endTurn' }).state
    }
    expect(next.round).toBeGreaterThan(withWind.round)
    expect(next.weather).toEqual([])
  })

  it('throws the dearest cargo overboard in a storm, not the cheapest', () => {
    const s = table({ konjunktur: 'erweitert' })
    const portId = portAt(ctx, flagship(s.players[0]!).nodeId)!
    let loaded = s
    for (const offer of buyOffers(ctx, s, s.players[0]!, portId).filter((o) => o.status === 'ok')) {
      loaded = applyAction(ctx, loaded, { type: 'buy', goodId: offer.goodId }).state
    }
    const before = flagship(loaded.players[0]!).cargo
    expect(before.length, 'need two posten to prove the dearest goes first')
      .toBeGreaterThanOrEqual(2)

    const dearest = [...before].sort((a, b) => b.pricePaid - a.pricePaid)[0]!
    const card: KonjunkturCard = {
      id: 'storm-test',
      title: { de: 'Sturm', en: 'Gale' },
      lines: { de: [], en: [] },
      effects: [
        {
          kind: 'stormInRegion',
          continent: 'europa',
          lose: 1,
          title: { de: 'Sturm', en: 'Gale' },
        },
      ],
    }
    const withCard: GameState = { ...loaded, phase: 'konjunktur', deck: [card.id] }
    const probe = createContext({
      ...CLASSIC_PACK,
      konjunktur: [...CLASSIC_PACK.konjunktur, card],
    })
    const after = applyAction(probe, withCard, { type: 'drawKonjunktur' })

    const kept = flagship(after.state.players[0]!).cargo
    expect(kept.length).toBe(before.length - 1)
    expect(kept.some((c) => c.uid === dearest.uid)).toBe(false)
    expect(after.events.some((e) => e.type === 'cargoLost')).toBe(true)
  })
})

describe('the Wohin? list under distance pricing', () => {
  /** Fill the hold to the harbour's limit — two posten, so it can be split. */
  const vollBeladen = (options: NewGameOptions) => {
    let s = table(options)
    const portId = portAt(ctx, flagship(s.players[0]!).nodeId)!
    for (const offer of buyOffers(ctx, s, s.players[0]!, portId).filter((o) => o.status === 'ok')) {
      s = applyAction(ctx, s, { type: 'buy', goodId: offer.goodId }).state
    }
    return s
  }

  /** Load a hold, then see what the chart offers. */
  const laden = (options: NewGameOptions) => {
    const s = table(options)
    const portId = portAt(ctx, flagship(s.players[0]!).nodeId)!
    const offer = buyOffers(ctx, s, s.players[0]!, portId).find((o) => o.status === 'ok')!
    return applyAction(ctx, s, { type: 'buy', goodId: offer.goodId }).state
  }

  it('offers both near and far harbours to weigh against each other', () => {
    // Ranking by profit-per-pip alone hands back six variations of "sail a
    // long way", and then there is nothing to decide.
    const s = laden({ preise: 'entfernung' })
    const report = marketReport(ctx, s, s.players[0]!, 6)
    expect(report.length).toBeGreaterThan(3)

    const distances = report.map((d) => d.distance)
    const near = Math.min(...distances)
    const far = Math.max(...distances)
    expect(far - near).toBeGreaterThan(2)
  })

  it('reads from near to far, so the trade-off is in order', () => {
    const s = laden({ preise: 'entfernung' })
    const report = marketReport(ctx, s, s.players[0]!, 6)
    for (let i = 1; i < report.length; i++) {
      expect(report[i]!.distance).toBeGreaterThanOrEqual(report[i - 1]!.distance)
    }
  })

  it('never offers a harbour that a nearer one already beats', () => {
    // The price rise flattens at the ceiling, so past a point the extra sea
    // buys nothing. Offering it anyway is offering a choice nobody would
    // make; every row here has to be either closer or richer than the last.
    const s = laden({ preise: 'entfernung' })
    const report = marketReport(ctx, s, s.players[0]!, 6)
    expect(report.length).toBeGreaterThan(3)
    for (let i = 1; i < report.length; i++) {
      expect(report[i]!.profit, `${report[i]!.name} is no better than ${report[i - 1]!.name}`)
        .toBeGreaterThan(report[i - 1]!.profit)
    }
  })

  it('always offers two harbours that will not take the whole hold', () => {
    // Ranking by what a place pays favours the ports that buy everything, and
    // a chart made only of those is just "which of these is nearest". Two, not
    // one: a single oddity in a list of six reads as a mistake rather than a
    // branch worth weighing.
    for (const preise of ['fest', 'entfernung'] as const) {
      const s = vollBeladen({ preise })
      const held = flagship(s.players[0]!).cargo.length
      expect(held, preise).toBeGreaterThan(1)

      const rows = marketReport(ctx, s, s.players[0]!, 6)
      const partial = rows.filter((d) => d.sellable < held)
      expect(partial.length, `${preise}: partial options`).toBe(2)
      // And they are real options, not empty ones.
      for (const row of partial) expect(row.sellable, row.name.de).toBeGreaterThan(0)
    }
  })

  it('does not go looking for awkward options with one posten aboard', () => {
    // With a single good there is nothing to split, so every harbour either
    // takes it or is not on the list at all.
    const s = table({ preise: 'entfernung' })
    const portId = portAt(ctx, flagship(s.players[0]!).nodeId)!
    const offer = buyOffers(ctx, s, s.players[0]!, portId).find((o) => o.status === 'ok')!
    const one = applyAction(ctx, s, { type: 'buy', goodId: offer.goodId }).state
    expect(flagship(one.players[0]!).cargo).toHaveLength(1)

    for (const row of marketReport(ctx, one, one.players[0]!, 6)) {
      expect(row.sellable, row.name.de).toBe(1)
    }
  })

  it('keeps the list in one order after making room', () => {
    // Displacing a full-sale harbour writes the newcomer in wherever a slot
    // came free, which is no order at all until it is sorted again.
    const s = vollBeladen({})
    const rows = marketReport(ctx, s, s.players[0]!, 6)
    for (let i = 1; i < rows.length; i++) {
      const before = rows[i - 1]!
      const row = rows[i]!
      expect(
        before.profit > row.profit || before.distance <= row.distance,
        `${before.name} then ${row.name}`,
      ).toBe(true)
    }
  })

  it('leaves the fixed-price list alone, where nearness is the whole question', () => {
    // Every harbour pays the same figure, so a far one is strictly worse and
    // padding the list with distance would be noise.
    const s = vollBeladen({})
    const held = flagship(s.players[0]!).cargo.length
    const report = marketReport(ctx, s, s.players[0]!, 6)
    // Every harbour that takes the whole hold pays exactly the same figure,
    // so among those only nearness can separate them.
    const full = report.filter((d) => d.sellable === held)
    expect(new Set(full.map((d) => d.profit)).size).toBe(1)
    for (let i = 1; i < full.length; i++) {
      expect(full[i]!.distance).toBeGreaterThanOrEqual(full[i - 1]!.distance)
    }
  })
})

describe('what the chart says a voyage will take', () => {
  const T0 = 1_800_000_000_000

  const afloat = (options: NewGameOptions = {}) =>
    replay(
      ctx,
      createGame(ctx, { seed: 'uhr', travel: 'echtzeit', minutesPerPip: 6, ...options }),
      [
        { type: 'tick', at: T0 },
        { type: 'join', playerId: 'a', name: 'Ada' },
        { type: 'join', playerId: 'b', name: 'Bo' },
        { type: 'start' },
      ],
    )

  it('quotes nothing in round play, where a voyage costs throws', () => {
    const s = table()
    for (const row of marketReport(ctx, s, s.players[0]!, 6)) {
      expect(row.travelMs).toBeUndefined()
    }
  })

  it('quotes a time for every destination once ships sail on a clock', () => {
    const s = afloat()
    const rows = marketReport(ctx, s, s.players[0]!, 6)
    expect(rows.length).toBeGreaterThan(0)
    for (const row of rows) {
      expect(row.travelMs, row.name.de).toBeGreaterThan(0)
    }
  })

  it('quotes the time the ship will actually take, cast-off included', () => {
    // The chart and the helm have to agree, or the estimate is decoration.
    const s = afloat()
    const ship = flagship(s.players[0]!)
    for (const row of marketReport(ctx, s, s.players[0]!, 6)) {
      expect(row.travelMs, row.name.de).toBe(sailingTimeMs(ctx, s, ship, row.portId))
    }
  })

  it('agrees with the voyage once it has actually been ordered', () => {
    const s = afloat()
    const target = marketReport(ctx, s, s.players[0]!, 6)[0]!
    const ordered = applyAction(ctx, s, { type: 'setCourse', to: target.portId, by: 'a' }).state
    const eta = voyageEndsAt(ctx, ordered, flagship(ordered.players[0]!))!
    expect(eta - T0).toBeCloseTo(target.travelMs!, -3)
  })

  it('says a longer haul takes longer', () => {
    const s = afloat({ preise: 'entfernung' })
    const rows = marketReport(ctx, s, s.players[0]!, 6)
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i]!.travelMs!, rows[i]!.name.de).toBeGreaterThan(rows[i - 1]!.travelMs!)
    }
  })
})
