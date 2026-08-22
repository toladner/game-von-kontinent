import { describe, expect, it } from 'vitest'
import { CLASSIC_PACK } from '@content/maps/classic'
import { createContext } from './context'
import { createGame, openingActions } from './setup'
import { applyAction, replay } from './reducer'
import { buyOffers, portAt } from './selectors'
import { flagship, type GameState } from './state'
import { harbourAdvice, leavingEmptyHanded } from './advice'

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
