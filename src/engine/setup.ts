import type { EngineContext } from './context'
import type { GameState, PlayerState } from './state'
import { makePersona } from './persona'
import { seedFrom, shuffle, type RngState } from './rng'

export interface NewGameOptions {
  readonly names: readonly string[]
  /** Any string; the same seed and the same actions give the same game. */
  readonly seed?: string
  /** The rules allow a shorter game, "z. B. nur 30 statt 50". */
  readonly totalRounds?: number
  /** Overrides the 500.000 the Exportbank normally credits. */
  readonly startingCapital?: number
}

/**
 * Deal the ships out, hand every player their 500.000 and open the Kontor.
 *
 * The first turn of each player is deliberately a port visit rather than a
 * throw: "Jeder Spieler kauft in seinem Ausgangshafen Waren."
 */
export function createGame(ctx: EngineContext, options: NewGameOptions): GameState {
  const names = options.names.map((n, i) => n.trim() || `Kaufmann ${i + 1}`)
  if (names.length < 1) throw new Error('Es braucht mindestens einen Mitspieler.')

  const config = {
    ...ctx.pack.config,
    ...(options.totalRounds ? { totalRounds: options.totalRounds } : {}),
    ...(options.startingCapital ? { startingCapital: options.startingCapital } : {}),
  }

  let rng: RngState = seedFrom(options.seed ?? `partie:${names.join('|')}`)

  const [ports, rngAfterPorts] = shuffle(ctx.pack.map.startPorts, rng)
  rng = rngAfterPorts
  const [deck, rngAfterDeck] = shuffle(
    ctx.pack.konjunktur.map((c) => c.id),
    rng,
  )
  rng = rngAfterDeck

  const players: PlayerState[] = names.map((name, i) => {
    const homePort = ports[i % ports.length]!
    return {
      id: `p${i + 1}`,
      name,
      persona: makePersona(name, ctx.pack.id),
      colorIndex: i,
      cash: config.startingCapital,
      cargo: [],
      ship: { nodeId: homePort, cameFrom: null, skipTurns: 0 },
      vehicle: config.startingVehicle,
      homePort,
      purchasesThisVisit: [],
      hasDeparted: false,
      levyPaidRound: { steuer: null, versicherung: null },
    }
  })

  const bankStock: Record<number, number> = {}
  for (const g of ctx.pack.goods) bankStock[g.id] = config.cardCopiesPerGood

  return {
    packId: ctx.pack.id,
    config,
    rng,
    round: 1,
    startPlayerIndex: 0,
    activeIndex: 0,
    phase: 'port',
    players,
    bankStock,
    deck,
    pendingCard: null,
    saleModifierPercent: 0,
    mustSellForeign: false,
    movement: null,
    seq: 0,
  }
}
