import { PACK_ENTRIES, packById as packFromRegistry } from '@content/packs'
import type { ContentPack } from '@engine/types'
import type { GameState } from '@engine/state'
import type { TableSettings } from '@app/net'
import type { Localized } from '@i18n/locale'

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
  minutesPerPip: 30,
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
 * The terms of a table already standing, read back into the setup form.
 *
 * Until now the arrow only pointed one way: options were turned into a game
 * and that was that. A host who wants to change his mind on the quayside needs
 * the other direction, and needs it to be exact — the form he is handed has to
 * be the form he filled in, or the first field he does not touch is the one
 * that quietly changes.
 */
export function optionsOf(state: GameState): GameOptions {
  return {
    ...DEFAULT_OPTIONS,
    // A table being reconsidered is by definition not the one-question route.
    mode: 'vollstaendig',
    table: 'online-eroeffnen',
    packId: state.packId,
    // The engine says 'runde' where the setup screen says 'wuerfel': the
    // engine names the unit of time, the screen names the thing on the table.
    travel: state.config.travel === 'echtzeit' ? 'echtzeit' : 'wuerfel',
    totalRounds: state.config.totalRounds,
    minutesPerPip: state.config.realtime.minutesPerPip,
    durationHours: state.config.realtime.durationHours,
    startingCapital: state.config.startingCapital,
    fleetLimit: state.config.maxFleetSize,
    sicht: state.config.sicht,
    angebot: state.config.angebot,
    preise: state.config.preise,
    konjunktur: state.config.konjunkturMode,
    joinPolicy: state.joinPolicy,
  }
}

/**
 * And back out again, as the settings a table is kept under.
 *
 * The seed is not here and never will be: it is what makes this table this
 * table rather than another one with the same rules.
 */
export function settingsOf(options: GameOptions): TableSettings {
  return {
    packId: options.packId,
    totalRounds: options.totalRounds,
    startingCapital: options.startingCapital,
    joinPolicy: options.joinPolicy,
    sicht: options.sicht,
    travel: options.travel === 'echtzeit' ? 'echtzeit' : 'runde',
    minutesPerPip: options.minutesPerPip,
    durationHours: options.durationHours,
    maxFleetSize: options.fleetLimit,
    angebot: options.angebot,
    preise: options.preise,
    konjunktur: options.konjunktur,
  }
}

/**
 * The plans on offer, taken from the content registry rather than listed
 * again here. `ready` survives as a field so the setup screen can still show
 * something it cannot yet offer, but every plan in the registry is playable.
 */
export interface PackEntry {
  readonly id: string
  readonly name: Localized<string>
  readonly blurb: Localized<string>
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
  readonly note: Localized<string> | null
}

/** What is actually built today. The setup screen reads this, not a guess. */
export const CAPABILITIES: Record<string, Capability> = {
  'travel:wuerfel': { ready: true, note: null },
  'travel:echtzeit': { ready: true, note: null },
  'sicht:normal': { ready: true, note: null },
  /*
   * Sicht "realistisch" is switched off at the door rather than removed.
   *
   * The engine carries it and the tests exercise it — projection, sightings,
   * pigeons, the lot — but the game around it is not finished. The plainest
   * hole: under fog the server withholds the action log by design and sends a
   * finished view instead, so there is nothing for a returning player to
   * rebuild a journal from, and the Nachrichten sheet comes back empty after
   * every reload. That wants a per-seat journal on the server, not a patch
   * here. Until then this is one word away from being offered again.
   */
  'sicht:realistisch': {
    ready: false,
    note: {
      de: 'Nebel, Sichtungen und Brieftauben stehen, aber der Nachrichtenverlauf übersteht kein Neuladen. Kommt zurück, sobald das rund ist.',
      en: 'Fog, sightings and carrier pigeons all work, but the news log does not survive a reload. It comes back once that is sound.',
    },
  },
  'table:lokal': { ready: true, note: null },
  'table:online-eroeffnen': { ready: true, note: null },
  'table:online-beitreten': { ready: true, note: null },
  'angebot:fest': { ready: true, note: null },
  'angebot:zufaellig': { ready: true, note: null },
  'preise:fest': { ready: true, note: null },
  'preise:entfernung': { ready: true, note: null },
  'konjunktur:klassisch': { ready: true, note: null },
  'konjunktur:erweitert': { ready: true, note: null },
}

export function isReady(key: string): boolean {
  return CAPABILITIES[key]?.ready ?? true
}
