import type { ContentPack, RuleConfig, Vehicle } from '../../../engine/types'
import { buildMap } from '../../../engine/mapbuild'
import { GOODS } from '../../goods'
import { KONJUNKTUR_DECK } from '../../konjunktur'
import { COUNTRIES } from './countries'
import { PORTS, START_PORTS } from './ports'
import { LEGS } from './legs'

/**
 * Every tunable number the Anleitung states, in one place.
 * A variant ruleset is a copy of this object with different values.
 */
export const CLASSIC_CONFIG: RuleConfig = {
  travel: 'runde',
  sicht: 'normal',
  pigeon: {
    // Birds outpace steamers, but not by as much as one would like.
    minutesPerPip: 2,
    lossPercent: 12,
    price: 4_000,
  },
  notebookLimit: 480,
  realtime: {
    // A ten-pip Atlantic crossing takes about an hour at this pace.
    minutesPerPip: 6,
    marketIntervalMinutes: 20,
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
  distressSaleRate: 0.75,
  finalRoundGlutSaleRate: 0.75,
  collisionDamageRate: 0.25,
  collisionPenaltyTurns: 1,
  levyGracePeriodRounds: 5,
  diceSides: 6,
  startingVehicle: {
    id: 'frachtdampfer',
    name: 'Frachtdampfer',
    // The Anleitung sets no limit on the hold of the ship you begin with.
    capacity: null,
    modes: ['see'],
    price: 0,
    speedFactor: 1,
  },
  maxFleetSize: 5,
}

/**
 * What the yards have on the stocks.
 *
 * A second ship is not a bigger hold, it is a second trade running at the same
 * time — and, once the Brieftauben are in play, a captain you cannot see.
 */
export const CLASSIC_VEHICLES: readonly Vehicle[] = [
  {
    id: 'kuestenschoner',
    name: 'Küstenschoner',
    capacity: 3,
    modes: ['see'],
    price: 140_000,
    speedFactor: 0.75,
    blurb: 'Flink und billig, nimmt aber nur drei Posten.',
  },
  {
    id: 'frachtdampfer',
    name: 'Frachtdampfer',
    capacity: 6,
    modes: ['see'],
    price: 300_000,
    speedFactor: 1,
    blurb: 'Das übliche Arbeitstier der Linie.',
  },
  {
    id: 'grossfrachter',
    name: 'Großfrachter',
    capacity: 12,
    modes: ['see'],
    price: 620_000,
    speedFactor: 1.35,
    blurb: 'Ein schwimmendes Lagerhaus. Nicht eilig.',
  },
]

export const CLASSIC_MAP = buildMap({
  id: 'classic',
  name: 'Europa · Afrika · Amerika',
  ports: PORTS,
  countries: COUNTRIES,
  legs: LEGS,
  startPorts: START_PORTS,
  kmPerPip: 550,
})

export const CLASSIC_PACK: ContentPack = {
  id: 'classic',
  name: 'Von Kontinent zu Kontinent — Originalplan',
  map: CLASSIC_MAP,
  vehicles: CLASSIC_VEHICLES,
  goods: GOODS,
  konjunktur: KONJUNKTUR_DECK,
  config: CLASSIC_CONFIG,
}
