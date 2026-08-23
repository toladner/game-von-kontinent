import type { ContentPack } from '../engine/types'
import { createContext, type EngineContext } from '../engine/context'
import { CLASSIC_PACK } from './maps/classic'
import { WELT_PACK } from './maps/welt'
import { REGIONS, REGION_PACKS } from './maps/regions'

/**
 * Every plan the game can be played on, and the one place that knows them.
 *
 * The engine has always been pack-driven, but the app pinned one context at
 * module scope, so "which map" was a decision nobody could make. Contexts are
 * built once and handed out by id: a context is derived entirely from its
 * pack, so building the same one twice would waste the graph and the export
 * tables for no gain — and the distance memo in `market` keys on pack
 * identity, which only works if there is exactly one of each.
 */

export interface PackEntry {
  readonly id: string
  /** Short name for the setup screen. */
  readonly label: string
  readonly blurb: string
  readonly pack: ContentPack
}

export const PACK_ENTRIES: readonly PackEntry[] = [
  {
    id: 'classic',
    label: 'Originalplan',
    blurb: 'Europa, Afrika, Nord- und Südamerika — der gedruckte Spielplan von 1950.',
    pack: CLASSIC_PACK,
  },
  {
    id: 'welt',
    label: 'Ganze Welt',
    blurb:
      'Der Originalplan und dazu Indien, China, Japan, Insulinde und Australien. 90 Warenkarten, zwei Wege nach Osten: Sueskanal oder Kap.',
    pack: WELT_PACK,
  },
  ...REGIONS.map((spec, i) => ({
    id: spec.id,
    label: spec.name,
    blurb: spec.blurb,
    pack: REGION_PACKS[i]!,
  })),
]

const byId = new Map(PACK_ENTRIES.map((e) => [e.id, e.pack]))
const contexts = new Map<string, EngineContext>()

export const DEFAULT_PACK_ID = 'classic'

export function packById(id: string | undefined): ContentPack {
  return byId.get(id ?? '') ?? CLASSIC_PACK
}

/** The engine context for a plan. Built once and reused thereafter. */
export function contextFor(id: string | undefined): EngineContext {
  const pack = packById(id)
  const existing = contexts.get(pack.id)
  if (existing) return existing
  const made = createContext(pack)
  contexts.set(pack.id, made)
  return made
}
