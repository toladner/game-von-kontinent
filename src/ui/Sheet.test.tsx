// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { nearestSnap } from './Sheet'

/** A phone-ish viewport; peek stands at 336, full at 688. */
const VH = 800

describe('where a released drag lands', () => {
  it('takes the level the thumb ended up nearest to', () => {
    expect(nearestSnap(0, VH)).toBe('closed')
    expect(nearestSnap(336, VH)).toBe('peek')
    expect(nearestSnap(688, VH)).toBe('full')
  })

  it('lets a long haul travel the whole way, not one step', () => {
    // The old rule was "moved more than 40px in a direction", so a drag from
    // full to the floor stopped at peek and a flick from peek jumped to full.
    expect(nearestSnap(20, VH)).toBe('closed')
    expect(nearestSnap(660, VH)).toBe('full')
  })

  it('keeps a small nudge where it started', () => {
    expect(nearestSnap(336 - 30, VH)).toBe('peek')
    expect(nearestSnap(336 + 30, VH)).toBe('peek')
    expect(nearestSnap(688 - 40, VH)).toBe('full')
  })

  it('breaks in the middle, halfway between neighbours', () => {
    expect(nearestSnap(167, VH)).toBe('closed')
    expect(nearestSnap(169, VH)).toBe('peek')
    expect(nearestSnap(511, VH)).toBe('peek')
    expect(nearestSnap(513, VH)).toBe('full')
  })

  it('scales with the window rather than assuming a phone', () => {
    expect(nearestSnap(0.86 * 1200, 1200)).toBe('full')
    expect(nearestSnap(0.42 * 1200, 1200)).toBe('peek')
  })
})
