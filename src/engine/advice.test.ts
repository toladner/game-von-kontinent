import { describe, expect, it } from 'vitest'
import { CLASSIC_PACK } from '@content/maps/classic'
import { createContext, portOf } from './context'
import { createGame, openingActions } from './setup'
import { applyAction, replay } from './reducer'
import { buyOffers, portAt } from './selectors'
import { flagship, type GameState } from './state'
import { harbourAdvice, harbourGreeting, leavingEmptyHanded } from './advice'

const ctx = createContext(CLASSIC_PACK)

function table(seed = 'rat'): GameState {
  return replay(ctx, createGame(ctx, { seed }), openingActions(['Ada', 'Bo']))
}

const here = (s: GameState) => portAt(ctx, flagship(s.players[0]!).nodeId)!
const advise = (s: GameState) => harbourAdvice(ctx, s, s.players[0]!, here(s))

describe('the Kontormakler', () => {
  it('sends a merchant with an empty hold to the Angebot', () => {
    const s = table()
    const advice = advise(s)

    expect(advice.id).toBe('leer-nachladen')
    expect(advice.tab).toBe('kaufen')
    expect(advice.urgency).toBe('dringend')
    // The whole point: it names something actually on offer here.
    const goods = ctx.exportsOf(here(s)).map((id) => ctx.goodsById.get(id)!.name)
    expect(goods.some((name) => advice.text.includes(name))).toBe(true)
  })

  it('stops nagging once something is aboard', () => {
    const s = table()
    const offer = buyOffers(ctx, s, s.players[0]!, here(s)).find((o) => o.status === 'ok')!
    const after = applyAction(ctx, s, { type: 'buy', goodId: offer.goodId }).state

    expect(flagship(after.players[0]!).cargo).toHaveLength(1)
    expect(advise(after).id).not.toBe('leer-nachladen')
  })

  it('puts the Verkaufszwang ahead of everything else', () => {
    const s = table()
    const offer = buyOffers(ctx, s, s.players[0]!, here(s)).find((o) => o.status === 'ok')!
    const loaded = applyAction(ctx, s, { type: 'buy', goodId: offer.goodId }).state

    // Tie up somewhere that does not grow what she is carrying, with the
    // Börse demanding a sale.
    const elsewhere = [...ctx.portsById.keys()].find(
      (id) => id !== here(s) && !ctx.exportsOf(id).includes(offer.goodId),
    )!
    const player = loaded.players[0]!
    const moved: GameState = {
      ...loaded,
      mustSellForeign: true,
      players: [
        {
          ...player,
          fleet: player.fleet.map((v, i) => (i === 0 ? { ...v, nodeId: elsewhere } : v)),
        },
        ...loaded.players.slice(1),
      ],
    }

    const advice = harbourAdvice(ctx, moved, moved.players[0]!, elsewhere)
    expect(advice.id).toBe('verkaufszwang')
    expect(advice.urgency).toBe('dringend')
    expect(advice.tab).toBe('verkaufen')
  })

  it('always offers somewhere to go', () => {
    // Every reply must be actionable: a line the player cannot act on is
    // just decoration, and this character exists to be acted on.
    const s = table()
    for (const portId of [...ctx.portsById.keys()].slice(0, 40)) {
      const player = s.players[0]!
      const moved: GameState = {
        ...s,
        players: [
          {
            ...player,
            fleet: player.fleet.map((v, i) => (i === 0 ? { ...v, nodeId: portId } : v)),
          },
          ...s.players.slice(1),
        ],
      }
      const advice = harbourAdvice(ctx, moved, moved.players[0]!, portId)
      expect(advice.text.length, portId).toBeGreaterThan(20)
      expect(advice.tab, portId).toBeTruthy()
      expect(advice.cta, portId).toBeTruthy()
    }
  })
})

describe('casting off', () => {
  it('counts as empty-handed at the start of a season', () => {
    const s = table()
    expect(leavingEmptyHanded(ctx, s, s.players[0]!, here(s))).toBe(true)
  })

  it('is fine once the hold has something in it', () => {
    const s = table()
    const offer = buyOffers(ctx, s, s.players[0]!, here(s)).find((o) => o.status === 'ok')!
    const after = applyAction(ctx, s, { type: 'buy', goodId: offer.goodId }).state
    expect(leavingEmptyHanded(ctx, after, after.players[0]!, here(after))).toBe(false)
  })

  it('is fine when the port has nothing this house can buy', () => {
    // A till that cannot afford anything is not a mistake, it is a situation.
    const s = table()
    const player = s.players[0]!
    const broke: GameState = { ...s, players: [{ ...player, cash: 0 }, ...s.players.slice(1)] }
    expect(leavingEmptyHanded(ctx, broke, broke.players[0]!, here(broke))).toBe(false)
    expect(harbourAdvice(ctx, broke, broke.players[0]!, here(broke)).id).toBe('leer-kein-geld')
  })
})

describe('stepping ashore', () => {
  it('names the harbour, what it ships and what you are carrying', () => {
    const s = table()
    const port = here(s)
    const g = harbourGreeting(ctx, s, s.players[0]!, port)

    expect(g.headline).toContain(portOf(ctx, port).name)
    expect(g.body).toContain('Ihr Laderaum ist leer.')
    const goods = ctx.exportsOf(port).map((id) => ctx.goodsById.get(id)!.name)
    expect(goods.some((name) => g.body.includes(name))).toBe(true)
  })

  it('greets a merchant standing in their own home port differently', () => {
    const s = table()
    const player = s.players[0]!
    expect(player.homePort).toBe(here(s))
    expect(harbourGreeting(ctx, s, player, here(s)).headline).toMatch(/Wieder daheim/)

    const away = [...ctx.portsById.keys()].find((id) => id !== player.homePort)!
    expect(harbourGreeting(ctx, s, player, away).headline).toMatch(/Willkommen in/)
  })

  it('says the same thing every time you call at the same quay', () => {
    const s = table()
    expect(harbourGreeting(ctx, s, s.players[0]!, here(s))).toEqual(
      harbourGreeting(ctx, s, s.players[0]!, here(s)),
    )
  })

  it('does not open with the same words in every port', () => {
    const s = table()
    const openings = new Set(
      [...ctx.portsById.keys()]
        .slice(0, 30)
        .map((id) => harbourGreeting(ctx, s, s.players[0]!, id).body.split('.')[0]),
    )
    expect(openings.size).toBeGreaterThan(2)
  })

  it('mentions a sale waiting here once there is cargo for it', () => {
    const s = table()
    const offer = buyOffers(ctx, s, s.players[0]!, here(s)).find((o) => o.status === 'ok')!
    const loaded = applyAction(ctx, s, { type: 'buy', goodId: offer.goodId }).state

    // Where she stands the good is a local glut, so no buyer — say so plainly.
    expect(harbourGreeting(ctx, loaded, loaded.players[0]!, here(loaded)).body).toMatch(
      /nimmt hier allerdings niemand/,
    )
  })
})
