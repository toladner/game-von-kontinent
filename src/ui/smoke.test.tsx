// @vitest-environment jsdom
import { describe, expect, it, beforeEach, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import App from '@app/App'
import { PLAYER_COLORS, useGame } from '@app/store'
import { buyOffers, legalSteps, portAt, routeTo } from '@engine/selectors'
import { flagship } from '@engine/state'
import { createGame } from '@engine/setup'
import { applyAction, replay } from '@engine/reducer'
import { CLASSIC_PACK } from '@content/maps/classic'
import { KonjunkturSlip } from './Cards'
import { HouseBadge } from './GameScreen'

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
const footer = () =>
  screen.getByRole('button', { name: /Weiter zu|ablegen|Verkaufszwang|Karte wählen/i })
const noFooter = () =>
  screen.queryByRole('button', {
    name: /Weiter zu|ablegen|Verkaufszwang|Karte wählen/i,
  }) === null

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
    expect(screen.getByText('Erweitert')).toBeTruthy()

    fireEvent.click(screen.getByText('Klassisch'))

    const input = screen.getByLabelText('Name der 1. Person') as HTMLInputElement
    expect((screen.getByText('An Bord gehen') as HTMLButtonElement).disabled).toBe(true)

    fireEvent.change(input, { target: { value: 'Tobias' } })

    // Typing a name conjures a face and claims the seat.
    expect(screen.getByText('Spieler 1')).toBeTruthy()
    expect(document.querySelectorAll('svg').length).toBeGreaterThan(0)
    expect((screen.getByText('An Bord gehen') as HTMLButtonElement).disabled).toBe(false)
  })

  /** Open a dropdown and pick the option with this label. */
  const opener = (control: string) => screen.getByRole('button', { name: control })
  const choose = (control: string, option: string) => {
    fireEvent.click(opener(control))
    const list = screen.getByRole('listbox', { name: control })
    const row = [...list.querySelectorAll('button')].find((b) =>
      (b.textContent ?? '').includes(option),
    )
    if (!row) throw new Error(`no option "${option}" under "${control}"`)
    fireEvent.click(row)
  }

  it('works the dropdowns from the keyboard, as a select would have', () => {
    // Rebuilding a native control means rebuilding what it gave away free.
    // A dropdown that traps a keyboard user is worse than a plain select
    // with no descriptions at all.
    render(<App />)
    fireEvent.click(screen.getByText('Erweitert'))
    const control = opener('Konjunktur')

    expect(control.getAttribute('aria-expanded')).toBe('false')
    fireEvent.keyDown(control, { key: 'ArrowDown' })
    expect(control.getAttribute('aria-expanded')).toBe('true')

    fireEvent.keyDown(control, { key: 'ArrowDown' })
    fireEvent.keyDown(control, { key: 'Enter' })
    expect(control.textContent).toContain('Erweitert')
    expect(control.getAttribute('aria-expanded')).toBe('false')

    // Escape closes without choosing.
    fireEvent.keyDown(control, { key: 'ArrowDown' })
    fireEvent.keyDown(control, { key: 'Home' })
    fireEvent.keyDown(control, { key: 'Escape' })
    expect(control.getAttribute('aria-expanded')).toBe('false')
    expect(control.textContent).toContain('Erweitert')
  })

  it('shuts a dropdown when the page is clicked elsewhere', () => {
    render(<App />)
    fireEvent.click(screen.getByText('Erweitert'))
    fireEvent.click(opener('Preise'))
    expect(screen.getByRole('listbox', { name: 'Preise' })).toBeTruthy()

    fireEvent.mouseDown(document.body)
    expect(screen.queryByRole('listbox', { name: 'Preise' })).toBeNull()
  })

  it('opens the option page on the full path', () => {
    render(<App />)
    fireEvent.click(screen.getByText('Erweitert'))

    // Settings are grouped under headings and worked through dropdowns; the
    // page used to be fourteen full-width cards in a flat list.
    for (const heading of ['Der Spielplan', 'Die Fahrt', 'Der Markt', 'Das Handelshaus']) {
      expect(screen.getByText(heading), heading).toBeTruthy()
    }

    // Every mode has a dropdown of its own.
    for (const label of ['Spielplan', 'Fahrtweise', 'Sicht', 'Angebot', 'Preise', 'Konjunktur']) {
      expect(opener(label).getAttribute('aria-haspopup'), label).toBe('listbox')
    }

    // Every plan in the registry is offered, the world and the regions
    // included — the world used to be an "in Vorbereitung" placeholder — and
    // each explains itself in the list rather than only once chosen.
    fireEvent.click(opener('Spielplan'))
    const list = screen.getByRole('listbox', { name: 'Spielplan' })
    const offered = [...list.querySelectorAll('[role="option"]')].map((o) => o.textContent ?? '')
    for (const name of ['Originalplan', 'Ganze Welt', 'Europa', 'Asien und Ozeanien']) {
      expect(offered.some((text) => text.includes(name)), name).toBe(true)
    }
    expect(offered.every((text) => text.length > 24)).toBe(true)
    expect([...list.querySelectorAll('button')].every((b) => !b.disabled)).toBe(true)
    fireEvent.keyDown(opener('Spielplan'), { key: 'Escape' })

    // Dauer and Kapital stay sliders: a range is the right control for a number.
    expect((screen.getByLabelText('Runden') as HTMLInputElement).type).toBe('range')
    expect((screen.getByLabelText('Betriebskapital') as HTMLInputElement).type).toBe('range')

    // Choosing real time swaps the round count for a pace and a season.
    choose('Fahrtweise', 'In Echtzeit')
    expect(screen.queryByLabelText('Runden')).toBeNull()
    expect((screen.getByLabelText('Fahrzeit je Punkt') as HTMLInputElement).type).toBe('range')
    expect((screen.getByLabelText('Länge der Saison') as HTMLInputElement).type).toBe('range')

    // Sicht "realistisch" is on the shelf but not for sale: the engine
    // carries it, the game around it is unfinished, and the list says so
    // rather than quietly dropping it.
    choose('Fahrtweise', 'Mit Würfel')
    expect(screen.queryByLabelText('Runden')).toBeTruthy()
    fireEvent.click(opener('Sicht'))
    const sichten = screen.getByRole('listbox', { name: 'Sicht' })
    const fog = [...sichten.querySelectorAll('button')].find((b) =>
      (b.textContent ?? '').includes('Realistisch'),
    )!
    expect(fog.disabled).toBe(true)
    expect(fog.textContent).toContain('in Vorbereitung')
    fireEvent.click(fog)
    expect(opener('Sicht').textContent).toContain('Normal')
    fireEvent.keyDown(opener('Sicht'), { key: 'Escape' })
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

describe('a full table', () => {
  it('seats ten houses, each with its own harbour and its own seal', () => {
    const ctx = useGame.getState().ctx
    const names = ['Ada', 'Bo', 'Cem', 'Dea', 'Eli', 'Fay', 'Gus', 'Hal', 'Ida', 'Jon']
    act(() => useGame.getState().begin(names, { totalRounds: 20, seed: 'volles-haus' }))

    const state = useGame.getState().state!
    expect(state.players).toHaveLength(10)
    // No two houses in the same berth, and no two wearing the same seal.
    expect(new Set(state.players.map((p) => p.homePort)).size).toBe(10)
    expect(new Set(state.players.map((p) => p.colorIndex)).size).toBe(10)
    // Every seat has an ink of its own; none falls back by wrapping round.
    expect(new Set(state.players.map((p) => PLAYER_COLORS[p.colorIndex]!.ink)).size).toBe(10)
    void ctx
  })

  it('turns the eleventh away', () => {
    const ctx = useGame.getState().ctx
    let s = createGame(ctx, { seed: 'elfter', joinPolicy: 'jederzeit' })
    for (let i = 0; i < 10; i++) {
      s = applyAction(ctx, s, { type: 'join', playerId: `p${i}`, name: `Haus ${i}` }).state
    }
    expect(s.players).toHaveLength(10)
    const refused = applyAction(ctx, s, { type: 'join', playerId: 'p10', name: 'Zu spät' })
    expect(refused.events[0]).toMatchObject({ type: 'rejected' })
    expect(refused.state.players).toHaveLength(10)
  })

  it('lets the names screen fill all ten seats and then stops', () => {
    render(<App />)
    fireEvent.click(screen.getByText('Klassisch'))

    const add = () => screen.queryByText('Noch jemanden eintragen')
    // Two slots are offered to begin with.
    expect(screen.getByLabelText('Name der 2. Person')).toBeTruthy()
    for (let seat = 3; seat <= 10; seat++) {
      fireEvent.click(add()!)
      expect(screen.getByLabelText(`Name der ${seat}. Person`), `seat ${seat}`).toBeTruthy()
    }
    // Ten is the table; there is no eleventh chair to pull up.
    expect(add()).toBeNull()
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

    // The walk through the harbour ends at the chart, where a destination has
    // to be named — so the last button opens the plan. It used to offer
    // "Ablegen", which in real-time play ends no turn and does nothing.
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Hafen' }))
    })
    enterHarbour()
    const last = walkToDeparture()
    expect(last.textContent).toBe('Hafen auf der Karte wählen')
    // Opening the plan is not the end of anything — the voyage is still
    // unchosen — so it does not carry the weight of a finishing move.
    expect(last.className).not.toContain('btn-primary')
    act(() => {
      fireEvent.click(last)
    })
    // Sheet gone, plan uncovered, and the bar says what to do next.
    expect(screen.queryByRole('button', { name: 'Hafen auf der Karte wählen' })).toBeNull()
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

describe('the set course on the plan', () => {
  /** Put Ada to sea with something in the hold, and hand back the target. */
  function setSail(seed: string) {
    render(<App />)
    act(() =>
      useGame.getState().begin(['Ada', 'Bo'], {
        travel: 'echtzeit',
        minutesPerPip: 1,
        durationHours: 6,
        seed,
      }),
    )
    const ctx = useGame.getState().ctx
    const s = useGame.getState().state!
    const player = s.players[0]!
    const offer = buyOffers(ctx, s, player, portAt(ctx, flagship(player).nodeId)!).find(
      (o) => o.status === 'ok',
    )!
    act(() => useGame.getState().dispatch({ type: 'buy', goodId: offer.goodId }))

    const from = flagship(useGame.getState().state!.players[0]!).nodeId
    const to = [...ctx.portsById.keys()].find(
      (id) => id !== from && routeTo(ctx, from, null, id).length >= 3,
    )!
    return { to }
  }

  const hints = () => document.querySelectorAll('circle[stroke="#1c6b4d"]').length
  // Ada is the first house, and the first house is blue.
  const ownCourse = () => document.querySelectorAll('path[stroke="#1f4f8f"]').length

  it('takes the advice rings down once the course is set', () => {
    // The green rings answer "where could this cargo go". Once a course is
    // set they are last question's answer, and they were arguing with the
    // drawn route over the same chart.
    const { to } = setSail('ringe')
    expect(hints()).toBeGreaterThan(0)

    act(() => useGame.getState().dispatch({ type: 'setCourse', to }))
    expect(hints()).toBe(0)
  })

  it('draws the voyage in the colour of the house sailing it', () => {
    const { to } = setSail('farbe')
    expect(ownCourse()).toBe(0)

    act(() => useGame.getState().dispatch({ type: 'setCourse', to }))
    // A soft underlay, the marching line over it — and only one of them moves.
    expect(ownCourse()).toBe(2)
    const marching = [...document.querySelectorAll('path[stroke="#1f4f8f"]')].filter((p) =>
      ((p as SVGElement).style.animation ?? '').includes('course-ants'),
    )
    expect(marching).toHaveLength(1)
  })

  it('draws the whole voyage, from the harbour left behind', () => {
    // A course drawn from the ship's current position tells you where she is
    // going but never where she came from, and shrinks away as she sails.
    const { to } = setSail('ganze-fahrt')
    act(() => useGame.getState().dispatch({ type: 'setCourse', to }))

    /** The full course, which is the longest of the strokes drawn for it. */
    const line = () =>
      [...document.querySelectorAll('path[stroke="#1f4f8f"]')]
        .map((p) => p.getAttribute('d')!)
        .sort((a, b) => b.length - a.length)[0]!
    const atCastOff = line()
    expect(atCastOff.split('L').length).toBeGreaterThan(2)

    // Minute by minute until she is through a leg but not yet in — a single
    // long jump would land her at the destination with no voyage left.
    const before = flagship(useGame.getState().state!.players[0]!).nodeId
    for (let minute = 0; minute < 90; minute++) {
      const ship = flagship(useGame.getState().state!.players[0]!)
      if (ship.nodeId !== before) break
      act(() =>
        useGame.getState().dispatch({ type: 'tick', at: useGame.getState().state!.now + 60_000 }),
      )
    }
    const after = flagship(useGame.getState().state!.players[0]!)
    expect(after.nodeId).not.toBe(before)
    expect(after.voyage).not.toBeNull()

    // Same line on the chart: the origin has not been dropped off the back.
    expect(line()).toBe(atCastOff)
    // And the water already covered is marked as such.
    const wake = [...document.querySelectorAll('path[stroke="#1f4f8f"]')].filter(
      (p) => p.getAttribute('d') !== atCastOff,
    )
    expect(wake.length).toBeGreaterThan(0)
  })

  it('shows a rival heading somewhere without letting them shout', () => {
    const { to } = setSail('rivale')
    act(() => useGame.getState().dispatch({ type: 'setCourse', to }))

    const ctx = useGame.getState().ctx
    const bo = useGame.getState().state!.players[1]!
    const from = flagship(bo).nodeId
    const target = [...ctx.portsById.keys()].find(
      (id) => id !== from && routeTo(ctx, from, null, id).length >= 3,
    )!
    act(() =>
      useGame.getState().dispatch({ type: 'setCourse', to: target, by: bo.id }),
    )

    // Bo is the second house, and the second house is red.
    const theirs = [...document.querySelectorAll('path[stroke="#b03027"]')]
    expect(theirs.length).toBe(2)
    expect(theirs.every((p) => !((p as SVGElement).style.animation ?? '').includes('ants'))).toBe(
      true,
    )
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

describe('looking a harbour up on the plan', () => {
  /** Reach the Wohin? step with something in the hold to plan for. */
  function loaded(seed: string) {
    render(<App />)
    act(() => useGame.getState().begin(['Ada', 'Bo'], { totalRounds: 20, seed }))
    enterHarbour()
    const s = useGame.getState().state!
    const gameCtx = useGame.getState().ctx
    const player = s.players[0]!
    const offer = buyOffers(gameCtx, s, player, portAt(gameCtx, flagship(player).nodeId)!).find(
      (o) => o.status === 'ok',
    )!
    act(() => useGame.getState().dispatch({ type: 'buy', goodId: offer.goodId }))
    act(() => {
      fireEvent.click(screen.getByRole('tab', { name: /Wohin/ }))
    })
  }

  it('drops the sheet to a peek so the plan can be seen', () => {
    loaded('nachschauen')
    const sheet = () => document.querySelector('aside.sheet') as HTMLElement
    expect(sheet().style.getPropertyValue('--sheet-h')).toBe('86dvh')

    const rows = screen.getAllByRole('button', { pressed: false })
    const destination = rows.find((r) => /Punkte? Fahrt/.test(r.textContent ?? ''))!
    act(() => {
      fireEvent.click(destination)
    })

    // Out of the way, but not gone: the list is still there to pick from.
    expect(sheet().style.getPropertyValue('--sheet-h')).toBe('42dvh')
    expect(screen.getByRole('tab', { name: /Wohin/ })).toBeTruthy()
  })

  it('marks the harbour it was asked about, in the list and on the plan', () => {
    loaded('markieren')
    const rows = screen.getAllByRole('button', { pressed: false })
    const destination = rows.find((r) => /Punkte? Fahrt/.test(r.textContent ?? ''))!
    const name = destination.textContent!.split('\n')[0]

    act(() => {
      fireEvent.click(destination)
    })

    expect(destination.getAttribute('aria-pressed')).toBe('true')
    void name

    // Gold on the plan, and only ever one of them — the green hint rings
    // would have labelled this harbour anyway, so the label proves nothing.
    const gold = document.querySelectorAll('circle[stroke="#a9863f"]')
    expect(gold.length).toBe(2)
  })

  it('forgets the mark when the ship moves on', () => {
    loaded('vergessen')
    const rows = screen.getAllByRole('button', { pressed: false })
    act(() => {
      fireEvent.click(rows.find((r) => /Punkte? Fahrt/.test(r.textContent ?? ''))!)
    })
    expect(screen.getAllByRole('button', { pressed: true }).length).toBeGreaterThan(0)

    act(() => useGame.getState().dispatch({ type: 'endTurn' }))
    expect(screen.queryAllByRole('button', { pressed: true })).toHaveLength(0)
  })
})

describe('reading one house’s column', () => {
  /** Play a few turns so both houses are in the paper, then open it. */
  function openNews(seed: string) {
    render(<App />)
    act(() => useGame.getState().begin(['Ada', 'Bo'], { totalRounds: 20, seed }))
    for (let turn = 0; turn < 6; turn++) {
      for (let guard = 0; guard < 12; guard++) {
        const g = useGame.getState()
        const s = g.state!
        if (s.phase === 'over') break
        if (s.phase === 'roll') act(() => g.dispatch({ type: 'roll' }))
        else if (s.phase === 'move') {
          const to = legalSteps(g.ctx, s.players[s.activeIndex]!)[0]
          if (!to) break
          act(() => g.dispatch({ type: 'step', to }))
        } else if (s.phase === 'konjunktur') act(() => g.dispatch({ type: 'drawKonjunktur' }))
        else {
          act(() => g.dispatch({ type: 'endTurn' }))
          break
        }
      }
    }
    act(() => {
      fireEvent.click(screen.getByLabelText(/^Nachrichten/))
    })
  }

  /** Older rounds fold away by default; unfold them all before counting. */
  function unfold(): void {
    for (let guard = 0; guard < 30; guard++) {
      const shut = document.querySelector(
        'aside.sheet section button[aria-expanded="false"]',
      ) as HTMLButtonElement | null
      if (!shut) return
      act(() => {
        fireEvent.click(shut)
      })
    }
  }

  const entries = () => {
    unfold()
    return [...document.querySelectorAll('aside.sheet ol li p')].map((p) => p.textContent ?? '')
  }

  it('narrows the paper to one house and back again', () => {
    openNews('spalte')
    const all = entries()
    expect(all.some((t) => t.startsWith('Ada'))).toBe(true)
    expect(all.some((t) => t.startsWith('Bo'))).toBe(true)

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Ada', pressed: false }))
    })
    const onlyAda = entries()
    expect(onlyAda.length).toBeLessThan(all.length)
    expect(onlyAda.some((t) => t.startsWith('Ada'))).toBe(true)
    expect(onlyAda.some((t) => t.startsWith('Bo'))).toBe(false)

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Alle' }))
    })
    expect(entries()).toHaveLength(all.length)
  })

  it('keeps the world news, so the rounds still divide it up', () => {
    // The round headings are not anybody's news, and without them a filtered
    // journal collapses into one undated heap.
    openNews('gerueste')
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Ada', pressed: false }))
    })
    const headings = [...document.querySelectorAll('aside.sheet section button')].map(
      (b) => b.textContent ?? '',
    )
    expect(headings.filter((h) => /Runde \d/.test(h)).length).toBeGreaterThan(0)
  })

  it('divides a real-time season by the day and stamps the hour', () => {
    // A season on the clock has no rounds at all, so the journal used to
    // arrive as one undivided heap headed "Laufende Runde".
    render(<App />)
    act(() =>
      useGame.getState().begin(['Ada', 'Bo'], {
        travel: 'echtzeit',
        minutesPerPip: 1,
        durationHours: 48,
        seed: 'tagebuch',
      }),
    )
    const ctx = useGame.getState().ctx
    const p = useGame.getState().state!.players[0]!
    const from = flagship(p).nodeId
    const to = [...ctx.portsById.keys()].find(
      (id) => id !== from && routeTo(ctx, from, null, id).length >= 2,
    )!
    act(() => useGame.getState().dispatch({ type: 'setCourse', to }))
    // Push the clock over midnight so there are two days to divide.
    act(() =>
      useGame
        .getState()
        .dispatch({ type: 'tick', at: useGame.getState().state!.now + 26 * 3_600_000 }),
    )

    act(() => {
      fireEvent.click(screen.getByLabelText(/^Nachrichten/))
    })

    const headings = [...document.querySelectorAll('aside.sheet section button')].map(
      (b) => b.textContent ?? '',
    )
    expect(headings.some((h) => h.includes('Heute'))).toBe(true)
    expect(headings.every((h) => !h.includes('Runde'))).toBe(true)
    expect(headings.length).toBeGreaterThan(1)

    // Every entry says when, in hours and minutes.
    const stamps = [...document.querySelectorAll('aside.sheet ol li span')].map(
      (s) => s.textContent ?? '',
    )
    expect(stamps.length).toBeGreaterThan(0)
    expect(stamps.every((s) => /^\d{2}:\d{2}$/.test(s))).toBe(true)
  })

  it('leaves a game of throws divided by its rounds, with no clock', () => {
    openNews('keine-uhr')
    const headings = [...document.querySelectorAll('aside.sheet section button')].map(
      (b) => b.textContent ?? '',
    )
    expect(headings.some((h) => /Runde \d/.test(h))).toBe(true)
    expect(document.querySelectorAll('aside.sheet ol li span')).toHaveLength(0)
  })

  it('offers no filter at a table for one', () => {
    render(<App />)
    act(() => useGame.getState().begin(['Ada'], { totalRounds: 20, seed: 'allein' }))
    act(() => {
      fireEvent.click(screen.getByLabelText(/^Nachrichten/))
    })
    expect(screen.queryByRole('button', { name: 'Alle' })).toBeNull()
  })
})

/**
 * Telegraphing the table.
 *
 * The Börsenblatt was a thing to read. Three houses on three telephones had
 * nowhere at all to say "verkaufst du mir den Kaffee?", and this is the one
 * page all three open anyway.
 */
describe('telegraphing the table', () => {
  const openPaper = (seed: string) => {
    render(<App />)
    act(() => useGame.getState().begin(['Ada', 'Bo'], { totalRounds: 20, seed }))
    act(() => {
      fireEvent.click(screen.getByLabelText(/^Nachrichten/))
    })
  }

  /** What a table over the wire looks like from this device: a seat at it. */
  const overTheWire = () => {
    const me = useGame.getState().state!.players[0]!.id
    act(() =>
      useGame.setState({
        net: { code: 'WZUH', status: 'verbunden', playerId: me, online: [] },
      }),
    )
  }

  it('offers no form at a table of one device', () => {
    // Everyone is in the room. A telegram to yourself is a note, and the
    // Kontor already has a notebook.
    openPaper('draht-lokal')
    expect(screen.queryByLabelText('Telegramm an alle')).toBeNull()
  })

  it('offers one where the other houses are elsewhere', () => {
    render(<App />)
    act(() => useGame.getState().begin(['Ada', 'Bo'], { totalRounds: 20, seed: 'draht-netz' }))
    overTheWire()
    act(() => {
      fireEvent.click(screen.getByLabelText(/^Nachrichten/))
    })
    expect(screen.getByLabelText('Telegramm an alle')).toBeTruthy()
  })

  it('will not send a blank form', () => {
    render(<App />)
    act(() => useGame.getState().begin(['Ada', 'Bo'], { totalRounds: 20, seed: 'draht-leer' }))
    overTheWire()
    act(() => {
      fireEvent.click(screen.getByLabelText(/^Nachrichten/))
    })
    const send = screen.getByRole('button', { name: 'Aufgeben' }) as HTMLButtonElement
    expect(send.disabled).toBe(true)

    act(() => {
      fireEvent.change(screen.getByLabelText('Telegramm an alle'), {
        target: { value: 'kaufe kaffee' },
      })
    })
    expect((screen.getByRole('button', { name: 'Aufgeben' }) as HTMLButtonElement).disabled).toBe(
      false,
    )
  })

  it('offers no wire until something has come over it', () => {
    // A filter that yields nothing is a dead end on a scrolling row.
    openPaper('draht-keins')
    expect(screen.queryByRole('button', { name: 'Telegramme' })).toBeNull()
  })

  it('narrows the paper to the wire, and lets go again', () => {
    openPaper('draht-filter')
    act(() => useGame.getState().dispatch({ type: 'telegramm', text: 'kaufe kaffee' }))

    const entries = () =>
      [...document.querySelectorAll('aside.sheet ol li p')].map((p) => p.textContent ?? '')
    const all = entries()
    // Das Blatt trägt mindestens die Eröffnungsbuchung der Exportbank neben
    // dem Telegramm — genug, damit der Filter etwas wegzunehmen hat.
    expect(all.length).toBeGreaterThan(1)
    expect(all.some((t) => !t.includes('telegrafiert'))).toBe(true)

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Telegramme' }))
    })
    const wire = entries()
    expect(wire.length).toBeGreaterThan(0)
    expect(wire.every((t) => t.includes('telegrafiert'))).toBe(true)
    expect(wire.some((t) => t.includes('kaufe kaffee'))).toBe(true)

    // Tapping it again reads the whole paper, like the house chips do.
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Telegramme' }))
    })
    expect(entries()).toHaveLength(all.length)
  })

  it('keeps the round headings, so the wire is still dated', () => {
    // Everything else the world says is dropped on purpose — a storm between
    // two messages is exactly what one asked to be rid of — but without the
    // headings the conversation arrives as one undated heap.
    openPaper('draht-runden')
    act(() => useGame.getState().dispatch({ type: 'telegramm', text: 'moin' }))
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Telegramme' }))
    })
    const headings = [...document.querySelectorAll('aside.sheet section button')].map(
      (b) => b.textContent ?? '',
    )
    expect(headings.length).toBeGreaterThan(0)
    expect(headings.some((h) => /Runde \d|Laufende Runde/.test(h))).toBe(true)
  })

  it('does not report one’s own telegram back as unread', () => {
    // The form sits inside this very sheet, so the pill lit up saying
    // "1 ungelesen" about a message the player had just typed, while looking
    // straight at it.
    render(<App />)
    act(() => useGame.getState().begin(['Ada', 'Bo'], { totalRounds: 20, seed: 'draht-gelesen' }))
    const mine = useGame.getState().state!.players[0]!.id
    const pill = () => screen.getByLabelText(/^Nachrichten/).getAttribute('aria-label')
    const before = pill()

    // Sent while this device is still reckoned local, so the line really
    // lands in the journal; then the device learns whose seat it holds.
    act(() => useGame.getState().dispatch({ type: 'telegramm', text: 'kaufe kaffee' }))
    act(() =>
      useGame.setState({
        net: { code: 'WZUH', status: 'verbunden', playerId: mine, online: [] },
      }),
    )

    // The strip counts exactly what it counted before, and the rule down the
    // left of the entry stays off too.
    expect(pill()).toBe(before)

    act(() => {
      fireEvent.click(screen.getByLabelText(/^Nachrichten/))
    })
    const own = [...document.querySelectorAll('aside.sheet ol li')].find((li) =>
      (li.textContent ?? '').includes('kaufe kaffee'),
    )!
    expect(own.className).not.toContain('border-gold')
  })

  it('still rules off what somebody else wrote', () => {
    // The other half of the same rule: a telegram from the far side of the
    // world is exactly the thing the mark is for.
    render(<App />)
    act(() => useGame.getState().begin(['Ada', 'Bo'], { totalRounds: 20, seed: 'draht-fremd' }))
    const bo = useGame.getState().state!.players[1]!.id
    const ada = useGame.getState().state!.players[0]!.id
    const count = () =>
      Number(
        /(\d+) ungelesen/.exec(
          screen.getByLabelText(/^Nachrichten/).getAttribute('aria-label') ?? '',
        )?.[1] ?? 0,
      )
    const before = count()

    act(() => useGame.getState().dispatch({ type: 'telegramm', text: 'biete zucker', by: bo }))
    act(() =>
      useGame.setState({
        net: { code: 'WZUH', status: 'verbunden', playerId: ada, online: [] },
      }),
    )
    expect(count()).toBe(before + 1)
  })

  it('prints the message in the paper, in nobody’s column', () => {
    openPaper('draht-blatt')
    act(() => useGame.getState().dispatch({ type: 'telegramm', text: 'kaufe kaffee jeden preis' }))

    const top = useGame.getState().log[0]!
    // The entry carries the message and the sender's house; the paper puts
    // the name back in front of it, in that house's ink.
    expect(top.text).toBe('kaufe kaffee jeden preis')
    expect(top.cause).toBe(useGame.getState().state!.players[0]!.id)
    // Sent to the whole table, so narrowing the paper to one house must not
    // lose it — that is what an empty `who` means here.
    expect(top.who).toEqual([])
  })
})

describe('the settings page', () => {
  const openSettings = (seed: string) => {
    render(<App />)
    act(() => useGame.getState().begin(['Ada', 'Bo'], { totalRounds: 20, seed }))
    enterHarbour()
    act(() => {
      fireEvent.click(screen.getByLabelText('Einstellungen'))
    })
  }

  it('is reachable from the board at any time', () => {
    openSettings('einstellungen')
    expect(screen.getByRole('heading', { name: 'Einstellungen' })).toBeTruthy()
    // The three things it is for.
    expect(screen.getByText('Meldungen')).toBeTruthy()
    expect(screen.getByText('Diese Partie')).toBeTruthy()
    expect(screen.getByText('Verlassen')).toBeTruthy()
  })

  it('goes back to the title page without throwing the game away', () => {
    // The whole point of the second exit: before this, the only way off the
    // board was the red button that deleted the save.
    openSettings('titelbild')
    act(() => {
      fireEvent.click(screen.getByText('Zum Titelbild'))
    })

    expect(useGame.getState().state).toBeNull()
    expect(screen.getByText('Angefangene Partie fortsetzen')).toBeTruthy()

    act(() => {
      fireEvent.click(screen.getByText('Angefangene Partie fortsetzen'))
    })
    expect(useGame.getState().state).not.toBeNull()
  })

  it('makes giving the game up take a second tap', () => {
    openSettings('aufgeben-ui')
    act(() => {
      fireEvent.click(screen.getByText('Partie aufgeben'))
    })
    // Still playing: the first tap only asks.
    expect(useGame.getState().state).not.toBeNull()

    act(() => {
      fireEvent.click(screen.getByText(/Wirklich aufgeben/))
    })
    expect(useGame.getState().state).toBeNull()
    expect(screen.queryByText('Angefangene Partie fortsetzen')).toBeNull()
  })
})

describe('a second device with no seat', () => {
  /**
   * Two people opened a real-time table on two devices and the second could
   * do nothing at all — the screen showed the first player's ship, name and
   * harbour as if they were its own, and every tap was swallowed in silence.
   *
   * Real-time play has no turns, so "wait your turn" was never the answer.
   * The device simply had no seat, and nothing said so.
   */
  const seatless = () => {
    render(<App />)
    act(() => {
      useGame
        .getState()
        .begin(['Ada', 'Bo'], { travel: 'echtzeit', minutesPerPip: 1, seed: 'kein-platz' })
    })
    // As a client the server never seated: connected, watching, no playerId.
    act(() => {
      useGame.setState({
        net: { code: 'ABCD', status: 'verbunden', playerId: null, online: [] },
      })
    })
  }

  it('does not hand the first player’s ship to a stranger', () => {
    seatless()
    const state = useGame.getState().state!
    expect(state.players[0]!.name).toBe('Ada')
    // Ada's name must not be sitting in this device's own HUD.
    expect(screen.queryByLabelText(/^Platz 1, Ada/)).toBeNull()
  })

  it('says plainly that there is no seat at this table', () => {
    seatless()
    expect(screen.getByText('Zuschauer')).toBeTruthy()
    expect(screen.getByText(/keinen Platz an diesem Tisch/i)).toBeTruthy()
  })

  it('does not swallow an order it cannot carry out', () => {
    // Silence is the worst answer: the player cannot tell a refusal from a
    // broken button.
    seatless()
    act(() => {
      useGame.getState().dispatch({ type: 'buy', goodId: 1 })
    })
    expect(useGame.getState().notice).toBeTruthy()
  })
})

/**
 * The colour of the paper a world card is printed on.
 *
 * jsdom does no painting, so what is checked here is the wiring: the slip
 * asks the engine for the card's temper and carries it as a class. What the
 * three classes look like is the stylesheet's business.
 */
describe('the stock a Konjunkturkarte is printed on', () => {
  const titled = (title: string) => CLASSIC_PACK.konjunktur.find((c) => c.title === title)!

  it('prints good news on green and bad news on red', () => {
    const { container, rerender } = render(<KonjunkturSlip card={titled('Hausse')} />)
    expect(container.querySelector('.paper-slip')!.className).toContain('slip-gut')

    rerender(<KonjunkturSlip card={titled('Baisse')} />)
    expect(container.querySelector('.paper-slip')!.className).toContain('slip-schlecht')
  })

  it('leaves the card that cuts both ways on straw', () => {
    const { container } = render(<KonjunkturSlip card={titled('Hafengebühr')} />)
    expect(container.querySelector('.paper-slip')!.className).toContain('slip-gemischt')
  })
})

/**
 * The paper reports the world, not the reader.
 *
 * The unread pill counted everything the journal wrote, including the entry
 * the reader had just caused by pressing a button — so buying a sack of
 * coffee lit the 📰 with "1 ungelesen" about the purchase you were looking at
 * the receipt for.
 */
describe('news that is not news to the man who made it', () => {
  const label = () => screen.getByLabelText(/^Nachrichten/).getAttribute('aria-label')!

  it('marks each entry with the house whose order wrote it', () => {
    render(<App />)
    act(() => useGame.getState().begin(['Ada', 'Bo'], { totalRounds: 20, seed: 'urheber' }))
    enterHarbour()

    const ctx = useGame.getState().ctx
    const state = useGame.getState().state!
    const ada = state.players[0]!
    const offer = buyOffers(ctx, state, ada, portAt(ctx, flagship(ada).nodeId)!).find(
      (o) => o.status === 'ok',
    )!
    act(() => useGame.getState().dispatch({ type: 'buy', goodId: offer.goodId }))

    expect(useGame.getState().log[0]!.cause).toBe(ada.id)
  })

  it('leaves the world’s own doings unclaimed, so they count for everybody', () => {
    // A tick is nobody's order. Arrivals, weather and the Börse come out of
    // one, and they are news to every house at the table including the one
    // whose ship it is.
    render(<App />)
    act(() =>
      useGame.getState().begin(['Ada', 'Bo'], {
        totalRounds: 20,
        travel: 'echtzeit',
        minutesPerPip: 1,
        durationHours: 6,
        seed: 'uhrwerk',
      }),
    )
    const world = useGame.getState().log.filter((l) => l.kind === 'roundStarted' || !l.cause)
    expect(world.length).toBeGreaterThan(0)
    expect(world.every((l) => l.cause === undefined)).toBe(true)
  })

  it('does not count one’s own purchase as unread', () => {
    render(<App />)
    act(() => useGame.getState().begin(['Ada', 'Bo'], { totalRounds: 20, seed: 'eigenkauf' }))
    enterHarbour()
    act(() => {
      fireEvent.click(screen.getByLabelText(/^Nachrichten/))
    })
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Schließen' }))
    })
    const before = label()

    const ctx = useGame.getState().ctx
    const state = useGame.getState().state!
    const ada = state.players[0]!
    const offer = buyOffers(ctx, state, ada, portAt(ctx, flagship(ada).nodeId)!).find(
      (o) => o.status === 'ok',
    )!
    act(() => useGame.getState().dispatch({ type: 'buy', goodId: offer.goodId }))

    // The journal wrote the purchase down — it just did not shout about it.
    expect(useGame.getState().log.some((l) => l.cause === ada.id)).toBe(true)
    expect(label()).toBe(before)
  })

  it('still counts what another house did', () => {
    render(<App />)
    act(() => useGame.getState().begin(['Ada', 'Bo'], { totalRounds: 20, seed: 'fremdkauf' }))
    const bo = useGame.getState().state!.players[1]!.id
    act(() => {
      fireEvent.click(screen.getByLabelText(/^Nachrichten/))
    })
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Schließen' }))
    })
    expect(label()).toBe('Nachrichten')

    act(() => useGame.getState().dispatch({ type: 'telegramm', text: 'biete zucker', by: bo }))
    expect(label()).toContain('1 ungelesen')
  })
})

/**
 * A telegram is the only line in the paper a person wrote. It gets the
 * sender's ink, so the wire reads as a voice and the rest as bookkeeping.
 */
describe('a telegram in the sender’s colour', () => {
  it('sets the name in the house’s ink and rules the entry in it', () => {
    render(<App />)
    act(() => useGame.getState().begin(['Ada', 'Bo'], { totalRounds: 20, seed: 'farbe-draht' }))
    const bo = useGame.getState().state!.players[1]!
    // jsdom gibt Farben als rgb() zurück, nie als Hex.
    const hex = PLAYER_COLORS[bo.colorIndex % PLAYER_COLORS.length]!.ink
    const ink = `rgb(${parseInt(hex.slice(1, 3), 16)}, ${parseInt(hex.slice(3, 5), 16)}, ${parseInt(hex.slice(5, 7), 16)})`
    act(() =>
      useGame.getState().dispatch({ type: 'telegramm', text: 'suche kautschuk', by: bo.id }),
    )
    act(() => {
      fireEvent.click(screen.getByLabelText(/^Nachrichten/))
    })

    const entry = [...document.querySelectorAll('aside.sheet ol li')].find((li) =>
      (li.textContent ?? '').includes('suche kautschuk'),
    )! as HTMLElement
    expect(entry.textContent).toContain('Bo')
    expect(entry.style.borderColor).toBe(ink)
    const name = entry.querySelector('p span') as HTMLElement
    expect(name.textContent).toBe('Bo')
    expect(name.style.color).toBe(ink)
  })
})

/**
 * Das Handelshaus, eingeklappt.
 *
 * Ob es eingeklappt wird, entscheidet eine Messung, die jsdom nicht anstellen
 * kann — dort ist alles null Pixel breit. Was hier geprüft wird, ist das
 * Verhalten danach: was das Bildnis zeigt, und was der Tipp darauf hervorholt.
 */
describe('the house folded down to its portrait', () => {
  const house = () => {
    const s = useGame.getState()
    const player = s.state!.players[0]!
    return {
      ctx: s.ctx,
      player,
      cargoCount: 0,
      purchasesLeft: null,
      rank: 1,
      onOpen: () => {},
    }
  }

  beforeEach(() => {
    act(() => useGame.getState().begin(['Ada', 'Bo'], { totalRounds: 20, seed: 'bildnis' }))
  })

  it('shows the portrait and keeps the ledger to itself', () => {
    render(<HouseBadge {...house()} />)
    expect(screen.getByLabelText(/Aufklappen\.$/)).toBeTruthy()
    expect(screen.queryByText('Ada')).toBeNull()
  })

  it('unfolds the whole card on a tap, and folds it away on the next', () => {
    render(<HouseBadge {...house()} />)
    act(() => {
      fireEvent.click(screen.getByLabelText(/Aufklappen\.$/))
    })
    expect(screen.getByText('Ada')).toBeTruthy()
    expect(document.querySelector('.anim-unfold')).toBeTruthy()

    act(() => {
      fireEvent.click(screen.getByLabelText(/Zuklappen\.$/))
    })
    expect(screen.queryByText('Ada')).toBeNull()
  })

  it('offers a cross of its own, for anyone who looks for one', () => {
    render(<HouseBadge {...house()} />)
    act(() => {
      fireEvent.click(screen.getByLabelText(/Aufklappen\.$/))
    })
    act(() => {
      fireEvent.click(screen.getByLabelText('Handelshaus zuklappen'))
    })
    expect(screen.queryByText('Ada')).toBeNull()
  })
})
