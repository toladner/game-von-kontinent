import { create } from 'zustand'
import { CLASSIC_PACK } from '@content/maps/classic'
import { createContext, type EngineContext } from '@engine/context'
import { createGame, openingActions } from '@engine/setup'
import { applyAction, replay } from '@engine/reducer'
import type { GameAction, GameEvent } from '@engine/actions'
import type { GameState, JoinPolicy } from '@engine/state'
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
  readonly startingCapital?: number
  readonly actions: GameAction[]
}

export interface BeginOptions {
  readonly totalRounds?: number
  readonly startingCapital?: number
  readonly seed?: string
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
  state: GameState | null
  log: LogLine[]
  /** Events from the most recent action, for animations and flashes. */
  lastEvents: readonly GameEvent[]
  notice: string | null
  /** Null for a local game at one device. */
  net: NetState | null

  begin: (names: string[], options?: BeginOptions) => void
  host: (name: string, options: BeginOptions & { joinPolicy: JoinPolicy }) => Promise<string>
  join: (code: string, name: string) => void
  dispatch: (action: GameAction) => void
  resume: () => boolean
  abandon: () => void
  dismissNotice: () => void
  /** True when this device may act right now. */
  myTurn: () => boolean
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

export const useGame = create<Store>((set, get) => ({
  ctx,
  state: null,
  log: [],
  lastEvents: [],
  notice: null,
  net: null,

  begin(names, options = {}) {
    const totalRounds = options.totalRounds ?? 30
    const startingCapital = options.startingCapital ?? ctx.pack.config.startingCapital
    const realSeed = options.seed ?? `${Date.now().toString(36)}-${names.join('|')}`
    saved = { names, seed: realSeed, totalRounds, startingCapital, actions: [] }
    persist()
    const opening = openingActions(names)
    const state = replay(ctx, createGame(ctx, { seed: realSeed, totalRounds, startingCapital }), opening)
    saved.actions.push(...opening)
    persist()
    session?.close()
    session = null
    set({
      state,
      net: null,
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
  },

  async host(name, options) {
    const { code } = await createOnlineGame({
      totalRounds: options.totalRounds ?? 30,
      startingCapital: options.startingCapital ?? ctx.pack.config.startingCapital,
      joinPolicy: options.joinPolicy,
    })
    get().join(code, name)
    return code
  },

  join(code, name) {
    session?.close()
    // A networked game is never saved locally; the server holds the log.
    saved = null
    set({ state: null, log: [], lastEvents: [], notice: null, net: { code, status: 'verbindet', playerId: null, online: [] } })

    session = new Session(code, name, {
      onStatus: (status) =>
        set((s) => ({ net: s.net ? { ...s.net, status } : s.net })),

      onWelcome: (playerId, meta, actions) => {
        const initial = createGame(ctx, {
          seed: meta.seed,
          totalRounds: meta.totalRounds,
          startingCapital: meta.startingCapital,
          joinPolicy: meta.joinPolicy,
        })
        set((s) => ({
          state: replay(ctx, initial, actions),
          net: s.net ? { ...s.net, playerId } : s.net,
          notice: null,
        }))
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

  myTurn() {
    const { state, net } = get()
    if (!state) return false
    if (!net) return true // one device, one pair of hands
    if (state.phase === 'lobby') return true
    return state.players[state.activeIndex]?.id === net.playerId
  },

  dispatch(action) {
    const { state, net } = get()
    if (!state) return

    if (net) {
      // The server is the referee. We apply nothing until it echoes back,
      // so two devices can never disagree about what happened.
      if (!session?.send(action)) {
        set({ notice: 'Keine Verbindung zur Partie. Es wird erneut versucht.' })
      }
      return
    }

    const result = applyAction(ctx, state, action)

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
      state: result.state,
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
      })
      const state = replay(ctx, initial, file.actions ?? [])
      saved = file
      set({ state, log: [], lastEvents: [], notice: null, net: null })
      return true
    } catch {
      return false
    }
  },

  abandon() {
    session?.close()
    session = null
    saved = null
    try {
      localStorage.removeItem(SAVE_KEY)
    } catch {
      /* nothing to clean up */
    }
    set({ state: null, log: [], lastEvents: [], notice: null, net: null })
  },

  dismissNotice() {
    set({ notice: null })
  },
}))

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
