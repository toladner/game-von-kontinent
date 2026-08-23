// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { CLASSIC_PACK } from '@content/maps/classic'
import { createContext } from '@engine/context'
import { createGame } from '@engine/setup'
import { applyAction, replay } from '@engine/reducer'
import { portAt, routeTo } from '@engine/selectors'
import { flagship, type GameState } from '@engine/state'
import { useArrivalNotice } from './useArrivalNotice'

const ctx = createContext(CLASSIC_PACK)
const T0 = 1_800_000_000_000

/** A running real-time table with Ada's ship under way. */
function underWay(): GameState {
  const s = replay(ctx, createGame(ctx, { seed: 'melde', travel: 'echtzeit', minutesPerPip: 6 }), [
    { type: 'tick', at: T0 },
    { type: 'join', playerId: 'a', name: 'Ada' },
    { type: 'join', playerId: 'b', name: 'Bo' },
    { type: 'start' },
  ])
  const from = flagship(s.players[0]!).nodeId
  const target = [...ctx.portsById.keys()].find((id) => {
    if (id === portAt(ctx, from)) return false
    const route = routeTo(ctx, from, null, id)
    return route.length >= 2 && route.length <= 5
  })!
  return applyAction(ctx, s, { type: 'setCourse', to: target, by: 'a' }).state
}

function Harness({ state, enabled }: { state: GameState; enabled: boolean }) {
  useArrivalNotice(ctx, state, state.players[0]!, enabled)
  return null
}

const shown: string[] = []

beforeEach(() => {
  shown.length = 0
  vi.useFakeTimers()
  vi.setSystemTime(T0)
  class FakeNotification {
    static permission: NotificationPermission = 'granted'
    static requestPermission = async () => 'granted'
    constructor(title: string) {
      shown.push(title)
    }
  }
  ;(globalThis as { Notification?: unknown }).Notification = FakeNotification
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
  delete (globalThis as { Notification?: unknown }).Notification
})

describe('telling a player their ship has arrived', () => {
  it('says nothing before the ship is due', async () => {
    const state = underWay()
    render(<Harness state={state} enabled />)
    await vi.advanceTimersByTimeAsync(60_000)
    expect(shown).toEqual([])
  })

  it('speaks up when she makes port', async () => {
    const state = underWay()
    render(<Harness state={state} enabled />)
    // Well past any plausible voyage on this map at six minutes to the pip.
    await vi.advanceTimersByTimeAsync(6 * 60 * 60_000)
    expect(shown).toEqual(['Schiff eingelaufen'])
  })

  it('stays quiet while the player is watching it happen', async () => {
    // A notification for something on screen in front of them is noise.
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
    render(<Harness state={underWay()} enabled />)
    await vi.advanceTimersByTimeAsync(6 * 60 * 60_000)
    expect(shown).toEqual([])
  })

  it('stays quiet in round play, where nothing moves unasked', async () => {
    render(<Harness state={underWay()} enabled={false} />)
    await vi.advanceTimersByTimeAsync(6 * 60 * 60_000)
    expect(shown).toEqual([])
  })

  it('drops the timer when the voyage is called off', async () => {
    const state = underWay()
    const view = render(<Harness state={state} enabled />)
    // Back in harbour with no course set: nothing left to announce.
    const idle: GameState = {
      ...state,
      players: [
        {
          ...state.players[0]!,
          fleet: state.players[0]!.fleet.map((v, i) => (i === 0 ? { ...v, voyage: null } : v)),
        },
        ...state.players.slice(1),
      ],
    }
    view.rerender(<Harness state={idle} enabled />)
    await vi.advanceTimersByTimeAsync(6 * 60 * 60_000)
    expect(shown).toEqual([])
  })

  it('announces an arrival once, not once per re-render', async () => {
    const state = underWay()
    const view = render(<Harness state={state} enabled />)
    for (let i = 0; i < 5; i++) view.rerender(<Harness state={state} enabled />)
    await vi.advanceTimersByTimeAsync(6 * 60 * 60_000)
    expect(shown).toEqual(['Schiff eingelaufen'])
  })

  it('says nothing about a voyage that finished while the page was away', async () => {
    // The state already shows her alongside; announcing it after the fact
    // would be telling somebody news they are looking straight at.
    const state = underWay()
    vi.setSystemTime(T0 + 12 * 60 * 60_000)
    render(<Harness state={state} enabled />)
    await vi.advanceTimersByTimeAsync(60 * 60_000)
    expect(shown).toEqual([])
  })
})
