// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { Emph } from './Emph'

/** What the player must never see is a stray asterisk. */
const shown = (text: string) => render(<Emph text={text} />).container.textContent
const bolded = (text: string) =>
  [...render(<Emph text={text} />).container.querySelectorAll('strong')].map((e) => e.textContent)

describe('emphasis in the game\u2019s copy', () => {
  it('bolds the marked words and eats the markers', () => {
    expect(shown('Hier wird *Kaffee* verladen, ab *60.000*.')).toBe(
      'Hier wird Kaffee verladen, ab 60.000.',
    )
    expect(bolded('Hier wird *Kaffee* verladen, ab *60.000*.')).toEqual(['Kaffee', '60.000'])
  })

  it('leaves plain copy alone', () => {
    expect(shown('Ruhiger Tag im Hafen.')).toBe('Ruhiger Tag im Hafen.')
    expect(bolded('Ruhiger Tag im Hafen.')).toEqual([])
  })

  it('prints an unpaired marker rather than swallowing the rest', () => {
    // A typo in the copy should look like a typo, not silently delete a line.
    expect(shown('Ein *offener Anfang')).toBe('Ein *offener Anfang')
    expect(bolded('Ein *offener Anfang')).toEqual([])
  })

  it('does not treat an empty pair as emphasis', () => {
    expect(shown('nichts ** hier')).toBe('nichts ** hier')
  })
})
