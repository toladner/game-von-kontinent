import type { GameAction } from '@engine/actions'
import type { JoinPolicy } from '@engine/state'

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
  readonly packId: string
  readonly createdAt: number
}

type ServerMessage =
  | { t: 'welcome'; playerId: string | null; token: string; meta: GameMeta; actions: GameAction[] }
  | { t: 'append'; actions: GameAction[]; from: number }
  | { t: 'presence'; online: string[] }
  | { t: 'error'; reason: string }
  | { t: 'pong' }

export interface SessionHandlers {
  onWelcome: (playerId: string | null, meta: GameMeta, actions: GameAction[]) => void
  onAppend: (actions: GameAction[]) => void
  onPresence: (online: string[]) => void
  onError: (reason: string) => void
  onStatus: (status: ConnectionStatus) => void
}

export type ConnectionStatus = 'verbindet' | 'verbunden' | 'getrennt'

const TOKEN_PREFIX = 'vkzk.token.'

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

export async function createOnlineGame(options: {
  totalRounds: number
  startingCapital: number
  joinPolicy: JoinPolicy
}): Promise<{ code: string; meta: GameMeta }> {
  const res = await fetch('/api/games', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(options),
  })
  if (!res.ok) throw new Error('Die Exportbank meldet: Partie konnte nicht eröffnet werden.')
  return (await res.json()) as { code: string; meta: GameMeta }
}

export async function gameExists(code: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/games/${encodeURIComponent(code)}`)
    return res.ok
  } catch {
    return false
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
      socket.send(JSON.stringify(token ? { t: 'hello', token } : { t: 'hello', name: this.name }))
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
        case 'presence':
          this.handlers.onPresence(message.online)
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

  close(): void {
    this.closedByUs = true
    if (this.timer) clearTimeout(this.timer)
    this.socket?.close()
    this.socket = null
  }
}
