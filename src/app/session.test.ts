// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useGame } from './store'
import { hasSeatAt, rememberedTable } from './net'
import { legalSteps } from '@engine/selectors'

/**
 * Staying logged in.
 *
 * The complaint this covers: every time the site was reopened the player was
 * back at the title page, and had to type the code and a name again to get
 * into a game that was still running. Worse in the installed app, where
 * closing it is the normal thing to do — and while they were off the game
 * screen nothing could tell them a ship had arrived.
 *
 * The seat token was already being kept, which is why *any* name got you back
 * into your own house. What was missing was the code beside it.
 */

/** A socket that never connects, so a join is testable without a server. */
class DeadSocket {
  static readonly OPEN = 1
  readyState = 0
  addEventListener(): void {}
  send(): void {}
  close(): void {}
}

const originalSocket = globalThis.WebSocket

beforeEach(() => {
  ;(globalThis as { WebSocket: unknown }).WebSocket = DeadSocket
  localStorage.clear()
  useGame.getState().abandon()
})

afterEach(() => {
  ;(globalThis as { WebSocket: unknown }).WebSocket = originalSocket
  useGame.getState().abandon()
  localStorage.clear()
})

describe('coming back to a table', () => {
  it('writes the table down when joining one', () => {
    useGame.getState().join('WZUH', 'Tobias', 'm')
    expect(rememberedTable()).toMatchObject({ code: 'WZUH', name: 'Tobias', gender: 'm' })
  })

  it('walks back in on its own next time the app starts', () => {
    useGame.getState().join('WZUH', 'Tobias')
    // What a reload does: the store is fresh, localStorage is not.
    useGame.getState().leave()
    localStorage.setItem('vkzk.tisch.v1', JSON.stringify({ code: 'WZUH', name: 'Tobias' }))

    expect(useGame.getState().net).toBeNull()
    expect(useGame.getState().restore()).toBe(true)
    expect(useGame.getState().net?.code).toBe('WZUH')
  })

  it('goes to the title page when no table is remembered', () => {
    expect(useGame.getState().restore()).toBe(false)
    expect(useGame.getState().net).toBeNull()
  })

  it('survives a table written by an older or broken build', () => {
    localStorage.setItem('vkzk.tisch.v1', '{ not json')
    expect(useGame.getState().restore()).toBe(false)
    localStorage.setItem('vkzk.tisch.v1', JSON.stringify({ name: 'niemand' }))
    expect(useGame.getState().restore()).toBe(false)
  })
})

describe('the Börsenblatt after a reload', () => {
  /**
   * The journal was only ever written by events arriving live, so anything
   * that rebuilt a game from its action log — resuming, joining, and now
   * walking back in at start-up — opened the Nachrichten sheet empty on a
   * game fifty rounds old.
   */
  /** Play a couple of rounds, so there is a history worth losing. */
  function playOn(seed: string): void {
    useGame.getState().begin(['Ada', 'Bo'], { totalRounds: 20, seed })
    for (let turn = 0; turn < 6; turn++) {
      for (let guard = 0; guard < 12; guard++) {
        const g = useGame.getState()
        const s = g.state!
        if (s.phase === 'over') return
        if (s.phase === 'roll') g.dispatch({ type: 'roll' })
        else if (s.phase === 'move') {
          const to = legalSteps(g.ctx, s.players[s.activeIndex]!)[0]
          if (!to) break
          g.dispatch({ type: 'step', to })
        } else if (s.phase === 'konjunktur') g.dispatch({ type: 'drawKonjunktur' })
        else {
          g.dispatch({ type: 'endTurn' })
          break
        }
      }
    }
  }

  it('rebuilds the whole history from the log, not just what happens next', () => {
    playOn('blatt')
    const before = useGame.getState().log
    // Dice, harbours, rounds — a real trail, not two lines.
    expect(before.length).toBeGreaterThan(8)

    // What a reload does.
    useGame.getState().leave()
    expect(useGame.getState().resume()).toBe(true)

    const after = useGame.getState().log
    expect(after.length).toBe(before.length)
    expect(after.map((l) => l.text)).toEqual(before.map((l) => l.text))
    // Newest first, and the credit from the Exportbank at the very bottom.
    expect(after.at(-1)!.text).toMatch(/Exportbank kreditiert/)
    expect(after.some((l) => /würfelt/.test(l.text))).toBe(true)
  })

  it('opens read, so the pill does not cry wolf on every launch', () => {
    playOn('gelesen')
    useGame.getState().leave()
    useGame.getState().resume()

    const { log, newsSeen } = useGame.getState()
    expect(log.length).toBeGreaterThan(8)
    expect(log.filter((l) => l.id > newsSeen)).toHaveLength(0)
  })
})

describe('the two ways out', () => {
  it('leaving keeps the seat, so the code alone brings you back', () => {
    useGame.getState().join('WZUH', 'Tobias')
    // Only the server hands out a token, so stand one in for it.
    localStorage.setItem('vkzk.token.WZUH', 'geheim')

    useGame.getState().leave()

    expect(useGame.getState().net).toBeNull()
    expect(useGame.getState().state).toBeNull()
    // Not walked back into automatically — but the seat is still ours.
    expect(rememberedTable()).toBeNull()
    expect(hasSeatAt('WZUH')).toBe(true)
  })

  it('leaving a game at one device keeps the save', () => {
    useGame.getState().begin(['Ada', 'Bo'], { totalRounds: 20, seed: 'verlassen' })
    useGame.getState().dispatch({ type: 'endTurn' })
    const active = useGame.getState().state!.activeIndex

    useGame.getState().leave()
    expect(useGame.getState().state).toBeNull()

    // "Angefangene Partie fortsetzen" must still find it, at the same point.
    expect(useGame.getState().resume()).toBe(true)
    expect(useGame.getState().state!.activeIndex).toBe(active)
  })

  it('giving up hands the seat back as well', () => {
    useGame.getState().join('WZUH', 'Tobias')
    localStorage.setItem('vkzk.token.WZUH', 'geheim')

    useGame.getState().abandon()

    expect(rememberedTable()).toBeNull()
    expect(hasSeatAt('WZUH')).toBe(false)
  })

  it('giving up a game at one device deletes the save', () => {
    useGame.getState().begin(['Ada'], { totalRounds: 20, seed: 'aufgeben' })
    useGame.getState().abandon()
    expect(useGame.getState().resume()).toBe(false)
  })

  it('does not sail back to an online table after a new local game', () => {
    useGame.getState().join('WZUH', 'Tobias')
    useGame.getState().begin(['Ada'], { totalRounds: 20, seed: 'neu' })
    expect(rememberedTable()).toBeNull()
  })
})
