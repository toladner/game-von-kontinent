import { describe, expect, it } from 'vitest'
import { durationText, roughDuration } from './useNow'

/**
 * Zwei Maße für dieselbe Spanne: eines zum Lesen, eines zum Danebenstellen.
 *
 * In der Leiste steht die Saison neben dem Handelshaus, und "129 Std 18 Min"
 * ist dort breiter als der Platz. Die Minuten interessieren auch niemanden,
 * solange noch Tage übrig sind — genau bekommt sie, wer die Karte antippt.
 */
describe('a season measured for the strip', () => {
  const min = 60_000
  const hour = 60 * min

  it('counts minutes while there is less than an hour', () => {
    expect(roughDuration(18 * min)).toBe('18 Min')
    expect(roughDuration(59 * min + 30_000)).toBe('59 Min')
  })

  it('drops the minutes as soon as an hour stands', () => {
    expect(roughDuration(hour + 18 * min)).toBe('1 Std')
    expect(roughDuration(3 * hour + 59 * min)).toBe('3 Std')
  })

  it('counts in days once two of them have gone by', () => {
    expect(roughDuration(47 * hour)).toBe('47 Std')
    expect(roughDuration(48 * hour)).toBe('2 Tage')
    expect(roughDuration(129 * hour + 18 * min)).toBe('5 Tage')
  })

  it('says so plainly when the season is over', () => {
    expect(roughDuration(0)).toBe('abgelaufen')
    expect(roughDuration(-1)).toBe('abgelaufen')
  })

  it('leaves the exact figure alone, for the sheet and the screen reader', () => {
    expect(durationText(129 * hour + 18 * min)).toBe('129 Std 18 Min')
  })
})
