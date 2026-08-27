// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import App from '@app/App'
import { useGame } from '@app/store'
import { useLocaleStore } from '@app/locale'
import { STRINGS } from './index'

/**
 * Nothing German where English was asked for.
 *
 * Every other check in this repo asks whether a *particular* string was
 * translated, which is exactly the wrong shape: the strings that get missed
 * are the ones nobody thought to check. Two of them survived a hand sweep and
 * shipped — "Posten an Bord" in the strip that is on screen the entire game,
 * and "Laderaum leer" beside it — because the sweep looked for umlauts and
 * neither has one.
 *
 * So this looks at the other end. It sets the app to English, drives it
 * through the screens a player actually sees, and reads the rendered text back
 * looking for German words. It knows nothing about which strings exist, which
 * is the point: a phrase added tomorrow and forgotten is caught by the same
 * net as one added today.
 */

/**
 * German that no English sentence would contain.
 *
 * Function words rather than nouns, because a noun can be a proper name that
 * belongs in both languages — Hamburg, Lüderitz, Störtebeker — while nothing
 * legitimately English contains "nicht" or "Ihre". The handful of game nouns
 * at the end are ones with no English use at all.
 *
 * Words the two languages share are left out however German they feel: "man"
 * is one of ours as well, and a list that flags "woman or man" is a list
 * people learn to ignore.
 */
const GERMAN =
  /\b(der|die|das|den|dem|des|ein|eine|einen|einem|einer|kein|keine|keinen|und|oder|aber|noch|schon|nicht|nur|auch|sehr|mehr|wieder|immer|ist|sind|war|waren|wird|werden|wurde|hat|haben|hatte|kann|müssen|muß|sie|ihr|ihre|ihren|ihrem|wir|uns|wer|wie|wann|warum|daß|dass|weil|für|über|unter|ohne|gegen|beim|vom|zur|zum|dieser|diese|dieses|jeder|jede|jedes|alle|allen|Hafen|Häfen|Schiff|Schiffe|Ladung|Laderaum|Posten|Ware|Waren|Kasse|Partie|Runde|Kaufmann|Kauffrau|Handelshaus|Kontor|Meldung|Meldungen|Nachricht|Nachrichten|Taube|Werft|Betriebskapital|Vermögen|Mitspieler|Einkauf|Verkauf|Gewinn|Verlust|Barmittel|leer|Punkte|Std|Sek|abgelaufen|Einstellungen|Zurück|Weiter|Abbrechen|Schließen)\b/

/**
 * Words that are German and are supposed to be.
 *
 * The title never translates — the game was published in German and never in
 * English — and neither do the proper names it is built from. Everything here
 * is a deliberate exception, and the list is short on purpose: anything added
 * to it is a decision, not a shortcut.
 */
const ALLOWED = ['Von Kontinent zu Kontinent', 'Deutsch']

function germanIn(text: string): string[] {
  let scrubbed = text
  for (const allowed of ALLOWED) scrubbed = scrubbed.split(allowed).join(' ')
  return [...new Set(scrubbed.match(new RegExp(GERMAN, 'g')) ?? [])]
}

/** Everything a player can currently read, as one piece of text. */
function onScreen(): string {
  const bits: string[] = [document.body.textContent ?? '']
  // Labels a sighted player never reads but a screen reader does.
  for (const node of document.querySelectorAll('[aria-label],[title],[placeholder]')) {
    bits.push(
      node.getAttribute('aria-label') ?? '',
      node.getAttribute('title') ?? '',
      node.getAttribute('placeholder') ?? '',
    )
  }
  return bits.join(' \n ')
}

function expectNoGerman(where: string): void {
  const found = germanIn(onScreen())
  expect(found, `${where}: German on screen with the app set to English`).toEqual([])
}

beforeEach(() => {
  cleanup()
  localStorage.clear()
  useGame.getState().abandon()
  useLocaleStore.setState({ locale: 'en' })
})

afterEach(() => {
  useLocaleStore.setState({ locale: 'de' })
})

describe('the app set to English', () => {
  it('says nothing German on the title page', () => {
    render(<App />)
    expectNoGerman('title page')
  })

  it('says nothing German while arranging a full game', () => {
    render(<App />)
    act(() => {
      fireEvent.click(screen.getByText('Full'))
    })
    expectNoGerman('the options')

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    })
    expectNoGerman('where to play')

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    })
    expectNoGerman('the register of names')
  })

  it('says nothing German on the chart, the strip or the harbour', () => {
    render(<App />)
    act(() => useGame.getState().begin(['Ada', 'Bo'], { totalRounds: 20, seed: 'englisch' }))
    expectNoGerman('the chart')

    const ashore = screen.queryByRole('button', { name: 'Go ashore' })
    if (ashore) act(() => { fireEvent.click(ashore) })
    expectNoGerman('the harbour')
  })

  it('says nothing German in the news sheet', () => {
    render(<App />)
    act(() => useGame.getState().begin(['Ada', 'Bo'], { totalRounds: 20, seed: 'englisch' }))
    act(() => {
      fireEvent.click(screen.getByLabelText(/^News/))
    })
    expectNoGerman('the news')
  })

  it('says nothing German in the counting house or the settings', () => {
    render(<App />)
    act(() => useGame.getState().begin(['Ada', 'Bo'], { totalRounds: 20, seed: 'englisch' }))

    const badge = screen.getAllByRole('button', { name: /Open the counting house/ })[0]!
    act(() => { fireEvent.click(badge) })
    expectNoGerman('the counting house')
  })

  it('says nothing German at the final reckoning', () => {
    render(<App />)
    act(() => useGame.getState().begin(['Ada'], { totalRounds: 1, seed: 'englisch' }))
    // Run it out: the last round settles itself and the reckoning opens.
    for (let guard = 0; guard < 40 && useGame.getState().state?.phase !== 'over'; guard++) {
      const button =
        screen.queryByRole('button', { name: /^Throw$|^End the turn$|^Turn a market card$/ }) ??
        screen.queryByRole('button', { name: /^Cast off$|^Sail with an empty hold$/ })
      if (!button) break
      act(() => { fireEvent.click(button) })
    }
    expectNoGerman('wherever the game got to')
  })

  /**
   * The catalogue itself, entry by entry.
   *
   * The walks above only reach the screens they can drive to; a phrase behind
   * a Konjunkturkarte or a carrier pigeon may never render in a test. This
   * reads every English string in the table instead, which reaches all of
   * them — and would have caught both of the ones that shipped.
   */
  it('has no German left in the English half of the phrase table', () => {
    const stragglers: string[] = []
    for (const [key, phrase] of Object.entries(STRINGS)) {
      const found = germanIn(phrase.en)
      if (found.length > 0) stragglers.push(`${key}: ${phrase.en} — ${found.join(', ')}`)
    }
    expect(stragglers).toEqual([])
  })
})
