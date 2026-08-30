import { describe, expect, it } from 'vitest'
import { CLASSIC_PACK } from '@content/maps/classic'
import { createContext } from '@engine/context'
import { createGame } from '@engine/setup'
import { DEFAULT_OPTIONS, optionsOf, settingsOf } from './options'

const ctx = createContext(CLASSIC_PACK)

/**
 * Reading a standing table back into the form it was set on.
 *
 * The arrow only ever pointed one way: options made a game, and the game kept
 * no way back. A host changing his mind on the quayside needs the other
 * direction, and needs it exact — he is handed a form with every field already
 * filled in, and hands it back whole. A field this misreads is not a field
 * that looks wrong on screen; it is a field he never touched that changes
 * anyway, under players who are watching the same lobby.
 *
 * So the test is the round trip, not either half of it.
 */

describe('the terms of a standing table', () => {
  it('comes back out of a game exactly as it went in', () => {
    const asked = {
      totalRounds: 44,
      startingCapital: 1_250_000,
      joinPolicy: 'jederzeit',
      travel: 'echtzeit',
      minutesPerPip: 12,
      durationHours: 96,
      maxFleetSize: 3,
      angebot: 'zufaellig',
      preise: 'entfernung',
      konjunktur: 'erweitert',
    } as const

    const state = createGame(ctx, { seed: 'kai', ...asked })

    expect(settingsOf(optionsOf(state))).toEqual({
      ...asked,
      sicht: 'normal',
      packId: 'classic',
    })
  })

  /*
   * The engine names the unit of time and the setup screen names the thing on
   * the table, so this one word is translated twice on the way round. Both
   * directions, because a one-way mistake here turns every real-time table
   * back into a game of dice the moment its host opens the settings.
   */
  it('translates the dice between the engine and the form, both ways', () => {
    const dice = createGame(ctx, { seed: 'kai', travel: 'runde' })
    expect(optionsOf(dice).travel).toBe('wuerfel')
    expect(settingsOf(optionsOf(dice)).travel).toBe('runde')

    const clock = createGame(ctx, { seed: 'kai', travel: 'echtzeit' })
    expect(optionsOf(clock).travel).toBe('echtzeit')
    expect(settingsOf(optionsOf(clock)).travel).toBe('echtzeit')
  })

  it('offers the whole form, not the one-question route', () => {
    const state = createGame(ctx, { seed: 'kai' })
    // `mode` decides which screens the setup wizard shows; a table being
    // reconsidered is by definition past the point of being asked one thing.
    expect(optionsOf(state).mode).toBe('vollstaendig')
    expect(optionsOf(state).table).toBe('online-eroeffnen')
  })

  it('names every field the form holds, so none can go missing in the round trip', () => {
    const state = createGame(ctx, { seed: 'kai' })
    const read = optionsOf(state)
    // Everything but the four that are not terms of the table: how the setup
    // screen is being walked, where it is played, and the code being joined.
    const notTerms = new Set(['mode', 'table', 'joinCode'])
    for (const key of Object.keys(DEFAULT_OPTIONS)) {
      if (notTerms.has(key)) continue
      expect(read[key as keyof typeof read], key).toBeDefined()
    }
  })
})
