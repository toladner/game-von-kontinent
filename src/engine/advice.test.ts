import { describe, expect, it } from 'vitest'
import { CLASSIC_PACK } from '@content/maps/classic'
import { createContext, portOf } from './context'
import { createGame, openingActions } from './setup'
import { applyAction, replay } from './reducer'
import { buyOffers, portAt } from './selectors'
import { flagship, type GameState } from './state'
import {
  harbourAdvice,
  harbourGreeting,
  harbourPlan,
  konjunkturOutcome,
  leavingEmptyHanded,
} from './advice'
import type { KonjunkturCard } from './types'

const ctx = createContext(CLASSIC_PACK)

function table(seed = 'rat'): GameState {
  return replay(ctx, createGame(ctx, { seed }), openingActions(['Ada', 'Bo']))
}

/** The copy carries *emphasis markers*; most assertions want the words. */
const plain = (text: string) => text.replace(/\*/g, '')

const here = (s: GameState) => portAt(ctx, flagship(s.players[0]!).nodeId)!
const walk = (s: GameState) => harbourPlan(ctx, s, s.players[0]!, here(s))

describe('the Kontormakler', () => {
  it('walks the same three steps whatever the harbour holds', () => {
    const s = table()
    const plan = walk(s)

    // Hold, quay, chart — always, so the tabs never move under a thumb.
    expect(plan.map((p) => p.step)).toEqual(['verkaufen', 'kaufen', 'wohin'])
    expect(plan[0]!.id).toBe('nichts-an-bord')
    expect(plan[2]!.id).toBe('nichts-zu-planen')

    const angebot = plan[1]!
    expect(angebot.id).toBe('leer-nachladen')
    expect(angebot.urgency).toBe('dringend')
    // The whole point: it names something actually on offer here.
    const goods = ctx.exportsOf(here(s)).map((id) => ctx.goodsById.get(id)!.name)
    expect(goods.some((name) => plain(angebot.text).includes(name))).toBe(true)
  })

  it('gives the chart something to say once there is cargo to place', () => {
    const s = table()
    const offer = buyOffers(ctx, s, s.players[0]!, here(s)).find((o) => o.status === 'ok')!
    const after = applyAction(ctx, s, { type: 'buy', goodId: offer.goodId }).state

    expect(walk(after).at(-1)!.step).toBe('wohin')
    expect(walk(after).at(-1)!.id).not.toBe('nichts-zu-planen')
  })

  it('keeps the Angebot in the round and says why it is shut', () => {
    // A step that comes and goes is one nobody learns to expect, so the quay
    // stays in the round and explains itself instead of disappearing.
    let s = table()
    for (let i = 0; i < 2; i++) {
      const offer = buyOffers(ctx, s, s.players[0]!, here(s)).find((o) => o.status === 'ok')
      if (!offer) break
      s = applyAction(ctx, s, { type: 'buy', goodId: offer.goodId }).state
    }
    expect(walk(s).map((p) => p.step)).toEqual(['verkaufen', 'kaufen', 'wohin'])
    expect(walk(s)[1]!.id).toBe('ladeschluss')
  })

  it('stops nagging once something is aboard', () => {
    const s = table()
    const offer = buyOffers(ctx, s, s.players[0]!, here(s)).find((o) => o.status === 'ok')!
    const after = applyAction(ctx, s, { type: 'buy', goodId: offer.goodId }).state

    expect(flagship(after.players[0]!).cargo).toHaveLength(1)
    expect(walk(after).some((p) => p.id === 'leer-nachladen')).toBe(false)
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

    // The round is still walkable — the Börse holds the ship, not the round —
    // but it opens on the demand and says so in the loudest voice it has.
    const plan = harbourPlan(ctx, moved, moved.players[0]!, elsewhere)
    expect(plan.map((p) => p.step)).toEqual(['verkaufen', 'kaufen', 'wohin'])
    expect(plan[0]!.id).toBe('verkaufszwang')
    expect(plan[0]!.urgency).toBe('dringend')
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
      const plan = harbourPlan(ctx, moved, moved.players[0]!, portId)
      // Three steps, always, and every one of them has something to say.
      expect(plan.map((p) => p.step), portId).toEqual(['verkaufen', 'kaufen', 'wohin'])
      for (const stage of plan) {
        expect(stage.text.length, portId).toBeGreaterThan(20)
        expect(stage.label, portId).toBeTruthy()
        // An odd marker would print a literal asterisk at the player.
        expect((stage.text.match(/\*/g) ?? []).length % 2, portId).toBe(0)
      }
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
    // The Makler still walks them past the quay, to say why it is shut.
    expect(harbourAdvice(ctx, broke, broke.players[0]!, here(broke)).id).toBe('nichts-an-bord')
    expect(harbourPlan(ctx, broke, broke.players[0]!, here(broke))[1]!.id).toBe('zu-teuer')
  })
})

describe('what a Konjunkturkarte did to you', () => {
  const cardWith = (effects: KonjunkturCard['effects']): KonjunkturCard => ({
    id: 'test',
    title: { de: 'Prüfkarte', en: 'Test card' },
    lines: { de: [], en: [] },
    effects,
  })

  it('says half of what, when the weather only spoils the cargo', () => {
    const s = table()
    const soaked = konjunkturOutcome(
      ctx,
      s.players[0]!,
      cardWith([
        {
          kind: 'cargoDamagedInRegion',
          continent: 'europa',
          count: 1,
          title: { de: 'Havarie', en: 'Damage at sea' },
        },
      ]),
    )
    expect(soaked.headline).toBe('Havarie')
    expect(soaked.detail).toContain('halben Erlös')
    expect(soaked.tone).toBe('schlecht')
  })

  it('names the sum on a Telegramm rather than the rule', () => {
    const s = table()
    const out = konjunkturOutcome(
      ctx,
      s.players[0]!,
      cardWith([{ kind: 'payoutToDrawer', amount: 15_000 }]),
    )
    expect(out.headline).toContain('15.000')
    expect(out.headline).toMatch(/^Sie erhalten/)
    expect(out.tone).toBe('gut')
  })

  it('works the Steuer out against what is actually in the hold', () => {
    const s = table()
    const offer = buyOffers(ctx, s, s.players[0]!, here(s)).find((o) => o.status === 'ok')!
    const loaded = applyAction(ctx, s, { type: 'buy', goodId: offer.goodId }).state
    const paid = flagship(loaded.players[0]!).cargo[0]!.pricePaid

    const out = konjunkturOutcome(
      ctx,
      loaded.players[0]!,
      cardWith([{ kind: 'leviedOnAllShips', levy: 'steuer', percentOfCargoValue: 10 }]),
    )
    expect(out.headline).toContain(Math.round(paid * 0.1).toLocaleString('de-DE'))
    expect(out.tone).toBe('schlecht')
  })

  it('says plainly that an empty hold owes no Steuer', () => {
    // A levy on nothing is nothing — the printed card cannot say that, and a
    // player staring at "10 % vom Warenwert" with an empty ship should not
    // have to work it out.
    const s = table()
    expect(flagship(s.players[0]!).cargo).toHaveLength(0)
    const out = konjunkturOutcome(
      ctx,
      s.players[0]!,
      cardWith([{ kind: 'leviedOnAllShips', levy: 'steuer', percentOfCargoValue: 10 }]),
    )
    expect(out.headline).toBe('Sie zahlen nichts.')
    expect(out.tone).toBe('neutral')
  })

  it('spares a ship at sea the Hafengebühr, and says so', () => {
    const s = table()
    const player = s.players[0]!
    const atSea = [...ctx.graph.neighbours.keys()].find((n) => !portAt(ctx, n))!
    const moved = {
      ...player,
      fleet: player.fleet.map((v, i) => (i === 0 ? { ...v, nodeId: atSea } : v)),
    }
    const card = cardWith([{ kind: 'portFeeAllInPort', amount: 5_000 }])

    expect(konjunkturOutcome(ctx, moved, card).headline).toBe('Sie zahlen nichts.')
    expect(konjunkturOutcome(ctx, player, card).headline).toContain('5.000')
  })

  it('reads a Hausse and a Baisse in opposite directions', () => {
    const s = table()
    const up = konjunkturOutcome(ctx, s.players[0]!, cardWith([{ kind: 'salePriceDelta', percent: 20 }]))
    const down = konjunkturOutcome(
      ctx,
      s.players[0]!,
      cardWith([{ kind: 'salePriceDelta', percent: -20 }]),
    )
    expect(up.headline).toContain('+20')
    expect(up.tone).toBe('gut')
    expect(down.headline).toContain('20')
    expect(down.tone).toBe('schlecht')
  })
})

describe('stepping ashore', () => {
  it('names the harbour, what it ships and what you are carrying', () => {
    const s = table()
    const port = here(s)
    const g = harbourGreeting(ctx, s, s.players[0]!, port)

    expect(g.headline).toContain(portOf(ctx, port).name)
    expect(plain(g.body)).toContain('Ihr Laderaum ist leer.')
    const goods = ctx.exportsOf(port).map((id) => ctx.goodsById.get(id)!.name)
    expect(goods.some((name) => plain(g.body).includes(name))).toBe(true)
    // And the words worth skimming for are marked.
    expect(g.body).toMatch(/\*Laderaum ist leer\*/)
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
    expect(plain(harbourGreeting(ctx, loaded, loaded.players[0]!, here(loaded)).body)).toMatch(
      /nimmt hier allerdings niemand/,
    )
  })
})
