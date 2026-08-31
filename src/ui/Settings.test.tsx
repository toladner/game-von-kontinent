// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { SettingsSheet } from './Settings'
import { useGame } from '@app/store'
import type { TableSettings } from '@app/net'
import { createGame, openingActions } from '@engine/setup'
import { replay } from '@engine/reducer'
import type { GameState } from '@engine/state'

/**
 * Changing a term after the ships have sailed.
 *
 * This was the lobby's business alone, on the reasoning that a table already
 * at sea cannot have its rules moved under it. The reasoning proves less than
 * it was taken to prove: a term that changes what a past action *meant*
 * rewrites the season, and a term that bears only on what is still to come
 * does not. The server folds the log both ways and compares, so the host may
 * ask — and this is the door they ask through.
 */

/** A table under way, with this device holding the host's seat. */
function underWay(): GameState {
  const ctx = useGame.getState().ctx
  const state = replay(
    ctx,
    createGame(ctx, { seed: 'terms', maxFleetSize: 3 }),
    openingActions(['Ada', 'Bo']),
  )
  useGame.setState({
    state,
    truth: null,
    net: { code: 'TERM', status: 'verbunden', playerId: state.hostId, online: [] },
  })
  return state
}

const sheet = (state: GameState, net = useGame.getState().net) =>
  render(
    <SettingsSheet
      state={state}
      net={net}
      snap="full"
      onSnap={() => {}}
      onLeave={() => {}}
      onAbandon={() => {}}
    />,
  )

beforeEach(() => {
  cleanup()
  localStorage.clear()
  useGame.getState().abandon()
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response('{}', { status: 404 })),
  )
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

it('lets the host reach the terms once the table has sailed', () => {
  const state = underWay()
  expect(state.phase).not.toBe('lobby')
  sheet(state)

  // Said before the form is opened rather than after the server refuses: a
  // form that mostly bounces teaches nobody anything.
  expect(screen.getByText(/nur das Kommende betrifft/)).toBeTruthy()
  fireEvent.click(screen.getByText('Bedingungen ändern'))
  // The form itself, with its own two buttons and the fleet slider in it.
  expect(screen.getByText('Übernehmen')).toBeTruthy()
  expect(screen.getAllByText(/Schiffe/).length).toBeGreaterThan(0)
})

it('hands the change to the table, not to this device alone', () => {
  const state = underWay()
  const sent: TableSettings[] = []
  useGame.setState({ reconfigure: (settings) => void sent.push(settings) })

  sheet(state)
  fireEvent.click(screen.getByText('Bedingungen ändern'))
  fireEvent.click(screen.getByText('Übernehmen'))

  expect(sent).toHaveLength(1)
  // Read off the table it is standing on, so a form nobody touched asks for
  // the terms already in force rather than the form's own defaults.
  expect(sent[0]!.maxFleetSize).toBe(3)
})

it('offers it to nobody but the host', () => {
  const state = underWay()
  sheet(state, { code: 'TERM', status: 'verbunden', playerId: 'nicht-der-wirt', online: [] })
  expect(screen.queryByText('Bedingungen ändern')).toBeNull()
})

it('says nothing about terms at a table played round one device', () => {
  // No wire, no host, nobody to be surprised by it — and the settings are
  // whatever was chosen on the way in.
  const state = underWay()
  useGame.setState({ net: null })
  sheet(state, null)
  expect(screen.queryByText('Bedingungen ändern')).toBeNull()
})
