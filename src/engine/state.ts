import type { GoodId, Money, NodeId, PortId, RuleConfig, Vehicle } from './types'
import type { RngState } from './rng'
import type { Persona } from './persona'

export interface CargoItem {
  readonly uid: string
  readonly goodId: GoodId
  /** What the Exportbank actually charged. Drives every loss-price rule. */
  readonly pricePaid: Money
  readonly boughtAt: PortId
  readonly boughtRound: number
}

/**
 * A voyage under way. The ship is between `nodeId` and `route[0]`, and will
 * be there at `legArrivesAt`. Everything is absolute epoch milliseconds, so a
 * client that was asleep for six hours works out the same answer as one that
 * watched the whole way.
 */
export interface Voyage {
  /** Nodes still to be reached, in order. The last one is the destination. */
  readonly route: readonly NodeId[]
  readonly legStartedAt: number
  readonly legArrivesAt: number
  readonly destination: PortId
}

export interface ShipState {
  readonly nodeId: NodeId
  /**
   * The node the ship came from. "Ein Pendeln der Schiffe ... ist verboten" -
   * a ship may not turn around on the spot, so this edge is barred next step.
   */
  readonly cameFrom: NodeId | null
  /** Turns still to be sat out, e.g. after ramming another ship. */
  readonly skipTurns: number
  /** Null when lying still. Only used in real-time play. */
  readonly voyage?: Voyage | null
}

export interface PlayerState {
  readonly id: string
  readonly name: string
  readonly persona: Persona
  readonly colorIndex: number
  readonly cash: Money
  readonly cargo: readonly CargoItem[]
  readonly ship: ShipState
  readonly vehicle: Vehicle
  readonly homePort: PortId
  /** Goods bought during the current port visit; max 2, never twice the same. */
  readonly purchasesThisVisit: readonly GoodId[]
  /**
   * False until the player has finished provisioning in their Ausgangshafen.
   * The very first turn is a port visit, not a throw of the dice.
   */
  readonly hasDeparted: boolean
  /** Round in which a levy of each kind was last settled (grace period). */
  readonly levyPaidRound: { readonly steuer: number | null; readonly versicherung: number | null }
}

export type JoinPolicy = 'nur-zu-beginn' | 'jederzeit'

export type Phase =
  /** Players are gathering; nobody has sailed yet. */
  | 'lobby'
  /** Real-time play: everyone acts when they like, there is no turn. */
  | 'laufend'
  /** Waiting for the active player to throw. */
  | 'roll'
  /** Dice thrown; player is picking their way along the sea lanes. */
  | 'move'
  /** A red field is in force and the card must be turned before trading. */
  | 'konjunktur'
  /** Ship lies in a port; buying and selling is open. */
  | 'port'
  /** Move finished on open water; nothing to do but report and hand over. */
  | 'endOfTurn'
  /** Round limit reached; ships run to their last harbour. */
  | 'finalRun'
  | 'over'

export interface MovementState {
  readonly rolled: number
  readonly remaining: number
  /** Nodes visited this move, for drawing the wake. */
  readonly path: readonly NodeId[]
}

export interface PendingCard {
  readonly cardId: string
  readonly drawerId: string
}

export interface GameState {
  readonly packId: string
  readonly config: RuleConfig
  readonly rng: RngState
  /** Whether latecomers may still take a ship out. */
  readonly joinPolicy: JoinPolicy
  /**
   * Ausgangshäfen not yet handed out, shuffled at creation. Joining consumes
   * one, which is what lets a player arrive mid-game and still be dealt a
   * harbour deterministically.
   */
  readonly startPortPool: readonly PortId[]
  /** The player who opened the table; only they may start it. */
  readonly hostId: string | null
  /** 1-based; matches the Kegelfigur on the printed round track. */
  readonly round: number
  readonly startPlayerIndex: number
  readonly activeIndex: number
  readonly phase: Phase
  readonly players: readonly PlayerState[]
  /** Remaining Warenkarten per good; the bank owns two of each. */
  readonly bankStock: Readonly<Record<number, number>>
  /** Konjunktur deck as card ids, drawn from the top, returned to the bottom. */
  readonly deck: readonly string[]
  readonly pendingCard: PendingCard | null
  /** Sale price modifier in percent for the current port visit only. */
  readonly saleModifierPercent: number
  /**
   * On a red field the player must sell at least one good the port does not
   * itself export before leaving ("Verkaufszwang").
   */
  readonly mustSellForeign: boolean
  readonly movement: MovementState | null
  /**
   * World clock in epoch milliseconds, advanced only by `tick` actions.
   * The reducer never reads the wall clock itself — that is what keeps a
   * replay of the log identical to the game that was played.
   */
  readonly now: number
  readonly startedAt: number
  /** When the season closes. Zero in round-based play. */
  readonly endsAt: number
  /** The Konjunktur card the world market is currently under, if any. */
  readonly marketCardId: string | null
  readonly marketSince: number
  readonly seq: number
}

/** True when this ship is lying in a harbour and free to trade. */
export function inPort(player: PlayerState, portIds: ReadonlySet<string>): boolean {
  return !player.ship.voyage && portIds.has(player.ship.nodeId)
}

/** How far along the current leg, 0..1. For drawing only. */
export function voyageProgress(voyage: Voyage, now: number): number {
  const span = voyage.legArrivesAt - voyage.legStartedAt
  if (span <= 0) return 1
  return Math.min(1, Math.max(0, (now - voyage.legStartedAt) / span))
}

export function activePlayer(state: GameState): PlayerState {
  const p = state.players[state.activeIndex]
  if (!p) throw new Error('No active player')
  return p
}

export function playerById(state: GameState, id: string): PlayerState {
  const p = state.players.find((x) => x.id === id)
  if (!p) throw new Error(`Unknown player ${id}`)
  return p
}

export function cargoValue(player: PlayerState): Money {
  return player.cargo.reduce((sum, item) => sum + item.pricePaid, 0)
}

/** Net worth as the rules score it at the end: cash plus what the hold is worth. */
export function netWorth(player: PlayerState): Money {
  return player.cash + cargoValue(player)
}
