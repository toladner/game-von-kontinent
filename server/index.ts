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
import { packById } from '../src/content/packs'
import { createContext } from '../src/engine/context'
import { createGame } from '../src/engine/setup'
import { applyAction } from '../src/engine/reducer'
import type { GameAction } from '../src/engine/actions'
import { flagship } from '../src/engine/state'
import type { GameState, JoinPolicy } from '../src/engine/state'
import { nextEventAt } from '../src/engine/selectors'
import { projectFor } from '../src/engine/fog'
import type { AngebotMode, PreisMode, TravelMode } from '../src/engine/types'
import type { Gender } from '../src/engine/persona'

export interface Env {
  GAMES: DurableObjectNamespace
  ASSETS?: { fetch: (req: Request) => Promise<Response> }
}

export interface GameMeta {
  readonly seed: string
  readonly totalRounds: number
  readonly startingCapital: number
  readonly joinPolicy: JoinPolicy
  readonly sicht: 'normal' | 'realistisch'
  readonly travel: TravelMode
  readonly minutesPerPip: number
  readonly durationHours: number
  /** Vessels one house may run at once; 1 is the printed game. */
  readonly maxFleetSize: number
  /**
   * Market options. Optional because tables opened before they existed have
   * no such field stored, and must keep replaying to the game they were.
   */
  readonly angebot?: AngebotMode
  readonly preise?: PreisMode
  readonly packId: string
  readonly createdAt: number
}

/** Wire protocol. Small, versioned by shape rather than a number. */
type ClientMessage =
  | { t: 'hello'; token?: string; name?: string; gender?: Gender }
  | { t: 'action'; action: GameAction }
  | { t: 'start' }
  /**
   * Which panel of the harbour round the sender is looking at. Presence, not
   * game state: it is never written to the log, never replayed, and a client
   * that misses one is only briefly looking at the wrong tab.
   */
  | { t: 'focus'; step: string }
  | { t: 'ping' }

type ServerMessage =
  | { t: 'welcome'; playerId: string | null; token: string; meta: GameMeta; actions: GameAction[] }
  | { t: 'append'; actions: GameAction[]; from: number }
  /**
   * Sicht "realistisch": the log itself is secret, because a client that
   * receives the truth has the truth whatever it chooses to draw. Each seat
   * is sent a projected state instead.
   */
  | { t: 'view'; state: GameState }
  | { t: 'presence'; online: string[] }
  | { t: 'focus'; playerId: string; step: string }
  | { t: 'error'; reason: string }
  | { t: 'pong' }

/**
 * One context per plan, built on demand.
 *
 * The Durable Object runs the same reducer as the browser, so it has to run
 * it against the same map — a table opened on the world plan cannot be
 * folded against the printed board.
 */
const contexts = new Map<string, ReturnType<typeof createContext>>()
function contextFor(packId: string | undefined) {
  const pack = packById(packId)
  const existing = contexts.get(pack.id)
  if (existing) return existing
  const made = createContext(pack)
  contexts.set(pack.id, made)
  return made
}

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
        sicht: body.sicht === 'realistisch' ? 'realistisch' : 'normal',
        travel: body.travel === 'echtzeit' ? 'echtzeit' : 'runde',
        // Fractional minutes are allowed: handy for a blitz table, and the
        // only way an automated test can watch a voyage finish.
        minutesPerPip: clampF(body.minutesPerPip ?? 6, 0.02, 240),
        durationHours: clamp(body.durationHours ?? 24, 1, 720),
        maxFleetSize: clamp(body.maxFleetSize ?? 1, 1, 6),
        angebot: body.angebot === 'zufaellig' ? 'zufaellig' : 'fest',
        preise: body.preise === 'entfernung' ? 'entfernung' : 'fest',
        packId: typeof body.packId === 'string' ? body.packId : 'classic',
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
    const ctx = contextFor(this.meta.packId)
    let s = createGame(ctx, {
      seed: this.meta.seed,
      totalRounds: this.meta.totalRounds,
      startingCapital: this.meta.startingCapital,
      joinPolicy: this.meta.joinPolicy,
      sicht: this.meta.sicht,
      travel: this.meta.travel,
      minutesPerPip: this.meta.minutesPerPip,
      durationHours: this.meta.durationHours,
      maxFleetSize: this.meta.maxFleetSize,
      // Absent on tables opened before these options existed; createGame then
      // falls back to the pack's own defaults, which is the old behaviour.
      ...(this.meta.angebot ? { angebot: this.meta.angebot } : {}),
      ...(this.meta.preise ? { preise: this.meta.preise } : {}),
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
            at: this.foggy ? null : flagship(p).nodeId,
            cash: this.foggy ? null : p.cash,
            destination: this.foggy ? null : (flagship(p).voyage?.destination ?? null),
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

  private get foggy(): boolean {
    return this.meta?.sicht === 'realistisch'
  }

  /** Under fog every seat gets a different letter. */
  private broadcastViews(): void {
    if (!this.state) return
    for (const [socket, playerId] of this.sockets) {
      this.send(socket, { t: 'view', state: projectFor(this.state, playerId) })
    }
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

      case 'focus': {
        // Watchers should see the harbour through the eyes of whoever has the
        // wheel. Relayed as-is and not stored: it is worth nothing a moment
        // later, so there is nothing to catch up on when a client reconnects.
        const who = this.sockets.get(socket)
        if (who) this.broadcast({ t: 'focus', playerId: who, step: message.step })
        return
      }

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
            actions: this.foggy ? [] : this.actions,
          })
          if (this.foggy) {
            this.send(socket, { t: 'view', state: projectFor(this.state, existing.playerId) })
          }
          this.broadcastPresence()
          return
        }

        // A new arrival with a name takes a seat, if the table allows it.
        if (message.name) {
          const playerId = `p${this.state.players.length + 1}-${makeCode(3).toLowerCase()}`
          const applied = await this.commit({
            type: 'join',
            playerId,
            name: message.name,
            // Only 'w' and 'm' are personas; anything else lets the name decide.
            ...(message.gender === 'w' || message.gender === 'm'
              ? { gender: message.gender }
              : {}),
          })
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
            actions: this.foggy ? [] : this.actions,
          })
          if (this.foggy) this.broadcastViews()
          this.broadcastPresence()
          return
        }

        // A spectator: everything to watch, no seat — unless the table is
        // playing under fog, in which case there is nothing to watch.
        this.send(socket, {
          t: 'welcome',
          playerId: null,
          token: '',
          meta: this.meta,
          actions: this.foggy ? [] : this.actions,
        })
        if (this.foggy) this.send(socket, { t: 'view', state: projectFor(this.state, null) })
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

    // Nobody acts for another house, whichever way the table is played. In
    // round play the turn check below happened to cover this; in real-time
    // nothing did, and an action naming somebody else would have been taken
    // at its word.
    const by = 'by' in action ? action.by : undefined
    if (by && by !== playerId) return 'Sie handeln nur für Ihr eigenes Haus.'

    // A telegram is not a move. It goes whenever its sender likes, whosever
    // turn it is — a table where you may only speak when it is your turn is
    // not a table anybody would talk at. The sender is already pinned above.
    if (action.type === 'telegramm') return null

    /*
     * Real-time play has no turn to wait for. The ships sail on a clock and
     * every house trades whenever it likes — that is the whole point of the
     * mode, and `activeIndex` is meaningless there: it never leaves the first
     * seat. Applying turn order anyway left everybody except the first player
     * permanently told that the first player was "am Zug", unable to buy,
     * sell or set a course for the entire game.
     */
    if (state.config.travel === 'echtzeit') return null

    const active = state.players[state.activeIndex]
    if (!active) return 'Es ist niemand am Zug.'
    if (active.id !== playerId) return `${active.name} ist am Zug.`
    return null
  }

  /** Apply, store, broadcast. The single place the log grows. */
  private async commit(
    action: GameAction,
  ): Promise<{ ok: true } | { ok: false; reason: string }> {
    const result = applyAction(contextFor(this.meta?.packId), this.state!, action)
    const rejection = result.events.find((e) => e.type === 'rejected')
    if (rejection && rejection.type === 'rejected') {
      return { ok: false, reason: rejection.reason }
    }

    this.state = result.state
    const from = this.actions.length
    this.actions.push(action)
    await this.persist()
    if (this.foggy) this.broadcastViews()
    else this.broadcast({ t: 'append', actions: [action], from })
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
    const at = nextEventAt(contextFor(this.meta?.packId), this.state)
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
    if (this.foggy) this.broadcastViews()
    await this.scheduleWake()
  }
}
