import { create } from 'zustand'
import { CLASSIC_PACK } from '@content/maps/classic'
import { createContext, type EngineContext } from '@engine/context'
import { createGame, openingActions, type Seat } from '@engine/setup'
import type { Gender } from '@engine/persona'
import { applyAction, replay } from '@engine/reducer'
import type { GameAction, GameEvent } from '@engine/actions'
import type { GameState, JoinPolicy } from '@engine/state'
import { projectFor } from '@engine/fog'
import {
  createOnlineGame,
  Session,
  type ConnectionStatus,
  type GameMeta,
} from './net'

const SAVE_KEY = 'vkzk.partie.v1'

interface SaveFile {
  readonly names: string[]
  readonly seed: string
  readonly totalRounds: number
  startingCapital?: number
  travel?: 'runde' | 'echtzeit'
  minutesPerPip?: number
  durationHours?: number
  sicht?: 'normal' | 'realistisch'
  maxFleetSize?: number
  readonly actions: GameAction[]
}

export interface BeginOptions {
  readonly totalRounds?: number
  readonly startingCapital?: number
  readonly seed?: string
  readonly travel?: 'runde' | 'echtzeit'
  readonly minutesPerPip?: number
  readonly durationHours?: number
  readonly sicht?: 'normal' | 'realistisch'
  /** Vessels one house may run; 1 (the printed game) closes the yards. */
  readonly maxFleetSize?: number
}

export interface LogLine {
  readonly id: number
  readonly text: string
  readonly tone: 'neutral' | 'gut' | 'schlecht' | 'wichtig'
}

/** Who is at this device, and how it is connected. */
export interface NetState {
  readonly code: string
  readonly status: ConnectionStatus
  /** Null while the server has not yet seated us (spectator or in flight). */
  readonly playerId: string | null
  readonly online: readonly string[]
}

interface Store {
  readonly ctx: EngineContext
  /**
   * What the screen may draw. Under Sicht "realistisch" this is a projection,
   * not the world: distant ships sit where they were last reported.
   */
  state: GameState | null
  /**
   * The world as it really is. Local games only — online, the server keeps it
   * and never sends it, which is the whole point of the fog.
   */
  truth: GameState | null
  log: LogLine[]
  /** Events from the most recent action, for animations and flashes. */
  lastEvents: readonly GameEvent[]
  notice: string | null
  /** Null for a local game at one device. */
  net: NetState | null

  /**
   * Whose hands are on the wheel. Online this is our seat; in a local
   * real-time game the player picks a ship, since there is no turn.
   */
  localActing: string | null

  begin: (seats: readonly Seat[], options?: BeginOptions) => void
  host: (
    seat: Seat,
    options: BeginOptions & { joinPolicy: JoinPolicy; sicht?: 'normal' | 'realistisch' },
  ) => Promise<string>
  join: (code: string, name: string, gender?: Gender) => void
  dispatch: (action: GameAction) => void
  resume: () => boolean
  abandon: () => void
  dismissNotice: () => void
  setActing: (playerId: string) => void
  /** True when this device may act right now. */
  myTurn: () => boolean
  /** The player this device is currently acting for, if any. */
  acting: () => GameState['players'][number] | null
}

const ctx = createContext(CLASSIC_PACK)

let saved: SaveFile | null = null
let logId = 0

function persist(): void {
  if (!saved) return
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(saved))
  } catch {
    // Private mode or a full quota: the game still plays, it just won't resume.
  }
}

const money = (n: number) => `${n.toLocaleString('de-DE')},—`

function describe(ctx: EngineContext, state: GameState, event: GameEvent): LogLine | null {
  const nameOf = (id: string) => state.players.find((p) => p.id === id)?.name ?? id
  const goodOf = (id: number) => ctx.goodsById.get(id)?.name ?? `Ware ${id}`
  const portOf = (id: string) => ctx.portsById.get(id)?.name ?? id
  const line = (text: string, tone: LogLine['tone'] = 'neutral'): LogLine => ({
    id: ++logId,
    text,
    tone,
  })

  switch (event.type) {
    case 'rolled':
      return line(`${nameOf(event.playerId)} würfelt ${event.value}.`)
    case 'arrived':
      return line(`${nameOf(event.playerId)} läuft ${portOf(event.portId)} an.`, 'wichtig')
    case 'stoppedAtSea':
      return line(`${nameOf(event.playerId)} liegt auf freier See.`)
    case 'collision':
      return line(
        `Zusammenstoß! ${nameOf(event.playerId)} zahlt ${nameOf(event.victimId)} ${money(event.damages)} Schadenersatz und setzt eine Runde aus.`,
        'schlecht',
      )
    case 'bought':
      return line(
        `${nameOf(event.playerId)} kauft ${goodOf(event.goodId)} für ${money(event.price)}.`,
      )
    case 'sold': {
      const label =
        event.kind === 'ueberfluss'
          ? ' (Verlustpreis, Ware wird hier selbst geführt)'
          : event.kind === 'notverkauf'
            ? ' (Notverkauf an die Exportbank)'
            : event.kind === 'schluss'
              ? ' (Schlußabrechnung)'
              : ''
      return line(
        `${nameOf(event.playerId)} verkauft ${goodOf(event.goodId)} für ${money(event.price)}${label}. ` +
          `${event.profit >= 0 ? 'Gewinn' : 'Verlust'} ${money(Math.abs(event.profit))}.`,
        event.profit >= 0 ? 'gut' : 'schlecht',
      )
    }
    case 'cardDrawn': {
      const card = ctx.cardsById.get(event.cardId)
      return line(
        `${nameOf(event.playerId)} hebt eine Konjunkturkarte ab: ${card?.title ?? ''} — ${card?.lines.join(', ') ?? ''}`,
        'wichtig',
      )
    }
    case 'paid': {
      const reasons = {
        steuer: 'Steuer',
        versicherung: 'Versicherung',
        hafengebuehr: 'Hafengebühr',
        entladegeld: 'Entladegeld',
        schaden: 'Schadenersatz',
      } as const
      return line(
        `${nameOf(event.playerId)} zahlt ${money(event.amount)} ${reasons[event.reason]}.`,
        'schlecht',
      )
    }
    case 'received':
      return line(
        `${nameOf(event.playerId)} erhält ${money(event.amount)}${event.reason === 'telegramm' ? ' per Telegramm' : ' als Schadenersatz'}.`,
        'gut',
      )
    case 'roundStarted':
      return line(
        `Runde ${event.round}${event.red ? ' — rotes Feld, die Konjunktur spricht mit.' : '.'}`,
        event.red ? 'wichtig' : 'neutral',
      )
    case 'gameOver':
      return line('Die letzte Runde ist gefahren. Schlußabrechnung.', 'wichtig')
    default:
      return null
  }
}

let session: Session | null = null
let ticker: ReturnType<typeof setInterval> | null = null

export const useGame = create<Store>((set, get) => ({
  ctx,
  state: null,
  truth: null,
  log: [],
  lastEvents: [],
  notice: null,
  net: null,
  localActing: null,

  begin(seats, options = {}) {
    const names = seats.map((s) => (typeof s === 'string' ? s : s.name))
    const totalRounds = options.totalRounds ?? 30
    const startingCapital = options.startingCapital ?? ctx.pack.config.startingCapital
    const realSeed = options.seed ?? `${Date.now().toString(36)}-${names.join('|')}`
    saved = { names, seed: realSeed, totalRounds, startingCapital, actions: [] }
    persist()
    const travel = options.travel ?? 'runde'
    const realtime = travel === 'echtzeit'
    // A real-time table needs a first stroke of the clock to reckon from.
    const opening: GameAction[] = realtime
      ? [{ type: 'tick', at: Date.now() }, ...openingActions(seats)]
      : openingActions(seats)

    const state = replay(
      ctx,
      createGame(ctx, {
        seed: realSeed,
        totalRounds,
        startingCapital,
        travel,
        ...(options.sicht ? { sicht: options.sicht } : {}),
        ...(options.minutesPerPip ? { minutesPerPip: options.minutesPerPip } : {}),
        ...(options.durationHours ? { durationHours: options.durationHours } : {}),
        ...(options.maxFleetSize ? { maxFleetSize: options.maxFleetSize } : {}),
      }),
      opening,
    )
    saved.actions.push(...opening)
    saved.travel = travel
    if (options.minutesPerPip) saved.minutesPerPip = options.minutesPerPip
    if (options.durationHours) saved.durationHours = options.durationHours
    if (options.sicht) saved.sicht = options.sicht
    if (options.maxFleetSize) saved.maxFleetSize = options.maxFleetSize
    persist()
    const firstActing = state.players[0]?.id ?? null
    session?.close()
    session = null
    set({
      state: projectFor(state, firstActing),
      truth: state,
      net: null,
      localActing: firstActing,
      log: [
        {
          id: ++logId,
          text: `Die Exportbank kreditiert jedem Mitspieler ${startingCapital.toLocaleString('de-DE')} Einheiten Betriebskapital.`,
          tone: 'wichtig',
        },
      ],
      lastEvents: [],
      notice: null,
    })
    if (realtime) startLocalClock(get)
  },

  async host(seat, options) {
    const who = typeof seat === 'string' ? { name: seat } : seat
    const { code } = await createOnlineGame({
      totalRounds: options.totalRounds ?? 30,
      startingCapital: options.startingCapital ?? ctx.pack.config.startingCapital,
      joinPolicy: options.joinPolicy,
      sicht: options.sicht ?? 'normal',
      travel: options.travel ?? 'runde',
      minutesPerPip: options.minutesPerPip ?? 6,
      durationHours: options.durationHours ?? 24,
      maxFleetSize: options.maxFleetSize ?? 1,
    })
    get().join(code, who.name, who.gender)
    return code
  },

  join(code, name, gender) {
    session?.close()
    // A networked game is never saved locally; the server holds the log.
    saved = null
    set({ state: null, log: [], lastEvents: [], notice: null, net: { code, status: 'verbindet', playerId: null, online: [] } })

    session = new Session(code, name, gender, {
      onStatus: (status) =>
        set((s) => ({ net: s.net ? { ...s.net, status } : s.net })),

      onWelcome: (playerId, meta, actions) => {
        const initial = createGame(ctx, {
          seed: meta.seed,
          totalRounds: meta.totalRounds,
          startingCapital: meta.startingCapital,
          joinPolicy: meta.joinPolicy,
          travel: meta.travel,
          minutesPerPip: meta.minutesPerPip,
          durationHours: meta.durationHours,
          // Must match the server exactly, or our replay drifts from its truth.
          ...(meta.maxFleetSize ? { maxFleetSize: meta.maxFleetSize } : {}),
        })
        // Under fog the log is withheld; a view arrives separately.
        const rebuilt = meta.sicht === 'realistisch' ? null : replay(ctx, initial, actions)
        set((s) => ({
          ...(rebuilt ? { state: rebuilt, truth: null } : {}),
          net: s.net ? { ...s.net, playerId } : s.net,
          notice: null,
        }))
      },

      onView: (view) => {
        set({ state: view, truth: null })
      },

      onAppend: (actions) => {
        const current = get().state
        if (!current) return
        let next = current
        const fresh: LogLine[] = []
        for (const action of actions) {
          const result = applyAction(ctx, next, action)
          next = result.state
          for (const event of result.events) {
            const line = describe(ctx, next, event)
            if (line) fresh.push(line)
          }
        }
        set((s) => ({
          state: next,
          lastEvents: [],
          log: [...fresh.reverse(), ...s.log].slice(0, 200),
        }))
      },

      onPresence: (online) => set((s) => ({ net: s.net ? { ...s.net, online } : s.net })),
      onError: (reason) => set({ notice: reason }),
    })
    session.connect()
  },

  setActing(playerId) {
    // Changing hands changes what may be seen.
    set((s) => ({
      localActing: playerId,
      state: s.truth ? projectFor(s.truth, playerId) : s.state,
    }))
  },

  acting() {
    const { state, net, localActing } = get()
    if (!state) return null
    if (net) return state.players.find((p) => p.id === net.playerId) ?? null
    if (state.config.travel === 'echtzeit') {
      return state.players.find((p) => p.id === localActing) ?? state.players[0] ?? null
    }
    return state.players[state.activeIndex] ?? null
  },

  myTurn() {
    const { state, net } = get()
    if (!state) return false
    // Real-time play has no turn: anyone may act whenever they like.
    if (state.config.travel === 'echtzeit') return true
    if (!net) return true // one device, one pair of hands
    if (state.phase === 'lobby') return true
    return state.players[state.activeIndex]?.id === net.playerId
  },

  dispatch(action) {
    const { state, net, truth } = get()
    if (!state) return

    // Real-time actions name their actor, because there is no turn to infer
    // it from.
    const NAMES_AN_ACTOR = [
      'buy',
      'sell',
      'setCourse',
      'buyVehicle',
      'boardVehicle',
      'sendPigeon',
      'collectMail',
      'writeNote',
    ] as const
    type ActorAction = Extract<GameAction, { type: (typeof NAMES_AN_ACTOR)[number] }>
    const namesAnActor = (a: GameAction): a is ActorAction =>
      (NAMES_AN_ACTOR as readonly string[]).includes(a.type)

    if (state.config.travel === 'echtzeit' && namesAnActor(action) && !action.by) {
      const me = get().acting()
      if (!me) return
      action = { ...action, by: me.id }
    }

    if (net) {
      // The server is the referee. We apply nothing until it echoes back,
      // so two devices can never disagree about what happened.
      if (!session?.send(action)) {
        set({ notice: 'Keine Verbindung zur Partie. Es wird erneut versucht.' })
      }
      return
    }

    // Local play reduces against the truth, never against the projection.
    const result = applyAction(ctx, truth ?? state, action)

    const rejection = result.events.find((e) => e.type === 'rejected')
    if (rejection && rejection.type === 'rejected') {
      set({ notice: rejection.reason })
      return
    }

    if (saved) {
      saved.actions.push(action)
      persist()
    }

    const fresh = result.events
      .map((e) => describe(ctx, result.state, e))
      .filter((l): l is LogLine => l !== null)

    set((s) => ({
      state: projectFor(result.state, s.localActing),
      truth: result.state,
      lastEvents: result.events,
      log: [...fresh.reverse(), ...s.log].slice(0, 200),
      notice: null,
    }))
  },

  resume() {
    try {
      const raw = localStorage.getItem(SAVE_KEY)
      if (!raw) return false
      const file = JSON.parse(raw) as SaveFile
      if (!Array.isArray(file.names) || file.names.length === 0) return false
      const initial = createGame(ctx, {
        seed: file.seed,
        totalRounds: file.totalRounds,
        ...(file.startingCapital ? { startingCapital: file.startingCapital } : {}),
        ...(file.travel ? { travel: file.travel } : {}),
        ...(file.minutesPerPip ? { minutesPerPip: file.minutesPerPip } : {}),
        ...(file.durationHours ? { durationHours: file.durationHours } : {}),
        ...(file.sicht ? { sicht: file.sicht } : {}),
        ...(file.maxFleetSize ? { maxFleetSize: file.maxFleetSize } : {}),
      })
      const state = replay(ctx, initial, file.actions ?? [])
      saved = file
      set({
        state: projectFor(state, state.players[0]?.id ?? null),
        truth: state,
        log: [],
        lastEvents: [],
        notice: null,
        net: null,
        localActing: state.players[0]?.id ?? null,
      })
      if (state.config.travel === 'echtzeit') startLocalClock(get)
      return true
    } catch {
      return false
    }
  },

  abandon() {
    session?.close()
    session = null
    if (ticker) clearInterval(ticker)
    ticker = null
    saved = null
    try {
      localStorage.removeItem(SAVE_KEY)
    } catch {
      /* nothing to clean up */
    }
    set({
      state: null,
      truth: null,
      log: [],
      lastEvents: [],
      notice: null,
      net: null,
      localActing: null,
    })
  },

  dismissNotice() {
    set({ notice: null })
  },
}))

/**
 * A local real-time game has no server, so this device keeps the clock.
 * Online this never runs: the server is the sole authority on time, and the
 * interface reads the wall clock only to draw countdowns.
 */
function startLocalClock(get: () => Store): void {
  if (ticker) clearInterval(ticker)
  ticker = setInterval(() => {
    const store = get()
    if (store.net) return
    const state = store.state
    if (!state || state.config.travel !== 'echtzeit' || state.phase === 'over') {
      if (ticker) clearInterval(ticker)
      ticker = null
      return
    }
    store.dispatch({ type: 'tick', at: Date.now() })
  }, 1000)
}

export type { GameMeta }

export function hasSavedGame(): boolean {
  try {
    return localStorage.getItem(SAVE_KEY) !== null
  } catch {
    return false
  }
}

export const PLAYER_COLORS = [
  { ink: '#1f4f8f', name: 'Blau' },
  { ink: '#b03027', name: 'Rot' },
  { ink: '#2e6b3f', name: 'Grün' },
  { ink: '#8a6a1f', name: 'Ocker' },
  { ink: '#5a3570', name: 'Violett' },
  { ink: '#1b1b1b', name: 'Schwarz' },
] as const

export const formatMoney = money
