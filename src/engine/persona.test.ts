import { describe, expect, it } from 'vitest'
import {
  harbourCharacters,
  harbourGuide,
  makePersona,
  makeShipIdentity,
  type Gender,
} from './persona'

/** Enough names to see the whole distribution, not just the lucky draw. */
const NAMES = Array.from({ length: 400 }, (_, i) => `Kaufmann ${i}`)

describe('trader personas', () => {
  it('gives the same name the same person, every time', () => {
    const a = makePersona('Wilhelmine', 'classic')
    const b = makePersona('  wilhelmine  ', 'classic')
    expect(b).toEqual(a)
  })

  it('makes women and men in roughly equal numbers', () => {
    const women = NAMES.filter((n) => makePersona(n).gender === 'w').length
    expect(women).toBeGreaterThan(NAMES.length * 0.35)
    expect(women).toBeLessThan(NAMES.length * 0.65)
  })

  it('honours a gender that was chosen rather than rolled', () => {
    for (const g of ['w', 'm'] as const) {
      for (const name of NAMES.slice(0, 40)) {
        expect(makePersona(name, 'classic', g).gender).toBe(g)
      }
    }
  })

  it('inflects the rank, because German ranks are not neutral', () => {
    const women = NAMES.map((n) => makePersona(n, '', 'w'))
    const men = NAMES.map((n) => makePersona(n, '', 'm'))
    // Superkargo is the one title that does not inflect.
    expect(women.some((p) => p.rank === 'Reederin')).toBe(true)
    expect(women.some((p) => p.rank === 'Reeder')).toBe(false)
    expect(men.some((p) => p.rank === 'Reeder')).toBe(true)
    expect(men.some((p) => p.rank === 'Reederin')).toBe(false)
  })

  it('never puts a beard on a woman, nor a bonnet on a man', () => {
    for (const name of NAMES) {
      const w = makePersona(name, '', 'w')
      const m = makePersona(name, '', 'm')
      expect(w.portrait.beard).toBe(0)
      expect(w.portrait.gender).toBe('w')
      // 4 and 5 are the Haube and the Kopftuch.
      expect(m.portrait.headwear).toBeLessThan(4)
    }
  })

  it('reserves "& Töchter" for a house a woman signs for', () => {
    const men = NAMES.map((n) => makePersona(n, '', 'm').house)
    expect(men.some((h) => h.includes('Töchter'))).toBe(false)
    expect(NAMES.map((n) => makePersona(n, '', 'w').house).some((h) => h.includes('Töchter'))).toBe(
      true,
    )
  })

  it('draws on a wide enough wardrobe to feel like a crowd', () => {
    const seen = new Set(
      NAMES.map((n) => {
        const p = makePersona(n)
        const t = p.portrait
        return [p.rank, p.house, t.face, t.hair, t.beard, t.headwear, t.accessory, t.age].join('|')
      }),
    )
    // 400 traders, essentially no repeats.
    expect(seen.size).toBeGreaterThan(NAMES.length * 0.98)
  })

  it('varies every portrait axis instead of leaning on one', () => {
    const traits = NAMES.map((n) => makePersona(n).portrait)
    const spread = (get: (t: (typeof traits)[number]) => number) =>
      new Set(traits.map(get)).size
    expect(spread((t) => t.face)).toBe(4)
    expect(spread((t) => t.hair)).toBeGreaterThanOrEqual(9)
    expect(spread((t) => t.headwear)).toBeGreaterThanOrEqual(6)
    expect(spread((t) => t.accessory)).toBeGreaterThanOrEqual(6)
    expect(spread((t) => t.age)).toBe(3)
  })
})

describe('the people on the quay', () => {
  it('titles a harbour character to match the person', () => {
    const seen = new Map<Gender, Set<string>>([
      ['w', new Set()],
      ['m', new Set()],
    ])
    for (let i = 0; i < 200; i++) {
      for (const person of harbourCharacters(`hafen-${i}`, 1, 2)) {
        seen.get(person.gender)!.add(person.role)
      }
    }
    // Both show up, and no role appears under both spellings.
    expect(seen.get('w')!.size).toBeGreaterThan(4)
    expect(seen.get('m')!.size).toBeGreaterThan(4)
    for (const role of seen.get('w')!) expect(seen.get('m')!.has(role)).toBe(false)
  })

  it('keeps the same Makler on a quay so you recognise them', () => {
    const first = harbourGuide('hamburg', 'classic')
    expect(harbourGuide('hamburg', 'classic')).toEqual(first)
    expect(harbourGuide('lissabon', 'classic').name).not.toBe(first.name)
    expect(['Kontormakler', 'Kontormaklerin']).toContain(first.role)
  })

  it('gives ships masters of both kinds', () => {
    const masters = Array.from({ length: 200 }, (_, i) => makeShipIdentity(`v${i}`))
    expect(masters.some((m) => m.captain.startsWith('Kapitänin '))).toBe(true)
    expect(masters.some((m) => m.captain.startsWith('Kapitän '))).toBe(true)
    for (const m of masters) {
      expect(m.captain.startsWith(m.captainGender === 'w' ? 'Kapitänin' : 'Kapitän')).toBe(true)
    }
  })
})
