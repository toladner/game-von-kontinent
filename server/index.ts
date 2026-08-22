/**
 * Der Partieserver — a Cloudflare Worker plus one Durable Object per game.
 *
 * The object stores nothing but `{meta, actions[]}`. Because the rules engine
 * is pure TypeScript with no DOM, the server runs the *same reducer* as the
 * browser to decide whether an action is legal and whose turn it is. There is
 * no second implementation of the rules to keep in step.
 *
 * A game therefore survives between visits, which is what makes both
 * cross-device play and "let the ship sail, come back this evening" possible.
 */
import { CLASSIC_PACK } from '../src/content/maps/classic'
import { createContext } from '../src/engine/context'
import { createGame } from '../src/engine/setup'
import { applyAction } from '../src/engine/reducer'
import type { GameAction } from '../src/engine/actions'
import { flagship } from '../src/engine/state'
import type { GameState, JoinPolicy } from '../src/engine/state'
import { nextEventAt } from '../src/engine/selectors'
import type { TravelMode } from '../src/engine/types'

export interface Env {
  GAMES: DurableObjectNamespace
  ASSETS?: { fetch: (req: Request) => Promise<Response> }
}

export interface GameMeta {
  readonly seed: string
  readonly totalRounds: number
  readonly startingCapital: number
  readonly joinPolicy: JoinPolicy
  readonly travel: TravelMode
  readonly minutesPerPip: number
  readonly durationHours: number
  readonly packId: string
  readonly createdAt: number
}

/** Wire protocol. Small, versioned by shape rather than a number. */
type ClientMessage =
  | { t: 'hello'; token?: string; name?: string }
  | { t: 'action'; action: GameAction }
  | { t: 'start' }
  | { t: 'ping' }

type ServerMessage =
  | { t: 'welcome'; playerId: string | null; token: string; meta: GameMeta; actions: GameAction[] }
  | { t: 'append'; actions: GameAction[]; from: number }
  | { t: 'presence'; online: string[] }
  | { t: 'error'; reason: string }
  | { t: 'pong' }

const ctx = createContext(CLASSIC_PACK)

// Unambiguous alphabet: no I/1, no O/0.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function makeCode(length = 4): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('')
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...CORS },
  })
}

const CORS: Record<string, string> = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-allow-headers': 'content-type',
}

// ---------------------------------------------------------------------------
// Worker: routing only
// ---------------------------------------------------------------------------

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS })

    if (url.pathname === '/api/games' && request.method === 'POST') {
      const body = (await request.json().catch(() => ({}))) as Partial<GameMeta>
      const code = makeCode()
      const meta: GameMeta = {
        seed: `${code}-${Date.now().toString(36)}`,
        totalRounds: clamp(body.totalRounds ?? 30, 1, 200),
        startingCapital: clamp(body.startingCapital ?? 500_000, 50_000, 5_000_000),
        joinPolicy: body.joinPolicy === 'jederzeit' ? 'jederzeit' : 'nur-zu-beginn',
        travel: body.travel === 'echtzeit' ? 'echtzeit' : 'runde',
        // Fractional minutes are allowed: handy for a blitz table, and the
        // only way an automated test can watch a voyage finish.
        minutesPerPip: clampF(body.minutesPerPip ?? 6, 0.02, 240),
        durationHours: clamp(body.durationHours ?? 24, 1, 720),
        packId: 'classic',
        createdAt: Date.now(),
      }
      const stub = env.GAMES.get(env.GAMES.idFromName(code))
      const res = await stub.fetch('https://do/create', {
        method: 'POST',
        body: JSON.stringify(meta),
      })
      if (!res.ok) return json({ error: 'Partie konnte nicht eröffnet werden.' }, 500)
      return json({ code, meta })
    }

    const match = url.pathname.match(/^\/api\/games\/([A-Z0-9]{3,8})(\/ws)?$/i)
    if (match) {
      const code = match[1]!.toUpperCase()
      const stub = env.GAMES.get(env.GAMES.idFromName(code))
      return stub.fetch(
        new Request(`https://do/${match[2] ? 'ws' : 'info'}`, request),
      )
    }

    if (url.pathname.startsWith('/api/')) return json({ error: 'Unbekannter Weg.' }, 404)

    // Everything else is the static game, when deployed together.
    if (env.ASSETS) return env.ASSETS.fetch(request)
    return new Response('Nicht gefunden', { status: 404 })
  },
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(n)))
const clampF = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

// ---------------------------------------------------------------------------
// Durable Object: one table
// ---------------------------------------------------------------------------

interface Seat {
  readonly playerId: string
  readonly token: string
}

export class GameRoom {
  private meta: GameMeta | null = null
  private actions: GameAction[] = []
  private seats = new Map<string, Seat>() // token -> seat
  private state: GameState | null = null
  private sockets = new Map<WebSocket, string | null>() // socket -> playerId
  private loaded = false

  constructor(
    private readonly storage: DurableObjectState,
    _env: Env,
  ) {}

  private async load(): Promise<void> {
    if (this.loaded) return
    this.meta = (await this.storage.storage.get<GameMeta>('meta')) ?? null
    this.actions = (await this.storage.storage.get<GameAction[]>('actions')) ?? []
    const seats = (await this.storage.storage.get<Seat[]>('seats')) ?? []
    this.seats = new Map(seats.map((s) => [s.token, s]))
    this.rebuild()
    this.loaded = true
  }

  /** Fold the log. Cheap enough to redo on wake; kept warm between messages. */
  private rebuild(): void {
    if (!this.meta) {
      this.state = null
      return
    }
    let s = createGame(ctx, {
      seed: this.meta.seed,
      totalRounds: this.meta.totalRounds,
      startingCapital: this.meta.startingCapital,
      joinPolicy: this.meta.joinPolicy,
      travel: this.meta.travel,
      minutesPerPip: this.meta.minutesPerPip,
      durationHours: this.meta.durationHours,
    })
    for (const a of this.actions) s = applyAction(ctx, s, a).state
    this.state = s
  }

  private async persist(): Promise<void> {
    await this.storage.storage.put({
      meta: this.meta,
      actions: this.actions,
      seats: [...this.seats.values()],
    })
  }

  async fetch(request: Request): Promise<Response> {
    await this.load()
    const url = new URL(request.url)

    if (url.pathname === '/create') {
      if (this.meta) return json({ error: 'Code bereits vergeben.' }, 409)
      this.meta = (await request.json()) as GameMeta
      this.actions = []
      this.rebuild()
      await this.persist()
      // A real-time table needs a first stroke of the clock to reckon from.
      await this.catchUp()
      return json({ ok: true })
    }

    if (url.pathname === '/info') {
      if (!this.meta) return json({ error: 'Unbekannte Partie.' }, 404)
      // Reading the state is enough to bring the clock up to date.
      await this.catchUp()
      return json({
        meta: this.meta,
        phase: this.state?.phase ?? 'lobby',
        now: this.state?.now ?? 0,
        players:
          this.state?.players.map((p) => ({
            id: p.id,
            name: p.name,
            at: flagship(p).nodeId,
            cash: p.cash,
            destination: flagship(p).voyage?.destination ?? null,
          })) ?? [],
      })
    }

    if (url.pathname === '/ws') {
      if (!this.meta) return json({ error: 'Unbekannte Partie.' }, 404)
      if (request.headers.get('Upgrade') !== 'websocket') {
        return new Response('Erwarte WebSocket', { status: 426 })
      }
      const pair = new WebSocketPair()
      const [client, server] = [pair[0], pair[1]]
      this.accept(server)
      return new Response(null, { status: 101, webSocket: client })
    }

    return json({ error: 'Unbekannter Weg.' }, 404)
  }

  private accept(socket: WebSocket): void {
    socket.accept()
    this.sockets.set(socket, null)

    socket.addEventListener('message', (event) => {
      void this.onMessage(socket, event)
    })
    const drop = () => {
      this.sockets.delete(socket)
      this.broadcastPresence()
    }
    socket.addEventListener('close', drop)
    socket.addEventListener('error', drop)
  }

  private send(socket: WebSocket, message: ServerMessage): void {
    try {
      socket.send(JSON.stringify(message))
    } catch {
      this.sockets.delete(socket)
    }
  }

  private broadcast(message: ServerMessage): void {
    for (const socket of this.sockets.keys()) this.send(socket, message)
  }

  private broadcastPresence(): void {
    const online = [...this.sockets.values()].filter((id): id is string => id !== null)
    this.broadcast({ t: 'presence', online })
  }

  private async onMessage(socket: WebSocket, event: MessageEvent): Promise<void> {
    let message: ClientMessage
    try {
      message = JSON.parse(String(event.data)) as ClientMessage
    } catch {
      return this.send(socket, { t: 'error', reason: 'Unlesbare Nachricht.' })
    }
    if (!this.meta || !this.state) {
      return this.send(socket, { t: 'error', reason: 'Diese Partie gibt es nicht.' })
    }

    // Whatever the message, the world has moved on since the last one.
    await this.catchUp()

    switch (message.t) {
      case 'ping':
        return this.send(socket, { t: 'pong' })

      case 'hello': {
        // A known token returns to its own seat, even on another device.
        const existing = message.token ? this.seats.get(message.token) : undefined
        if (existing) {
          this.sockets.set(socket, existing.playerId)
          this.send(socket, {
            t: 'welcome',
            playerId: existing.playerId,
            token: existing.token,
            meta: this.meta,
            actions: this.actions,
          })
          this.broadcastPresence()
          return
        }

        // A new arrival with a name takes a seat, if the table allows it.
        if (message.name) {
          const playerId = `p${this.state.players.length + 1}-${makeCode(3).toLowerCase()}`
          const applied = await this.commit({ type: 'join', playerId, name: message.name })
          if (!applied.ok) return this.send(socket, { t: 'error', reason: applied.reason })

          const token = crypto.randomUUID()
          this.seats.set(token, { playerId, token })
          await this.persist()

          this.sockets.set(socket, playerId)
          this.send(socket, {
            t: 'welcome',
            playerId,
            token,
            meta: this.meta,
            actions: this.actions,
          })
          this.broadcastPresence()
          return
        }

        // A spectator: everything to watch, no seat.
        this.send(socket, {
          t: 'welcome',
          playerId: null,
          token: '',
          meta: this.meta,
          actions: this.actions,
        })
        return
      }

      case 'action': {
        const playerId = this.sockets.get(socket) ?? null
        if (!playerId) {
          return this.send(socket, { t: 'error', reason: 'Sie sitzen nicht mit am Tisch.' })
        }
        const guard = this.mayAct(playerId, message.action)
        if (guard) return this.send(socket, { t: 'error', reason: guard })

        const applied = await this.commit(message.action)
        if (!applied.ok) return this.send(socket, { t: 'error', reason: applied.reason })
        return
      }
    }
  }

  /**
   * Turn ownership. The reducer already knows the rules; this only answers
   * "is this person allowed to speak right now".
   */
  private mayAct(playerId: string, action: GameAction): string | null {
    const state = this.state!
    if (action.type === 'join') return 'Beitritt läuft über die Anmeldung.'
    if (action.type === 'start') {
      if (state.hostId !== playerId) return 'Nur wer die Partie eröffnet hat, gibt sie frei.'
      return null
    }
    const active = state.players[state.activeIndex]
    if (!active) return 'Es ist niemand am Zug.'
    if (active.id !== playerId) return `${active.name} ist am Zug.`
    return null
  }

  /** Apply, store, broadcast. The single place the log grows. */
  private async commit(
    action: GameAction,
  ): Promise<{ ok: true } | { ok: false; reason: string }> {
    const result = applyAction(ctx, this.state!, action)
    const rejection = result.events.find((e) => e.type === 'rejected')
    if (rejection && rejection.type === 'rejected') {
      return { ok: false, reason: rejection.reason }
    }

    this.state = result.state
    const from = this.actions.length
    this.actions.push(action)
    await this.persist()
    this.broadcast({ t: 'append', actions: [action], from })
    await this.scheduleWake()
    return { ok: true }
  }

  /**
   * Bring the world clock up to now.
   *
   * The server is the only authority on time: clients never stamp their own,
   * so nobody can make their ship arrive early by lying about the hour.
   */
  private async catchUp(): Promise<void> {
    if (this.meta?.travel !== 'echtzeit') return
    const now = Date.now()
    if (this.state && now > this.state.now) await this.commit({ type: 'tick', at: now })
  }

  /**
   * Sleep until the next thing that happens on its own. This is what lets a
   * ship make port at three in the morning with nobody connected.
   */
  private async scheduleWake(): Promise<void> {
    if (!this.state) return
    const at = nextEventAt(this.state)
    if (at === null) {
      await this.storage.storage.deleteAlarm()
      return
    }
    // A small margin so the tick lands after the moment, never just before.
    await this.storage.storage.setAlarm(Math.max(Date.now() + 1000, at + 250))
  }

  /** Durable Object alarm: the world moving while nobody watches. */
  async alarm(): Promise<void> {
    await this.load()
    await this.catchUp()
    await this.scheduleWake()
  }
}
