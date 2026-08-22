import type { AnyNode, Country, GameMap, Lane, Port, SeaNode } from './types'
import { distanceKm, sampleAlongPolyline, type LatLon } from './geo'

export interface LegSpec {
  readonly a: string
  readonly b: string
  readonly via?: readonly (readonly [number, number])[]
  readonly steps?: number
}

export interface BuildMapInput {
  readonly id: string
  readonly name: string
  readonly ports: readonly Port[]
  readonly countries: readonly Country[]
  readonly legs: readonly LegSpec[]
  readonly startPorts: readonly string[]
  /** Kilometres of open water per pip of movement. Tunes the whole board. */
  readonly kmPerPip?: number
  readonly projectionCenterLon?: number
  readonly padding?: number
}

/**
 * Turns a port list plus a leg list into the node/lane graph ships sail on.
 *
 * Every lane is exactly one pip, so "move 4" is always four edges - the same
 * counting the printed board asks for. Sea nodes are generated, never authored
 * by hand, which is what keeps a new map down to ports + connections.
 */
export function buildMap(input: BuildMapInput): GameMap {
  const kmPerPip = input.kmPerPip ?? 550
  const portsById = new Map(input.ports.map((p) => [p.id, p]))

  const nodes: AnyNode[] = [...input.ports]
  const lanes: Lane[] = []

  for (const leg of input.legs) {
    const a = portsById.get(leg.a)
    const b = portsById.get(leg.b)
    if (!a) throw new Error(`Leg references unknown port "${leg.a}"`)
    if (!b) throw new Error(`Leg references unknown port "${leg.b}"`)

    const polyline: LatLon[] = [
      { lat: a.lat, lon: a.lon },
      ...(leg.via ?? []).map(([lat, lon]) => ({ lat, lon })),
      { lat: b.lat, lon: b.lon },
    ]

    let length = 0
    for (let i = 0; i < polyline.length - 1; i++) {
      length += distanceKm(polyline[i]!, polyline[i + 1]!)
    }

    // pips = number of edges; interior sea nodes = pips - 1
    const pips = leg.steps ?? Math.max(1, Math.round(length / kmPerPip))
    const interior = sampleAlongPolyline(polyline, pips - 1)

    const chain: string[] = [a.id]
    interior.forEach((pt, i) => {
      const id = `sea:${leg.a}~${leg.b}:${i}`
      const seaNode: SeaNode = { kind: 'sea', id, lat: pt.lat, lon: pt.lon }
      nodes.push(seaNode)
      chain.push(id)
    })
    chain.push(b.id)

    for (let i = 0; i < chain.length - 1; i++) {
      lanes.push({ a: chain[i]!, b: chain[i + 1]! })
    }
  }

  const pad = input.padding ?? 4
  const lats = nodes.map((n) => n.lat)
  const lons = nodes.map((n) => n.lon)

  return {
    id: input.id,
    name: input.name,
    nodes,
    lanes,
    countries: input.countries,
    startPorts: input.startPorts,
    projectionCenterLon: input.projectionCenterLon ?? 0,
    bounds: {
      minLat: Math.min(...lats) - pad,
      maxLat: Math.max(...lats) + pad,
      minLon: Math.min(...lons) - pad,
      maxLon: Math.max(...lons) + pad,
    },
  }
}

// ---------------------------------------------------------------------------
// Graph helpers used by movement and by the UI
// ---------------------------------------------------------------------------

export interface MapGraph {
  readonly map: GameMap
  readonly nodesById: ReadonlyMap<string, AnyNode>
  /** Adjacency list; order is stable so replays are deterministic. */
  readonly neighbours: ReadonlyMap<string, readonly string[]>
}

export function buildGraph(map: GameMap): MapGraph {
  const nodesById = new Map(map.nodes.map((n) => [n.id, n]))
  const neighbours = new Map<string, string[]>()
  const add = (from: string, to: string) => {
    const list = neighbours.get(from)
    if (list) list.push(to)
    else neighbours.set(from, [to])
  }
  for (const lane of map.lanes) {
    add(lane.a, lane.b)
    add(lane.b, lane.a)
  }
  for (const list of neighbours.values()) list.sort()
  return { map, nodesById, neighbours }
}

export function isPort(node: AnyNode | undefined): node is Port {
  return node?.kind === 'port'
}
