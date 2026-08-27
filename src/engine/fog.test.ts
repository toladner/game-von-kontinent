import { describe, expect, it } from 'vitest'
import { CLASSIC_PACK } from '@content/maps/classic'
import { createContext } from './context'
import { createGame } from './setup'
import { applyAction, replay } from './reducer'
import { projectFor } from './fog'
import { flagship, type GameState } from './state'
import { portAt, routeTo } from './selectors'
import type { GameAction } from './actions'

const ctx = createContext(CLASSIC_PACK)
const T0 = 1_900_000_000_000
const MIN = 60_000

/**
 * A running table under Sicht "realistisch", with Ada owning two vessels and
 * a rival, Bo, somewhere over the horizon.
 */
function table(overrides: Partial<Parameters<typeof createGame>[1]> = {}): GameState {
  const base = createGame(ctx, {
    seed: 'fog',
    travel: 'echtzeit',
    sicht: 'realistisch',
    minutesPerPip: 1,
    durationHours: 24,
    // Fog is about captains you cannot see, so this table runs a fleet.
    maxFleetSize: 2,
    ...overrides,
  })
  return replay(ctx, base, [
    { type: 'tick', at: T0 },
    { type: 'join', playerId: 'a', name: 'Ada' },
    { type: 'join', playerId: 'b', name: 'Bo' },
    { type: 'start' },
    // Ada buys a second ship, which is delivered where she stands.
    { type: 'buyVehicle', kindId: 'kuestenschoner', by: 'a' },
  ])
}

const ada = (s: GameState) => s.players.find((p) => p.id === 'a')!
const second = (s: GameState) => ada(s).fleet[1]!

/** A harbour a given number of pips away from a node. */
function portAway(from: string, minPips: number, maxPips: number): string {
  for (const id of ctx.portsById.keys()) {
    if (id === from) continue
    const len = routeTo(ctx, from, null, id).length
    if (len >= minPips && len <= maxPips) return id
  }
  throw new Error('no suitable harbour')
}

describe('Sicht: normal', () => {
  it('is the identity projection — nothing is hidden', () => {
    const open = replay(
      ctx,
      createGame(ctx, { seed: 'open', travel: 'echtzeit', minutesPerPip: 1 }),
      [
        { type: 'tick', at: T0 },
        { type: 'join', playerId: 'a', name: 'Ada' },
        { type: 'join', playerId: 'b', name: 'Bo' },
        { type: 'start' },
      ],
    )
    expect(projectFor(open, 'a')).toBe(open)
  })
})

describe('Sicht: realistisch', () => {
  it('shows a distant ship where she was last seen, not where she is', () => {
    let s = table()
    const home = flagship(ada(s)).nodeId
    const away = portAway(home, 3, 6)

    // Ada is standing on the quay, so she can order the schooner in person.
    s = applyAction(ctx, s, {
      type: 'setCourse',
      vehicleId: second(s).id,
      to: away,
      by: 'a',
    }).state
    s = applyAction(ctx, s, { type: 'tick', at: T0 + 60 * MIN }).state

    // In truth she has arrived.
    expect(second(s).nodeId).toBe(away)

    // Ada, still at home, has heard nothing since the schooner sailed.
    const view = projectFor(s, 'a')
    const believed = ada(view).fleet[1]!
    expect(believed.unseen).toBe(true)
    expect(believed.nodeId).toBe(home)
    expect(believed.nodeId).not.toBe(second(s).nodeId)
  })

  it('hides rival houses unless they are tied up alongside', () => {
    let s = table()
    // Send Bo somewhere, so his true position differs from his home port.
    const boHome = flagship(s.players.find((p) => p.id === 'b')!).nodeId
    s = applyAction(ctx, s, { type: 'setCourse', to: portAway(boHome, 3, 6), by: 'b' }).state
    s = applyAction(ctx, s, { type: 'tick', at: T0 + 60 * MIN }).state
    const view = projectFor(s, 'a')
    const rival = view.players.find((p) => p.id === 'b')!

    expect(rival.fleet.every((v) => v.hidden)).toBe(true)
    // Their true position is not merely undrawn, it is not in the data.
    const truth = s.players.find((p) => p.id === 'b')!
    if (flagship(truth).nodeId !== flagship(ada(s)).nodeId) {
      expect(flagship(rival).nodeId).not.toBe(flagship(truth).nodeId)
    }
    // Nor are a rival's letters and notes readable.
    expect(rival.knowledge.read).toEqual([])
    expect(rival.knowledge.notebook).toBe('')
  })

  it('will not let you order a captain you cannot speak to', () => {
    let s = table()
    const home = flagship(ada(s)).nodeId
    const away = portAway(home, 3, 6)
    s = applyAction(ctx, s, { type: 'setCourse', vehicleId: second(s).id, to: away, by: 'a' })
      .state
    s = applyAction(ctx, s, { type: 'tick', at: T0 + 60 * MIN }).state

    const refused = applyAction(ctx, s, {
      type: 'setCourse',
      vehicleId: second(s).id,
      to: home,
      by: 'a',
    })
    expect(refused.events[0]).toMatchObject({ type: 'rejected' })
    // The refusal travels as a key now, so this asks which one rather than
    // matching a German word that would not survive the app being read in
    // English.
    expect((refused.events[0] as { reason: { key: string } }).reason.key).toBe(
      'reject.needPigeon',
    )
  })

  it('delivers an order when the letter is addressed correctly', () => {
    let s = table()
    // Remove the risk of a lost bird for this one case.
    s = { ...s, config: { ...s.config, pigeon: { ...s.config.pigeon, lossPercent: 0 } } }

    const home = flagship(ada(s)).nodeId
    const away = portAway(home, 3, 6)
    const onward = portAway(away, 2, 5)

    s = applyAction(ctx, s, { type: 'setCourse', vehicleId: second(s).id, to: away, by: 'a' })
      .state
    s = applyAction(ctx, s, { type: 'tick', at: T0 + 60 * MIN }).state
    expect(second(s).nodeId).toBe(away)

    s = applyAction(ctx, s, {
      type: 'sendPigeon',
      vehicleId: second(s).id,
      toPort: away,
      destination: onward,
      by: 'a',
    }).state
    expect(s.pigeons).toHaveLength(1)

    s = applyAction(ctx, s, { type: 'tick', at: T0 + 300 * MIN }).state
    // The captain read it and put to sea — Ada is told nothing at all.
    const ship = second(s)
    expect(ship.voyage?.destination === onward || ship.nodeId === onward).toBe(true)
  })

  it('loses the order when the letter is addressed to the wrong harbour', () => {
    let s = table()
    s = { ...s, config: { ...s.config, pigeon: { ...s.config.pigeon, lossPercent: 0 } } }

    const home = flagship(ada(s)).nodeId
    const away = portAway(home, 3, 6)
    const onward = portAway(away, 2, 5)

    s = applyAction(ctx, s, { type: 'setCourse', vehicleId: second(s).id, to: away, by: 'a' })
      .state
    s = applyAction(ctx, s, { type: 'tick', at: T0 + 60 * MIN }).state

    // Addressed to where she started, not where she went.
    const sent = applyAction(ctx, s, {
      type: 'sendPigeon',
      vehicleId: second(s).id,
      toPort: home,
      destination: onward,
      by: 'a',
    })
    s = sent.state
    // No news is given either way — only that a bird was released.
    expect(sent.events.map((e) => e.type)).toContain('pigeonSent')

    s = applyAction(ctx, s, { type: 'tick', at: T0 + 300 * MIN }).state
    expect(second(s).voyage).toBeNull()
    expect(second(s).nodeId).toBe(away)
  })

  it('never lets a doomed bird arrive, and says nothing about it', () => {
    let s = table()
    s = { ...s, config: { ...s.config, pigeon: { ...s.config.pigeon, lossPercent: 100 } } }

    const home = flagship(ada(s)).nodeId
    const away = portAway(home, 3, 6)
    const onward = portAway(away, 2, 5)

    s = applyAction(ctx, s, { type: 'setCourse', vehicleId: second(s).id, to: away, by: 'a' })
      .state
    s = applyAction(ctx, s, { type: 'tick', at: T0 + 60 * MIN }).state
    s = applyAction(ctx, s, {
      type: 'sendPigeon',
      vehicleId: second(s).id,
      toPort: away,
      destination: onward,
      by: 'a',
    }).state

    const after = applyAction(ctx, s, { type: 'tick', at: T0 + 300 * MIN })
    expect(after.state.pigeons).toHaveLength(0)
    expect(second(after.state).voyage).toBeNull()
    // Crucially: no event tells the player the bird was lost.
    expect(after.events.some((e) => e.type === 'rejected')).toBe(false)
  })

  it('answers by letter, which must be fetched in person', () => {
    let s = table()
    s = { ...s, config: { ...s.config, pigeon: { ...s.config.pigeon, lossPercent: 0 } } }

    const home = flagship(ada(s)).nodeId
    const away = portAway(home, 3, 6)
    const onward = portAway(away, 2, 5)

    s = applyAction(ctx, s, { type: 'setCourse', vehicleId: second(s).id, to: away, by: 'a' })
      .state
    s = applyAction(ctx, s, { type: 'tick', at: T0 + 60 * MIN }).state
    s = applyAction(ctx, s, {
      type: 'sendPigeon',
      vehicleId: second(s).id,
      toPort: away,
      destination: onward,
      replyTo: home,
      by: 'a',
    }).state
    // One tick brings the order in; the answer is still on the wing.
    s = applyAction(ctx, s, { type: 'tick', at: T0 + 600 * MIN }).state
    s = applyAction(ctx, s, { type: 'tick', at: T0 + 900 * MIN }).state

    const waiting = ada(s).knowledge.waiting[home] ?? []
    expect(waiting.length).toBeGreaterThan(0)
    // It is not read until she calls at the post office herself.
    expect(ada(s).knowledge.read).toHaveLength(0)

    const collected = applyAction(ctx, s, { type: 'collectMail', by: 'a' })
    expect(collected.state.players.find((p) => p.id === 'a')!.knowledge.read.length).toBe(
      waiting.length,
    )
    const letter = collected.state.players.find((p) => p.id === 'a')!.knowledge.read[0]!
    // The letter is signed with a date and a place, so old news is knowable.
    expect(letter.writtenIn).toBe(away)
    expect(letter.writtenAt).toBeGreaterThan(T0)
    expect(portAt(ctx, letter.writtenIn)).toBe(away)
  })

  it('keeps the notebook, and keeps it short', () => {
    let s = table()
    const long = 'x'.repeat(s.config.notebookLimit + 200)
    s = applyAction(ctx, s, { type: 'writeNote', text: long, by: 'a' }).state
    expect(ada(s).knowledge.notebook).toHaveLength(s.config.notebookLimit)
  })

  it('decides a bird’s fate from the seeded log, so devices agree', () => {
    const build = () => {
      let s = table()
      const home = flagship(ada(s)).nodeId
      const away = portAway(home, 3, 6)
      const script: GameAction[] = [
        { type: 'setCourse', vehicleId: second(s).id, to: away, by: 'a' },
        { type: 'tick', at: T0 + 60 * MIN },
        {
          type: 'sendPigeon',
          vehicleId: second(s).id,
          toPort: away,
          destination: home,
          replyTo: home,
          by: 'a',
        },
        { type: 'tick', at: T0 + 400 * MIN },
      ]
      return replay(ctx, s, script)
    }
    expect(JSON.stringify(build())).toEqual(JSON.stringify(build()))
  })
})
