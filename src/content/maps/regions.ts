import type { Continent, ContentPack, Country, GoodId, Port } from '../../engine/types'
import { buildMap } from '../../engine/mapbuild'
import { GOODS } from '../goods'
import { GOODS_WELT } from '../goods-welt'
import { KONJUNKTUR_DECK } from '../konjunktur'
import { KONJUNKTUR_ERWEITERT } from '../konjunktur-erweitert'
import { CLASSIC_CONFIG, CLASSIC_VEHICLES } from './classic'
import { COUNTRIES } from './classic/countries'
import { PORTS, START_PORTS } from './classic/ports'
import { LEGS, type RouteLeg } from './classic/legs'
import { COUNTRIES_WELT } from './welt/countries'
import { PORTS_WELT, START_PORTS_WELT } from './welt/ports'
import { LEGS_WELT } from './welt/legs'

/**
 * Regional plans, cut out of the world plan rather than drawn again.
 *
 * A shorter game on one ocean is the same content with most of it taken away,
 * so authoring it by hand would be three chances to let a harbour drift out
 * of step with the plan it came from. Cutting means every regional map is
 * exactly the world map with a knife taken to it, and a change to a lane in
 * one place is a change everywhere.
 *
 * The awkward part is that a naive cut leaves harbours stranded — take Europe
 * and Dakar's only remaining line may run to a port that is no longer there.
 * So after the cut the largest connected group is kept and the strays are
 * dropped, which is checked by a test rather than assumed.
 */

const ALL_PORTS: readonly Port[] = [...PORTS, ...PORTS_WELT]
const ALL_COUNTRIES: readonly Country[] = [...COUNTRIES, ...COUNTRIES_WELT]
const ALL_LEGS: readonly RouteLeg[] = [...LEGS, ...LEGS_WELT]
const ALL_GOODS = [...GOODS, ...GOODS_WELT]
const ALL_START: readonly string[] = [...START_PORTS, ...START_PORTS_WELT]

export interface RegionSpec {
  readonly id: string
  readonly name: string
  /** Shown on the setup screen. */
  readonly blurb: string
  readonly continents: readonly Continent[]
  readonly totalRounds: number
}

/** Which harbours survive the cut, and which of them are still reachable. */
function carve(continents: readonly Continent[]): {
  ports: Port[]
  countries: Country[]
  legs: RouteLeg[]
  startPorts: string[]
  goods: typeof ALL_GOODS
} {
  const wanted = new Set(continents)
  const countries = ALL_COUNTRIES.filter((c) => wanted.has(c.continent))
  const countryIds = new Set(countries.map((c) => c.id))

  const candidates = ALL_PORTS.filter((p) => countryIds.has(p.country))
  const candidateIds = new Set(candidates.map((p) => p.id))
  const legs = ALL_LEGS.filter((l) => candidateIds.has(l.a) && candidateIds.has(l.b))

  // Largest connected group wins; anything else would be a harbour a ship can
  // see on the plan and never reach.
  const adjacency = new Map<string, string[]>()
  for (const id of candidateIds) adjacency.set(id, [])
  for (const leg of legs) {
    adjacency.get(leg.a)!.push(leg.b)
    adjacency.get(leg.b)!.push(leg.a)
  }

  const seen = new Set<string>()
  let best: string[] = []
  for (const start of [...candidateIds].sort()) {
    if (seen.has(start)) continue
    const group: string[] = []
    const queue = [start]
    seen.add(start)
    for (let head = 0; head < queue.length; head++) {
      const at = queue[head]!
      group.push(at)
      for (const next of adjacency.get(at) ?? []) {
        if (seen.has(next)) continue
        seen.add(next)
        queue.push(next)
      }
    }
    if (group.length > best.length) best = group
  }

  const keep = new Set(best)
  const ports = candidates.filter((p) => keep.has(p.id))
  const kept = new Set(ports.map((p) => p.id))

  // A good nobody in the region ships is a card that can never be bought, so
  // it leaves with the harbours that used to sell it.
  const offered = new Set<GoodId>()
  const byId = new Map(countries.map((c) => [c.id, c]))
  for (const port of ports) {
    for (const id of port.exports ?? byId.get(port.country)?.exports ?? []) offered.add(id)
  }

  return {
    ports,
    countries,
    legs: legs.filter((l) => kept.has(l.a) && kept.has(l.b)),
    startPorts: startBerths(ports, kept),
    goods: ALL_GOODS.filter((g) => offered.has(g.id)),
  }
}

/**
 * Where a house may be based in this region.
 *
 * The world plan's own list is used first, but a cut leaves most of it behind
 * — Europe alone keeps three of them — and a table of six needs six berths.
 * The shortfall is made up from the region's own harbours, one country at a
 * time, so a full table is dealt across the map instead of into one bay.
 */
function startBerths(ports: readonly Port[], kept: ReadonlySet<string>): string[] {
  const chosen = ALL_START.filter((id) => kept.has(id))
  const taken = new Set(chosen)

  const byCountry = new Map<string, Port[]>()
  for (const port of ports) {
    if (taken.has(port.id)) continue
    const list = byCountry.get(port.country)
    if (list) list.push(port)
    else byCountry.set(port.country, [port])
  }
  // Sorted throughout: a start port list that depended on object order would
  // make the same seed deal different harbours on different days.
  const queues = [...byCountry.keys()]
    .sort()
    .map((c) => byCountry.get(c)!.sort((a, b) => a.id.localeCompare(b.id)))

  // One from each country, then a second from each, and so on.
  for (let round = 0; chosen.length < 8 && round < 6; round++) {
    for (const queue of queues) {
      const port = queue[round]
      if (!port || chosen.length >= 8) continue
      chosen.push(port.id)
    }
  }
  return chosen
}

export function buildRegionPack(spec: RegionSpec): ContentPack {
  const cut = carve(spec.continents)
  return {
    id: spec.id,
    name: `Von Kontinent zu Kontinent — ${spec.name}`,
    map: buildMap({
      id: spec.id,
      name: spec.name,
      ports: cut.ports,
      countries: cut.countries,
      legs: cut.legs,
      startPorts: cut.startPorts,
      kmPerPip: 550,
    }),
    vehicles: CLASSIC_VEHICLES,
    goods: cut.goods,
    konjunktur: KONJUNKTUR_DECK,
  konjunkturErweitert: KONJUNKTUR_ERWEITERT,
    config: { ...CLASSIC_CONFIG, totalRounds: spec.totalRounds },
  }
}

/**
 * The regions on offer.
 *
 * Round counts are cut to the size of the sea: a game confined to Europe is
 * over in half the voyages a world game needs, and leaving it at fifty would
 * only mean sailing the same short circuit again and again.
 */
export const REGIONS: readonly RegionSpec[] = [
  {
    id: 'europa',
    name: 'Europa',
    blurb: 'Ostsee, Nordsee und Mittelmeer. Kurze Wege, schnelle Partien.',
    continents: ['europa'],
    totalRounds: 24,
  },
  {
    id: 'amerika',
    name: 'Amerika',
    blurb: 'Von Vancouver bis Feuerland, beide Küsten.',
    continents: ['nordamerika', 'suedamerika'],
    totalRounds: 30,
  },
  {
    id: 'afrika',
    name: 'Afrika',
    blurb: 'Rund um den Kontinent, vom Mittelmeer bis Sansibar.',
    continents: ['afrika'],
    totalRounds: 28,
  },
  {
    id: 'asien',
    name: 'Asien und Ozeanien',
    blurb: 'Vom Persischen Golf über Malakka bis Japan und Australien.',
    continents: ['asien', 'ozeanien'],
    totalRounds: 34,
  },
  {
    id: 'atlantik',
    name: 'Atlantik',
    blurb: 'Europa, Afrika und Amerika — der gedruckte Plan als Weltmeer.',
    continents: ['europa', 'afrika', 'nordamerika', 'suedamerika'],
    totalRounds: 40,
  },
]

export const REGION_PACKS: readonly ContentPack[] = REGIONS.map(buildRegionPack)
