import { describe, expect, it } from 'vitest'
import { AS_PRINTED, settle } from './index'

/**
 * The one reading of a table's terms.
 *
 * There are two ways a table gets its settings — opened with them, or changed
 * to them on the quayside — and both go through here, which is the whole point
 * of it. Two readings would be two sets of bounds, and the second would be the
 * one nobody remembered to widen when the first was.
 *
 * What arrives is whatever a browser felt like sending, so nothing here trusts
 * it: every number is held inside bounds and every choice has to be one of the
 * ones on offer. A table is replayed against these on every wake, so a value
 * that should not exist is not a bad screenful, it is a game that cannot be
 * folded.
 */

describe('the terms of a table', () => {
  it('falls back to the Anleitung when nothing is asked for', () => {
    expect(settle({})).toEqual(AS_PRINTED)
  })

  it('leaves alone what a change does not name', () => {
    const table = settle({ travel: 'echtzeit', minutesPerPip: 30, durationHours: 168 })
    const after = settle({ startingCapital: 1_000_000 }, table)

    expect(after.startingCapital).toBe(1_000_000)
    // The rest of the table is still the table.
    expect(after.travel).toBe('echtzeit')
    expect(after.minutesPerPip).toBe(30)
    expect(after.durationHours).toBe(168)
  })

  it('holds every number inside its bounds', () => {
    const wild = settle({
      totalRounds: 10_000,
      startingCapital: 1,
      minutesPerPip: 0,
      durationHours: 100_000,
      maxFleetSize: 99,
    })
    expect(wild.totalRounds).toBe(200)
    expect(wild.startingCapital).toBe(50_000)
    expect(wild.minutesPerPip).toBe(0.02)
    expect(wild.durationHours).toBe(720)
    expect(wild.maxFleetSize).toBe(6)
  })

  it('keeps fractional minutes, which a blitz table is played on', () => {
    expect(settle({ minutesPerPip: 0.5 }).minutesPerPip).toBe(0.5)
  })

  /*
   * A word that is not one of the words is not a new option, it is noise —
   * and the table it would produce is one the reducer cannot fold. So it
   * falls back to what was there, which for a change means no change at all.
   */
  it('refuses a choice that is not on offer, keeping what was there', () => {
    const table = settle({ preise: 'entfernung', angebot: 'zufaellig', konjunktur: 'erweitert' })
    const after = settle(
      { preise: 'nach laune', angebot: '', konjunktur: 'erweitert' } as never,
      table,
    )
    expect(after.preise).toBe('entfernung')
    expect(after.angebot).toBe('zufaellig')
    expect(after.konjunktur).toBe('erweitert')
  })

  /*
   * The deck is the newest of these and the one that was missing longest: it
   * was chosen on the setup screen, dropped before it reached the server, and
   * every online table played the printed 27 whatever the host had picked.
   */
  it('will not let anyone move a table onto different rules', () => {
    // The Regelstand is the date on the rulebook a table was opened with, not
    // a setting the host may change his mind about. Changing it mid-season
    // would not change the game from there on — the server folds the log from
    // the beginning, so it would change what had already happened.
    const asked = settle({ regeln: 99, konjunktur: 'erweitert' } as never)
    expect('regeln' in asked).toBe(false)

    // And a change that names it leaves the table's own where it stands: the
    // host's settings are merged over the meta, not in place of it.
    const meta = { regeln: 1, ...settle({ travel: 'echtzeit' }) }
    const after = { ...meta, ...settle({ regeln: 99 } as never, meta) }
    expect(after.regeln).toBe(1)
  })

  it('carries the Konjunktur deck, which online tables never used to', () => {
    expect(settle({ konjunktur: 'erweitert' }).konjunktur).toBe('erweitert')
    expect(settle({}).konjunktur).toBe('klassisch')
  })
})
