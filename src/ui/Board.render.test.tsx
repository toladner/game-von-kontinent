// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { CLASSIC_PACK } from '@content/maps/classic'
import { createContext } from '@engine/context'
import { createGame } from '@engine/setup'
import { applyAction, replay } from '@engine/reducer'
import { routeTo } from '@engine/selectors'
import { flagship, voyageProgress, type GameState } from '@engine/state'
import { project } from '@engine/geo'
import { REGELSTAND } from '@engine/regeln'
import { Board } from './Board'

/**
 * The chart, checked against the map it claims to be of.
 *
 * `shipNudge` is tested on its own next door; this is here because the bug it
 * fixes was never in the sum, it was in what the drawing passed to it. A
 * ship's place on the plan is the one thing a merchant cannot check against
 * anything else, so it is worth pinning to the projection itself rather than
 * to the last screenshot anyone happened to look at.
 */
afterEach(cleanup)

describe('the chart draws a ship where she is', () => {
  const ctx = createContext(CLASSIC_PACK)
  const BOARD_W = 1200
  const { bounds } = CLASSIC_PACK.map
  const H = (BOARD_W * (bounds.maxLat - bounds.minLat)) / (bounds.maxLon - bounds.minLon)
  const T0 = 1_800_000_000_000

  const xy = (nodeId: string) => {
    const node = CLASSIC_PACK.map.nodes.find((n) => n.id === nodeId)!
    return project(node, bounds, { width: BOARD_W, height: H })
  }

  /** A full table — six houses, which is where the old fan went widest. */
  const table = (): GameState =>
    replay(
      ctx,
      createGame(ctx, {
        seed: 'chart',
        travel: 'echtzeit',
        minutesPerPip: 30,
        durationHours: 24,
        regeln: REGELSTAND,
      }),
      [
        { type: 'tick', at: T0 },
        ...['a', 'b', 'c', 'd', 'e', 'f'].map((id, i) => ({
          type: 'join' as const,
          playerId: id,
          name: `H${i}`,
        })),
        { type: 'start' as const },
      ],
    )

  /** Every ship the chart drew, as the translate in its transform. */
  const drawn = (container: HTMLElement) =>
    [...container.querySelectorAll('g[transform]')]
      .map((g) => g.getAttribute('transform')!)
      .filter((tr) => tr.includes('scale('))
      .map((tr) => {
        const m = /translate\(([-\d.]+) ([-\d.]+)\)/.exec(tr)!
        return { x: Number(m[1]), y: Number(m[2]) }
      })

  const chart = (state: GameState, now: number) =>
    drawn(
      render(
        <Board ctx={ctx} state={state} legalTargets={[]} onPick={() => {}} now={now} />,
      ).container,
    )

  it('puts a ship at sea on the line between the two harbours', () => {
    let s = table()
    const from = flagship(s.players[0]!).nodeId
    // Far enough that she is still well out when the chart is drawn.
    const target = [...ctx.portsById.keys()].find(
      (id) => id !== from && routeTo(ctx, from, null, id).length >= 4,
    )!
    s = applyAction(ctx, s, { type: 'setCourse', to: target, by: 'a' }).state
    const voyage = flagship(s.players[0]!).voyage!
    s = { ...s, now: voyage.legStartedAt + (voyage.legArrivesAt - voyage.legStartedAt) / 2 }

    const a = xy(flagship(s.players[0]!).nodeId)
    const b = xy(voyage.route[0]!)
    const t = voyageProgress(voyage, s.now)
    const expected = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }

    const marks = chart(s, s.now)
    // The Ship group is drawn four points above its position so the hull sits
    // on the node rather than hanging below it; that is the whole offset.
    const hers = marks.find((m) => Math.abs(m.x - expected.x) < 0.01)
    expect(hers, 'no ship drawn at the interpolated position').toBeTruthy()
    expect(hers!.y).toBeCloseTo(expected.y - 4, 6)
  })

  it('puts a ship alone in a harbour on the harbour', () => {
    // Six houses in six different harbours: not one of them may be shifted,
    // because there is nothing beside any of them to be shifted away from.
    const s = table()
    const marks = chart(s, s.now)
    for (const p of s.players) {
      const node = xy(flagship(p).nodeId)
      const hers = marks.find((m) => Math.abs(m.x - node.x) < 0.01)
      expect(hers, `no ship drawn at ${flagship(p).nodeId}`).toBeTruthy()
      expect(hers!.y).toBeCloseTo(node.y - 4, 6)
    }
  })
})
