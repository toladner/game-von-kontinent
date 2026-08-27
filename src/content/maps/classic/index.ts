import type { ContentPack, RuleConfig, Vehicle } from '../../../engine/types'
import { buildMap } from '../../../engine/mapbuild'
import { GOODS } from '../../goods'
import { KONJUNKTUR_DECK } from '../../konjunktur'
import { KONJUNKTUR_ERWEITERT } from '../../konjunktur-erweitert'
import { COUNTRIES } from './countries'
import { PORTS, START_PORTS } from './ports'
import { LEGS } from './legs'

/**
 * Every tunable number the Anleitung states, in one place.
 * A variant ruleset is a copy of this object with different values.
 */
export const CLASSIC_CONFIG: RuleConfig = {
  travel: 'runde',
  // The printed game: the Warenverzeichnis stands, and a Verkaufspreis is
  // the same figure in every harbour on the board.
  konjunkturMode: 'klassisch',
  angebot: 'fest',
  preise: 'fest',
  sicht: 'normal',
  pigeon: {
    // Birds outpace steamers, but not by as much as one would like.
    minutesPerPip: 2,
    lossPercent: 12,
    price: 4_000,
  },
  notebookLimit: 480,
  realtime: {
    // A twelve-pip Atlantic crossing takes about six hours at this pace, so a
    // day's season is three or four ocean crossings — a ship set going in the
    // morning is worth looking in on at lunch and again in the evening, which
    // is the rhythm the mode is actually played at.
    minutesPerPip: 30,
    portCallPips: 0.4,
    marketIntervalMinutes: 20,
    marketChancePercent: 50,
    durationHours: 24,
  },
  startingCapital: 500_000,
  startingNotes: [
    { value: 100_000, count: 3 },
    { value: 50_000, count: 3 },
    { value: 10_000, count: 5 },
  ],
  totalRounds: 50,
  // Read off the printed round track along the top edge of the board.
  redFields: [5, 9, 13, 16, 21, 26, 29, 34, 39, 43, 48],
  maxPurchasesPerPort: 2,
  cardCopiesPerGood: 2,
  localGlutSaleRate: 0.75,
  damagedSaleRate: 0.5,
  distressSaleRate: 0.75,
  finalRoundGlutSaleRate: 0.75,
  collisionDamageRate: 0.25,
  collisionPenaltyTurns: 1,
  levyGracePeriodRounds: 5,
  diceSides: 6,
  startingVehicle: {
    id: 'frachtdampfer',
    name: { de: 'Frachtdampfer', en: 'Cargo steamer' },
    // The Anleitung sets no limit on the hold of the ship you begin with.
    capacity: null,
    modes: ['see'],
    price: 0,
    speedFactor: 1,
  },
  /**
   * The printed game gives each house one steamer and never another: there is
   * no yard on the board and no rule for buying one. A fleet is an extension,
   * so the faithful setting is 1 and variants raise it deliberately.
   */
  maxFleetSize: 1,
}

/**
 * What the yards have on the stocks. Only variants that raise `maxFleetSize`
 * above 1 ever see this list — the original game has no yard.
 *
 * A second ship is not a bigger hold, it is a second trade running at the same
 * time — and, once the Brieftauben are in play, a captain you cannot see. That
 * is worth a great deal, so it is priced against a whole season rather than
 * against one cargo: with 500.000 in the till a house can just about manage a
 * schooner by emptying it, and must trade its way up to anything larger.
 */
export const CLASSIC_VEHICLES: readonly Vehicle[] = [
  {
    id: 'kuestenschoner',
    name: { de: 'Küstenschoner', en: 'Coasting schooner' },
    capacity: 3,
    modes: ['see'],
    price: 450_000,
    speedFactor: 0.75,
    blurb: {
      de: 'Flink und noch erschwinglich, nimmt aber nur drei Posten.',
      en: 'Quick, and still affordable, but she takes only three lots.',
    },
  },
  {
    id: 'frachtdampfer',
    name: { de: 'Frachtdampfer', en: 'Cargo steamer' },
    capacity: 6,
    modes: ['see'],
    price: 1_100_000,
    speedFactor: 1,
    blurb: {
      de: 'Das übliche Arbeitstier der Linie. Ein gutes Jahr Handel.',
      en: 'The usual workhorse of the line. A good year of trading.',
    },
  },
  {
    id: 'grossfrachter',
    name: { de: 'Großfrachter', en: 'Heavy freighter' },
    capacity: 12,
    modes: ['see'],
    price: 2_400_000,
    speedFactor: 1.35,
    blurb: {
      de: 'Ein schwimmendes Lagerhaus. Nicht eilig, und nicht billig.',
      en: 'A floating warehouse. In no hurry, and no bargain.',
    },
  },
]

export const CLASSIC_MAP = buildMap({
  id: 'classic',
  name: { de: 'Europa · Afrika · Amerika', en: 'Europe · Africa · America' },
  ports: PORTS,
  countries: COUNTRIES,
  legs: LEGS,
  startPorts: START_PORTS,
  kmPerPip: 550,
})

export const CLASSIC_PACK: ContentPack = {
  id: 'classic',
  // The game was only ever published in German and the title stays as it was
  // printed; only what follows the dash is translated.
  name: {
    de: 'Von Kontinent zu Kontinent — Originalplan',
    en: 'Von Kontinent zu Kontinent — the printed board',
  },
  map: CLASSIC_MAP,
  vehicles: CLASSIC_VEHICLES,
  goods: GOODS,
  konjunktur: KONJUNKTUR_DECK,
  konjunkturErweitert: KONJUNKTUR_ERWEITERT,
  config: CLASSIC_CONFIG,
}
