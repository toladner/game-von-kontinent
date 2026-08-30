import type { Gender, PortraitTraits } from '@engine/persona'
import { t, type Message } from '@i18n'
import { currentLocale } from './locale'
import type { GameAction } from '@engine/actions'
import type { GameState, JoinPolicy } from '@engine/state'

/**
 * The wire to the Partieserver.
 *
 * Only actions travel. The client keeps no authoritative state of its own —
 * it applies what the server echoes back, which is why two devices can never
 * drift apart, and why a phone that was asleep for six hours catches up by
 * replaying a handful of log entries.
 */

export interface GameMeta {
  readonly seed: string
  readonly totalRounds: number
  readonly startingCapital: number
  readonly joinPolicy: JoinPolicy
  readonly sicht: 'normal' | 'realistisch'
  readonly travel: 'runde' | 'echtzeit'
  readonly minutesPerPip: number
  readonly durationHours: number
  /** Vessels one house may run at once; absent on tables opened before fleets. */
  readonly maxFleetSize?: number
  /** Market options; absent on tables opened before they existed. */
  readonly angebot?: 'fest' | 'zufaellig'
  readonly preise?: 'fest' | 'entfernung'
  readonly konjunktur?: 'klassisch' | 'erweitert'
  readonly packId: string
  readonly createdAt: number
}

/**
 * What the host may still change while the ships are tied up.
 *
 * The seed, the code and the hour the table was opened are not in it: those
 * are what the table *is*. Everything else is only the terms it will be played
 * under, and until the first die is thrown nothing has been played under them.
 */
export type TableSettings = Partial<Omit<GameMeta, 'seed' | 'createdAt'>>

type ServerMessage =
  | { t: 'welcome'; playerId: string | null; token: string; meta: GameMeta; actions: GameAction[] }
  | { t: 'append'; actions: GameAction[]; from: number }
  | { t: 'view'; state: GameState }
  | { t: 'presence'; online: string[] }
  | { t: 'focus'; playerId: string; step: string }
  | { t: 'error'; reason: Message }
  | { t: 'pong' }

export interface SessionHandlers {
  onWelcome: (playerId: string | null, meta: GameMeta, actions: GameAction[]) => void
  onAppend: (actions: GameAction[]) => void
  /** Under fog the server sends a finished view instead of the log. */
  onView: (state: GameState) => void
  onPresence: (online: string[]) => void
  /** Which harbour panel another seat is looking at. Presence, not state. */
  onFocus: (playerId: string, step: string) => void
  onError: (reason: Message) => void
  onStatus: (status: ConnectionStatus) => void
}

export type ConnectionStatus = 'verbindet' | 'verbunden' | 'getrennt'

const TOKEN_PREFIX = 'vkzk.token.'
const TABLE_KEY = 'vkzk.tisch.v1'
const SEATS_KEY = 'vkzk.tische.v1'

export function storedToken(code: string): string | null {
  try {
    return localStorage.getItem(TOKEN_PREFIX + code)
  } catch {
    return null
  }
}

function rememberToken(code: string, token: string): void {
  try {
    if (token) localStorage.setItem(TOKEN_PREFIX + code, token)
  } catch {
    /* a seat that cannot be remembered still plays for this session */
  }
}

/** Whether this device already holds a seat at that table. */
export function hasSeatAt(code: string): boolean {
  return storedToken(code) !== null
}

/** Give the seat up, so the next join asks for a name again. */
export function forgetSeat(code: string): void {
  try {
    localStorage.removeItem(TOKEN_PREFIX + code)
    const seats = storedSeats()
    delete seats[code]
    localStorage.setItem(SEATS_KEY, JSON.stringify(seats))
  } catch {
    /* nothing to clean up */
  }
}

/**
 * Every table this device holds a seat at.
 *
 * The seat tokens were always here — one key per table, written when the
 * server hands a seat over and removed only when the seat is given up. What
 * was missing was anything to show for them: the app remembered exactly one
 * table, the last, so a player sitting at three had to keep the other two
 * codes on a piece of paper.
 *
 * The tokens are the authority on *whether* there is a seat; the record below
 * carries what is worth showing about it — the name being played under and
 * when the table was last opened, so the list can be put in a sensible order.
 * A token without a record is still listed: a seat is a seat, even if it was
 * taken before this was written.
 */
export interface KnownTable {
  readonly code: string
  readonly name: string
  readonly gender?: Gender
  /** When this device last sat down. Absent for seats taken before v1. */
  readonly seenAt?: number
}

type SeatRecord = Record<string, { name: string; gender?: Gender; seenAt: number }>

function storedSeats(): SeatRecord {
  try {
    const raw = localStorage.getItem(SEATS_KEY)
    const parsed = raw ? (JSON.parse(raw) as SeatRecord) : {}
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

/** Note that this device is sitting at a table, and under what name. */
export function noteSeat(code: string, name: string, gender?: Gender): void {
  try {
    const seats = storedSeats()
    seats[code] = { name, seenAt: Date.now(), ...(gender ? { gender } : {}) }
    localStorage.setItem(SEATS_KEY, JSON.stringify(seats))
  } catch {
    /* private mode: the table still plays, it just will not be listed */
  }
}

/**
 * The tables, most recently opened first.
 *
 * Read from the token keys rather than from the record, so a seat can never
 * be listed that the device cannot actually take — which would be a code that
 * looks like a way back in and is not.
 */
export function knownTables(): KnownTable[] {
  try {
    const seats = storedSeats()
    const codes: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith(TOKEN_PREFIX)) codes.push(key.slice(TOKEN_PREFIX.length))
    }
    return codes
      .map((code) => ({ code, name: seats[code]?.name ?? '', ...(seats[code] ?? {}) }))
      .sort((a, b) => (b.seenAt ?? 0) - (a.seenAt ?? 0))
  } catch {
    return []
  }
}

/**
 * Which table this device was last sitting at.
 *
 * The seat token above was only ever half the story. It answers "who am I at
 * table WZUH", which is why typing any name at all got you back into your own
 * house — but nothing remembered *that it was WZUH*, so every reload landed on
 * the title page and the code had to be typed in again. In an installed app,
 * where closing is what you do rather than reloading, that happened constantly,
 * and while the player was off the game screen no arrival could be announced.
 *
 * So the code is written down beside the token, and the app walks back in on
 * its own. Cleared when the player leaves deliberately, never otherwise.
 */
export interface RememberedTable {
  readonly code: string
  readonly name: string
  readonly gender?: Gender
}

export function rememberTable(table: RememberedTable): void {
  try {
    localStorage.setItem(TABLE_KEY, JSON.stringify(table))
  } catch {
    /* private mode: the game plays, it just will not walk back in */
  }
}

export function rememberedTable(): RememberedTable | null {
  try {
    const raw = localStorage.getItem(TABLE_KEY)
    if (!raw) return null
    const table = JSON.parse(raw) as RememberedTable
    if (typeof table?.code !== 'string' || !table.code) return null
    return table
  } catch {
    return null
  }
}

export function forgetTable(): void {
  try {
    localStorage.removeItem(TABLE_KEY)
  } catch {
    /* nothing to clean up */
  }
}

export async function createOnlineGame(options: {
  totalRounds: number
  startingCapital: number
  joinPolicy: JoinPolicy
  sicht: 'normal' | 'realistisch'
  travel: 'runde' | 'echtzeit'
  minutesPerPip: number
  durationHours: number
  maxFleetSize: number
  angebot?: 'fest' | 'zufaellig'
  preise?: 'fest' | 'entfernung'
  konjunktur?: 'klassisch' | 'erweitert'
  packId?: string
}): Promise<{ code: string; meta: GameMeta }> {
  const res = await fetch('/api/games', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(options),
  })
  // Thrown rather than returned because the caller shows it as-is; the
  // language is this device's, since this device is the one that asked.
  if (!res.ok) throw new Error(t(currentLocale(), 'net.couldNotOpen'))
  return (await res.json()) as { code: string; meta: GameMeta }
}

/** Ein Platz an einem fremden Tisch, so wie ihn die Anmeldung zeigen darf. */
export interface TableSeat {
  readonly id: string
  readonly name: string
  readonly colorIndex: number
  readonly portrait: PortraitTraits
}

/** Was von einer Partie zu sehen ist, ohne ihr beizutreten. */
export interface TableInfo {
  readonly meta: GameMeta
  readonly phase: string
  readonly players: readonly TableSeat[]
}

/**
 * Wer schon am Kai steht.
 *
 * Ein Blick auf den Tisch, ohne sich hinzusetzen: der Beitretende sieht die
 * angemeldeten Häuser und bekommt die Farbe, die er wirklich erhält, statt
 * überall als Spieler 1 in Blau zu erscheinen und beim Beitreten der Vierte
 * in Ocker zu werden.
 */
export type TableLookup =
  | { readonly ok: true; readonly info: TableInfo }
  /** Der Server kennt den Code nicht. */
  | { readonly ok: false; readonly reason: 'unbekannt' }
  /** Der Server war nicht zu erreichen — das sagt über den Tisch nichts aus. */
  | { readonly ok: false; readonly reason: 'stumm' }

export async function tableInfo(code: string): Promise<TableLookup> {
  try {
    const res = await fetch(`/api/games/${encodeURIComponent(code)}`)
    if (!res.ok) return { ok: false, reason: 'unbekannt' }
    return { ok: true, info: (await res.json()) as TableInfo }
  } catch {
    return { ok: false, reason: 'stumm' }
  }
}

export class Session {
  private socket: WebSocket | null = null
  private closedByUs = false
  private retry = 0
  private timer: ReturnType<typeof setTimeout> | null = null

  constructor(
    readonly code: string,
    private readonly name: string,
    /** Undefined lets the server derive a persona from the name alone. */
    private readonly gender: Gender | undefined,
    private readonly handlers: SessionHandlers,
  ) {}

  connect(): void {
    this.closedByUs = false
    this.handlers.onStatus('verbindet')

    const scheme = location.protocol === 'https:' ? 'wss' : 'ws'
    const socket = new WebSocket(`${scheme}://${location.host}/api/games/${this.code}/ws`)
    this.socket = socket

    socket.addEventListener('open', () => {
      this.retry = 0
      this.handlers.onStatus('verbunden')
      const token = storedToken(this.code)
      // A remembered token returns to the same seat; otherwise ask for one.
      socket.send(
        JSON.stringify(
          token ? { t: 'hello', token } : { t: 'hello', name: this.name, gender: this.gender },
        ),
      )
    })

    socket.addEventListener('message', (event) => {
      let message: ServerMessage
      try {
        message = JSON.parse(String(event.data)) as ServerMessage
      } catch {
        return
      }
      switch (message.t) {
        case 'welcome':
          rememberToken(this.code, message.token)
          this.handlers.onWelcome(message.playerId, message.meta, message.actions)
          return
        case 'append':
          this.handlers.onAppend(message.actions)
          return
        case 'view':
          this.handlers.onView(message.state)
          return
        case 'presence':
          this.handlers.onPresence(message.online)
          return
        case 'focus':
          this.handlers.onFocus(message.playerId, message.step)
          return
        case 'error':
          this.handlers.onError(message.reason)
          return
        case 'pong':
          return
      }
    })

    const dropped = () => {
      if (this.closedByUs) return
      this.handlers.onStatus('getrennt')
      // Back off, but never so far that a returning player waits long.
      const wait = Math.min(8000, 500 * 2 ** this.retry++)
      this.timer = setTimeout(() => this.connect(), wait)
    }
    socket.addEventListener('close', dropped)
    socket.addEventListener('error', dropped)
  }

  send(action: GameAction): boolean {
    if (this.socket?.readyState !== WebSocket.OPEN) return false
    this.socket.send(JSON.stringify({ t: 'action', action }))
    return true
  }

  /**
   * New terms for a table that has not cast off.
   *
   * Nothing comes back but the table itself, dealt again from the top: the
   * server keeps the settings, not the log, so there is no reply to wait for
   * and nothing to reconcile — the next `welcome` is the answer.
   */
  configure(settings: TableSettings): boolean {
    if (this.socket?.readyState !== WebSocket.OPEN) return false
    this.socket.send(JSON.stringify({ t: 'configure', settings }))
    return true
  }

  /**
   * Tell the table which panel of the harbour round we are on. Fire and
   * forget: a dropped focus costs nothing, so it is never queued or retried.
   */
  sendFocus(step: string): void {
    if (this.socket?.readyState !== WebSocket.OPEN) return
    this.socket.send(JSON.stringify({ t: 'focus', step }))
  }

  close(): void {
    this.closedByUs = true
    if (this.timer) clearTimeout(this.timer)
    this.socket?.close()
    this.socket = null
  }
}
