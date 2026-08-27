/**
 * Domain vocabulary for "Von Kontinent zu Kontinent".
 *
 * This file is pure data description: no React, no DOM, no randomness.
 * Content packs (goods, maps, card decks) are *data* that conform to these
 * types, which is what makes new maps / new goods a content change rather
 * than a code change.
 */

import type { Localized } from '../i18n/locale'

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
  /**
   * The English name, where one was chosen. Folded on from
   * `@content/naming` as the deck is assembled, so the transcription above
   * stays a faithful copy of the card and nothing in the engine has to know
   * a dictionary exists. Absent means the two languages agree.
   */
  readonly en?: string
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
  /** The English name, where one was chosen. See `Good.en`. */
  readonly en?: string
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
  /**
   * The English name, where the trade had one of its own — Genoa for Genua,
   * Copenhagen for Kopenhagen. Most harbours have none and read the same in
   * both languages. See `Good.en`.
   */
  readonly en?: string
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
  readonly name: Localized<string>
  /** null = no limit, as in the original rules. */
  readonly capacity: number | null
  readonly modes: readonly TransportMode[]
  /** What the yard charges. Zero for the vessel a house starts with. */
  readonly price: Money
  /**
   * Multiplies the time a leg takes. Below 1 is a flyer, above 1 a lumberer.
   */
  readonly speedFactor: number
  /** One line of sales patter for the shipyard. */
  readonly blurb?: Localized<string>
}

export interface GameMap {
  readonly id: MapId
  readonly name: Localized<string>
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
  /**
   * Erweiterte Konjunktur — events that pick out a part of the world rather
   * than the whole board. These are what make a plan with five oceans feel
   * different from a plan with one: a storm in the Indian Ocean is news if
   * you are in it and gossip if you are not.
   */
  /** A price swing over one continent, in force for a number of rounds. */
  | {
      readonly kind: 'regionalPriceDelta'
      readonly continent: Continent
      readonly percent: number
      /** Rounds it stays in force; in real-time play, hours. */
      readonly rounds: number
      /** Headline for the news, e.g. "Hausse in Ostasien". */
      readonly title: Localized<string>
    }
  /** Heavy weather in one region: every ship caught in it loses cargo. */
  | {
      readonly kind: 'stormInRegion'
      readonly continent: Continent
      /** Pieces of cargo lost per ship, dearest first. */
      readonly lose: number
      readonly title: Localized<string>
    }
  /**
   * Heavy weather that spoils rather than sinks: the cargo stays in the hold
   * and is worth a fraction of it. The cheaper half of a storm, and the more
   * interesting one — a sunk posten is a number going down, a spoiled one is
   * still yours to place, and a soaked bale of silk in the wrong harbour is a
   * decision rather than a loss.
   */
  | {
      readonly kind: 'cargoDamagedInRegion'
      readonly continent: Continent
      /** Pieces spoiled per ship, dearest first. */
      readonly count: number
      readonly title: Localized<string>
    }
  /**
   * Weather that costs time instead of goods. In real-time play, where the
   * clock is the whole currency, being held four hours off a headland is the
   * sharpest thing that can happen to you short of losing the cargo; in round
   * play it is a turn spent hove to.
   */
  | {
      readonly kind: 'delayInRegion'
      readonly continent: Continent
      /** Minutes added to a voyage already at sea in that part of the world. */
      readonly minutes: number
      readonly title: Localized<string>
    }
  /**
   * A price movement that follows a ware rather than a place.
   *
   * The printed deck moves every price on the board at once and the regional
   * cards move every price in one ocean; both ask where a merchant is. This
   * asks what is in the hold. A failed coffee harvest lifts coffee in every
   * harbour there is, and the house carrying coffee is the one it finds —
   * which is the first reason in this game to have read the Warenverzeichnis.
   */
  | {
      readonly kind: 'goodPriceDelta'
      /** One ware by its Warenkarte, or a whole column of the register. */
      readonly scope:
        | { readonly good: GoodId; readonly gruppe?: undefined }
        | { readonly gruppe: GoodCategory; readonly good?: undefined }
      readonly percent: number
      /** Turns of the market it stays in force, as for regionalPriceDelta. */
      readonly rounds: number
      readonly title: Localized<string>
    }
  /**
   * Quarantine, a dock strike, a harbour silted up: one port shuts its Kontor.
   *
   * The only card that changes the shape of the map instead of the numbers on
   * it. Which harbour is drawn when the card is turned rather than printed on
   * it, so the same card works on every plan — and so the news has something
   * to name.
   */
  | {
      readonly kind: 'portClosed'
      readonly continent: Continent
      /** Turns of the market it stays shut, as for the price notices. */
      readonly rounds: number
      readonly title: Localized<string>
    }
  /** Pirates, ice, a fire in the hold: the drawing player alone loses cargo. */
  | {
      readonly kind: 'cargoLostByDrawer'
      readonly lose: number
      readonly title: Localized<string>
    }
  /** A windfall or demand for every ship lying in one continent's harbours. */
  | {
      readonly kind: 'regionalLevy'
      readonly continent: Continent
      readonly amount: Money
      /** Positive pays the houses, negative charges them. */
      readonly sign: 1 | -1
      readonly title: Localized<string>
    }

export interface KonjunkturCard {
  readonly id: string
  /** Headline as printed: "Hausse", "Baisse", "Steuer", "Telegramm", ... */
  readonly title: Localized<string>
  /**
   * The printed body lines, shown on the card face in the UI.
   *
   * Localized as a whole list rather than line by line because the two
   * languages do not always break a card's text in the same places — an
   * English notice that reads well in two lines may want three in German.
   */
  readonly lines: Localized<readonly string[]>
  readonly effects: readonly KonjunkturEffect[]
}

// ---------------------------------------------------------------------------
// Rule configuration - every tunable number from the Anleitung
// ---------------------------------------------------------------------------

/**
 * How ships move.
 *
 * 'runde'   - the printed game: throw, count off the pips, hand over.
 * 'echtzeit' - ships sail continuously; a voyage takes real minutes and the
 *              players come and go as they please.
 */
export type TravelMode = 'runde' | 'echtzeit'

export interface RealtimeConfig {
  /**
   * Real minutes a ship needs for one pip of sea lane.
   *
   * The map is cut at 550 km to the pip, and a 1950s general-cargo steamer
   * made about 14 knots — 622 km a day — so one pip is very nearly one day of
   * steaming. At six real minutes to the pip a whole day of play is about
   * seven months of trading, Hamburg to New York takes 67 real minutes, and
   * the figures the plan produces match the real crossings: 9.9 days across
   * the Atlantic, 14 from Kapstadt to Fremantle.
   */
  readonly minutesPerPip: number
  /**
   * How long a ship lies alongside before it can sail, as a fraction of a pip.
   *
   * A break-bulk freighter of the period spent three to seven days in port
   * and something like half its life alongside — but a house here loads at
   * most two Warenkarten, a parcel rather than a full hold, so a short call
   * is the honest figure. 0.4 of a pip is about eight hours: a working day of
   * loading, and two and a half real minutes at the default pace. Multiplied
   * by the vessel's speedFactor, so a Großfrachter is slower to turn round.
   */
  readonly portCallPips: number
  /** How often the world market turns a new Konjunktur card. */
  readonly marketIntervalMinutes: number
  /**
   * How likely the market is to have anything to say when it is asked.
   *
   * A notice every twenty minutes without fail made the Konjunktur wallpaper:
   * something was always in force, so nothing was news. At even odds the quiet
   * stretches come back, and a card turning up means something again.
   */
  readonly marketChancePercent: number
  /** The season closes this many real hours after departure. */
  readonly durationHours: number
}

/** Which Konjunktur deck is in play. */
export type KonjunkturMode = 'klassisch' | 'erweitert'

/** How goods are distributed over the harbours. */
export type AngebotMode = 'fest' | 'zufaellig'

/** How a sale price is arrived at. */
export type PreisMode = 'fest' | 'entfernung'

/** How much of the world a house may see. */
export type Sicht = 'normal' | 'realistisch'

export interface PigeonConfig {
  /** Real minutes a bird needs per pip of distance. */
  readonly minutesPerPip: number
  /** Chance in percent that a bird is lost on the way. */
  readonly lossPercent: number
  /** What the loft charges to release one. */
  readonly price: Money
}

export interface RuleConfig {
  readonly travel: TravelMode
  readonly sicht: Sicht
  /**
   * 'fest'      - harbours ship what the Warenverzeichnis says they ship.
   * 'zufaellig' - the trade routes are rolled from the seed instead.
   */
  /**
   * 'klassisch' - the 27 printed Konjunkturkarten and nothing else.
   * 'erweitert' - and storms, regional booms, pirates and local demands.
   *
   * Named for the mode rather than the deck, because `ContentPack.konjunktur`
   * is the deck and the two would otherwise read alike.
   */
  readonly konjunkturMode: KonjunkturMode
  readonly angebot: AngebotMode
  /**
   * 'fest'       - one printed Verkaufspreis, good the world over.
   * 'entfernung' - a good is worth more the further it has been carried from
   *                the nearest harbour that ships it.
   */
  readonly preise: PreisMode
  readonly pigeon: PigeonConfig
  /** Characters a player's notebook holds. */
  readonly notebookLimit: number
  readonly realtime: RealtimeConfig
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
  /** What a spoiled posten still fetches, as a fraction of the clean price. */
  readonly damagedSaleRate: number
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
  /** How many vessels one house may run at once. */
  readonly maxFleetSize: number
}

// ---------------------------------------------------------------------------
// Content pack: everything a variant needs to exist
// ---------------------------------------------------------------------------

export interface ContentPack {
  readonly id: string
  readonly name: Localized<string>
  readonly map: GameMap
  /** Vessels the shipyards offer, beyond the one every house starts with. */
  readonly vehicles: readonly Vehicle[]
  readonly goods: readonly Good[]
  /** The 27 printed cards. Always present; used under 'klassisch'. */
  readonly konjunktur: readonly KonjunkturCard[]
  /**
   * The larger deck used under `konjunkturMode: 'erweitert'`. Includes the
   * printed cards, so the mode adds weather rather than replacing the game.
   */
  readonly konjunkturErweitert?: readonly KonjunkturCard[]
  readonly config: RuleConfig
}
