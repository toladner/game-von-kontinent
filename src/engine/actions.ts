import type { GoodId, Money, NodeId, PortId } from './types'
import type { Gender } from './persona'

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
  | {
      readonly type: 'join'
      readonly playerId: string
      readonly name: string
      /** Omitted means "whatever the name rolls" — see makePersona. */
      readonly gender?: Gender
    }
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
  | {
      readonly type: 'setCourse'
      readonly to: PortId
      /** Which vessel. Defaults to the one the merchant is aboard. */
      readonly vehicleId?: string
      readonly by?: string
    }
  /** Order a vessel from the yard. It is delivered to the harbour you stand in. */
  | { readonly type: 'buyVehicle'; readonly kindId: string; readonly by?: string }
  /** Step across to another of your vessels lying in the same harbour. */
  | { readonly type: 'boardVehicle'; readonly vehicleId: string; readonly by?: string }
  /**
   * Release a bird with an order for a distant captain.
   *
   * It flies to where you *believe* the ship to be. You are never told whether
   * it got there; the only evidence is the ship moving, which you also cannot
   * see unless you go and look.
   */
  | {
      readonly type: 'sendPigeon'
      readonly vehicleId: string
      /**
       * The harbour the letter is addressed to. You choose it, and you may be
       * wrong: if she is not there, nobody reads it and nobody tells you.
       */
      readonly toPort: PortId
      readonly destination: PortId
      /** Where the captain should answer, if you want an answer at all. */
      readonly replyTo?: PortId | null
      readonly by?: string
    }
  /** Call at the post office of the harbour you are standing in. */
  | { readonly type: 'collectMail'; readonly by?: string }
  /** The player's own notes; the game remembers nothing for them. */
  | { readonly type: 'writeNote'; readonly text: string; readonly by?: string }
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
  | {
      readonly type: 'vehicleBought'
      readonly playerId: string
      readonly vehicleId: string
      readonly name: string
      readonly price: Money
    }
  | { readonly type: 'boarded'; readonly playerId: string; readonly vehicleId: string }
  | {
      readonly type: 'pigeonSent'
      readonly playerId: string
      readonly toNode: PortId
      readonly kind: 'befehl' | 'bericht'
    }
  | { readonly type: 'mailCollected'; readonly playerId: string; readonly count: number }
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
  /** Erweiterte Konjunktur: cargo over the side, to a storm or to pirates. */
  | {
      readonly type: 'cargoLost'
      readonly playerId: string
      readonly goodId: GoodId
      readonly value: Money
      /** Headline of the card that did it, so the news can name the cause. */
      readonly reason: string
    }
  /** Erweiterte Konjunktur: price weather settled over a continent. */
  | {
      readonly type: 'weatherSet'
      readonly continent: string
      readonly percent: number
      readonly title: string
    }
  | { readonly type: 'turnEnded'; readonly playerId: string }
  | { readonly type: 'roundStarted'; readonly round: number; readonly red: boolean }
  | { readonly type: 'gameOver' }
  | { readonly type: 'rejected'; readonly reason: string }

export interface ActionResult {
  readonly state: import('./state').GameState
  readonly events: readonly GameEvent[]
}
