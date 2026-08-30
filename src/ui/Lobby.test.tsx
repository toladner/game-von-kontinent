// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import App from '@app/App'
import { useGame } from '@app/store'
import { hasSeatAt, knownTables, type TableSettings } from '@app/net'
import { createGame, openingActions } from '@engine/setup'
import { replay } from '@engine/reducer'

/**
 * The quayside, and the one way off it.
 *
 * The lobby has a single button at the foot of it, and for a while that button
 * said »Verlassen« and did something else: it gave the seat up. Nothing on the
 * screen said so, nothing asked twice, and what it cost was invisible until
 * later — the table was struck off the entrance page, the app no longer walked
 * back into it, and coming back meant a second seat under the same name beside
 * the first. A game waiting to cast off is precisely the one a player steps
 * away from, so this was the exit most likely to be taken.
 *
 * In the game proper the two are kept well apart: »Zum Titelbild« puts the
 * game down, »Partie aufgeben« is red and asks again. The quayside gets the
 * mild one, which is what its label always promised.
 */

/** The lobby of a networked table, seated but not yet cast off. */
function atTheQuay(code: string) {
  localStorage.setItem(`vkzk.token.${code}`, `platz-${code}`)
  const ctx = useGame.getState().ctx
  const state = replay(
    ctx,
    // Terms that are nobody's default — neither the form's nor the plan's —
    // so a form filled in from anywhere but this table shows it at once.
    createGame(ctx, { seed: code, totalRounds: 65, startingCapital: 750_000 }),
    // The joins only: `openingActions` ends with the start that would take
    // the table off the quay, which is the one thing this test needs unsent.
    openingActions(['Ada', 'Bo']).filter((a) => a.type !== 'start'),
  )
  useGame.setState({
    state,
    truth: null,
    net: { code, status: 'verbunden', playerId: 'p1', online: [] },
  })
}

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

it('keeps the seat when the quayside is left, so the table stays on the entrance page', async () => {
  atTheQuay('N76K')
  render(<App />)

  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Verlassen' }))
  })

  expect(useGame.getState().state, 'the lobby should have been left').toBeNull()
  expect(hasSeatAt('N76K'), 'the seat token').toBe(true)
  expect(knownTables().map((table) => table.code)).toEqual(['N76K'])
})

/**
 * Changing the terms before the first die.
 *
 * A table is set before anybody has arrived, which is the worst moment to
 * settle it: the third player turns up, says an hour a pip is a week of
 * waiting, and the only answer used to be a fresh table and a fresh code.
 * Nothing was ever stopping it — the settings are not in the log, they are the
 * ground the log is replayed on, and a log holding nothing but arrivals can be
 * moved onto new ground without anything on it falling over.
 */

/** Catch what the quayside would send the server, without a socket. */
function watchSettings(): TableSettings[] {
  const sent: TableSettings[] = []
  useGame.setState({ reconfigure: (settings) => void sent.push(settings) })
  return sent
}

it('lets the house that opened the table change its terms', async () => {
  atTheQuay('N76K')
  const sent = watchSettings()
  render(<App />)

  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Bedingungen ändern' }))
  })
  // The form arrives filled in from the table as it stands, not from the
  // defaults: the first field the host does not touch must not change.
  const rounds = screen.getByLabelText('Runden') as HTMLInputElement
  expect(rounds.value).toBe('65')

  await act(async () => {
    fireEvent.change(rounds, { target: { value: '40' } })
  })
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Übernehmen' }))
  })

  expect(sent).toHaveLength(1)
  expect(sent[0]!.totalRounds).toBe(40)
  // And everything he left alone went along untouched.
  expect(sent[0]!.startingCapital).toBe(750_000)
  expect(sent[0]!.travel).toBe('runde')
})

it('throws the draft away when it is discarded', async () => {
  atTheQuay('N76K')
  const sent = watchSettings()
  render(<App />)

  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Bedingungen ändern' }))
  })
  await act(async () => {
    fireEvent.change(screen.getByLabelText('Runden'), { target: { value: '80' } })
  })
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Verwerfen' }))
  })

  expect(sent, 'a discarded draft is nobody else’s business').toHaveLength(0)
  expect(screen.queryByLabelText('Runden')).toBeNull()
})

it('offers the terms to nobody but the host', async () => {
  atTheQuay('N76K')
  // The second house at the table: seated, but it did not open it.
  useGame.setState((s) => ({ net: { ...s.net!, playerId: 'p2' } }))
  render(<App />)

  expect(screen.queryByRole('button', { name: 'Bedingungen ändern' })).toBeNull()
})

/**
 * The way back in, written down where the table can read it.
 *
 * The person who has lost a seat cannot see this screen — losing it is what
 * took them off it — so the note is for the houses still at the table to pass
 * on. It stands rather than appearing when a dot goes dark: a dot goes dark
 * whenever a telephone locks, and an instruction raised each time would read
 * as an alarm about something that mends itself.
 */
it('tells the table how a lost seat is taken back', () => {
  atTheQuay('N76K')
  render(<App />)

  expect(screen.getByText(/demselben Namen wie beim ersten Mal/)).toBeTruthy()
})

it('says nothing about seats at a table that has none to lose', () => {
  atTheQuay('N76K')
  // One device, one room, no code: nothing here is held by a token.
  useGame.setState({ net: null })
  render(<App />)

  expect(screen.queryByText(/demselben Namen wie beim ersten Mal/)).toBeNull()
})

/**
 * Which of these houses is mine.
 *
 * Five portraits in five colours read as five strangers. The colour seal only
 * helps once you know your own colour, which is the thing you came to the
 * register to find out — so the row says so in words as well as in ink.
 */
it('marks the reader’s own house in the register', () => {
  atTheQuay('N76K')
  render(<App />)

  const rows = screen.getAllByRole('listitem')
  const [first, second] = rows
  expect(rows).toHaveLength(2)
  // p1 is this device's seat; Ada holds it, Bo does not.
  expect(first!.textContent).toContain('Ada')
  expect(first!.textContent).toContain('Ihr Haus')
  expect(second!.textContent).toContain('Bo')
  expect(second!.textContent).not.toContain('Ihr Haus')
})

it('marks nobody’s house at a table played round one device', () => {
  atTheQuay('N76K')
  useGame.setState({ net: null })
  render(<App />)

  expect(screen.queryByText('Ihr Haus')).toBeNull()
})
