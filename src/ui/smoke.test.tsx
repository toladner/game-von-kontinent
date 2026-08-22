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
  it('offers the two modes and walks the classic path to the names', () => {
    render(<App />)
    expect(screen.getByText(/Von Kontinent/)).toBeTruthy()
    expect(screen.getByText('Klassisch')).toBeTruthy()
    expect(screen.getByText('Vollständig')).toBeTruthy()

    fireEvent.click(screen.getByText('Klassisch'))

    const input = screen.getByLabelText('Name des 1. Kaufmanns') as HTMLInputElement
    expect((screen.getByText('An Bord gehen') as HTMLButtonElement).disabled).toBe(true)

    fireEvent.change(input, { target: { value: 'Tobias' } })

    // Typing a name conjures a trading house on the spot.
    expect(screen.getByText(/Kontor|Reederei|Handelshaus|& Söhne|& Co\.|Compagnie|Überseehandel/)).toBeTruthy()
    expect((screen.getByText('An Bord gehen') as HTMLButtonElement).disabled).toBe(false)
  })

  it('opens the option page on the full path', () => {
    render(<App />)
    fireEvent.click(screen.getByText('Vollständig'))
    expect(screen.getByText('Spielplan')).toBeTruthy()
    expect(screen.getByText('Originalplan')).toBeTruthy()
    // Unbuilt features are shown, but never offered as working buttons.
    expect((screen.getByText('In Echtzeit').closest('button') as HTMLButtonElement).disabled).toBe(
      true,
    )
    fireEvent.click(screen.getByText('Weiter'))
    expect(
      (screen.getByText('Partie eröffnen').closest('button') as HTMLButtonElement).disabled,
    ).toBe(true)
    expect(
      (screen.getByText('An einem Gerät').closest('button') as HTMLButtonElement).disabled,
    ).toBe(false)
  })
})

describe('the board', () => {
  it('draws the plan, the harbour and a full turn without throwing', () => {
    render(<App />)

    act(() => {
      useGame.getState().begin(['Ada', 'Bo'], { totalRounds: 20, seed: 'smoke-seed' })
    })

    // Starts in harbour: the sheet is open and the board is drawn behind it.
    expect(screen.getByText('Ablegen')).toBeTruthy()
    expect(screen.getByText('Angebot')).toBeTruthy()
    expect(document.querySelector('svg[aria-label]')).toBeTruthy()
    // The HUD answers "who am I and what can I spend" at all times.
    expect(screen.getAllByText(/Posten an Bord|Laderaum leer/).length).toBeGreaterThan(0)

    // Both players provision, then the first one puts to sea.
    act(() => useGame.getState().dispatch({ type: 'endTurn' }))
    act(() => useGame.getState().dispatch({ type: 'endTurn' }))
    expect(useGame.getState().state!.phase).toBe('roll')

    act(() => useGame.getState().dispatch({ type: 'roll' }))
    expect(screen.getByText(/grünen Punkt antippen/)).toBeTruthy()

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
    act(() => useGame.getState().begin(['Ada'], { totalRounds: 20, seed: 'buy-seed' }))

    const before = useGame.getState().state!.players[0]!
    const ctx = useGame.getState().ctx
    const portId = portAt(ctx, before.ship.nodeId)!
    const goodId = ctx.exportsOf(portId)[0]!

    act(() => useGame.getState().dispatch({ type: 'buy', goodId }))

    const after = useGame.getState().state!.players[0]!
    expect(after.cargo).toHaveLength(1)
    expect(after.cash).toBeLessThan(before.cash)
    expect(screen.getAllByText('Ladung').length).toBeGreaterThan(0)
    // The hold is drawn as crates, one per posten, stencilled with the card number.
    expect(document.querySelectorAll(`svg[aria-label="${ctx.goodsById.get(goodId)!.name}"]`).length)
      .toBeGreaterThan(0)
  })

  it('reaches the final reckoning and ranks the houses', () => {
    render(<App />)
    act(() => useGame.getState().begin(['Ada', 'Bo'], { totalRounds: 1, seed: 'end-seed' }))

    // One-round game: both provision, and the wrap past the last round settles up.
    act(() => useGame.getState().dispatch({ type: 'endTurn' }))
    act(() => useGame.getState().dispatch({ type: 'endTurn' }))

    expect(useGame.getState().state!.phase).toBe('over')
    expect(screen.getByText(/Wer hat den Handel gemacht/)).toBeTruthy()
    expect(screen.getByText('Schlußabrechnung')).toBeTruthy()
  })
})

describe('saving', () => {
  it('resumes a game from the action log alone', () => {
    render(<App />)
    act(() => useGame.getState().begin(['Ada', 'Bo'], { totalRounds: 20, seed: 'resume-seed' }))
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
