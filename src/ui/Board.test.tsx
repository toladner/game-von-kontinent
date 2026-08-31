import { describe, expect, it } from 'vitest'
import { shipNudge } from './Board'

/**
 * Where a ship is drawn.
 *
 * The chart is the game: a merchant reads a course off it and decides on
 * what they see. So a ship drawn beside her lane rather than on it is not a
 * cosmetic complaint — it is the plan lying about where the ship is.
 *
 * The fan that keeps two hulls in one harbour apart used to be struck from
 * the size of the table rather than from what was actually alongside, which
 * offset every ship whether or not anything was beside her and grew with the
 * number of houses. At six, the first house's ship was drawn ten points off
 * her node — sixty pixels on a plan zoomed to a coastline, which put her on
 * the land next to the water she was sailing on.
 */
describe('where a ship is drawn', () => {
  const berthed = (id: string, nodeId: string) => ({ id, nodeId, sailing: false })
  const sailing = (id: string, nodeId: string) => ({ id, nodeId, sailing: true })

  it('draws a ship under way on her line, whatever the size of the table', () => {
    // The failure this test exists for. Ten houses, and the one whose ship is
    // at sea is drawn exactly where the interpolation put her.
    const fleet = [
      sailing('mine', 'sea:capcoast~monrovia:0'),
      ...Array.from({ length: 9 }, (_, i) => berthed(`p${i}`, `hafen${i}`)),
    ]
    expect(shipNudge(fleet, fleet[0]!)).toBe(0)
  })

  it('leaves a ship alone in a harbour sitting in it', () => {
    const fleet = [berthed('mine', 'hamburg'), berthed('other', 'lissabon')]
    expect(shipNudge(fleet, fleet[0]!)).toBe(0)
  })

  it('fans two ships in one harbour apart, centred on the harbour', () => {
    const fleet = [berthed('a', 'hamburg'), berthed('b', 'hamburg')]
    const offsets = fleet.map((v) => shipNudge(fleet, v))
    expect(offsets[0]).toBe(-offsets[1]!)
    expect(offsets[0]).not.toBe(0)
    // Centred: the fan has no net drift off the node it is fanning from.
    expect(offsets.reduce((a, b) => a + b, 0)).toBe(0)
  })

  it('counts only the vessels actually lying there', () => {
    // Two houses in Hamburg and eight scattered: the fan is over the two.
    const here = [berthed('a', 'hamburg'), berthed('b', 'hamburg')]
    const elsewhere = Array.from({ length: 8 }, (_, i) => berthed(`x${i}`, `hafen${i}`))
    const crowd = shipNudge([...here, ...elsewhere], here[0]!)
    const alone = shipNudge(here, here[0]!)
    expect(crowd).toBe(alone)
  })

  it('does not count a ship that has already put to sea', () => {
    // She has left the quay, so there is nothing left in the harbour to hide
    // under — and a ship at sea must not be pushed off her lane to make room.
    const fleet = [berthed('a', 'hamburg'), sailing('b', 'hamburg')]
    expect(shipNudge(fleet, fleet[0]!)).toBe(0)
    expect(shipNudge(fleet, fleet[1]!)).toBe(0)
  })

  it('keeps a house’s own second vessel from hiding under its first', () => {
    const fleet = [berthed('flag', 'hamburg'), berthed('schoner', 'hamburg')]
    expect(shipNudge(fleet, fleet[0]!)).not.toBe(shipNudge(fleet, fleet[1]!))
  })
})
