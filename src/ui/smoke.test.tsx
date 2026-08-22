// @vitest-environment jsdom
import { describe, expect, it, beforeEach, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import App from '@app/App'
import { useGame } from '@app/store'
import { legalSteps, portAt, routeTo } from '@engine/selectors'
import { flagship } from '@engine/state'
import { createGame } from '@engine/setup'
import { applyAction, replay } from '@engine/reducer'

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
    expect((screen.getByText('Ganze Welt').closest('button') as HTMLButtonElement).disabled).toBe(
      true,
    )
    expect((screen.getByText('In Echtzeit').closest('button') as HTMLButtonElement).disabled).toBe(
      false,
    )
    // Dauer and Kapital are sliders, not fixed buttons.
    expect((screen.getByLabelText('Runden') as HTMLInputElement).type).toBe('range')
    expect((screen.getByLabelText('Betriebskapital') as HTMLInputElement).type).toBe('range')

    // Choosing real time swaps the round count for a pace and a season.
    fireEvent.click(screen.getByText('In Echtzeit'))
    expect(screen.queryByLabelText('Runden')).toBeNull()
    expect((screen.getByLabelText('Fahrzeit je Punkt') as HTMLInputElement).type).toBe('range')
    expect((screen.getByLabelText('Länge der Saison') as HTMLInputElement).type).toBe('range')
    fireEvent.click(screen.getByText('Mit Würfel'))

    fireEvent.click(screen.getByText('Weiter'))
    expect(
      (screen.getByText('Partie eröffnen').closest('button') as HTMLButtonElement).disabled,
    ).toBe(false)
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
    const portId = portAt(ctx, flagship(before).nodeId)!
    const goodId = ctx.exportsOf(portId)[0]!

    act(() => useGame.getState().dispatch({ type: 'buy', goodId }))

    const after = useGame.getState().state!.players[0]!
    expect(flagship(after).cargo).toHaveLength(1)
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

describe('the lobby', () => {
  it('gathers players before anyone sails', () => {
    render(<App />)
    const ctx = useGame.getState().ctx

    // A table opened by hand: nobody aboard until they join.
    act(() => {
      useGame.setState({ state: createGame(ctx, { seed: 'lobby-seed' }) })
    })
    expect(useGame.getState().state!.phase).toBe('lobby')
    expect(screen.getByText('Am Kai')).toBeTruthy()

    act(() => useGame.getState().dispatch({ type: 'join', playerId: 'a', name: 'Ada' }))
    act(() => useGame.getState().dispatch({ type: 'join', playerId: 'b', name: 'Bo' }))

    const state = useGame.getState().state!
    expect(state.players).toHaveLength(2)
    // Whoever opened the table gives the word.
    expect(state.hostId).toBe('a')
    expect(state.players[0]!.homePort).not.toBe(state.players[1]!.homePort)

    act(() => useGame.getState().dispatch({ type: 'start' }))
    expect(useGame.getState().state!.phase).toBe('port')
  })

  it('turns a latecomer away unless the table allows it', () => {
    const ctx = useGame.getState().ctx
    const shut = replay(ctx, createGame(ctx, { seed: 'shut' }), [
      { type: 'join', playerId: 'a', name: 'Ada' },
      { type: 'start' },
    ])
    expect(applyAction(ctx, shut, { type: 'join', playerId: 'z', name: 'Zoe' }).events[0])
      .toMatchObject({ type: 'rejected' })

    const open = replay(ctx, createGame(ctx, { seed: 'open', joinPolicy: 'jederzeit' }), [
      { type: 'join', playerId: 'a', name: 'Ada' },
      { type: 'start' },
    ])
    const late = applyAction(ctx, open, { type: 'join', playerId: 'z', name: 'Zoe' })
    expect(late.events[0]).toMatchObject({ type: 'playerJoined', midGame: true })
    expect(late.state.players).toHaveLength(2)
    // A latecomer provisions in harbour on their first turn, like everyone.
    expect(late.state.players[1]!.hasDeparted).toBe(false)
    expect(late.state.players[1]!.cash).toBe(late.state.config.startingCapital)
  })
})

describe('real-time play in the interface', () => {
  it('shows a season clock, sails on a tap and reports the voyage', () => {
    render(<App />)
    const ctx = useGame.getState().ctx

    act(() => {
      useGame
        .getState()
        .begin(['Ada'], { travel: 'echtzeit', minutesPerPip: 1, durationHours: 4, seed: 'ui-rt' })
    })

    const state = useGame.getState().state!
    expect(state.phase).toBe('laufend')
    // A clock, not a round track.
    expect(screen.getAllByText('Saison').length).toBeGreaterThan(0)
    expect(screen.getByText(/Kurs zu setzen/)).toBeTruthy()

    const from = flagship(state.players[0]!).nodeId
    const target = [...ctx.portsById.keys()].find(
      (id) => id !== from && routeTo(ctx, from, null, id).length >= 2,
    )!

    act(() => useGame.getState().dispatch({ type: 'setCourse', to: target }))

    const sailing = useGame.getState().state!.players[0]!
    expect(flagship(sailing).voyage).not.toBeNull()
    expect(flagship(sailing).voyage!.destination).toBe(target)
    expect(screen.getByText(new RegExp('Kurs auf'))).toBeTruthy()
    expect(screen.getByText(/Ankunft/)).toBeTruthy()
  })
})

describe('the map on a touch screen', () => {
  const board = () => document.querySelector('svg[aria-label]') as SVGSVGElement

  it('survives a gesture that is cancelled mid-drag', () => {
    render(<App />)
    act(() => useGame.getState().begin(['Ada', 'Bo'], { totalRounds: 20, seed: 'touch' }))

    const svg = board()
    expect(svg).toBeTruthy()

    // The browser routinely cancels a pointer when a second finger lands or
    // the system takes over the gesture. That used to throw and blank the app.
    fireEvent.pointerDown(svg, { pointerId: 1, clientX: 100, clientY: 100 })
    fireEvent.pointerCancel(svg, { pointerId: 1, clientX: 100, clientY: 100 })
    fireEvent.pointerMove(svg, { pointerId: 1, clientX: 220, clientY: 180 })
    fireEvent.pointerUp(svg, { pointerId: 1, clientX: 220, clientY: 180 })

    expect(board()).toBeTruthy()
    expect(screen.getByText('Ablegen')).toBeTruthy()
  })

  it('survives two fingers arriving and leaving in any order', () => {
    render(<App />)
    act(() => useGame.getState().begin(['Ada'], { totalRounds: 20, seed: 'pinch' }))
    const svg = board()

    fireEvent.pointerDown(svg, { pointerId: 1, clientX: 100, clientY: 100 })
    fireEvent.pointerDown(svg, { pointerId: 2, clientX: 200, clientY: 200 })
    fireEvent.pointerMove(svg, { pointerId: 2, clientX: 260, clientY: 260 })
    // The first finger leaves while the second stays down.
    fireEvent.pointerUp(svg, { pointerId: 1, clientX: 100, clientY: 100 })
    fireEvent.pointerMove(svg, { pointerId: 2, clientX: 280, clientY: 280 })
    fireEvent.pointerCancel(svg, { pointerId: 2, clientX: 280, clientY: 280 })
    // A stray move from a pointer nobody is tracking must be ignored.
    fireEvent.pointerMove(svg, { pointerId: 9, clientX: 10, clientY: 10 })

    expect(board()).toBeTruthy()
  })

  it('never leaves an action button stranded behind the sheet', () => {
    render(<App />)
    act(() => useGame.getState().begin(['Ada', 'Bo'], { totalRounds: 20, seed: 'layer' }))

    // While the harbour is open, the bar underneath it must not be mounted:
    // it sits at bottom:0 under a sheet that covers the lower half, where it
    // can be seen sliding past but never touched.
    expect(screen.getByText('Ablegen')).toBeTruthy()
    expect(screen.queryByText('Hafen öffnen')).toBeNull()
  })

  it('reopens the harbour after the sheet has been dismissed', () => {
    render(<App />)
    act(() => useGame.getState().begin(['Ada', 'Bo'], { totalRounds: 20, seed: 'reopen' }))

    // The harbour opens itself on arrival.
    expect(screen.getByText('Ablegen')).toBeTruthy()

    // Drag it away.
    const grip = screen.getAllByLabelText(/Vergrößern|Verkleinern/)[0]!
    fireEvent.pointerDown(grip, { pointerId: 1, clientY: 100 })
    fireEvent.pointerMove(grip, { pointerId: 1, clientY: 400 })
    fireEvent.pointerUp(grip, { pointerId: 1, clientY: 400 })
    expect(screen.queryByText('Ablegen')).toBeNull()

    // The button that offers it back must actually bring it back.
    const reopen = screen.getByText('Hafen öffnen')
    fireEvent.click(reopen)
    expect(screen.getByText('Ablegen')).toBeTruthy()
  })

  it('puts no unstyled wrapper above the screen', () => {
    // The whole layout hangs off height:100%. A wrapper element with
    // height:auto anywhere in the chain collapses it, and the map falls back
    // to its intrinsic aspect ratio — half a screen of dark board.
    const { container } = render(<App />)
    act(() => useGame.getState().begin(['Ada'], { totalRounds: 20, seed: 'chain' }))

    const first = container.firstElementChild as HTMLElement
    expect(first).toBeTruthy()
    expect(first.className).not.toBe('')
    expect(first.className).toMatch(/h-full|board-shell/)
  })

  it('moves the ship when a green dot is tapped', () => {
    render(<App />)
    act(() => useGame.getState().begin(['Ada', 'Bo'], { totalRounds: 20, seed: 'tap' }))
    act(() => useGame.getState().dispatch({ type: 'endTurn' }))
    act(() => useGame.getState().dispatch({ type: 'endTurn' }))
    act(() => useGame.getState().dispatch({ type: 'roll' }))

    const before = useGame.getState().state!
    expect(before.phase).toBe('move')
    const remaining = before.movement!.remaining
    const wasAt = flagship(before.players[before.activeIndex]!).nodeId

    // A plain tap on the surface. This used to do nothing on a touch screen:
    // the surface held a pointer capture, so the dot's own handler never ran.
    const svg = board()
    fireEvent.pointerDown(svg, { pointerId: 1, clientX: 160, clientY: 240 })
    fireEvent.pointerUp(svg, { pointerId: 1, clientX: 160, clientY: 240 })

    const after = useGame.getState().state!
    expect(after.movement?.remaining ?? 0).toBe(remaining - 1)
    expect(flagship(after.players[after.activeIndex]!).nodeId).not.toBe(wasAt)
  })

  it('ignores a tap that was really a drag', () => {
    render(<App />)
    act(() => useGame.getState().begin(['Ada', 'Bo'], { totalRounds: 20, seed: 'drag' }))
    act(() => useGame.getState().dispatch({ type: 'endTurn' }))
    act(() => useGame.getState().dispatch({ type: 'endTurn' }))
    act(() => useGame.getState().dispatch({ type: 'roll' }))
    const remaining = useGame.getState().state!.movement!.remaining

    const svg = board()
    fireEvent.pointerDown(svg, { pointerId: 1, clientX: 100, clientY: 100 })
    fireEvent.pointerMove(svg, { pointerId: 1, clientX: 260, clientY: 210 })
    fireEvent.pointerUp(svg, { pointerId: 1, clientX: 260, clientY: 210 })

    // Panning the plan must never be mistaken for an order.
    expect(useGame.getState().state!.movement!.remaining).toBe(remaining)
  })

  it('shows the plan through a viewBox shaped like the screen, never letterboxed', () => {
    render(<App />)
    act(() => useGame.getState().begin(['Ada', 'Bo'], { totalRounds: 20, seed: 'focus' }))

    const svg = board()
    // 'slice' covers the container; the default 'meet' would leave dead bands
    // above and below on a tall telephone.
    expect(svg.getAttribute('preserveAspectRatio')).toBe('xMidYMid slice')
    const box = svg.getAttribute('viewBox')!.split(' ').map(Number)
    expect(box).toHaveLength(4)
    expect(box.every((n) => Number.isFinite(n))).toBe(true)
  })

  it('recentres on the ship when the turn passes', () => {
    vi.useFakeTimers()
    try {
      render(<App />)
      act(() => useGame.getState().begin(['Ada', 'Bo'], { totalRounds: 20, seed: 'focus' }))
      act(() => {
        vi.advanceTimersByTime(800)
      })
      const before = board().getAttribute('viewBox')

      act(() => useGame.getState().dispatch({ type: 'endTurn' }))
      act(() => {
        vi.advanceTimersByTime(800)
      })

      // Bo's harbour is elsewhere, so the camera must have travelled.
      expect(board().getAttribute('viewBox')).not.toBe(before)
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('Sicht realistisch in the interface', () => {
  it('draws a distant ship as a belief and offers a pigeon', () => {
    render(<App />)
    const ctx = useGame.getState().ctx

    act(() =>
      useGame.getState().begin(['Ada'], {
        travel: 'echtzeit',
        sicht: 'realistisch',
        minutesPerPip: 1,
        durationHours: 6,
        // Choosing "realistisch" in the setup opens the yards for the same
        // reason: a captain over the horizon needs a second ship to be on.
        maxFleetSize: 2,
        seed: 'fog-ui',
      }),
    )
    act(() => useGame.getState().dispatch({ type: 'buyVehicle', kindId: 'kuestenschoner' }))

    const truth = useGame.getState().truth!
    const schooner = truth.players[0]!.fleet[1]!
    const home = truth.players[0]!.fleet[0]!.nodeId
    const away = [...ctx.portsById.keys()].find(
      (id) => id !== home && routeTo(ctx, home, null, id).length >= 3,
    )!

    act(() =>
      useGame.getState().dispatch({ type: 'setCourse', vehicleId: schooner.id, to: away }),
    )
    act(() =>
      useGame.getState().dispatch({ type: 'tick', at: truth.now + 60 * 60_000 }),
    )

    // The truth: she has arrived. The view: Ada has heard nothing.
    const after = useGame.getState().truth!
    const seen = useGame.getState().state!
    expect(after.players[0]!.fleet[1]!.nodeId).toBe(away)
    expect(seen.players[0]!.fleet[1]!.unseen).toBe(true)
    expect(seen.players[0]!.fleet[1]!.nodeId).not.toBe(away)

    // The fleet register says so in as many words, and offers a bird.
    fireEvent.click(screen.getByLabelText(/^Flotte:/))
    expect(screen.getByText(/Zuletzt gemeldet/)).toBeTruthy()
    expect(screen.getByText('Taube schicken')).toBeTruthy()

    fireEvent.click(screen.getByText('Taube schicken'))
    expect(screen.getByText('Brieftaube')).toBeTruthy()
    expect(screen.getByLabelText('Adressiert an')).toBeTruthy()
    expect(screen.getByText(/Ob die Taube ankommt, erfahren Sie nicht/)).toBeTruthy()
  })

  it('keeps a notebook because nothing else remembers', () => {
    render(<App />)
    act(() =>
      useGame.getState().begin(['Ada'], {
        travel: 'echtzeit',
        sicht: 'realistisch',
        minutesPerPip: 1,
        seed: 'note-ui',
      }),
    )

    fireEvent.click(screen.getByLabelText(/^Flotte:/))
    fireEvent.click(screen.getByText('Notizbuch'))

    const pad = screen.getByLabelText('Notizbuch') as HTMLTextAreaElement
    fireEvent.change(pad, { target: { value: 'Stella nach Dakar, Taube 14:25' } })
    fireEvent.click(screen.getByText('Eintragen'))

    expect(useGame.getState().state!.players[0]!.knowledge.notebook).toBe(
      'Stella nach Dakar, Taube 14:25',
    )
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
