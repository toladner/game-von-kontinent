import type { ContentPack, RuleConfig } from '@engine/types'
import { buildMap } from '@engine/mapbuild'
import { GOODS } from '@content/goods'
import { KONJUNKTUR_DECK } from '@content/konjunktur'
import { COUNTRIES } from './countries'
import { PORTS, START_PORTS } from './ports'
import { LEGS } from './legs'

/**
 * Every tunable number the Anleitung states, in one place.
 * A variant ruleset is a copy of this object with different values.
 */
export const CLASSIC_CONFIG: RuleConfig = {
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
    // The Anleitung sets no limit on the hold.
    capacity: null,
    modes: ['see'],
  },
}

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
  goods: GOODS,
  konjunktur: KONJUNKTUR_DECK,
  config: CLASSIC_CONFIG,
}
