import type { ContentPack, Good, KonjunkturCard, Port } from './types'
import { buildGraph, isPort, type MapGraph } from './mapbuild'

/**
 * Everything derived from a content pack, computed once.
 *
 * GameState stays small and serialisable (ids and numbers); the context holds
 * the lookup tables. Reducers take (ctx, state, action), never reach for a
 * module-level singleton, which is what lets a second game - or a replay -
 * run alongside the live one.
 */
export interface EngineContext {
  readonly pack: ContentPack
  readonly graph: MapGraph
  readonly goodsById: ReadonlyMap<number, Good>
  readonly portsById: ReadonlyMap<string, Port>
  readonly cardsById: ReadonlyMap<string, KonjunkturCard>
  /** Effective export list for a port, honouring per-port overrides. */
  readonly exportsOf: (portId: string) => readonly number[]
  /**
   * The same card, one edition later.
   *
   * The two extended decks are the same length and in the same order, so a
   * card in one has a twin at the same place in the other. A table that takes
   * up the new rules mid-season swaps the ids in its deck through this and
   * goes on drawing in the same order it was — the same card on the same day,
   * doing what the new edition says it does.
   */
  readonly reformedCardId: ReadonlyMap<string, string>
}

export function createContext(pack: ContentPack): EngineContext {
  const graph = buildGraph(pack.map)
  const goodsById = new Map(pack.goods.map((g) => [g.id, g]))
  // Both decks, so a lookup works whichever one a game is playing with.
  const cardsById = new Map(
    [
      ...pack.konjunktur,
      ...(pack.konjunkturErweitert ?? []),
      // Tables opened under an earlier Regelstand are still dealing these.
      ...(pack.konjunkturErweitertVorReform ?? []),
    ].map((c) => [c.id, c]),
  )
  const countriesById = new Map(pack.map.countries.map((c) => [c.id, c]))

  const portsById = new Map<string, Port>()
  for (const node of pack.map.nodes) {
    if (isPort(node)) portsById.set(node.id, node)
  }

  const exportCache = new Map<string, readonly number[]>()
  const exportsOf = (portId: string): readonly number[] => {
    const cached = exportCache.get(portId)
    if (cached) return cached
    const port = portsById.get(portId)
    const list = port?.exports ?? countriesById.get(port?.country ?? '')?.exports ?? []
    exportCache.set(portId, list)
    return list
  }

  const reformedCardId = new Map<string, string>()
  const before = pack.konjunkturErweitertVorReform ?? []
  const after = pack.konjunkturErweitert ?? []
  if (before.length === after.length) {
    for (let i = 0; i < before.length; i++) reformedCardId.set(before[i]!.id, after[i]!.id)
  }

  return { pack, graph, goodsById, portsById, cardsById, exportsOf, reformedCardId }
}

export function goodOf(ctx: EngineContext, id: number): Good {
  const g = ctx.goodsById.get(id)
  if (!g) throw new Error(`Unknown good ${id}`)
  return g
}

export function portOf(ctx: EngineContext, id: string): Port {
  const p = ctx.portsById.get(id)
  if (!p) throw new Error(`Unknown port ${id}`)
  return p
}
