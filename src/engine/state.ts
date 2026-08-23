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

/**
 * One vessel of a trading house.
 *
 * A player begins with a single ship and may buy more. Each carries its own
 * hold and sails its own course, which is what makes it possible to own
 * something you cannot see.
 */
export interface VehicleInstance {
  readonly id: string
  /** The ship's name, so a captain can be written to by more than an id. */
  readonly name: string
  readonly kind: Vehicle
  readonly nodeId: NodeId
  /**
   * The node the ship came from. "Ein Pendeln der Schiffe ... ist verboten" -
   * a ship may not turn around on the spot, so this edge is barred next step.
   *
   * Cleared on arrival in a harbour: "die Reiseroute bleibt dem Spieler
   * überlassen", and a captain who has paid for a full port call may put about
   * and leave the way they came. Only the flinch at sea stays forbidden.
   */
  readonly cameFrom: NodeId | null
  /** Turns still to be sat out, e.g. after ramming another ship. */
  readonly skipTurns: number
  /** Null when lying still. Only used in real-time play. */
  readonly voyage: Voyage | null
  readonly cargo: readonly CargoItem[]
  /** Goods bought during the current port call; max 2, never twice the same. */
  readonly purchasesThisVisit: readonly GoodId[]
  /**
   * Set only in a projected view under Sicht "realistisch": this position is
   * the last thing you were told, not where the ship is now.
   */
  readonly unseen?: boolean
  /** Set only in a projected view: another house's vessel you cannot see. */
  readonly hidden?: boolean
}

/** Kept as an alias: a great deal of code speaks of a player's ship. */
export type ShipState = VehicleInstance

export interface PlayerState {
  readonly id: string
  readonly name: string
  readonly persona: Persona
  readonly colorIndex: number
  readonly cash: Money
  /** Every vessel the house owns. Never empty. */
  readonly fleet: readonly VehicleInstance[]
  /** The vessel the merchant is personally travelling aboard. */
  readonly aboard: string
  readonly homePort: PortId
  /**
   * False until the player has finished provisioning in their Ausgangshafen.
   * The very first turn is a port visit, not a throw of the dice.
   */
  readonly hasDeparted: boolean
  /** Round in which a levy of each kind was last settled (grace period). */
  readonly levyPaidRound: { readonly steuer: number | null; readonly versicherung: number | null }
  /** Only meaningful under Sicht "realistisch". */
  readonly knowledge: PlayerKnowledge
}

// ---------------------------------------------------------------------------
// Sicht "realistisch": belief, letters and pigeons
// ---------------------------------------------------------------------------

/** What a house last learned about one of its vessels, and when. */
export interface Sighting {
  readonly vehicleId: string
  readonly nodeId: NodeId
  /** World time the news describes — not when it was read. */
  readonly asOf: number
  /** Where the news was written, or seen with one's own eyes. */
  readonly place: PortId | null
  /** Where she was said to be bound, if anywhere. */
  readonly bound: PortId | null
  /** The hold as it stood then. */
  readonly cargo: readonly CargoItem[]
  /** True when the merchant was standing on the deck at the time. */
  readonly firsthand: boolean
}

export interface Letter {
  readonly id: string
  readonly vehicleId: string
  readonly vehicleName: string
  readonly captain: string
  readonly writtenAt: number
  readonly writtenIn: PortId
  readonly sighting: Sighting
}

/**
 * A bird in the air. Nobody is told whether it arrives; the only evidence is
 * the world changing, or not.
 */
export interface Pigeon {
  readonly id: string
  readonly playerId: string
  readonly kind: 'befehl' | 'bericht'
  /** The harbour it is flying to — where the sender believed to find someone. */
  readonly toNode: PortId
  readonly sentAt: number
  readonly arrivesAt: number
  /**
   * Decided by the seeded generator the moment it is released, so every
   * device agrees about a bird that never arrives.
   */
  readonly doomed: boolean
  /** For an order: which ship, where to, and where to answer. */
  readonly order?: {
    readonly vehicleId: string
    readonly destination: PortId
    readonly replyTo: PortId | null
  }
  readonly letter?: Letter
}

export interface PlayerKnowledge {
  /** Last known whereabouts of each of the house's own vessels. */
  readonly sightings: Readonly<Record<string, Sighting>>
  /** Letters lying at a harbour, waiting to be fetched in person. */
  readonly waiting: Readonly<Record<string, readonly Letter[]>>
  /** Letters read, newest last. */
  readonly read: readonly Letter[]
  /** The player's own notes. Nothing else remembers for them. */
  readonly notebook: string
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
  /** Birds currently in the air. Empty unless Sicht is "realistisch". */
  readonly pigeons: readonly Pigeon[]
  readonly seq: number
}

// ---------------------------------------------------------------------------
// Fleet helpers
// ---------------------------------------------------------------------------

/** The vessel the merchant is aboard. Never null: a house always has a ship. */
export function flagship(player: PlayerState): VehicleInstance {
  const v = player.fleet.find((x) => x.id === player.aboard) ?? player.fleet[0]
  if (!v) throw new Error(`${player.name} has no vessel`)
  return v
}

export function vehicleOf(player: PlayerState, vehicleId: string): VehicleInstance | null {
  return player.fleet.find((v) => v.id === vehicleId) ?? null
}

/** Every vessel on the board, with the house that owns it. */
export function allVehicles(
  state: GameState,
): readonly { player: PlayerState; vehicle: VehicleInstance }[] {
  return state.players.flatMap((player) => player.fleet.map((vehicle) => ({ player, vehicle })))
}

/** True when this vessel is lying in a harbour and free to trade. */
export function inPort(vehicle: VehicleInstance, portIds: ReadonlySet<string>): boolean {
  return !vehicle.voyage && portIds.has(vehicle.nodeId)
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

/** What the whole fleet is carrying, at what it cost. */
export function cargoValue(player: PlayerState): Money {
  return player.fleet.reduce(
    (sum, v) => sum + v.cargo.reduce((s, item) => s + item.pricePaid, 0),
    0,
  )
}

export function fleetCargo(player: PlayerState): readonly CargoItem[] {
  return player.fleet.flatMap((v) => v.cargo)
}

/** Net worth as the rules score it at the end: cash plus what the holds hold. */
export function netWorth(player: PlayerState): Money {
  return player.cash + cargoValue(player)
}
