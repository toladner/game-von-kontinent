import { create } from 'zustand'
import { contextFor, DEFAULT_PACK_ID } from '@content/packs'
import type { EngineContext } from '@engine/context'
import { createGame, openingActions, type Seat } from '@engine/setup'
import type { Gender } from '@engine/persona'
import { applyAction, replay } from '@engine/reducer'
import type { GameAction, GameEvent } from '@engine/actions'
import { activePlayer } from '@engine/state'
import type { GameState, JoinPolicy, PlayerState } from '@engine/state'
import type { AngebotMode, KonjunkturMode, PreisMode } from '@engine/types'
import { projectFor } from '@engine/fog'
import {
  createOnlineGame,
  forgetSeat,
  forgetTable,
  hasSeatAt,
  rememberedTable,
  rememberTable,
  Session,
  type ConnectionStatus,
  type GameMeta,
} from './net'
import { armPush } from './push'
import { currentLocale, useLocaleStore } from './locale'
import { msg, t, type Message, type MsgKey, type Vars } from '@i18n'
import { formatMoney as moneyIn, formatNumber, named } from '@i18n/locale'

const SAVE_KEY = 'vkzk.partie.v1'

interface SaveFile {
  readonly names: string[]
  /** Which plan the game is played on; absent on saves from before maps. */
  packId?: string
  readonly seed: string
  readonly totalRounds: number
  startingCapital?: number
  travel?: 'runde' | 'echtzeit'
  minutesPerPip?: number
  durationHours?: number
  sicht?: 'normal' | 'realistisch'
  maxFleetSize?: number
  angebot?: AngebotMode
  preise?: PreisMode
  konjunktur?: KonjunkturMode
  readonly actions: GameAction[]
}

export interface BeginOptions {
  /** Which plan to play on. Defaults to the printed board. */
  readonly packId?: string
  readonly totalRounds?: number
  readonly startingCapital?: number
  readonly seed?: string
  readonly travel?: 'runde' | 'echtzeit'
  readonly minutesPerPip?: number
  readonly durationHours?: number
  readonly sicht?: 'normal' | 'realistisch'
  /** Vessels one house may run; 1 (the printed game) closes the yards. */
  readonly maxFleetSize?: number
  /** 'zufaellig' deals the trade routes afresh from the seed. */
  readonly angebot?: AngebotMode
  /** 'entfernung' pays more the further a good is from its source. */
  readonly preise?: PreisMode
  /** 'erweitert' adds storms, regional weather and pirates to the deck. */
  readonly konjunktur?: KonjunkturMode
  /**
   * Whether the table takes latecomers.
   *
   * Belongs to the Partie, not to the wire: a local table cannot be joined
   * over a socket, but the rule is the same rule, and the state should not
   * claim otherwise.
   */
  readonly joinPolicy?: JoinPolicy
}

export interface LogLine {
  readonly id: number
  readonly text: string
  readonly tone: 'neutral' | 'gut' | 'schlecht' | 'wichtig'
  /**
   * Which sort of thing happened, straight from the event that made the line.
   *
   * `who` answers "whose news is this", which is the wrong axis for the wire:
   * a telegram belongs to nobody's column on purpose, so that narrowing the
   * paper to one house does not lose it. Reading only the telegrams is a
   * different question, and this is what answers it.
   */
  readonly kind: GameEvent['type']
  /**
   * The house whose order produced this entry, if it was anybody's doing.
   *
   * Not the same question as `who`, which asks whom the news is about. A
   * storm names the house it caught and a Hafengebühr names the house it
   * charged; both are very much news to that house. What is never news to you
   * is the thing you just did — so the unread count skips whatever your own
   * orders wrote, and a telegram, which belongs to nobody's column on purpose,
   * still remembers who sent it and gets his colour in the paper.
   *
   * Empty on everything the world did by itself: a tick names nobody, which is
   * what keeps arrivals, weather and the Börse counting for everyone.
   */
  readonly cause?: string
  /**
   * The houses this entry concerns. Empty means the world at large — a round
   * opening, a storm, the close of the season — which is what lets the
   * journal be filtered to one house without losing the scaffolding that
   * holds it together.
   *
   * A collision names two: it happened to both of them.
   */
  readonly who: readonly string[]
  /**
   * When it happened, by the game's own clock rather than the reader's.
   *
   * Taken from `state.now`, so a journal rebuilt by folding the action log
   * carries the times the events actually happened at, not the time somebody
   * reopened the app. Meaningless in round play, where the clock never runs
   * and the round track does the dividing instead.
   */
  readonly at: number
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
  /**
   * The highest log id the player has actually looked at. Everything above it
   * is unread, which is what puts the number on the Nachrichten pill — the
   * journal was previously buried two taps deep and simply never read.
   */
  newsSeen: number
  /**
   * Which panel of the harbour round another seat is looking at, so watchers
   * can follow the player whose turn it is. Presence only — it never enters
   * the action log, because it is not part of the game.
   */
  focus: { readonly playerId: string; readonly step: string } | null
  /** Events from the most recent action, for animations and flashes. */
  lastEvents: readonly GameEvent[]
  /**
   * What the app has to say to the player right now.
   *
   * Held as a key and its variables rather than as a sentence, because the
   * one that matters most — a refusal — may have been composed by the server
   * or by another device, and because a notice standing on screen when the
   * language is changed should change with it.
   */
  notice: Message | null
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
  /**
   * Walk back into the table this device was last sitting at, if any.
   *
   * Called once at start-up, before the first render, so a reload or a
   * reopened app goes straight back aboard rather than to the title page.
   *
   * `invitation` is the table named in the address bar, if one is. A table
   * this device holds no seat at outranks everything — that is a link from
   * somebody else, and the join screen is where it belongs. A table it *does*
   * hold a seat at is not an invitation at all but the way back in, which is
   * what an arrival notification taps.
   */
  restore: (invitation?: string | null) => boolean
  /**
   * Put the game down and go back to the title page, keeping the seat.
   *
   * Distinct from `abandon`, which gives the seat up and deletes the save.
   * Leaving is reversible; abandoning is not, and the two must not wear the
   * same button.
   */
  leave: () => void
  abandon: () => void
  dismissNotice: () => void
  /** Called when the Nachrichten sheet is opened: everything is now read. */
  markNewsRead: () => void
  /** Tell the other seats which harbour panel we are on. No-op offline. */
  announceFocus: (step: string) => void
  setActing: (playerId: string) => void
  /** True when this device may act right now. */
  myTurn: () => boolean
  /** The player this device is currently acting for, if any. */
  acting: () => GameState['players'][number] | null
}

/**
 * The plan currently in play.
 *
 * Reassigned whenever a game is begun, resumed or joined, because which map
 * is in use is a property of the game and not of the app. The store mirrors
 * it so components re-render; this binding exists so the many small helpers
 * below do not each have to reach into the store for it.
 */
let ctx: EngineContext = contextFor(DEFAULT_PACK_ID)

/** Switch to the plan a game is played on, and report it for the store. */
function usePack(packId: string | undefined): EngineContext {
  ctx = contextFor(packId)
  return ctx
}

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

/**
 * Sums as the paper sets them, in whichever language it is being read.
 *
 * The journal is composed as events arrive rather than as it is rendered, so
 * it asks the locale store for the current language rather than taking one as
 * an argument. Changing language re-folds the whole journal — see
 * `setLocale` — which is what keeps a game's back pages from being a mixture.
 */
const money = (n: number) => moneyIn(currentLocale(), n)

/**
 * Was auch dann noch eine Nachricht ist, wenn alle zugesehen haben.
 *
 * An einem Gerät sitzt der ganze Tisch am selben Bildschirm: daß Sepp Kaffee
 * gekauft hat, hat jeder gesehen, während es geschah, und es dann noch als
 * ungelesene Nachricht zu melden, macht aus der Zeitung ein Protokoll. Was
 * bleibt, ist alles, was einem Haus zustößt statt von ihm auszugehen — eine
 * Rechnung, eine Anweisung, ein Sturm, ein gesperrter Hafen, die Börse.
 */
const NOTEWORTHY: ReadonlySet<GameEvent['type']> = new Set([
  'paid',
  'received',
  'levySkipped',
  'cargoLost',
  'cargoDamaged',
  'heldUp',
  'collision',
  'marketTurned',
  'portClosed',
  'portReopened',
  'weatherSet',
  'playerJoined',
  'telegramm',
  'gameOver',
])

export function isNoteworthy(kind: GameEvent['type']): boolean {
  return NOTEWORTHY.has(kind)
}

/**
 * Whose order this was.
 *
 * Real-time actions name their actor; in round play nobody has to, because
 * the turn says who it was. A tick is the world's own doing, and joining or
 * opening a table is news to everybody including the man who did it.
 */
function actorOf(state: GameState, action: GameAction): string | undefined {
  // Wer beitritt, nennt sich selbst — an der Reihe ist er dabei nicht.
  if (action.type === 'join') return action.playerId
  if (action.type === 'tick' || action.type === 'start') return undefined
  const by = 'by' in action ? action.by : undefined
  return by ?? activePlayer(state)?.id
}

function describe(
  ctx: EngineContext,
  state: GameState,
  event: GameEvent,
  cause?: string,
): LogLine | null {
  const locale = currentLocale()
  const say = (key: MsgKey, vars?: Vars) => t(locale, key, vars)
  const nameOf = (id: string) => state.players.find((p) => p.id === id)?.name ?? id
  const goodOf = (id: number) => {
    const good = ctx.goodsById.get(id)
    return good ? named(good)[locale] : say('log.unknownGood', { id })
  }
  const portOf = (id: string) => {
    const port = ctx.portsById.get(id)
    return port ? named(port)[locale] : id
  }
  // Almost every entry belongs to whoever the event names; the handful that
  // belong to nobody say so with an empty list.
  const line = (
    text: string,
    tone: LogLine['tone'] = 'neutral',
    who: readonly string[] = 'playerId' in event ? [event.playerId] : [],
  ): LogLine => ({
    id: ++logId,
    text,
    tone,
    who,
    kind: event.type,
    ...(cause ? { cause } : {}),
    at: state.now,
  })

  switch (event.type) {
    /*
     * Ein Haus, das mitten in der Fahrt an den Tisch kommt, ist eine Nachricht
     * für alle, die schon fahren: ein Mitbieter mehr in jedem Hafen, und einer,
     * der mit vollem Kapital anfängt. Vor dem Ablegen bleibt die Zeile aus —
     * dort steht die Liste am Kai ohnehin auf dem Bildschirm, und die Zeitung
     * würde mit der Anwesenheitsliste anfangen.
     *
     * Der Name ist ausgezeichnet, damit ihn das Blatt in der Farbe des Hauses
     * setzen kann; er gehört in niemandes Spalte, weil er alle angeht.
     */
    case 'playerJoined':
      return event.midGame
        ? line(say('log.playerJoined', { name: event.name, port: portOf(event.portId) }), 'wichtig', [])
        : null
    case 'rolled':
      return line(say('log.rolled', { name: nameOf(event.playerId), value: event.value }))
    case 'arrived':
      return line(
        say('log.arrived', { name: nameOf(event.playerId), port: portOf(event.portId) }),
        'wichtig',
      )
    case 'setSail':
      return line(
        say('log.setSail', { name: nameOf(event.playerId), port: portOf(event.to) }),
        'wichtig',
      )
    case 'stoppedAtSea':
      return line(say('log.stoppedAtSea', { name: nameOf(event.playerId) }))
    case 'collision':
      return line(
        say('log.collision', {
          name: nameOf(event.playerId),
          victim: nameOf(event.victimId),
          amount: money(event.damages),
        }),
        'schlecht',
        [event.playerId, event.victimId],
      )
    case 'bought':
      return line(
        say('log.bought', {
          name: nameOf(event.playerId),
          good: goodOf(event.goodId),
          price: money(event.price),
        }),
      )
    case 'sold': {
      const label =
        event.kind === 'ueberfluss'
          ? say('log.sold.ueberfluss')
          : event.kind === 'notverkauf'
            ? say('log.sold.notverkauf')
            : event.kind === 'schluss'
              ? say('log.sold.schluss')
              : ''
      return line(
        say('log.sold', {
          name: nameOf(event.playerId),
          good: goodOf(event.goodId),
          price: money(event.price),
          label,
          result: say(event.profit >= 0 ? 'log.profit' : 'log.loss'),
          amount: money(Math.abs(event.profit)),
        }),
        event.profit >= 0 ? 'gut' : 'schlecht',
      )
    }
    case 'cardDrawn': {
      const card = ctx.cardsById.get(event.cardId)
      return line(
        say('log.cardDrawn', {
          name: nameOf(event.playerId),
          title: card?.title ?? '',
          lines: card?.lines[locale].join(', ') ?? '',
        }),
        'wichtig',
      )
    }
    case 'paid':
      return line(
        say('log.paid', {
          name: nameOf(event.playerId),
          amount: money(event.amount),
          reason: say(`log.paid.${event.reason}`),
        }),
        'schlecht',
      )
    case 'received':
      return line(
        say('log.received', {
          name: nameOf(event.playerId),
          amount: money(event.amount),
          reason: say(
            event.reason === 'telegramm' ? 'log.received.telegramm' : 'log.received.schaden',
          ),
        }),
        'gut',
      )
    case 'cargoLost':
      return line(
        say('log.cargoLost', {
          name: nameOf(event.playerId),
          good: goodOf(event.goodId),
          value: money(event.value),
          reason: event.reason,
        }),
        'schlecht',
      )
    case 'cargoDamaged':
      return line(
        say('log.cargoDamaged', {
          name: nameOf(event.playerId),
          good: goodOf(event.goodId),
          reason: event.reason,
        }),
        'schlecht',
      )
    case 'heldUp':
      return line(
        say('log.heldUp', {
          name: nameOf(event.playerId),
          reason: event.reason,
          cost:
            state.config.travel === 'echtzeit'
              ? say('log.heldUp.minutes', { minutes: event.minutes })
              : say('log.heldUp.round'),
        }),
        'schlecht',
      )
    // Weltnachrichten: sie gehören keinem Haus und bleiben deshalb auch
    // stehen, wenn das Blatt auf ein einzelnes gefiltert wird — sonst
    // verlöre der Verlauf die Rundenüberschriften, die ihn gliedern.
    case 'portClosed':
      return line(
        say('log.portClosed', { title: event.title, port: portOf(event.portId) }),
        'wichtig',
        [],
      )
    case 'portReopened':
      return line(say('log.portReopened', { port: portOf(event.portId) }), 'gut', [])
    case 'weatherSet':
      // "dort" only makes sense of a notice that names a place. A Warenbericht
      // names a ware and holds in every harbour there is.
      return line(
        say('log.weatherSet', {
          title: event.title,
          where: say(event.continent ? 'log.weatherSet.there' : 'log.weatherSet.forThat'),
          sign: event.percent > 0 ? '+' : '−',
          percent: Math.abs(event.percent),
        }),
        'wichtig',
        [],
      )
    // A telegram belongs to nobody's column: it was sent to the whole table,
    // so filtering the paper down to one house must not lose it.
    // Nur die Nachricht selbst. Wer sie aufgegeben hat, steht in `cause`, und
    // das Blatt setzt den Namen in der Farbe seines Hauses davor.
    case 'telegramm':
      return line(event.text, 'wichtig', [])
    // A market that says nothing is not news. The strip already reads ±0 %
    // and the Saison sheet says it in full; a line in the paper for every
    // quiet turn buried the turns where something actually happened.
    case 'marketCalm':
      return null
    case 'roundStarted':
      return line(
        say(event.red ? 'log.roundStarted.red' : 'log.roundStarted', { round: event.round }),
        event.red ? 'wichtig' : 'neutral',
        [],
      )
    case 'gameOver':
      return line(say('log.gameOver'), 'wichtig', [])
    default:
      return null
  }
}

/**
 * How many entries the Börsenblatt keeps. A fifty-round game with six houses
 * runs to a few hundred, so this holds a whole one.
 */
const MAX_LOG = 500

/**
 * Fold an action log into a state *and* the journal that goes with it.
 *
 * The journal used to be written only by `onAppend` — that is, only for
 * things that happened while this device was watching. Everything that
 * rebuilds a game from its log (resuming a save, joining a table, and now
 * walking back into the last one at start-up) called `replay`, which throws
 * the events away, so the Nachrichten sheet opened empty on a game fifty
 * rounds old and filled up again from whatever happened next.
 *
 * The events were there all along; nobody was catching them.
 */
/**
 * The last fold, kept so the journal can be written out again.
 *
 * Lines are composed as events arrive rather than as they are rendered — the
 * paper is a list of finished sentences, which is what lets it be filtered
 * and searched cheaply. That makes changing language a problem: half a
 * season's back pages would stay in the one it was written in. Keeping what
 * the journal was folded from means the whole thing can simply be written
 * again.
 */
let folded: { initial: GameState; actions: GameAction[] } | null = null

function foldWithLog(
  ctx: EngineContext,
  initial: GameState,
  actions: readonly GameAction[],
): { state: GameState; log: LogLine[] } {
  folded = { initial, actions: [...actions] }
  let state = initial
  // Claimed before anything else, so the opening entry takes the lowest id:
  // the journal is read newest-first and `markNewsRead` uses the head's id as
  // the high-water mark, so an entry sitting at the bottom of the list with
  // the highest number would count as unread for ever.
  const openingId = ++logId
  const lines: LogLine[] = []
  for (const action of actions) {
    const cause = actorOf(state, action)
    const result = applyAction(ctx, state, action)
    state = result.state
    for (const event of result.events) {
      const line = describe(ctx, state, event, cause)
      if (line) lines.push(line)
    }
  }
  // The store keeps the journal newest first; a fold produces it oldest first.
  const log = lines.reverse().slice(0, MAX_LOG)
  // The clock has not been set at `initial` — in a real-time game the first
  // action in the log is the tick that starts it — so the opening entry
  // borrows the time of the first thing that happened after it.
  log.push({
    ...openingLine(state.config.startingCapital, log.at(-1)?.at ?? state.now),
    id: openingId,
  })
  return { state, log }
}

/** The line every game opens with, written where the oldest entries go. */
function openingLine(startingCapital: number, at: number): LogLine {
  return {
    id: ++logId,
    text: t(currentLocale(), 'log.opening', {
      amount: formatNumber(currentLocale(), startingCapital),
    }),
    tone: 'wichtig',
    who: [],
    // Kein Ereignis stand dahinter — die Bank hat schlicht gebucht.
    kind: 'gameStarted',
    at,
  }
}

let session: Session | null = null
let ticker: ReturnType<typeof setInterval> | null = null

/**
 * A table with nobody at it — what both ways out of a game reset to.
 *
 * `focus` belongs here too: it is another seat's whereabouts, and leaving it
 * behind meant the next game opened following a player who was no longer at
 * the table.
 */
const EMPTY: Pick<
  Store,
  'state' | 'truth' | 'log' | 'newsSeen' | 'focus' | 'lastEvents' | 'notice' | 'net' | 'localActing'
> = {
  state: null,
  truth: null,
  log: [],
  newsSeen: 0,
  focus: null,
  lastEvents: [],
  notice: null,
  net: null,
  localActing: null,
}

export const useGame = create<Store>((set, get) => ({
  ctx,
  state: null,
  truth: null,
  log: [],
  newsSeen: 0,
  focus: null,
  lastEvents: [],
  notice: null,
  net: null,
  localActing: null,

  begin(seats, options = {}) {
    const active = usePack(options.packId)
    const names = seats.map((s) => (typeof s === 'string' ? s : s.name))
    const totalRounds = options.totalRounds ?? 30
    const startingCapital = options.startingCapital ?? ctx.pack.config.startingCapital
    const realSeed = options.seed ?? `${Date.now().toString(36)}-${names.join('|')}`
    saved = {
      names,
      seed: realSeed,
      totalRounds,
      startingCapital,
      packId: active.pack.id,
      actions: [],
    }
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
        // Auch am eigenen Gerät festgehalten: die Wahl gehört zur Partie,
        // nicht zur Leitung, und der Zustand soll nicht anderes behaupten
        // als die Anmeldung.
        ...(options.joinPolicy ? { joinPolicy: options.joinPolicy } : {}),
        ...(options.minutesPerPip ? { minutesPerPip: options.minutesPerPip } : {}),
        ...(options.durationHours ? { durationHours: options.durationHours } : {}),
        ...(options.maxFleetSize ? { maxFleetSize: options.maxFleetSize } : {}),
        ...(options.angebot ? { angebot: options.angebot } : {}),
        ...(options.preise ? { preise: options.preise } : {}),
        ...(options.konjunktur ? { konjunktur: options.konjunktur } : {}),
      }),
      opening,
    )
    saved.actions.push(...opening)
    saved.travel = travel
    if (options.minutesPerPip) saved.minutesPerPip = options.minutesPerPip
    if (options.durationHours) saved.durationHours = options.durationHours
    if (options.sicht) saved.sicht = options.sicht
    if (options.maxFleetSize) saved.maxFleetSize = options.maxFleetSize
    // Without these in the save file a resumed game would deal itself fresh
    // trade routes and disagree with the log it is replaying.
    if (options.angebot) saved.angebot = options.angebot
    if (options.preise) saved.preise = options.preise
    if (options.konjunktur) saved.konjunktur = options.konjunktur
    persist()
    const firstActing = state.players[0]?.id ?? null
    session?.close()
    session = null
    // A game at this device replaces whatever online table was remembered,
    // or the next reload would sail off to the old one instead.
    forgetTable()
    set({
      ctx,
      state: projectFor(state, firstActing),
      truth: state,
      net: null,
      localActing: firstActing,
      log: [openingLine(startingCapital, state.now)],
      newsSeen: 0,
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
      angebot: options.angebot ?? 'fest',
      preise: options.preise ?? 'fest',
      packId: options.packId ?? DEFAULT_PACK_ID,
    })
    get().join(code, who.name, who.gender)
    return code
  },

  join(code, name, gender) {
    session?.close()
    // A networked game is never saved locally; the server holds the log.
    saved = null
    // Written down before the socket is even open: the point is to come back
    // here next time the app is opened, and a table you failed to connect to
    // is exactly the one worth retrying.
    rememberTable({ code, name, ...(gender ? { gender } : {}) })
    set({ state: null, log: [], newsSeen: 0, lastEvents: [], notice: null, net: { code, status: 'verbindet', playerId: null, online: [] } })

    session = new Session(code, name, gender, {
      onStatus: (status) =>
        set((s) => ({ net: s.net ? { ...s.net, status } : s.net })),

      onWelcome: (playerId, meta, actions) => {
        // The host chose the plan; we replay against that one or drift.
        usePack(meta.packId)
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
          ...(meta.angebot ? { angebot: meta.angebot } : {}),
          ...(meta.preise ? { preise: meta.preise } : {}),
        })
        // Under fog the log is withheld — you know only what you witnessed,
        // which is the point — and a finished view arrives separately.
        const rebuilt = meta.sicht === 'realistisch' ? null : foldWithLog(ctx, initial, actions)
        set((s) => ({
          ctx,
          ...(rebuilt
            ? {
                state: rebuilt.state,
                truth: null,
                log: rebuilt.log,
                newsSeen: rebuilt.log[0]?.id ?? 0,
              }
            : {}),
          net: s.net ? { ...s.net, playerId } : s.net,
          notice: null,
        }))

        /*
         * Now that there is a seat, leave an address the Partieserver can
         * reach when this app is not running. Every reconnect, because a
         * browser may rotate the subscription and the server's copy has to
         * follow. Fire and forget: it fails quietly where the browser cannot
         * do it, or where notices were never allowed.
         */
        void armPush(code)
      },

      onView: (view) => {
        set({ state: view, truth: null })
      },

      onAppend: (actions) => {
        const current = get().state
        if (!current) return
        folded?.actions.push(...actions)
        let next = current
        const fresh: LogLine[] = []
        for (const action of actions) {
          const cause = actorOf(next, action)
          const result = applyAction(ctx, next, action)
          next = result.state
          for (const event of result.events) {
            const line = describe(ctx, next, event, cause)
            if (line) fresh.push(line)
          }
        }
        set((s) => ({
          state: next,
          lastEvents: [],
          log: [...fresh.reverse(), ...s.log].slice(0, MAX_LOG),
        }))
      },

      onPresence: (online) => set((s) => ({ net: s.net ? { ...s.net, online } : s.net })),
      onFocus: (playerId, step) => set({ focus: { playerId, step } }),
      onError: (reason: Message) => {
        // A refusal that arrives before any state is a refusal to seat us at
        // all — a table closed to latecomers, most often. Retrying will not
        // help, and the code was written down before the socket was even
        // open, so leaving it there would walk the app back into the same
        // dead end every time it starts. Forget the table; keep the reason.
        if (!get().state) forgetTable()
        set({ notice: reason })
      },
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

    // A telegram names its sender in both modes. It waits for no turn, so
    // there is no turn to read the sender off — and in round play the actor
    // would otherwise come out as whoever happens to be at the wheel.
    if (action.type === 'telegramm' && !action.by) {
      const me = get().acting()
      if (!me) {
        set({ notice: msg('ui.watchingOnly') })
        return
      }
      action = { ...action, by: me.id }
    }

    if (state.config.travel === 'echtzeit' && namesAnActor(action) && !action.by) {
      const me = get().acting()
      if (!me) {
        // No seat at this table. Dropping the order in silence is the worst
        // answer: the player cannot tell a refusal from a broken button.
        set({ notice: msg('ui.watchingOnly') })
        return
      }
      action = { ...action, by: me.id }
    }

    if (net) {
      // The server is the referee. We apply nothing until it echoes back,
      // so two devices can never disagree about what happened.
      if (!session?.send(action)) {
        set({ notice: msg('ui.noConnection') })
      }
      return
    }

    // Local play reduces against the truth, never against the projection.
    const cause = actorOf(truth ?? state, action)
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
    folded?.actions.push(action)

    const fresh = result.events
      .map((e) => describe(ctx, result.state, e, cause))
      .filter((l): l is LogLine => l !== null)

    set((s) => ({
      state: projectFor(result.state, s.localActing),
      truth: result.state,
      lastEvents: result.events,
      log: [...fresh.reverse(), ...s.log].slice(0, MAX_LOG),
      notice: null,
    }))
  },

  resume() {
    try {
      const raw = localStorage.getItem(SAVE_KEY)
      if (!raw) return false
      const file = JSON.parse(raw) as SaveFile
      if (!Array.isArray(file.names) || file.names.length === 0) return false
      // The plan has to be restored before the log is folded, or the replay
      // would run against a different map than the one it was recorded on.
      usePack(file.packId)
      const initial = createGame(ctx, {
        seed: file.seed,
        totalRounds: file.totalRounds,
        ...(file.startingCapital ? { startingCapital: file.startingCapital } : {}),
        ...(file.travel ? { travel: file.travel } : {}),
        ...(file.minutesPerPip ? { minutesPerPip: file.minutesPerPip } : {}),
        ...(file.durationHours ? { durationHours: file.durationHours } : {}),
        ...(file.sicht ? { sicht: file.sicht } : {}),
        ...(file.maxFleetSize ? { maxFleetSize: file.maxFleetSize } : {}),
        ...(file.angebot ? { angebot: file.angebot } : {}),
        ...(file.preise ? { preise: file.preise } : {}),
        ...(file.konjunktur ? { konjunktur: file.konjunktur } : {}),
      })
      const { state, log } = foldWithLog(ctx, initial, file.actions ?? [])
      saved = file
      set({
        ctx,
        state: projectFor(state, state.players[0]?.id ?? null),
        truth: state,
        log,
        // Everything in a rebuilt journal has already been lived through, so
        // it opens read. The alternative is a badge reading "247 neu" every
        // time the app is opened, which teaches the player to ignore it.
        newsSeen: log[0]?.id ?? 0,
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

  restore(invitation) {
    const table = rememberedTable()
    if (invitation && !hasSeatAt(invitation)) return false
    /*
     * The notification came from a table we hold a seat at, and the token is
     * proof of who we are there — asking for a name would be asking what we
     * already know. Nearly always it is the remembered table anyway; the two
     * part company only for a table left behind whose ship is still at sea,
     * and the tap says plainly which of them the player wants.
     */
    const code = invitation ?? table?.code
    if (!code) return false
    get().join(code, table?.name ?? '', table?.gender)
    return true
  },

  leave() {
    session?.close()
    session = null
    if (ticker) clearInterval(ticker)
    ticker = null
    // The seat token stays, and so does the local save file: this is putting
    // the game down, not walking away from it. `saved` is dropped only from
    // memory, so the next `resume()` reads it back off the disc.
    saved = null
    forgetTable()
    set(EMPTY)
  },

  abandon() {
    session?.close()
    session = null
    if (ticker) clearInterval(ticker)
    ticker = null
    saved = null
    const code = get().net?.code
    if (code) forgetSeat(code)
    forgetTable()
    try {
      localStorage.removeItem(SAVE_KEY)
    } catch {
      /* nothing to clean up */
    }
    set(EMPTY)
  },

  dismissNotice() {
    set({ notice: null })
  },

  markNewsRead() {
    // The log is newest-first, so its head is the high-water mark.
    set((s) => ({ newsSeen: s.log[0]?.id ?? s.newsSeen }))
  },

  announceFocus(step) {
    session?.sendFocus(step)
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

/**
 * The seals a house may wear, one per seat.
 *
 * The first six are the printed game's own pieces and stay where they are:
 * `colorIndex` is handed out in join order and saved in the log, so moving
 * one would repaint every game already in progress.
 *
 * The next four are for tables the box never anticipated. They are picked for
 * the widest hue gaps left over — teal between blue and green, carmine
 * between violet and red, olive between ochre and green, slate against black
 * — and every one of them is dark enough for white lettering, because the
 * chips and the helm switcher print names on top of them.
 *
 * Ten inks on one sepia chart is more than any palette reads cleanly at a
 * glance, which is why the colour is never the only cue: a name or a portrait
 * stands beside it everywhere it appears.
 */
export const PLAYER_COLORS = [
  { ink: '#1f4f8f', name: { de: 'Blau', en: 'Blue' } },
  { ink: '#b03027', name: { de: 'Rot', en: 'Red' } },
  { ink: '#2e6b3f', name: { de: 'Grün', en: 'Green' } },
  { ink: '#8a6a1f', name: { de: 'Ocker', en: 'Ochre' } },
  { ink: '#5a3570', name: { de: 'Violett', en: 'Violet' } },
  { ink: '#1b1b1b', name: { de: 'Schwarz', en: 'Black' } },
  { ink: '#0e6d72', name: { de: 'Türkis', en: 'Turquoise' } },
  { ink: '#a52a5f', name: { de: 'Karmin', en: 'Carmine' } },
  { ink: '#5f6a1e', name: { de: 'Oliv', en: 'Olive' } },
  { ink: '#55606a', name: { de: 'Schiefer', en: 'Slate' } },
] as const

/**
 * How a seat is named where the player's own name is not the point.
 *
 * `colorIndex` is handed out in join order and never moves, so the number
 * always matches the colour beside it.
 */
export function playerLabel(player: PlayerState): string {
  return t(currentLocale(), 'ui.seatNumber', { n: player.colorIndex + 1 })
}

export const formatMoney = money

/**
 * Write the journal out again when the language changes.
 *
 * The paper holds finished sentences, not events — that is what makes it
 * cheap to filter and search — so a season played in German and then read in
 * English would otherwise be a mixture, with the oldest entries in the
 * language they happened in. Re-folding is not free, but changing language is
 * something a person does once.
 *
 * Subscribed from here rather than done inside `setLocale` so the dependency
 * runs one way: the game store knows about the language, and the language
 * store knows nothing about games.
 */
useLocaleStore.subscribe((now, before) => {
  if (now.locale === before.locale) return
  if (!folded) return
  const { log } = foldWithLog(ctx, folded.initial, folded.actions)
  // The high-water mark moves with it: the same entries are the same entries,
  // and re-reading them all because the language changed would be a lie.
  const seen = useGame.getState().newsSeen > 0 ? log[0]?.id ?? 0 : 0
  useGame.setState({ log, newsSeen: seen })
})
