import type { EngineContext } from './context'
import type { GameAction } from './actions'
import type { GameState, JoinPolicy } from './state'
import type { Sicht, TravelMode } from './types'
import type { Gender } from './persona'
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
  readonly travel?: TravelMode
  /** Real minutes per pip of sea lane; only meaningful in real-time play. */
  readonly minutesPerPip?: number
  /** Real hours the season lasts; only meaningful in real-time play. */
  readonly durationHours?: number
  readonly sicht?: Sicht
  /**
   * Vessels one house may run at once. The printed game says one; a variant
   * that wants a fleet has to ask for it.
   */
  readonly maxFleetSize?: number
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
    ...(options.travel ? { travel: options.travel } : {}),
    ...(options.sicht ? { sicht: options.sicht } : {}),
    ...(options.maxFleetSize ? { maxFleetSize: options.maxFleetSize } : {}),
    realtime: {
      ...ctx.pack.config.realtime,
      ...(options.minutesPerPip ? { minutesPerPip: options.minutesPerPip } : {}),
      ...(options.durationHours ? { durationHours: options.durationHours } : {}),
    },
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
    now: 0,
    startedAt: 0,
    endsAt: 0,
    marketCardId: null,
    marketSince: 0,
    pigeons: [],
    seq: 0,
  }
}

/**
 * A place at the table. A bare string is a name and nothing more, which is
 * the zero-friction path; the object form carries a chosen gender.
 */
export type Seat = string | { readonly name: string; readonly gender?: Gender }

/**
 * The opening moves for a table that is filled and started in one go, which
 * is every local game.
 */
export function openingActions(seats: readonly Seat[]): GameAction[] {
  return [
    ...seats.map((seat, i) => {
      const { name, gender } = typeof seat === 'string' ? { name: seat, gender: undefined } : seat
      return {
        type: 'join' as const,
        playerId: `p${i + 1}`,
        name: name.trim() || `Haus ${i + 1}`,
        ...(gender ? { gender } : {}),
      }
    }),
    { type: 'start' as const },
  ]
}
