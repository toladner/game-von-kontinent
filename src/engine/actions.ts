import type { GoodId, Money, NodeId, PortId } from './types'

/**
 * Everything a player can do, as plain serialisable data.
 *
 * A game is its seed plus this list of actions. Saving is writing the list
 * out; replay is folding it again; a networked game later is shipping these
 * over a wire instead of calling the reducer directly.
 */
export type GameAction =
  /**
   * Taking a ship out. This is an action rather than a setup parameter so a
   * latecomer is simply another entry in the log - the same mechanism that
   * makes replay, saving and network sync work.
   */
  | { readonly type: 'join'; readonly playerId: string; readonly name: string }
  /** The host opens the season. */
  | { readonly type: 'start' }
  | { readonly type: 'roll' }
  | { readonly type: 'step'; readonly to: NodeId }
  | { readonly type: 'drawKonjunktur' }
  | { readonly type: 'buy'; readonly goodId: GoodId; readonly by?: string }
  | { readonly type: 'sell'; readonly uid: string; readonly by?: string }
  | { readonly type: 'endTurn' }
  /**
   * Real-time play: lay in a course for a harbour and let the ship run.
   * The voyage takes real minutes; nobody has to sit and watch it.
   */
  | { readonly type: 'setCourse'; readonly to: PortId; readonly by?: string }
  /**
   * The world clock, carried as data so the reducer never reads it itself.
   * Only this action moves time, which is what keeps replays exact.
   */
  | { readonly type: 'tick'; readonly at: number }

/**
 * What happened, for the log, the animations and the harbour chatter.
 * Events are produced by the reducer; they never feed back into it.
 */
export type GameEvent =
  | {
      readonly type: 'playerJoined'
      readonly playerId: string
      readonly name: string
      readonly portId: PortId
      readonly midGame: boolean
    }
  | { readonly type: 'gameStarted' }
  | {
      readonly type: 'setSail'
      readonly playerId: string
      readonly to: PortId
      readonly arrivesAt: number
    }
  | { readonly type: 'marketTurned'; readonly cardId: string }
  | { readonly type: 'rolled'; readonly playerId: string; readonly value: number }
  | { readonly type: 'moved'; readonly playerId: string; readonly to: NodeId }
  | { readonly type: 'arrived'; readonly playerId: string; readonly portId: PortId }
  | { readonly type: 'stoppedAtSea'; readonly playerId: string }
  | {
      readonly type: 'collision'
      readonly playerId: string
      readonly victimId: string
      readonly damages: Money
    }
  | {
      readonly type: 'bought'
      readonly playerId: string
      readonly goodId: GoodId
      readonly price: Money
    }
  | {
      readonly type: 'sold'
      readonly playerId: string
      readonly goodId: GoodId
      readonly price: Money
      readonly profit: Money
      readonly kind: 'markt' | 'ueberfluss' | 'notverkauf' | 'schluss'
    }
  | { readonly type: 'cardDrawn'; readonly playerId: string; readonly cardId: string }
  | {
      readonly type: 'paid'
      readonly playerId: string
      readonly amount: Money
      readonly reason: 'steuer' | 'versicherung' | 'hafengebuehr' | 'entladegeld' | 'schaden'
    }
  | {
      readonly type: 'received'
      readonly playerId: string
      readonly amount: Money
      readonly reason: 'telegramm' | 'schaden'
    }
  | { readonly type: 'levySkipped'; readonly playerId: string; readonly levy: string }
  | { readonly type: 'turnEnded'; readonly playerId: string }
  | { readonly type: 'roundStarted'; readonly round: number; readonly red: boolean }
  | { readonly type: 'gameOver' }
  | { readonly type: 'rejected'; readonly reason: string }

export interface ActionResult {
  readonly state: import('./state').GameState
  readonly events: readonly GameEvent[]
}
