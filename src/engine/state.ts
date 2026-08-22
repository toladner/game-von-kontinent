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

export interface ShipState {
  readonly nodeId: NodeId
  /**
   * The node the ship came from. "Ein Pendeln der Schiffe ... ist verboten" -
   * a ship may not turn around on the spot, so this edge is barred next step.
   */
  readonly cameFrom: NodeId | null
  /** Turns still to be sat out, e.g. after ramming another ship. */
  readonly skipTurns: number
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

export type Phase =
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
  readonly seq: number
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
