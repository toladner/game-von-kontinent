import type { EngineContext } from './context'
import type { GameAction } from './actions'
import type { GameState, JoinPolicy } from './state'
import { seedFrom, shuffle, type RngState } from './rng'

export interface NewGameOptions {
  /** Any string; the same seed and the same actions give the same game. */
  readonly seed?: string
  /** The rules allow a shorter game, "z. B. nur 30 statt 50". */
  readonly totalRounds?: number
  /** Overrides the 500.000 the Exportbank normally credits. */
  readonly startingCapital?: number
  /** Whether latecomers may still take a ship out once play has begun. */
  readonly joinPolicy?: JoinPolicy
}

/**
 * Open an empty table.
 *
 * No players yet: everyone, the host included, arrives through a `join`
 * action. That is what lets a whole game be described by `{seed, actions}` —
 * which in turn makes saving, replaying and networked play one problem
 * instead of three.
 */
export function createGame(ctx: EngineContext, options: NewGameOptions = {}): GameState {
  const config = {
    ...ctx.pack.config,
    ...(options.totalRounds ? { totalRounds: options.totalRounds } : {}),
    ...(options.startingCapital ? { startingCapital: options.startingCapital } : {}),
  }

  let rng: RngState = seedFrom(options.seed ?? `partie:${Date.now()}`)

  const [ports, rngAfterPorts] = shuffle(ctx.pack.map.startPorts, rng)
  rng = rngAfterPorts
  const [deck, rngAfterDeck] = shuffle(
    ctx.pack.konjunktur.map((c) => c.id),
    rng,
  )
  rng = rngAfterDeck

  const bankStock: Record<number, number> = {}
  for (const g of ctx.pack.goods) bankStock[g.id] = config.cardCopiesPerGood

  return {
    packId: ctx.pack.id,
    config,
    rng,
    joinPolicy: options.joinPolicy ?? 'nur-zu-beginn',
    startPortPool: ports,
    hostId: null,
    round: 1,
    startPlayerIndex: 0,
    activeIndex: 0,
    phase: 'lobby',
    players: [],
    bankStock,
    deck,
    pendingCard: null,
    saleModifierPercent: 0,
    mustSellForeign: false,
    movement: null,
    seq: 0,
  }
}

/**
 * The opening moves for a table that is filled and started in one go, which
 * is every local game.
 */
export function openingActions(names: readonly string[]): GameAction[] {
  return [
    ...names.map((name, i) => ({
      type: 'join' as const,
      playerId: `p${i + 1}`,
      name: name.trim() || `Kaufmann ${i + 1}`,
    })),
    { type: 'start' as const },
  ]
}
