/**
 * Domain vocabulary for "Von Kontinent zu Kontinent".
 *
 * This file is pure data description: no React, no DOM, no randomness.
 * Content packs (goods, maps, card decks) are *data* that conform to these
 * types, which is what makes new maps / new goods a content change rather
 * than a code change.
 */

export type GoodId = number
export type PortId = string
export type NodeId = string
export type CountryId = string
export type PlayerId = string
export type MapId = string

/** Money is stored in whole units (the board's "Einheiten"). 500_000 to start. */
export type Money = number

// ---------------------------------------------------------------------------
// Goods
// ---------------------------------------------------------------------------

export interface Good {
  /** Card number 1..72 on the original Warenkarten. */
  readonly id: GoodId
  /** German name as printed on the card. */
  readonly name: string
  /** EINKAUF - what the Exportbank charges in an exporting port. */
  readonly buy: Money
  /** VERKAUF - base price the Exportbank pays, before Konjunktur modifiers. */
  readonly sell: Money
  /** Coarse grouping, used for icons/tinting in the UI only. */
  readonly category: GoodCategory
}

export type GoodCategory =
  | 'agrar'
  | 'genuss'
  | 'tier'
  | 'bergbau'
  | 'edel'
  | 'energie'
  | 'industrie'
  | 'textil'

// ---------------------------------------------------------------------------
// Geography
// ---------------------------------------------------------------------------

export type Continent =
  | 'europa'
  | 'afrika'
  | 'nordamerika'
  | 'suedamerika'
  | 'asien'
  | 'ozeanien'

export interface Country {
  readonly id: CountryId
  /** As printed in the Warenverzeichnis, e.g. "ENGLAND und SCHOTTLAND". */
  readonly name: string
  readonly continent: Continent
  /** Goods this country exports; only these can be bought in its ports. */
  readonly exports: readonly GoodId[]
}

/** A navigable point on the sea-lane network. Ports are nodes you may trade at. */
export interface MapNode {
  readonly id: NodeId
  /** Geographic position; the renderer projects this to screen space. */
  readonly lat: number
  readonly lon: number
}

export interface Port extends MapNode {
  readonly kind: 'port'
  readonly name: string
  readonly country: CountryId
  /**
   * Overrides the country's export list for this port alone. The United
   * States are printed city by city in the Warenverzeichnis, which is exactly
   * what this is for.
   */
  readonly exports?: readonly GoodId[]
  /** Label placement hint for the cartographer in us. */
  readonly labelAnchor?: 'start' | 'middle' | 'end'
  readonly labelDy?: number
}

export interface SeaNode extends MapNode {
  readonly kind: 'sea'
}

export type AnyNode = Port | SeaNode

/**
 * How a leg is travelled. The classic board knows only sea lanes; land and
 * rail exist here so a future map can carry them without reshaping the graph.
 */
export type TransportMode = 'see' | 'land' | 'schiene'

/**
 * An undirected lane between two adjacent nodes. One edge is exactly one
 * "pip" of movement, mirroring the printed dots on the board.
 */
export interface Lane {
  readonly a: NodeId
  readonly b: NodeId
  /** Defaults to 'see'. */
  readonly mode?: TransportMode
  /** Optional curvature for drawing (0 = straight great-circle-ish line). */
  readonly bow?: number
}

/**
 * What the player travels in.
 *
 * The original game gives everyone one identical steamer with an unlimited
 * hold, so the classic vehicle has `capacity: null`. Trading your way up from
 * a handcart to a freighter is a matter of swapping this object.
 */
export interface Vehicle {
  readonly id: string
  readonly name: string
  /** null = no limit, as in the original rules. */
  readonly capacity: number | null
  readonly modes: readonly TransportMode[]
  /** Kilometres per pip; lets a lorry and a steamer share one map. */
  readonly kmPerPip?: number
}

export interface GameMap {
  readonly id: MapId
  readonly name: string
  readonly nodes: readonly AnyNode[]
  readonly lanes: readonly Lane[]
  readonly countries: readonly Country[]
  /** Ports players may be dealt as their Ausgangshafen, spread over continents. */
  readonly startPorts: readonly PortId[]
  /** Longitude the equirectangular projection is centred on. */
  readonly projectionCenterLon: number
  readonly bounds: { minLat: number; maxLat: number; minLon: number; maxLon: number }
}

// ---------------------------------------------------------------------------
// Konjunktur (market event) cards
// ---------------------------------------------------------------------------

/**
 * Effects are declarative so new cards are data. A card may carry several.
 */
export type KonjunkturEffect =
  /** Hausse / Baisse: percentage change to sale prices for this transaction. */
  | { readonly kind: 'salePriceDelta'; readonly percent: number }
  /** Steuer / Versicherung: every player pays a share of their cargo value. */
  | {
      readonly kind: 'leviedOnAllShips'
      readonly levy: 'steuer' | 'versicherung'
      readonly percentOfCargoValue: number
    }
  /** Hafengebühr: flat fee for every ship currently lying in a port. */
  | { readonly kind: 'portFeeAllInPort'; readonly amount: Money }
  /** Entladegeld: flat fee for the drawing player. */
  | { readonly kind: 'feeForDrawer'; readonly amount: Money }
  /** Telegramm: the drawing player receives a money order. */
  | { readonly kind: 'payoutToDrawer'; readonly amount: Money }

export interface KonjunkturCard {
  readonly id: string
  /** Headline as printed: "Hausse", "Baisse", "Steuer", "Telegramm", ... */
  readonly title: string
  /** The printed body lines, shown verbatim on the card in the UI. */
  readonly lines: readonly string[]
  readonly effects: readonly KonjunkturEffect[]
}

// ---------------------------------------------------------------------------
// Rule configuration - every tunable number from the Anleitung
// ---------------------------------------------------------------------------

export interface RuleConfig {
  readonly startingCapital: Money
  /** Denominations dealt out, purely for the cash drawer visualisation. */
  readonly startingNotes: readonly { readonly value: Money; readonly count: number }[]
  /** 50 by default; the rules explicitly allow a shorter game, e.g. 30. */
  readonly totalRounds: number
  /** Rounds whose track field is red -> Konjunktur cards are in force. */
  readonly redFields: readonly number[]
  /** How many goods may be bought in one port visit. */
  readonly maxPurchasesPerPort: number
  /** Copies of each Warenkarte the Exportbank owns (the board ships 2). */
  readonly cardCopiesPerGood: number
  /** Selling a good the port itself exports: fraction of the price paid. */
  readonly localGlutSaleRate: number
  /** Forced sale to raise cash: fraction of the price paid. */
  readonly distressSaleRate: number
  /** Final-round sale rate for goods the destination port also exports. */
  readonly finalRoundGlutSaleRate: number
  /** Damages paid when ramming another ship: fraction of victim's cargo value. */
  readonly collisionDamageRate: number
  /** Turns lost by the ship that caused a collision. */
  readonly collisionPenaltyTurns: number
  /** A Steuer/Versicherung demand is only settled once per this many rounds. */
  readonly levyGracePeriodRounds: number
  readonly diceSides: number
  /** What every player starts out travelling in. */
  readonly startingVehicle: Vehicle
}

// ---------------------------------------------------------------------------
// Content pack: everything a variant needs to exist
// ---------------------------------------------------------------------------

export interface ContentPack {
  readonly id: string
  readonly name: string
  readonly map: GameMap
  readonly goods: readonly Good[]
  readonly konjunktur: readonly KonjunkturCard[]
  readonly config: RuleConfig
}
