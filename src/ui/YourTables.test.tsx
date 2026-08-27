// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { YourTables } from './YourTables'
import { forgetSeat, knownTables, noteSeat, type KnownTable } from '@app/net'

/**
 * The register of tables this device sits at.
 *
 * What is worth testing here is not the markup but the bookkeeping: a seat
 * token is what makes a table listable, the details are decoration on top of
 * it, and giving one up has to take it off the list and out of storage
 * together — a row that came back on the next reload would be worse than no
 * list at all.
 */

/** A seat, as the Session writes one when the server hands it over. */
function seat(code: string, name: string) {
  localStorage.setItem(`vkzk.token.${code}`, `platz-${code}`)
  noteSeat(code, name)
}

const lookups: Record<string, unknown> = {}

/**
 * Render, and let the lookups settle.
 *
 * Every row asks the server how its table stands, so a bare `render` leaves a
 * promise in flight that resolves after the test has finished — which React
 * reports, correctly, as a state update outside `act()`.
 */
async function show(onOpen: (table: KnownTable) => void = () => {}): Promise<HTMLElement> {
  let container!: HTMLElement
  await act(async () => {
    container = render(<YourTables onOpen={onOpen} />).container
  })
  return container
}

beforeEach(() => {
  localStorage.clear()
  for (const key of Object.keys(lookups)) delete lookups[key]
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const code = url.split('/').pop()!
      const info = lookups[code]
      return info ? { ok: true, json: async () => info } : { ok: false, json: async () => ({}) }
    }),
  )
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('the tables you are sitting at', () => {
  it('shows nothing at all when there are none', async () => {
    expect((await show()).firstChild).toBeNull()
  })

  it('lists a table for every seat this device holds', async () => {
    seat('WZUH', 'Ada')
    seat('KAI7', 'Ada')

    await show()
    expect(screen.getByText('WZUH')).toBeTruthy()
    expect(screen.getByText('KAI7')).toBeTruthy()
  })

  it('puts the table opened most recently at the top', () => {
    vi.useFakeTimers()
    try {
      seat('ALT1', 'Ada')
      vi.advanceTimersByTime(60_000)
      seat('NEU2', 'Ada')
    } finally {
      vi.useRealTimers()
    }

    expect(knownTables().map((table) => table.code)).toEqual(['NEU2', 'ALT1'])
  })

  /**
   * The token is the authority, not the details record. A seat taken before
   * this register existed has no name to show, and dropping it from the list
   * would hide a table the device can still walk into.
   */
  it('lists a seat that has no details written down', async () => {
    localStorage.setItem('vkzk.token.OLD9', 'platz-alt')
    await show()
    expect(screen.getByText('OLD9')).toBeTruthy()
  })

  it('says how the table stands once the server has answered', async () => {
    seat('WZUH', 'Ada')
    lookups['WZUH'] = {
      meta: {},
      phase: 'laufend',
      players: [
        { id: 'a', name: 'Ada', colorIndex: 0, portrait: {} },
        { id: 'b', name: 'Bo', colorIndex: 1, portrait: {} },
      ],
    }

    await show()
    expect(screen.getByText(/2 Häuser am Tisch/)).toBeTruthy()
  })

  it('says so plainly when a table has been reckoned up', async () => {
    seat('ENDE', 'Ada')
    lookups['ENDE'] = { meta: {}, phase: 'over', players: [] }

    await show()
    expect(screen.getByText('abgerechnet')).toBeTruthy()
  })

  it('does not pretend a table is there when the server will not answer', async () => {
    seat('WEG5', 'Ada')
    await show()
    expect(screen.getByText('meldet sich nicht')).toBeTruthy()
  })

  it('hands the whole seat back when a table is opened, code and name', async () => {
    seat('WZUH', 'Ada')
    const opened: string[] = []
    await show((table) => opened.push(`${table.code}:${table.name}`))

    fireEvent.click(screen.getByText('WZUH'))
    expect(opened).toEqual(['WZUH:Ada'])
  })

  it('takes a seat off the list and out of storage together', async () => {
    seat('WZUH', 'Ada')
    seat('KAI7', 'Ada')

    await show()
    // Awaited, because dropping a row shortens the list and the shorter list
    // asks the server again — a promise still in flight when the test ends.
    await act(async () => {
      fireEvent.click(screen.getByLabelText(/WZUH/))
    })

    expect(screen.queryByText('WZUH')).toBeNull()
    expect(screen.getByText('KAI7')).toBeTruthy()
    // And it stays gone: a row that came back on the next reload would be
    // worse than never having listed it.
    expect(knownTables().map((table) => table.code)).toEqual(['KAI7'])
    expect(localStorage.getItem('vkzk.token.WZUH')).toBeNull()
  })

  it('forgets the details along with the token', () => {
    seat('WZUH', 'Ada')
    forgetSeat('WZUH')
    // Re-taking the same code must not resurrect the old name.
    localStorage.setItem('vkzk.token.WZUH', 'platz-neu')
    expect(knownTables()).toEqual([{ code: 'WZUH', name: '' }])
  })
})
