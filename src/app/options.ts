import { PACK_ENTRIES, packById as packFromRegistry } from '@content/packs'
import type { ContentPack } from '@engine/types'

/**
 * What the player chooses before the first die is thrown.
 *
 * Two paths: "klassisch" takes the Anleitung at its word and asks nothing,
 * "vollständig" opens every knob. Both produce the same `GameOptions`, so the
 * rest of the app never branches on which route was taken.
 */

export type GameMode = 'klassisch' | 'vollstaendig'
export type Travel = 'wuerfel' | 'echtzeit'
export type Table = 'lokal' | 'online-eroeffnen' | 'online-beitreten'
export type JoinPolicy = 'nur-zu-beginn' | 'jederzeit'

/**
 * How much of the world a player may see.
 *
 * 'normal' is the identity projection: everything, always, orders instant.
 * 'realistisch' shows only what a player stands next to or has been told, and
 * orders to distant captains travel by carrier pigeon.
 */
export type Sicht = 'normal' | 'realistisch'

/**
 * Where the goods are.
 *
 * 'fest'      - the Warenverzeichnis as printed: Hamburg ships Chemikalien
 *               and always will.
 * 'zufaellig' - the trade routes are dealt afresh from the seed, so nobody's
 *               memory of the board is worth anything.
 */
export type Angebot = 'fest' | 'zufaellig'

/**
 * What a harbour pays.
 *
 * 'fest'       - one Verkaufspreis per good, the world over.
 * 'entfernung' - the price climbs with the distance to the nearest harbour
 *                that ships the good, so a long haul is the earner.
 */
export type Preise = 'fest' | 'entfernung'

/**
 * Which Konjunktur deck is on the table.
 *
 * 'klassisch' - the 27 printed cards.
 * 'erweitert' - and storms, regional booms and slumps, pirates, local dues.
 */
export type Konjunktur = 'klassisch' | 'erweitert'

export interface GameOptions {
  readonly mode: GameMode
  readonly packId: string
  readonly travel: Travel
  readonly totalRounds: number
  /** Real-time only: minutes of real time per pip of sea lane. */
  readonly minutesPerPip: number
  /** Real-time only: how many real hours the season lasts. */
  readonly durationHours: number
  readonly startingCapital: number
  /**
   * Vessels one house may run. 1 is the printed game: no yard, no fleet.
   * Above that the yards open and a second captain becomes possible.
   */
  readonly fleetLimit: number
  readonly table: Table
  readonly sicht: Sicht
  readonly angebot: Angebot
  readonly preise: Preise
  readonly konjunktur: Konjunktur
  readonly joinPolicy: JoinPolicy
  /** Only for joining: the code of a running game. */
  readonly joinCode: string
}

export const DEFAULT_OPTIONS: GameOptions = {
  mode: 'klassisch',
  packId: 'classic',
  travel: 'wuerfel',
  totalRounds: 30,
  minutesPerPip: 6,
  durationHours: 24,
  startingCapital: 500_000,
  fleetLimit: 1,
  table: 'lokal',
  sicht: 'normal',
  angebot: 'fest',
  preise: 'fest',
  konjunktur: 'klassisch',
  joinPolicy: 'nur-zu-beginn',
  joinCode: '',
}

/**
 * The plans on offer, taken from the content registry rather than listed
 * again here. `ready` survives as a field so the setup screen can still show
 * something it cannot yet offer, but every plan in the registry is playable.
 */
export interface PackEntry {
  readonly id: string
  readonly name: string
  readonly blurb: string
  readonly ready: boolean
  readonly pack?: ContentPack
}

export const PACKS: readonly PackEntry[] = PACK_ENTRIES.map((entry) => ({
  id: entry.id,
  name: entry.label,
  blurb: entry.blurb,
  ready: true,
  pack: entry.pack,
}))

export function packById(id: string): ContentPack {
  return packFromRegistry(id)
}

export interface Capability {
  readonly ready: boolean
  readonly note: string
}

/** What is actually built today. The setup screen reads this, not a guess. */
export const CAPABILITIES: Record<string, Capability> = {
  'travel:wuerfel': { ready: true, note: '' },
  'travel:echtzeit': { ready: true, note: '' },
  'sicht:normal': { ready: true, note: '' },
  'sicht:realistisch': { ready: true, note: '' },
  'table:lokal': { ready: true, note: '' },
  'table:online-eroeffnen': { ready: true, note: '' },
  'table:online-beitreten': { ready: true, note: '' },
  'angebot:fest': { ready: true, note: '' },
  'angebot:zufaellig': { ready: true, note: '' },
  'preise:fest': { ready: true, note: '' },
  'preise:entfernung': { ready: true, note: '' },
  'konjunktur:klassisch': { ready: true, note: '' },
  'konjunktur:erweitert': { ready: true, note: '' },
}

export function isReady(key: string): boolean {
  return CAPABILITIES[key]?.ready ?? true
}
