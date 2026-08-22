import type { EngineContext } from './context'
import type { GameState, PlayerState, Sighting, VehicleInstance } from './state'
import { flagship } from './state'

/**
 * Sicht — how much of the world one house may see.
 *
 * `projectFor` returns a GameState, not some other shape. Under "normal" it is
 * the state itself; under "realistisch" it is a doctored copy in which distant
 * vessels sit where you last heard they were and other houses are simply not
 * there. Because the shape is unchanged, every screen renders a view without
 * knowing it is looking at a belief.
 *
 * Doctoring rather than filtering also means the server can hand a seat this
 * object directly: a client that never receives the truth cannot show it.
 */
export function projectFor(state: GameState, playerId: string | null): GameState {
  if (state.config.sicht !== 'realistisch') return state

  const viewer = playerId ? state.players.find((p) => p.id === playerId) : undefined
  if (!viewer) {
    // An onlooker with no seat sees the harbours and nothing that moves.
    return {
      ...state,
      players: state.players.map((p) => projectRival(p, null)),
      pigeons: [],
    }
  }

  const eyes = flagship(viewer)
  // Everything tied up alongside you is plainly visible.
  const hereNode = eyes.voyage ? null : eyes.nodeId

  const players = state.players.map((player) => {
    if (player.id === viewer.id) return projectOwnFleet(player, hereNode)
    return projectRival(player, hereNode)
  })

  return {
    ...state,
    players,
    // You know only about your own birds, and only that you released them.
    pigeons: state.pigeons.filter((p) => p.playerId === viewer.id),
  }
}

/**
 * Your own ships: the one under your feet, and anything in the same harbour,
 * are fact. The rest is the last thing you were told.
 */
function projectOwnFleet(player: PlayerState, hereNode: string | null): PlayerState {
  const lastResort = player.homePort
  const fleet = player.fleet.map((vehicle): VehicleInstance => {
    const seenNow = hereNode !== null && vehicle.nodeId === hereNode && !vehicle.voyage
    if (seenNow) return vehicle

    const sighting = player.knowledge.sightings[vehicle.id]
    if (!sighting) {
      // No news at all. Fall back to the home port rather than the truth —
      // an absent record must never become a way to read the real position.
      return { ...vehicle, nodeId: lastResort, cameFrom: null, unseen: true, voyage: null, cargo: [] }
    }
    return {
      ...vehicle,
      nodeId: sighting.nodeId,
      cameFrom: null,
      voyage: null,
      cargo: sighting.cargo,
      unseen: true,
    }
  })
  return { ...player, fleet }
}

/** Rival houses: only what is lying alongside you right now. */
function projectRival(player: PlayerState, hereNode: string | null): PlayerState {
  const fleet = player.fleet.map((vehicle): VehicleInstance => {
    const visible = hereNode !== null && vehicle.nodeId === hereNode && !vehicle.voyage
    if (visible) return vehicle
    // Not merely undrawn: the position is replaced, so it is not in the data
    // at all. Their home port is public knowledge; where they are now is not.
    return {
      ...vehicle,
      nodeId: player.homePort,
      cameFrom: null,
      voyage: null,
      cargo: [],
      hidden: true,
    }
  })
  return {
    ...player,
    fleet,
    // A rival's private notes and letters are their own business.
    knowledge: { sightings: {}, waiting: {}, read: [], notebook: '' },
  }
}

/** A fresh, first-hand sighting of a vessel you are standing on or beside. */
export function seeVehicle(
  vehicle: VehicleInstance,
  now: number,
  place: string | null,
): Sighting {
  return {
    vehicleId: vehicle.id,
    nodeId: vehicle.nodeId,
    asOf: now,
    place,
    bound: vehicle.voyage?.destination ?? null,
    cargo: vehicle.cargo,
    firsthand: true,
  }
}

/** How stale a belief is, in milliseconds. */
export function ageOf(sighting: Sighting, now: number): number {
  return Math.max(0, now - sighting.asOf)
}

/** True when this vessel's drawn position is a guess. */
export function isBelief(vehicle: VehicleInstance): boolean {
  return vehicle.unseen === true
}

export function visibleVehicles(
  ctx: EngineContext,
  player: PlayerState,
): readonly VehicleInstance[] {
  void ctx
  return player.fleet.filter((v) => !v.hidden)
}
