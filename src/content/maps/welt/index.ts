import type { ContentPack } from '../../../engine/types'
import { buildMap } from '../../../engine/mapbuild'
import { GOODS } from '../../goods'
import { GOODS_WELT } from '../../goods-welt'
import { KONJUNKTUR_DECK } from '../../konjunktur'
import {
  KONJUNKTUR_ERWEITERT,
  KONJUNKTUR_ERWEITERT_VOR_REFORM,
} from '../../konjunktur-erweitert'
import { CLASSIC_CONFIG, CLASSIC_VEHICLES } from '../classic'
import { COUNTRIES } from '../classic/countries'
import { PORTS, START_PORTS } from '../classic/ports'
import { LEGS } from '../classic/legs'
import { COUNTRIES_WELT } from './countries'
import { PORTS_WELT, START_PORTS_WELT } from './ports'
import { LEGS_WELT } from './legs'

/**
 * The whole world: the printed board with the far side of Suez filled in.
 *
 * Built by addition rather than by rewriting. Every harbour, country and lane
 * of the original plan is here untouched, which means a route a player knows
 * from the classic game still works, and the regional plans can be cut out of
 * this one instead of being authored a third time.
 *
 * The Pacific is the outer edge, as it is on the printed board: cargo bound
 * from Yokohama to San Francisco sails west, the long way.
 */
export const WELT_MAP = buildMap({
  id: 'welt',
  name: { de: 'Die ganze Welt', en: 'The whole world' },
  ports: [...PORTS, ...PORTS_WELT],
  countries: [...COUNTRIES, ...COUNTRIES_WELT],
  legs: [...LEGS, ...LEGS_WELT],
  startPorts: [...START_PORTS, ...START_PORTS_WELT],
  kmPerPip: 550,
})

/**
 * The world plan runs to ninety Warenkarten and a great many more harbours,
 * so a fifty-round game would end long before a house had seen half of it.
 * Everything else is the Anleitung's.
 */
export const WELT_CONFIG = {
  ...CLASSIC_CONFIG,
  totalRounds: 60,
  redFields: [5, 9, 13, 16, 21, 26, 29, 34, 39, 43, 48, 52, 56, 59],
}

export const WELT_PACK: ContentPack = {
  id: 'welt',
  name: {
    de: 'Von Kontinent zu Kontinent — Weltplan',
    en: 'Von Kontinent zu Kontinent — the world board',
  },
  map: WELT_MAP,
  vehicles: CLASSIC_VEHICLES,
  goods: [...GOODS, ...GOODS_WELT],
  konjunktur: KONJUNKTUR_DECK,
  konjunkturErweitert: KONJUNKTUR_ERWEITERT,
  konjunkturErweitertVorReform: KONJUNKTUR_ERWEITERT_VOR_REFORM,
  config: WELT_CONFIG,
}
