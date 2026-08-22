// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import App from '@app/App'
import { useGame } from '@app/store'
import { legalSteps, portAt } from '@engine/selectors'

/**
 * A stand-in for looking at the thing: boots the real app, walks the real
 * store through a turn, and fails loudly if any component throws while
 * rendering the board, the harbour or the final reckoning.
 */

beforeEach(() => {
  cleanup()
  localStorage.clear()
  useGame.getState().abandon()
})

describe('the front page', () => {
  it('renders the title and takes a name', () => {
    render(<App />)
    expect(screen.getByText(/Von Kontinent/)).toBeTruthy()

    const input = screen.getByLabelText('Name des 1. Kaufmanns') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'Tobias' } })

    // Typing a name conjures a trading house on the spot.
    expect(screen.getByText(/aus /)).toBeTruthy()
    expect((screen.getByText('An Bord gehen') as HTMLButtonElement).disabled).toBe(false)
  })
})

describe('the board', () => {
  it('draws the plan, the harbour and a full turn without throwing', () => {
    render(<App />)

    act(() => {
      useGame.getState().begin(['Ada', 'Bo'], 20, 'smoke-seed')
    })

    // Starts in harbour: the port panel and its quay characters are up.
    expect(screen.getByText('Ablegen')).toBeTruthy()
    expect(screen.getByText(/Ausfuhrgüter dieses Landes/)).toBeTruthy()
    expect(document.querySelector('svg[aria-label]')).toBeTruthy()

    // Both players provision, then the first one puts to sea.
    act(() => useGame.getState().dispatch({ type: 'endTurn' }))
    act(() => useGame.getState().dispatch({ type: 'endTurn' }))
    expect(useGame.getState().state!.phase).toBe('roll')

    act(() => useGame.getState().dispatch({ type: 'roll' }))
    expect(screen.getAllByText(/Punkte/).length).toBeGreaterThan(0)

    // Sail the whole throw.
    for (let guard = 0; guard < 8; guard++) {
      const s = useGame.getState().state!
      if (s.phase !== 'move') break
      const ctx = useGame.getState().ctx
      const player = s.players[s.activeIndex]!
      const to = legalSteps(ctx, player)[0]!
      act(() => useGame.getState().dispatch({ type: 'step', to }))
    }

    const after = useGame.getState().state!
    expect(after.movement).toBeNull()
    expect(['port', 'konjunktur', 'endOfTurn']).toContain(after.phase)
  })

  it('shows a buy as a change of cash and cargo', () => {
    render(<App />)
    act(() => useGame.getState().begin(['Ada'], 20, 'buy-seed'))

    const before = useGame.getState().state!.players[0]!
    const ctx = useGame.getState().ctx
    const portId = portAt(ctx, before.ship.nodeId)!
    const goodId = ctx.exportsOf(portId)[0]!

    act(() => useGame.getState().dispatch({ type: 'buy', goodId }))

    const after = useGame.getState().state!.players[0]!
    expect(after.cargo).toHaveLength(1)
    expect(after.cash).toBeLessThan(before.cash)
    expect(screen.getByText(/Ihre Ladung/)).toBeTruthy()
  })

  it('reaches the final reckoning and ranks the houses', () => {
    render(<App />)
    act(() => useGame.getState().begin(['Ada', 'Bo'], 1, 'end-seed'))

    // One-round game: both provision, and the wrap past the last round settles up.
    act(() => useGame.getState().dispatch({ type: 'endTurn' }))
    act(() => useGame.getState().dispatch({ type: 'endTurn' }))

    expect(useGame.getState().state!.phase).toBe('over')
    expect(screen.getByText(/Wer hat den Handel gemacht/)).toBeTruthy()
  })
})

describe('saving', () => {
  it('resumes a game from the action log alone', () => {
    render(<App />)
    act(() => useGame.getState().begin(['Ada', 'Bo'], 20, 'resume-seed'))
    act(() => useGame.getState().dispatch({ type: 'endTurn' }))
    const expected = useGame.getState().state!

    act(() => {
      useGame.setState({ state: null })
    })
    let ok = false
    act(() => {
      ok = useGame.getState().resume()
    })

    expect(ok).toBe(true)
    expect(useGame.getState().state!.activeIndex).toBe(expected.activeIndex)
    expect(useGame.getState().state!.players[0]!.cash).toBe(expected.players[0]!.cash)
  })
})
