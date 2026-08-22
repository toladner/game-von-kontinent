// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { snapTo } from './Sheet'

/** A phone-ish viewport: peek stands at 336, full at 688. */
const VH = 800
const PEEK = 0.42 * VH
const FULL = 0.86 * VH

/** A fifth of the gap between the two open levels — about 70px here. */
const COMMIT_UP = PEEK + 0.2 * (FULL - PEEK)
/** A fifth of the way from peek down to the floor — about 67px. */
const COMMIT_DOWN = PEEK - 0.2 * PEEK

describe('where a released drag lands', () => {
  it('commits upward after a fifth of the gap, not half of it', () => {
    // Nearest-wins put the boundary at the halfway mark, so reaching full
    // meant hauling the sheet most of the way there by hand.
    expect(snapTo('peek', COMMIT_UP + 1, VH)).toBe('full')
    expect(snapTo('peek', COMMIT_UP - 1, VH)).toBe('peek')
    expect(snapTo('peek', PEEK + 80, VH)).toBe('full')
  })

  it('commits downward on the same fifth', () => {
    expect(snapTo('peek', COMMIT_DOWN - 1, VH)).toBe('closed')
    expect(snapTo('peek', COMMIT_DOWN + 1, VH)).toBe('peek')

    const fromFull = FULL - 0.2 * (FULL - PEEK)
    expect(snapTo('full', fromFull - 1, VH)).toBe('peek')
    expect(snapTo('full', fromFull + 1, VH)).toBe('full')
  })

  it('stays put when the thumb barely moves', () => {
    expect(snapTo('peek', PEEK, VH)).toBe('peek')
    expect(snapTo('peek', PEEK + 20, VH)).toBe('peek')
    expect(snapTo('peek', PEEK - 20, VH)).toBe('peek')
    expect(snapTo('full', FULL - 20, VH)).toBe('full')
  })

  it('keeps stepping while each fifth is cleared', () => {
    // A long haul from full to the floor should close, not stop at the first
    // level it passes on the way.
    expect(snapTo('full', 40, VH)).toBe('closed')
    expect(snapTo('full', 0, VH)).toBe('closed')
    // But a haul that runs out of momentum in peek's territory stays there.
    expect(snapTo('full', PEEK, VH)).toBe('peek')
  })

  it('cannot be pushed past the ends', () => {
    expect(snapTo('full', FULL + 400, VH)).toBe('full')
    expect(snapTo('closed', -50, VH)).toBe('closed')
  })

  it('is direction-aware, so the same height can mean two things', () => {
    // Halfway between peek and full: coming up from peek, a fifth is long
    // since cleared and it commits. Coming down from full, it has not yet
    // cleared full's fifth, so it stays.
    const middle = (PEEK + FULL) / 2
    expect(snapTo('peek', middle, VH)).toBe('full')
    expect(snapTo('full', middle, VH)).toBe('peek')
  })

  it('scales with the window rather than assuming a phone', () => {
    expect(snapTo('peek', 0.42 * 1200 + 0.2 * 0.44 * 1200 + 1, 1200)).toBe('full')
    expect(snapTo('peek', 0.42 * 1200 + 10, 1200)).toBe('peek')
  })
})
