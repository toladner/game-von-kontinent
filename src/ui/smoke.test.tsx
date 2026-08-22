// @vitest-environment jsdom
import { describe, expect, it, beforeEach, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import App from '@app/App'
import { useGame } from '@app/store'
import { buyOffers, legalSteps, portAt, routeTo } from '@engine/selectors'
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

/**
 * Step past the Makler's welcome, which every arrival opens with.
 *
 * Harmless when it is not showing, so tests that only care about the trading
 * panels can call it after any move without checking first.
 */
function enterHarbour(): void {
  const button = screen.queryByRole('button', { name: 'Hafen betreten' })
  if (button) act(() => { fireEvent.click(button) })
}

/** The single button at the foot of the harbour sheet, whatever it says. */
const footer = () => screen.getByRole('button', { name: /Weiter zu|ablegen|Verkaufszwang/i })
const noFooter = () =>
  screen.queryByRole('button', { name: /Weiter zu|ablegen|Verkaufszwang/i }) === null

/**
 * Follow the Makler to the end of the walk, where departure waits.
 *
 * The harbour is a guided round now: the one button moves you through the
 * panels the Makler thinks are worth seeing, and only the last of them casts
 * off. Tests that just want to be at sea say so with this.
 */
function walkToDeparture(): HTMLElement {
  for (let guard = 0; guard < 6; guard++) {
    const button = footer()
    // The last step is whatever is not another "Weiter zu" — usually Ablegen,
    // but a Verkaufszwang parks a refusal there instead.
    if (!/^Weiter zu /.test(button.textContent ?? '')) return button
    act(() => {
      fireEvent.click(button)
    })
  }
  throw new Error('the Makler never walked us to a last step')
}

describe('the front page', () => {
  it('offers the two modes and walks the classic path to the names', () => {
    render(<App />)
    expect(screen.getByText(/Von Kontinent/)).toBeTruthy()
    expect(screen.getByText('Klassisch')).toBeTruthy()
    expect(screen.getByText('Vollständig')).toBeTruthy()

    fireEvent.click(screen.getByText('Klassisch'))

    const input = screen.getByLabelText('Name der 1. Person') as HTMLInputElement
    expect((screen.getByText('An Bord gehen') as HTMLButtonElement).disabled).toBe(true)

    fireEvent.change(input, { target: { value: 'Tobias' } })

    // Typing a name conjures a face and claims the seat.
    expect(screen.getByText('Spieler 1')).toBeTruthy()
    expect(document.querySelectorAll('svg').length).toBeGreaterThan(0)
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

    // Landfall first: the Makler introduces themselves before the ledgers.
    expect(screen.getByText(/Willkommen in|Wieder daheim in/)).toBeTruthy()
    enterHarbour()

    // Then the harbour proper, with the board drawn behind it.
    expect(footer()).toBeTruthy()
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
    enterHarbour()

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
    enterHarbour()

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
    enterHarbour()

    const svg = board()
    expect(svg).toBeTruthy()

    // The browser routinely cancels a pointer when a second finger lands or
    // the system takes over the gesture. That used to throw and blank the app.
    fireEvent.pointerDown(svg, { pointerId: 1, clientX: 100, clientY: 100 })
    fireEvent.pointerCancel(svg, { pointerId: 1, clientX: 100, clientY: 100 })
    fireEvent.pointerMove(svg, { pointerId: 1, clientX: 220, clientY: 180 })
    fireEvent.pointerUp(svg, { pointerId: 1, clientX: 220, clientY: 180 })

    expect(board()).toBeTruthy()
    expect(footer()).toBeTruthy()
  })

  it('survives two fingers arriving and leaving in any order', () => {
    render(<App />)
    act(() => useGame.getState().begin(['Ada'], { totalRounds: 20, seed: 'pinch' }))
    enterHarbour()
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
    enterHarbour()

    // While the harbour is open, the bar underneath it must not be mounted:
    // it sits at bottom:0 under a sheet that covers the lower half, where it
    // can be seen sliding past but never touched.
    expect(footer()).toBeTruthy()
    expect(screen.queryByText('Hafen öffnen')).toBeNull()
  })

  it('reopens the harbour after the sheet has been dismissed', () => {
    render(<App />)
    act(() => useGame.getState().begin(['Ada', 'Bo'], { totalRounds: 20, seed: 'reopen' }))
    enterHarbour()

    // The harbour opens itself on arrival.
    expect(footer()).toBeTruthy()

    // Drag it away. The harbour opens full, so that is full → peek → gone.
    const dragDown = () => {
      const grip = screen.getAllByLabelText(/Vergrößern|Verkleinern/)[0]!
      fireEvent.pointerDown(grip, { pointerId: 1, clientY: 100 })
      fireEvent.pointerMove(grip, { pointerId: 1, clientY: 400 })
      fireEvent.pointerUp(grip, { pointerId: 1, clientY: 400 })
    }
    dragDown()
    expect(footer()).toBeTruthy()
    dragDown()
    expect(noFooter()).toBe(true)

    // The button that offers it back must actually bring it back.
    const reopen = screen.getByText('Hafen öffnen')
    fireEvent.click(reopen)
    expect(footer()).toBeTruthy()
  })

  it('puts no unstyled wrapper above the screen', () => {
    // The whole layout hangs off height:100%. A wrapper element with
    // height:auto anywhere in the chain collapses it, and the map falls back
    // to its intrinsic aspect ratio — half a screen of dark board.
    const { container } = render(<App />)
    act(() => useGame.getState().begin(['Ada'], { totalRounds: 20, seed: 'chain' }))
    enterHarbour()

    const first = container.firstElementChild as HTMLElement
    expect(first).toBeTruthy()
    expect(first.className).not.toBe('')
    expect(first.className).toMatch(/h-full|board-shell/)
  })

  it('moves the ship when a green dot is tapped', () => {
    render(<App />)
    act(() => useGame.getState().begin(['Ada', 'Bo'], { totalRounds: 20, seed: 'tap' }))
    enterHarbour()
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
    enterHarbour()
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
    enterHarbour()

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
      enterHarbour()
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
    enterHarbour()
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

describe('the Makler on the quay', () => {
  it('greets the merchant, points at the Angebot and gets there in one tap', () => {
    render(<App />)
    act(() => useGame.getState().begin(['Ada', 'Bo'], { totalRounds: 20, seed: 'makler' }))
    enterHarbour()

    // Somebody who works here is standing in the panel, and says something.
    expect(screen.getByText(/Kontormakler(in)?/)).toBeTruthy()
    // The words worth skimming for come through in bold, not as asterisks.
    const bold = [...document.querySelectorAll('strong')].map((e) => e.textContent)
    expect(bold).toContain('Laderaum ist leer')
    expect(document.body.textContent).not.toContain('*')

    // One button at the foot walks the round: hold, then quay.
    expect(footer().textContent).toBe('Weiter zu Angebot')
    act(() => {
      fireEvent.click(footer())
    })
    expect(
      (screen.getByRole('tab', { name: /Angebot/ }) as HTMLElement).getAttribute('aria-selected'),
    ).toBe('true')
  })

  it('makes casting off with an empty hold take a second tap', () => {
    render(<App />)
    act(() => useGame.getState().begin(['Ada', 'Bo'], { totalRounds: 20, seed: 'leer' }))
    enterHarbour()

    const active = () => useGame.getState().state!.activeIndex
    const leave = walkToDeparture()
    expect(leave.textContent).toMatch(/Ohne Ladung ablegen/)
    expect(active()).toBe(0)

    // The first tap warns rather than hands the turn over.
    act(() => {
      fireEvent.click(leave)
    })
    expect(active()).toBe(0)
    expect(footer().textContent).toMatch(/Wirklich/)

    // The second goes through — a warning, never a refusal.
    act(() => {
      fireEvent.click(footer())
    })
    expect(active()).toBe(1)
  })

  it('drops the warning as soon as something is loaded', () => {
    render(<App />)
    act(() => useGame.getState().begin(['Ada'], { totalRounds: 20, seed: 'geladen' }))
    enterHarbour()

    const state = useGame.getState().state!
    const player = state.players[0]!
    const offer = buyOffers(
      useGame.getState().ctx,
      state,
      player,
      portAt(useGame.getState().ctx, flagship(player).nodeId)!,
    ).find((o) => o.status === 'ok')!

    act(() => useGame.getState().dispatch({ type: 'buy', goodId: offer.goodId }))
    expect(walkToDeparture().textContent).toBe('Ablegen')
  })
})

describe('landfall', () => {
  it('shows the Makler alone first, and the ledgers only after stepping ashore', () => {
    render(<App />)
    act(() => useGame.getState().begin(['Ada', 'Bo'], { totalRounds: 20, seed: 'landfall' }))

    // The welcome, and nothing to trade with yet.
    expect(screen.getByText(/Willkommen in|Wieder daheim in/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Hafen betreten' })).toBeTruthy()
    expect(screen.queryByRole('tab', { name: /Angebot/ })).toBeNull()
    expect(noFooter()).toBe(true)

    enterHarbour()

    expect(screen.getByRole('tab', { name: /Angebot/ })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Hafen betreten' })).toBeNull()
  })

  it('does not greet you twice in the same harbour', () => {
    // Meeting the Makler is an arrival, not a panel: closing the sheet and
    // asking for it again mid-visit must not replay the welcome.
    render(<App />)
    act(() => useGame.getState().begin(['Ada', 'Bo'], { totalRounds: 20, seed: 'zweimal' }))
    enterHarbour()

    const dragDown = () => {
      const grip = screen.getAllByLabelText(/Vergrößern|Verkleinern/)[0]!
      fireEvent.pointerDown(grip, { pointerId: 1, clientY: 100 })
      fireEvent.pointerMove(grip, { pointerId: 1, clientY: 400 })
      fireEvent.pointerUp(grip, { pointerId: 1, clientY: 400 })
    }
    dragDown()
    dragDown()
    expect(noFooter()).toBe(true)

    fireEvent.click(screen.getByText('Hafen öffnen'))
    expect(screen.queryByRole('button', { name: 'Hafen betreten' })).toBeNull()
    expect(footer()).toBeTruthy()
  })

  it('greets the next merchant to take the wheel', () => {
    render(<App />)
    act(() => useGame.getState().begin(['Ada', 'Bo'], { totalRounds: 20, seed: 'naechster' }))
    enterHarbour()

    // Ada casts off; Bo is lying in a harbour of their own.
    act(() => useGame.getState().dispatch({ type: 'endTurn' }))
    expect(screen.getByRole('button', { name: 'Hafen betreten' })).toBeTruthy()
  })
})

describe('visual guidance', () => {
  const selected = (name: RegExp) =>
    screen.getByRole('tab', { name }).getAttribute('aria-selected')

  it('always opens the harbour on the hold, whatever the Makler is pointing at', () => {
    render(<App />)
    act(() => useGame.getState().begin(['Ada'], { totalRounds: 20, seed: 'ladung-zuerst' }))
    enterHarbour()

    // The Makler wants the Angebot — the panel still starts where the goods are.
    expect(footer().textContent).toBe('Weiter zu Angebot')
    expect(selected(/Ladung/)).toBe('true')
    expect(selected(/Angebot/)).toBe('false')
  })

  it('gives the leave button its weight only once there is cargo aboard', () => {
    // Primary means "this is the good next step". Sailing empty is neither.
    render(<App />)
    act(() => useGame.getState().begin(['Ada'], { totalRounds: 20, seed: 'gewicht' }))
    enterHarbour()

    // The walk itself is the good next step, so its button carries weight.
    expect(footer().className).toContain('btn-primary')
    expect(walkToDeparture().className).not.toContain('btn-primary')

    const s = useGame.getState().state!
    const gameCtx = useGame.getState().ctx
    const player = s.players[0]!
    const offer = buyOffers(gameCtx, s, player, portAt(gameCtx, flagship(player).nodeId)!).find(
      (o) => o.status === 'ok',
    )!
    act(() => useGame.getState().dispatch({ type: 'buy', goodId: offer.goodId }))

    expect(walkToDeparture().className).toContain('btn-primary')
  })

  it('offers to sell without repeating where you are standing', () => {
    render(<App />)
    act(() => useGame.getState().begin(['Ada'], { totalRounds: 20, seed: 'verkaufen' }))
    enterHarbour()

    const s = useGame.getState().state!
    const gameCtx = useGame.getState().ctx
    const player = s.players[0]!
    const offer = buyOffers(gameCtx, s, player, portAt(gameCtx, flagship(player).nodeId)!).find(
      (o) => o.status === 'ok',
    )!
    act(() => useGame.getState().dispatch({ type: 'buy', goodId: offer.goodId }))

    expect(screen.getByText('verkaufen')).toBeTruthy()
    expect(screen.queryByText('hier verkaufen')).toBeNull()
  })
})

describe('the guided round', () => {
  const tabOf = (name: RegExp) =>
    screen.getByRole('tab', { name }).getAttribute('aria-selected')

  it('walks hold, quay and chart before it will let you sail', () => {
    render(<App />)
    act(() => useGame.getState().begin(['Ada', 'Bo'], { totalRounds: 20, seed: 'rundgang' }))
    enterHarbour()

    // Hold first, and nowhere to plan for yet, so the quay is next.
    expect(tabOf(/Ladung/)).toBe('true')
    expect(footer().textContent).toBe('Weiter zu Angebot')
    act(() => {
      fireEvent.click(footer())
    })
    expect(tabOf(/Angebot/)).toBe('true')

    // Buying gives the cargo somewhere to go, so the chart joins the round.
    const s = useGame.getState().state!
    const gameCtx = useGame.getState().ctx
    const player = s.players[0]!
    const offer = buyOffers(gameCtx, s, player, portAt(gameCtx, flagship(player).nodeId)!).find(
      (o) => o.status === 'ok',
    )!
    act(() => useGame.getState().dispatch({ type: 'buy', goodId: offer.goodId }))

    expect(footer().textContent).toBe('Weiter zu Wohin?')
    act(() => {
      fireEvent.click(footer())
    })
    expect(tabOf(/Wohin/)).toBe('true')
    expect(footer().textContent).toBe('Ablegen')

    act(() => {
      fireEvent.click(footer())
    })
    expect(useGame.getState().state!.activeIndex).toBe(1)
  })

  it('never offers a step that has gone away underfoot', () => {
    // The round is read off the visible tab, not a counter, so buying the
    // harbour out from under the Angebot cannot strand the button on it.
    render(<App />)
    act(() => useGame.getState().begin(['Ada', 'Bo'], { totalRounds: 20, seed: 'unterfuss' }))
    enterHarbour()
    act(() => {
      fireEvent.click(footer())
    })
    expect(tabOf(/Angebot/)).toBe('true')

    for (let i = 0; i < 2; i++) {
      const s = useGame.getState().state!
      const gameCtx = useGame.getState().ctx
      const player = s.players[0]!
      const offer = buyOffers(gameCtx, s, player, portAt(gameCtx, flagship(player).nodeId)!).find(
        (o) => o.status === 'ok',
      )
      if (!offer) break
      act(() => useGame.getState().dispatch({ type: 'buy', goodId: offer.goodId }))
    }

    // The Angebot is spent; the button has moved on rather than sat there.
    expect(footer().textContent).not.toBe('Weiter zu Angebot')
    expect(walkToDeparture().textContent).toBe('Ablegen')
  })

  it('will not walk you to the exit while the Börse wants a sale', () => {
    render(<App />)
    act(() => useGame.getState().begin(['Ada', 'Bo'], { totalRounds: 20, seed: 'zwang-ui' }))
    enterHarbour()

    const s = useGame.getState().state!
    const gameCtx = useGame.getState().ctx
    const player = s.players[0]!
    const offer = buyOffers(gameCtx, s, player, portAt(gameCtx, flagship(player).nodeId)!).find(
      (o) => o.status === 'ok',
    )!
    act(() => useGame.getState().dispatch({ type: 'buy', goodId: offer.goodId }))

    // Tie up where the good is foreign, with the obligation in force — which
    // is what a red field does to a ship carrying somebody else's export.
    act(() => {
      useGame.setState((g) => {
        const state = g.state!
        const p0 = state.players[0]!
        const elsewhere = [...g.ctx.portsById.keys()].find(
          (id) =>
            id !== flagship(p0).nodeId && !g.ctx.exportsOf(id).includes(offer.goodId),
        )!
        return {
          state: {
            ...state,
            mustSellForeign: true,
            players: [
              {
                ...p0,
                fleet: p0.fleet.map((v, i) => (i === 0 ? { ...v, nodeId: elsewhere } : v)),
              },
              ...state.players.slice(1),
            ],
          },
        }
      })
    })
    enterHarbour()

    // The round is still walkable — you may look at the quay and the chart —
    // but its last step will not open until the Börse has its sale.
    const button = walkToDeparture()
    expect(button.textContent).toMatch(/Verkaufszwang/)
    expect((button as HTMLButtonElement).disabled).toBe(true)
  })
})

describe('the round and the tabs are one list', () => {
  const tabs = () => screen.getAllByRole('tab').map((t) => t.textContent?.replace(/\d+$/, ''))

  it('shows a tab for every step of the round and nothing else', () => {
    render(<App />)
    act(() => useGame.getState().begin(['Ada'], { totalRounds: 20, seed: 'listen' }))
    enterHarbour()

    // The same three, always — and Am Kai is gone for good.
    expect(tabs()).toEqual(['Ladung', 'Angebot', 'Wohin?'])
    expect(screen.queryByRole('tab', { name: /Am Kai/ })).toBeNull()
  })

  it('keeps all three tabs when the harbour is spent, and explains itself', () => {
    // The bug this replaces: the tab list and the round were two lists that
    // had to agree. They are one now, and it never shortens — standing on a
    // step that had vanished was what left the foot of the sheet offering a
    // departure from the middle of the round.
    render(<App />)
    act(() => useGame.getState().begin(['Ada', 'Bo'], { totalRounds: 20, seed: 'verbraucht' }))
    enterHarbour()

    for (let i = 0; i < 2; i++) {
      const s = useGame.getState().state!
      const gameCtx = useGame.getState().ctx
      const player = s.players[0]!
      const offer = buyOffers(gameCtx, s, player, portAt(gameCtx, flagship(player).nodeId)!).find(
        (o) => o.status === 'ok',
      )
      if (!offer) break
      act(() => useGame.getState().dispatch({ type: 'buy', goodId: offer.goodId }))
    }

    expect(tabs()).toEqual(['Ladung', 'Angebot', 'Wohin?'])
    expect(footer().textContent).toBe('Weiter zu Angebot')

    // The quay is still a step; it just has bad news.
    act(() => {
      fireEvent.click(footer())
    })
    // The Makler says it, not just the cards.
    expect(document.querySelector('.paper-slip')!.textContent).toMatch(/Ladeschluß/)
    expect(footer().textContent).toBe('Weiter zu Wohin?')
  })

  it('offers a departure only from the last tab of the round', () => {
    render(<App />)
    act(() => useGame.getState().begin(['Ada'], { totalRounds: 20, seed: 'letzter' }))
    enterHarbour()

    const names = tabs()
    for (let i = 0; i < names.length; i++) {
      const last = i === names.length - 1
      const label = footer().textContent ?? ''
      expect(/ablegen/i.test(label), `tab ${names[i]}`).toBe(last)
      if (!last) {
        expect(label, `tab ${names[i]}`).toBe(`Weiter zu ${names[i + 1]}`)
        act(() => {
          fireEvent.click(footer())
        })
      }
    }
  })

  it('keeps the Makler in one colour whatever the news', () => {
    // A voice that turns red when it matters is one you stop reading when it
    // does not, so the slip never changes ink.
    render(<App />)
    act(() => useGame.getState().begin(['Ada'], { totalRounds: 20, seed: 'stimme' }))
    enterHarbour()

    const slip = () => document.querySelector('.paper-slip')!
    // An empty hold is the loudest thing the Makler says.
    act(() => {
      fireEvent.click(footer())
    })
    expect(slip().innerHTML).toContain('text-press')
    expect(slip().innerHTML).not.toContain('text-rot')
  })
})

describe('the sheet on a wide screen', () => {
  it('offers a way to put the rail away', () => {
    // The grip and the collapse arrow are both lg:hidden, so before this the
    // only route to 'closed' was a drag — and a desktop had none. Opening
    // the Kontor left you with no way back to the action bar.
    render(<App />)
    act(() => useGame.getState().begin(['Ada'], { totalRounds: 20, seed: 'schliessen' }))
    enterHarbour()

    const shut = screen.getByRole('button', { name: 'Schließen' })
    expect(shut).toBeTruthy()
    act(() => {
      fireEvent.click(shut)
    })
    expect(screen.queryByRole('tab', { name: /Ladung/ })).toBeNull()
    // And the way back in is offered again.
    expect(screen.getByText('Hafen öffnen')).toBeTruthy()
  })

  it('leaves the height to the stylesheet so the rail can fill its column', () => {
    // An inline height beats any class, which is how the rail came to stand
    // 42% tall against the top of the window instead of floor to ceiling.
    render(<App />)
    act(() => useGame.getState().begin(['Ada'], { totalRounds: 20, seed: 'saeule' }))
    enterHarbour()

    const sheet = document.querySelector('aside.sheet') as HTMLElement
    expect(sheet.style.height).toBe('')
    expect(sheet.style.getPropertyValue('--sheet-h')).toBe('86dvh')
  })

  it('puts the sheet away on Escape', () => {
    render(<App />)
    act(() => useGame.getState().begin(['Ada'], { totalRounds: 20, seed: 'escape' }))
    enterHarbour()

    act(() => {
      fireEvent.keyDown(window, { key: 'Escape' })
    })
    act(() => {
      fireEvent.keyDown(window, { key: 'Escape' })
    })
    expect(screen.queryByRole('tab', { name: /Ladung/ })).toBeNull()
  })
})
