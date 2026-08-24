import { useEffect, useMemo, useRef, useState } from 'react'
import { Board } from './Board'
import { PortSheet, MarketReport, PortPreviewSheet } from './PortPanel'
import { KonjunkturSlip } from './Cards'
import { Portrait } from './Portrait'
import { PlayerHUD, useCountUp } from './PlayerHUD'
import { Die } from './Dice'
import { CargoHold } from './Cargo'
import { Sheet, Tabs, type SheetSnap } from './Sheet'
import { SettingsSheet } from './Settings'
import { FleetSheet } from './FleetSheet'
import { PigeonSheet } from './PigeonSheet'
import { formatMoney, PLAYER_COLORS, playerLabel, useGame, type LogLine } from '@app/store'
import { arrivalAt, legalSteps, marketReport, portAt, standings } from '@engine/selectors'
import { konjunkturOutcome, type HarbourStep } from '@engine/advice'
import { Emph } from './Emph'
import type { GameEvent } from '@engine/actions'
import {
  cargoValue,
  flagship,
  netWorth,
  type GameState,
  type PlayerState,
} from '@engine/state'
import type { EngineContext } from '@engine/context'
import { clockText, durationText, untilText, useNow } from './useNow'
import { useArrivalNotice } from './useArrivalNotice'
import { PLAYER_COLORS as COLORS } from '@app/store'

type SheetKind =
  | 'port'
  | 'kontor'
  | 'runde'
  | 'konjunktur'
  | 'ende'
  | 'flotte'
  | 'taube'
  | 'nachrichten'
  | 'vorschau'
  | 'einstellungen'
  | null

export function GameScreen() {
  const ctx = useGame((s) => s.ctx)
  const state = useGame((s) => s.state)!
  const dispatch = useGame((s) => s.dispatch)
  const notice = useGame((s) => s.notice)
  const dismiss = useGame((s) => s.dismissNotice)
  const log = useGame((s) => s.log)
  const lastEvents = useGame((s) => s.lastEvents)
  const newsSeen = useGame((s) => s.newsSeen)
  const markNewsRead = useGame((s) => s.markNewsRead)
  const abandon = useGame((s) => s.abandon)
  const leave = useGame((s) => s.leave)

  const acting = useGame((s) => s.acting())
  const setActing = useGame((s) => s.setActing)
  const net = useGame((s) => s.net)
  const myTurn = useGame((s) => s.myTurn())
  const focus = useGame((s) => s.focus)
  const announceFocus = useGame((s) => s.announceFocus)

  const realtime = state.config.travel === 'echtzeit'
  const now = useNow(1000, realtime)

  // Round play follows the turn; real-time play follows whoever this device
  // is commanding.
  /**
   * Whether this device has a seat at all.
   *
   * A watcher who joined a table that had already sailed gets no playerId,
   * and the screen used to fall through to `players[0]` — handing them the
   * first player's ship, name, cash and harbour as though it were their own,
   * while every tap vanished. Better to say so.
   */
  const seated = !net || net.playerId !== null
  const player = (realtime ? acting : state.players[state.activeIndex]) ?? state.players[0]!
  const voyage = flagship(player).voyage ?? null
  const portId = voyage ? null : portAt(ctx, flagship(player).nodeId)
  const targets = state.phase === 'move' ? legalSteps(ctx, player) : []

  const [kind, setKind] = useState<SheetKind>(null)
  const [snap, setSnap] = useState<SheetSnap>('peek')
  const [pigeonFor, setPigeonFor] = useState<string | null>(null)
  const [greeting, setGreeting] = useState(true)
  const [marked, setMarked] = useState<{ portId: string; nonce: number } | null>(null)
  /** A harbour being looked at from the sea, before deciding to sail there. */
  const [preview, setPreview] = useState<string | null>(null)

  /**
   * A new harbour under the keel, or the wheel in somebody else's hands: the
   * Makler comes aboard before the ledgers do. Kept out here rather than in
   * the sheet so that closing and reopening it mid-visit does not repeat the
   * welcome.
   */
  useEffect(() => {
    setGreeting(portId !== null)
    setMarked(null)
  }, [portId, player.id])

  // The harbour opens itself; everything else waits to be asked for.
  useEffect(() => {
    if (!seated) return
    if (realtime) {
      // The plan stays uncovered unless something is asked for; arriving in
      // harbour offers a button rather than taking over the screen.
      if (state.phase === 'over') {
        setKind('ende')
        setSnap('full')
      } else if (!portId) {
        setKind((k) => (k === 'port' ? null : k))
      }
      return
    }
    if (state.phase === 'port') {
      setKind('port')
      setSnap('full')
    } else if (state.phase === 'konjunktur') {
      setKind('konjunktur')
      setSnap('peek')
    } else if (state.phase === 'over') {
      setKind('ende')
      setSnap('full')
    } else {
      setKind(null)
    }
  }, [state.phase, state.activeIndex, realtime, portId, seated])

  useEffect(() => {
    if (!notice) return
    const t = setTimeout(dismiss, 4200)
    return () => clearTimeout(t)
  }, [notice, dismiss])

  const unread = useMemo(() => log.filter((l) => l.id > newsSeen).length, [log, newsSeen])

  /**
   * Where the unread mark sat when the sheet was opened. Opening marks
   * everything read, so without this the "neu" rules would vanish in the same
   * frame the player went to look at them.
   */
  const [newsMark, setNewsMark] = useState(0)

  const open = (k: SheetKind) => {
    setKind(k)
    // Buying and selling wants the whole sheet; the news wants room to read.
    setSnap(k === 'port' || k === 'nachrichten' ? 'full' : 'peek')
    if (k === 'nachrichten') {
      setNewsMark(newsSeen)
      markNewsRead()
    }
  }
  const close = (s: SheetSnap) => {
    if (s === 'closed') setKind(null)
    else setSnap(s)
  }

  const highlights = useMemo(
    () => marketReport(ctx, state, player, 5).map((d) => d.portId),
    [ctx, player],
  )

  // Who is winning, recomputed wherever it is shown so the HUD badge and the
  // Kontor table can never disagree.
  const table = useMemo(() => standings(state), [state])

  // Recentre the plan whenever the turn passes or another ship takes the helm,
  // so nobody has to go looking for their own vessel.
  const focusKey = realtime
    ? `${player.id}:${portId ?? 'see'}`
    : `${state.round}:${state.activeIndex}`
  const focusNonce = useFocusNonce(focusKey)

  const waitingMail = portId ? (player.knowledge.waiting[flagship(player).nodeId] ?? []).length : 0

  // A voyage takes real hours and the point of that is being able to put the
  // phone down, so the ship says when it has made port.
  useArrivalNotice(ctx, state, player, realtime)

  return (
    <div className="relative h-full w-full overflow-hidden">
      <Board
        ctx={ctx}
        state={state}
        legalTargets={targets}
        onPick={(to) => dispatch({ type: 'step', to })}
        focusNode={flagship(player).nodeId}
        // Die grünen Ringe sind Vorschläge, wohin sich die Ladung tragen
        // ließe. Sobald der Kurs steht, sind sie ein überholter Rat, der mit
        // der eingezeichneten Fahrt um dieselbe Karte streitet — und beim
        // Würfeln zählen nur die erreichbaren Felder.
        highlightPorts={state.phase === 'move' || voyage ? [] : highlights}
        now={now}
        focusNonce={focusNonce}
        coursePlayerId={player.id}
        markedPort={marked?.portId ?? null}
        markNonce={marked?.nonce ?? 0}
        {...(realtime
          ? {
              // A tap opens the harbour rather than committing to it. A long
              // voyage bought with one careless thumb was the old behaviour.
              onPickPort: (to: string) => {
                setPreview(to)
                setMarked((m) => ({ portId: to, nonce: (m?.nonce ?? 0) + 1 }))
                setKind('vorschau')
                setSnap('peek')
              },
            }
          : {})}
      />

      {/* Kopfzeile: das Handelshaus links, die Leiste rechts.
          Sie *soll* umbrechen, wenn der Platz nicht reicht — bisher stand das
          nur als Absicht hier, ohne flex-wrap, und die Leiste (shrink-0) hat
          das Handelshaus stattdessen zusammengedrückt, bis vom Namen zwei
          Buchstaben übrig waren. Jetzt rutscht die Leiste auf eine eigene
          Zeile, sobald es eng wird, und ml-auto hält sie dabei rechts. */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-wrap items-start gap-2 px-3"
        style={{ paddingTop: 'calc(var(--safe-t) + 0.6rem)' }}
      >
        {!seated ? (
          <div className="paper anim-rise pointer-events-auto rounded-lg px-3 py-2 shadow-lg">
            <p className="smallcaps text-[11px] tracking-[0.2em]">Zuschauer</p>
            <p className="text-ink-soft text-[12px] leading-snug">
              Sie haben keinen Platz an diesem Tisch und sehen nur zu.
            </p>
          </div>
        ) : (
        <PlayerHUD
          ctx={ctx}
          player={player}
          cargoCount={flagship(player).cargo.length}
          purchasesLeft={
            state.phase === 'port'
              ? state.config.maxPurchasesPerPort - flagship(player).purchasesThisVisit.length
              : null
          }
          rank={table.find((r) => r.player.id === player.id)?.rank ?? null}
          onOpen={() => open('kontor')}
        />
        )}

        {/* Eine Leiste statt vier Merkzettel: ein Papier, ein Schatten,
            Haarlinien dazwischen. */}
        <div className="paper anim-rise pointer-events-auto ml-auto flex shrink-0 items-stretch divide-x divide-black/15 overflow-hidden rounded-lg shadow-lg">
          <Cell label={`Nachrichten${unread > 0 ? `, ${unread} ungelesen` : ''}`} onOpen={() => open('nachrichten')}>
            <span className="text-base leading-none" aria-hidden>
              📰
            </span>
            {unread > 0 && (
              <span className="bg-rot tnum rounded-full px-1 text-[9px] leading-[1.4] font-bold text-white">
                {unread > 99 ? '99+' : unread}
              </span>
            )}
          </Cell>

          {/* Nur wenn es etwas zu verwalten gibt: bei einem Schiff, keiner
              Post und geschlossener Werft ist das Register ein Knopf ohne
              Inhalt. Unter Sicht realistisch immer — dort hängen Notizbuch
              und Brieftauben daran, und die sind das halbe Spiel. */}
          {(player.fleet.length > 1 ||
            waitingMail > 0 ||
            state.config.maxFleetSize > 1 ||
            state.config.sicht === 'realistisch') && (
            <Cell
              label={`Flotte: ${player.fleet.length} Schiffe${waitingMail > 0 ? `, ${waitingMail} Briefe` : ''}`}
              onOpen={() => open('flotte')}
            >
              <span className="text-base leading-none" aria-hidden>
                ⚓
              </span>
              <span className="tnum text-base leading-none font-bold">{player.fleet.length}</span>
              {waitingMail > 0 && (
                <span className="bg-rot tnum rounded-full px-1 text-[9px] leading-[1.4] font-bold text-white">
                  {waitingMail}
                </span>
              )}
            </Cell>
          )}

          {realtime ? (
            <ClockCell state={state} now={now} onOpen={() => open('runde')} />
          ) : (
            <RoundCell
              round={state.round}
              total={state.config.totalRounds}
              red={state.config.redFields.includes(state.round)}
              onOpen={() => open('runde')}
            />
          )}

          <Cell label="Einstellungen" onOpen={() => open('einstellungen')}>
            <span className="text-base leading-none" aria-hidden>
              ⚙
            </span>
          </Cell>
        </div>
      </div>

      {/* Fußzeile. Ruder und Handlungsleiste standen vorher als zwei
          absolute Ebenen übereinander, jede mit einem von Hand gewählten
          Abstand vom unteren Rand; hier ist es eine Spalte, die sich selbst
          staffelt und mitwandert, wenn eine der beiden fehlt. */}
      {seated && kind === null && (
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col items-center gap-2 px-4 lg:right-[400px]"
          style={{ paddingBottom: 'calc(var(--safe-b) + 1rem)' }}
        >
          {realtime && !net && state.players.length > 1 && (
            <HelmSwitcher players={state.players} current={player.id} onPick={setActing} />
          )}
          {realtime ? (
            <RealtimeBar
              ctx={ctx}
              state={state}
              player={player}
              now={now}
              onOpenPort={() => open('port')}
            />
          ) : (
            <ActionBar
              state={state}
              onRoll={() => dispatch({ type: 'roll' })}
              onEnd={() => dispatch({ type: 'endTurn' })}
              onOpenPort={() => open('port')}
              onDraw={() => dispatch({ type: 'drawKonjunktur' })}
            />
          )}
        </div>
      )}

      {/* Über allem, auch über einem offenen Blatt — eine Absage, die hinter
          dem Blatt verschwindet, ist keine. */}
      {notice && (
        <div className="pointer-events-none absolute inset-x-0 bottom-32 z-40 flex justify-center px-4">
          <p className="paper-card text-rot anim-rise max-w-md rounded-sm px-3 py-2 text-center text-sm shadow-lg">
            {notice}
          </p>
        </div>
      )}

      {kind === 'port' && portId && (
        <PortSheet
          ctx={ctx}
          state={state}
          player={player}
          portId={portId}
          snap={snap}
          onSnap={close}
          onBuy={(goodId) => dispatch({ type: 'buy', goodId })}
          onSell={(uid) => dispatch({ type: 'sell', uid })}
          onLeave={() => dispatch({ type: 'endTurn' })}
          // Real-time play ends the walk at the chart, not at a gangway.
          onShowMap={realtime ? () => close('closed') : undefined}
          greeting={greeting}
          onEnter={() => setGreeting(false)}
          // Online, a watcher rides along on the active player's panel; the
          // one holding the wheel reports theirs instead. Offline there is
          // only one screen, so neither applies.
          followTab={
            net && !myTurn && focus?.playerId === player.id
              ? (focus.step as HarbourStep)
              : null
          }
          onTabChange={net && myTurn ? (t) => announceFocus(t) : undefined}
          markedPort={marked?.portId ?? null}
          // The same card a tap on the plan opens, reached from the list.
          onOpenPort={
            realtime
              ? (to) => {
                  setPreview(to)
                  setMarked((m) => ({ portId: to, nonce: (m?.nonce ?? 0) + 1 }))
                  setKind('vorschau')
                  setSnap('peek')
                }
              : undefined
          }
          // No die in real-time play: naming the harbour is the whole move.
          onSetCourse={
            realtime && portId
              ? (to) => {
                  if (to !== portId) dispatch({ type: 'setCourse', to })
                }
              : undefined
          }
          onLookAt={(to) => {
            // Get out of the way first, then go and find it: the sheet slides
            // to a peek while the plan glides across, and both settle together.
            setMarked((m) => ({ portId: to, nonce: (m?.nonce ?? 0) + 1 }))
            setSnap('peek')
          }}
        />
      )}

      {kind === 'flotte' && (
        <FleetSheet
          ctx={ctx}
          state={state}
          player={player}
          now={now}
          snap={snap}
          onSnap={close}
          onBoard={(vehicleId) => dispatch({ type: 'boardVehicle', vehicleId })}
          onBuy={(kindId) => dispatch({ type: 'buyVehicle', kindId })}
          onSendPigeon={(vehicleId) => {
            setPigeonFor(vehicleId)
            setKind('taube')
            setSnap('full')
          }}
          onCollectMail={() => dispatch({ type: 'collectMail' })}
          onWriteNote={(text) => dispatch({ type: 'writeNote', text })}
        />
      )}

      {kind === 'taube' && pigeonFor && (
        <PigeonSheet
          ctx={ctx}
          state={state}
          player={player}
          vehicleId={pigeonFor}
          snap={snap}
          onSnap={close}
          onSend={(toPort, destination, replyTo) => {
            dispatch({ type: 'sendPigeon', vehicleId: pigeonFor, toPort, destination, replyTo })
            setPigeonFor(null)
            setKind('flotte')
            setSnap('peek')
          }}
        />
      )}

      {kind === 'kontor' && (
        <KontorSheet ctx={ctx} state={state} player={player} snap={snap} onSnap={close} />
      )}

      {kind === 'nachrichten' && (
        <NewsSheet
          log={log}
          players={state.players}
          realtime={realtime}
          now={now || Date.now()}
          sinceId={newsMark}
          snap={snap}
          onSnap={close}
        />
      )}

      {kind === 'einstellungen' && (
        <SettingsSheet
          state={state}
          net={net}
          snap={snap}
          onSnap={close}
          onLeave={leave}
          onAbandon={abandon}
        />
      )}

      {kind === 'vorschau' && preview && (
        <PortPreviewSheet
          ctx={ctx}
          state={state}
          player={player}
          portId={preview}
          snap={snap}
          onSnap={close}
          // Only offered when the ship is actually free to be given a course.
          onSetCourse={
            portId && !voyage
              ? (to) => {
                  dispatch({ type: 'setCourse', to })
                  setKind(null)
                }
              : undefined
          }
        />
      )}

      {kind === 'runde' &&
        (realtime ? (
          <SeasonSheet
            ctx={ctx}
            state={state}
            now={now}
            snap={snap}
            onSnap={close}
            onSettings={() => open('einstellungen')}
          />
        ) : (
          <RoundSheet
            state={state}
            snap={snap}
            onSnap={close}
            onSettings={() => open('einstellungen')}
          />
        ))}

      {kind === 'konjunktur' && (
        <KonjunkturSheet
          ctx={ctx}
          state={state}
          player={player}
          snap={snap}
          onSnap={close}
          onDraw={() => dispatch({ type: 'drawKonjunktur' })}
        />
      )}

      {kind === 'ende' && (
        <FinalSheet
          ctx={ctx}
          state={state}
          closing={lastEvents}
          snap={snap}
          onSnap={close}
          onNew={abandon}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------

/**
 * One division of the instrument strip.
 *
 * These were four separate floating cards — news, fleet, the clock, the
 * settings gear — each with its own paper, its own shadow and its own gap,
 * and on a telephone they had begun to wrap onto a second line. As cells of a
 * single strip they cost one shadow between them, sit at one height, and read
 * as an instrument panel rather than as things dropped on the chart.
 *
 * Counts ride inline rather than as corner badges: the strip clips its
 * children so that it can round its own ends, and a badge hung off the corner
 * would be cut in half by it.
 */
function Cell({
  label,
  onOpen,
  children,
}: {
  label: string
  onOpen: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onOpen}
      aria-label={label}
      className="flex items-center gap-1.5 px-2.5 py-1.5 transition-colors hover:bg-black/5"
    >
      {children}
    </button>
  )
}

/** Counts up whenever the key changes, to trigger a one-off camera move. */
function useFocusNonce(key: string): number {
  const [nonce, setNonce] = useState(0)
  const previous = useRef(key)
  useEffect(() => {
    if (previous.current !== key) {
      previous.current = key
      setNonce((n) => n + 1)
    }
  }, [key])
  return nonce
}

/**
 * The one thing to do next, at the foot of the chart.
 *
 * It no longer places itself: the footer column does that, so that the helm
 * switcher above it and this can never disagree about how far off the bottom
 * edge they sit.
 */
function ActionBar({
  state,
  onRoll,
  onEnd,
  onOpenPort,
  onDraw,
}: {
  state: GameState
  onRoll: () => void
  onEnd: () => void
  onOpenPort: () => void
  onDraw: () => void
}) {
  const wrap = (children: React.ReactNode) => (
    <div className="pointer-events-auto anim-rise">{children}</div>
  )

  switch (state.phase) {
    case 'roll':
      return wrap(
        <button className="btn btn-primary px-10 py-3 text-lg shadow-xl" onClick={onRoll}>
          Würfeln
        </button>,
      )

    case 'move':
      return wrap(
        <div className="paper flex items-center gap-3 rounded-xl px-3 py-2 shadow-xl">
          <Die value={state.movement?.rolled ?? 1} size={44} />
          <div className="pr-1">
            <p className="tnum text-lg leading-none font-bold">
              noch {state.movement?.remaining}
            </p>
            <p className="text-ink-soft text-[11px]">grünen Punkt antippen</p>
          </div>
        </div>,
      )

    case 'endOfTurn':
      return wrap(
        <button className="btn btn-primary px-8 py-3 text-base shadow-xl" onClick={onEnd}>
          Zug beenden
        </button>,
      )

    case 'port':
      return wrap(
        <button className="btn btn-primary px-8 py-3 text-base shadow-xl" onClick={onOpenPort}>
          Hafen öffnen
        </button>,
      )

    case 'konjunktur':
      return wrap(
        <button className="btn btn-danger px-8 py-3 text-base shadow-xl" onClick={onDraw}>
          Konjunkturkarte abheben
        </button>,
      )

    default:
      return null
  }
}

/**
 * Time left in the season, and what the world market is doing.
 *
 * The word "Saison" stands down on a narrow screen. It is the widest thing in
 * the strip and the least informative — a running clock beside a chart of the
 * oceans is not going to be mistaken for anything else.
 */
function ClockCell({
  state,
  now,
  onOpen,
}: {
  state: GameState
  now: number
  onOpen: () => void
}) {
  const left = state.endsAt - now
  const closing = left < 15 * 60_000
  return (
    <button
      onClick={onOpen}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 transition-colors hover:bg-black/5 ${
        closing ? 'text-rot' : ''
      }`}
      aria-label={`Noch ${durationText(left)} Saison`}
    >
      <span className="smallcaps hidden text-[10px] sm:inline">Saison</span>
      <span className="tnum text-base leading-none font-bold">{durationText(left)}</span>
      {state.saleModifierPercent !== 0 && (
        <span
          className={`tnum text-[11px] font-bold ${
            state.saleModifierPercent > 0 ? 'text-press' : 'text-rot'
          }`}
        >
          {state.saleModifierPercent > 0 ? '+' : '−'}
          {Math.abs(state.saleModifierPercent)}%
        </span>
      )}
    </button>
  )
}

/** The Kegelfigur, as a division of the strip. Tap for the whole track. */
function RoundCell({
  round,
  total,
  red,
  onOpen,
}: {
  round: number
  total: number
  red: boolean
  onOpen: () => void
}) {
  return (
    <button
      onClick={onOpen}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 transition-colors hover:bg-black/5 ${
        red ? 'text-rot' : ''
      }`}
      aria-label={`Runde ${round} von ${total}${red ? ', rotes Feld' : ''}`}
    >
      {red && <span className="bg-rot h-2.5 w-2.5 shrink-0 rounded-full" aria-hidden />}
      <span className="smallcaps hidden text-[10px] sm:inline">Runde</span>
      <span className="tnum text-base leading-none font-bold">{round}</span>
      <span className="text-ink-faint text-[10px]">/{total}</span>
    </button>
  )
}

/** What the commanded ship is doing right now, and the one thing to do next. */
function RealtimeBar({
  ctx,
  state,
  player,
  now,
  onOpenPort,
}: {
  ctx: EngineContext
  state: GameState
  player: PlayerState
  now: number
  onOpenPort: () => void
}) {
  if (state.phase === 'over') return null

  const voyage = flagship(player).voyage ?? null
  const wrap = (children: React.ReactNode) => (
    <div className="pointer-events-auto anim-rise">{children}</div>
  )

  if (voyage) {
    const eta = arrivalAt(ctx, state, player) ?? now
    const destination = ctx.portsById.get(voyage.destination)?.name ?? voyage.destination
    // The course is set but the hatches are still open: say so, or a ship
    // sitting at the quay for two minutes looks like a game that has hung.
    const loading = now < voyage.departsAt
    return wrap(
      <div className="paper flex items-center gap-3 rounded-xl px-4 py-2.5 shadow-xl">
        <span className={`text-2xl ${loading ? 'opacity-60' : ''}`} aria-hidden>
          {loading ? '🏗' : '⛴'}
        </span>
        <div>
          <p className="text-sm leading-tight font-semibold">
            {loading ? `Wird beladen · Kurs auf ${destination}` : `Kurs auf ${destination}`}
          </p>
          <p className="text-ink-soft text-[11px]">
            {loading
              ? `Legt ab ${untilText(voyage.departsAt, now)} · Ankunft ${untilText(eta, now)}`
              : `Ankunft ${untilText(eta, now)} · ${clockText(eta)} Uhr`}
          </p>
        </div>
      </div>,
    )
  }

  return wrap(
    <div className="paper flex items-center gap-3 rounded-xl px-3 py-2 shadow-xl">
      <button className="btn btn-primary" onClick={onOpenPort}>
        Hafen
      </button>
      <p className="text-ink-soft max-w-[10rem] text-[11px] leading-snug">
        Einen Hafen auf dem Plan antippen, um Kurs zu setzen.
      </p>
    </div>,
  )
}

/** Local real-time games command several ships from one device. */
function HelmSwitcher({
  players,
  current,
  onPick,
}: {
  players: readonly PlayerState[]
  current: string
  onPick: (id: string) => void
}) {
  return (
    <div className="pointer-events-auto anim-rise max-w-full">
      {/* Zehn Häuser passen nicht nebeneinander auf ein Telefon. */}
      <div className="paper flex max-w-full gap-1 overflow-x-auto rounded-full px-1.5 py-1 shadow-lg">
        {players.map((p) => {
          const color = COLORS[p.colorIndex % COLORS.length]!
          const active = p.id === current
          return (
            <button
              key={p.id}
              onClick={() => onPick(p.id)}
              className={`btn-sm rounded-full px-2.5 text-[11px] ${
                active ? 'text-white' : 'text-ink-soft'
              }`}
              style={active ? { background: color.ink } : undefined}
              aria-pressed={active}
            >
              {p.name}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function SeasonSheet({
  ctx,
  state,
  now,
  snap,
  onSnap,
  onSettings,
}: {
  ctx: EngineContext
  state: GameState
  now: number
  snap: SheetSnap
  onSnap: (s: SheetSnap) => void
  onSettings: () => void
}) {
  const card = state.marketCardId ? ctx.cardsById.get(state.marketCardId) : null
  const nextTurn = state.marketSince + state.config.realtime.marketIntervalMinutes * 60_000

  return (
    <Sheet
      snap={snap}
      onSnap={onSnap}
      title="Die Saison"
      subtitle={`Schluß ${clockText(state.endsAt)} Uhr · noch ${durationText(state.endsAt - now)}`}
    >
      <h3 className="smallcaps text-ink-soft mb-2 text-[11px]">Weltmarkt</h3>
      {card ? (
        <KonjunkturSlip card={card} standing />
      ) : (
        <p className="text-ink-faint text-xs italic">
          Noch keine Notierung. Die erste Karte fällt {untilText(nextTurn, now)}.
        </p>
      )}
      <p className="text-ink-soft mt-3 text-center text-[11px]">
        Nächste Notierung {untilText(nextTurn, now)}
      </p>

      <h3 className="smallcaps text-ink-soft mt-5 mb-2 text-[11px]">Die Flotte</h3>
      <ul className="space-y-1.5 text-[12px]">
        {state.players.map((p) => {
          const color = COLORS[p.colorIndex % COLORS.length]!
          const eta = arrivalAt(ctx, state, p)
          const ship = flagship(p)
          const where = ship.voyage
            ? `unterwegs nach ${ctx.portsById.get(ship.voyage.destination)?.name ?? ''}`
            : `liegt in ${ctx.portsById.get(ship.nodeId)?.name ?? 'See'}`
          return (
            <li key={p.id} className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full border border-black/30"
                style={{ background: color.ink }}
              />
              <span className="min-w-0 flex-1 truncate">
                {p.name} — <span className="text-ink-soft">{where}</span>
              </span>
              {eta && <span className="tnum text-ink-faint">{untilText(eta, now)}</span>}
            </li>
          )
        })}
      </ul>

      {/* Aufgeben steht unter Einstellungen, mit dem Unterschied zwischen
          Weggehen und Aufgeben daneben — hier war beides derselbe Knopf. */}
      <button className="btn mt-6 w-full" onClick={onSettings}>
        Einstellungen
      </button>
    </Sheet>
  )
}

function KontorSheet({
  ctx,
  state,
  player,
  snap,
  onSnap,
}: {
  ctx: EngineContext
  state: GameState
  player: PlayerState
  snap: SheetSnap
  onSnap: (s: SheetSnap) => void
}) {
  const [tab, setTab] = useState<'kasse' | 'wohin'>('kasse')
  const color = PLAYER_COLORS[player.colorIndex % PLAYER_COLORS.length]!
  const worth = useCountUp(netWorth(player))
  const report = useMemo(() => marketReport(ctx, state, player, 6), [ctx, player])

  return (
    <Sheet
      snap={snap}
      onSnap={onSnap}
      title={player.name}
      subtitle={playerLabel(player)}
      accent={color.ink}
    >
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { id: 'kasse', label: 'Kasse' },
          { id: 'wohin', label: 'Wohin?' },
        ]}
      />

      {tab === 'kasse' && (
        <div className="anim-fade">
          <dl className="teletype space-y-1 text-[13px]">
            <Row label="Barmittel" value={formatMoney(player.cash)} />
            <Row label="Warenwert" value={formatMoney(cargoValue(player))} />
            <hr className="rule my-1.5" />
            <Row label="Vermögen" value={formatMoney(worth)} strong />
          </dl>

          <h3 className="smallcaps text-ink-soft mt-4 mb-1.5 text-[11px]">
            Laderaum · {flagship(player).kind.name}
          </h3>
          <CargoHold ctx={ctx} cargo={flagship(player).cargo} vehicle={flagship(player).kind} size={38} />
          {flagship(player).cargo.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-[12px]">
              {flagship(player).cargo.map((c) => (
                <li key={c.uid} className="flex justify-between gap-2">
                  <span className="min-w-0 truncate">
                    {ctx.goodsById.get(c.goodId)?.name}
                    {c.damaged && <span className="text-rot ml-1 text-[11px]">havariert</span>}
                  </span>
                  <span className="tnum text-ink-soft">
                    {c.pricePaid.toLocaleString('de-DE')}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <h3 className="smallcaps text-ink-soft mt-4 mb-1.5 text-[11px]">Die Rangliste</h3>
          <Rangliste state={state} highlight={player.id} />
        </div>
      )}

      {tab === 'wohin' && <MarketReport ctx={ctx} report={report} cargo={flagship(player).cargo.length} />}
    </Sheet>
  )
}

function RoundSheet({
  state,
  snap,
  onSnap,
  onSettings,
}: {
  state: GameState
  snap: SheetSnap
  onSnap: (s: SheetSnap) => void
  onSettings: () => void
}) {
  return (
    <Sheet
      snap={snap}
      onSnap={onSnap}
      title={`Runde ${state.round}`}
      subtitle={`von ${state.config.totalRounds} · rote Felder bringen die Konjunktur ins Spiel`}
    >
      <div className="flex flex-wrap gap-1">
        {Array.from({ length: state.config.totalRounds }, (_, i) => {
          const n = i + 1
          const red = state.config.redFields.includes(n)
          const now = state.round === n
          const past = state.round > n
          return (
            <span
              key={n}
              className={`tnum grid h-7 w-7 place-items-center rounded-[2px] border text-[11px] ${
                red ? 'bg-rot border-black/30 text-white' : 'border-black/15 bg-white/50'
              } ${past ? 'opacity-40' : ''} ${now ? 'ring-ink ring-2 ring-offset-1' : ''}`}
            >
              {n}
            </span>
          )
        })}
      </div>
      <button className="btn mt-6 w-full" onClick={onSettings}>
        Einstellungen
      </button>
    </Sheet>
  )
}

/**
 * The red field: turn a card, then be told plainly what it cost or paid.
 *
 * The card alone was not enough. It states a rule in 1950s bank German and the
 * money moves on its own, so a player could be charged a Steuer and never
 * connect the two. Now the card turns over on screen — the motion is what says
 * "this happened to you" — and under it sits the consequence in figures.
 */
function KonjunkturSheet({
  ctx,
  state,
  player,
  snap,
  onSnap,
  onDraw,
}: {
  ctx: EngineContext
  state: GameState
  player: PlayerState
  snap: SheetSnap
  onSnap: (s: SheetSnap) => void
  onDraw: () => void
}) {
  const card = state.pendingCard ? ctx.cardsById.get(state.pendingCard.cardId) : null
  const outcome = card ? konjunkturOutcome(ctx, player, card) : null

  return (
    <Sheet
      snap={snap}
      onSnap={onSnap}
      title="Rotes Feld"
      subtitle="Vor dem Verkauf ist eine Karte abzuheben"
      footer={
        !card ? (
          <button className="btn btn-primary w-full" onClick={onDraw}>
            Karte abheben
          </button>
        ) : undefined
      }
    >
      {card ? (
        <div className="flip-scene">
          <div className="anim-flip">
            <KonjunkturSlip card={card} />
          </div>

          {outcome && (
            <div
              className={`anim-rise mt-4 rounded-sm border-l-4 px-3 py-2.5 ${
                outcome.tone === 'gut'
                  ? 'paper-slip border-l-press'
                  : outcome.tone === 'schlecht'
                    ? 'border-l-rot bg-rot/8'
                    : 'paper-card border-l-ink/30'
              }`}
              style={{ animationDelay: '520ms' }}
            >
              <p
                className={`text-[17px] leading-tight font-bold ${
                  outcome.tone === 'gut'
                    ? 'press-dark'
                    : outcome.tone === 'schlecht'
                      ? 'text-rot'
                      : ''
                }`}
              >
                {outcome.headline}
              </p>
              <p className="text-ink-soft mt-1 text-[13px] leading-snug">{outcome.detail}</p>
            </div>
          )}
        </div>
      ) : (
        <div className="paper-slip mx-auto grid h-36 w-60 place-items-center rounded-[2px] shadow-md">
          <span className="smallcaps text-xs tracking-[0.3em] text-black/40">Konjunktur</span>
        </div>
      )}
    </Sheet>
  )
}

/**
 * The Schlußabrechnung, with its working shown.
 *
 * The last round runs itself: every ship makes for the nearest harbour and
 * the whole hold goes over the side at once. Showing only the final ranking
 * meant a player watched their cash jump by six figures with no account of
 * where it came from. The closing sales are already emitted as events, so
 * they are laid out here, per house, under the rule that produced them.
 */
function FinalSheet({
  ctx,
  state,
  closing,
  snap,
  onSnap,
  onNew,
}: {
  ctx: EngineContext
  state: GameState
  /** Events from the action that ended the game — the whole closing run. */
  closing: readonly GameEvent[]
  snap: SheetSnap
  onSnap: (s: SheetSnap) => void
  onNew: () => void
}) {
  const table = useMemo(() => standings(state), [state])

  // What each house sold up at the close, in the order the bank took it.
  const soldUp = useMemo(() => {
    const byPlayer = new Map<string, { goodId: number; price: number; profit: number }[]>()
    for (const e of closing) {
      if (e.type !== 'sold' || e.kind !== 'schluss') continue
      const rows = byPlayer.get(e.playerId) ?? []
      rows.push({ goodId: e.goodId, price: e.price, profit: e.profit })
      byPlayer.set(e.playerId, rows)
    }
    return byPlayer
  }, [closing])

  const anySales = soldUp.size > 0

  return (
    <Sheet
      snap={snap}
      onSnap={onSnap}
      title="Schlußabrechnung"
      subtitle="Wer hat den Handel gemacht?"
      footer={
        <button className="btn btn-primary w-full" onClick={onNew}>
          Neue Partie
        </button>
      }
    >
      <div className="paper-slip mb-3 rounded-sm px-3 py-2.5">
        <p className="text-press text-[13px] leading-snug">
          <Emph
            strong="press-dark font-bold"
            text={
              'Die *letzte Runde* ist gefahren. Jedes Schiff hat den *nächsten Hafen* angelaufen und ' +
              'seine Ladung abgestoßen: was der Hafen *nicht selbst führt*, zum vollen Verkaufspreis — ' +
              'alles andere zu *75 % des Einkaufs*. Sieger ist das größte Vermögen.'
            }
          />
        </p>
      </div>

      <ol className="stagger space-y-2">
        {table.map((row) => {
          const rows = soldUp.get(row.player.id) ?? []
          const takings = rows.reduce((sum, r) => sum + r.price, 0)
          return (
            <li key={row.player.id} className="paper-card rounded-sm p-2.5">
              <div className="flex items-center gap-3">
                <span className="display w-6 text-center text-xl">{row.rank}</span>
                <Portrait traits={row.player.persona.portrait} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{row.player.name}</p>
                  <p className="text-ink-soft truncate text-[11px]">{playerLabel(row.player)}</p>
                </div>
                <span className="tnum text-sm font-bold">{formatMoney(row.worth)}</span>
              </div>

              {rows.length > 0 && (
                <ul className="mt-2 space-y-0.5 border-t border-black/10 pt-1.5 text-[12px]">
                  {rows.map((r, i) => (
                    <li key={i} className="flex items-baseline justify-between gap-2">
                      <span className="min-w-0 flex-1 truncate">
                        {ctx.goodsById.get(r.goodId)?.name ?? `Ware ${r.goodId}`}
                      </span>
                      <span className="tnum">{r.price.toLocaleString('de-DE')}</span>
                      <span
                        className={`tnum w-20 text-right ${r.profit >= 0 ? 'text-press' : 'text-rot'}`}
                      >
                        {r.profit >= 0 ? '+' : '−'}
                        {Math.abs(r.profit).toLocaleString('de-DE')}
                      </span>
                    </li>
                  ))}
                  <li className="flex items-baseline justify-between gap-2 border-t border-black/10 pt-1 font-bold">
                    <span className="smallcaps text-[11px]">Schlußverkauf</span>
                    <span className="tnum">{takings.toLocaleString('de-DE')}</span>
                    <span className="w-20" />
                  </li>
                </ul>
              )}

              {anySales && rows.length === 0 && (
                <p className="text-ink-soft mt-1.5 border-t border-black/10 pt-1.5 text-[12px]">
                  Fuhr mit leerem Laderaum ein — nichts mehr abzurechnen.
                </p>
              )}
            </li>
          )
        })}
      </ol>
    </Sheet>
  )
}

/**
 * The Börsenblatt: everything that has happened, newest first.
 *
 * This is the same log that used to hide behind the Kontor's third tab, but
 * read as a newspaper rather than a debug trace — larger type, the round
 * headings standing clear of the entries under them, and anything that
 * arrived since the last look ruled off down the left. Money moves in this
 * game without the player touching anything, and the only honest fix for
 * "what just happened to my cash" is somewhere that says so.
 */
function NewsSheet({
  log,
  players,
  /** Real-time play divides the paper by the day and stamps every entry. */
  realtime,
  now,
  sinceId,
  snap,
  onSnap,
}: {
  log: LogLine[]
  readonly players: readonly PlayerState[]
  realtime: boolean
  now: number
  /** Entries above this id are new since the sheet was last opened. */
  sinceId: number
  snap: SheetSnap
  onSnap: (s: SheetSnap) => void
}) {
  /** Null reads the whole paper; an id reads one house's column. */
  const [only, setOnly] = useState<string | null>(null)

  /*
   * Filtering keeps the world news — round openings, storms, the close of
   * the season — because those are the scaffolding the journal hangs on. A
   * round in which the chosen house did nothing drops out by itself: its
   * heading has no entries under it, and empty groups are not drawn.
   */
  const shown = useMemo(
    () => (only ? log.filter((l) => l.who.length === 0 || l.who.includes(only)) : log),
    [log, only],
  )
  const fresh = shown.filter((l) => l.id > sinceId).length
  // The clock is redrawn every second; the headings only ever change at
  // midnight, so they are grouped against the day rather than the instant.
  const today = new Date(now).setHours(0, 0, 0, 0)
  const rounds = useMemo(
    () => (realtime ? groupByDay(shown, today) : groupByRound(shown)),
    [shown, realtime, today],
  )
  const named = only ? (players.find((p) => p.id === only)?.name ?? null) : null

  // The current round is the one you came to read; older ones fold away so a
  // fifty-round game does not become a scroll to nowhere.
  const [openRounds, setOpenRounds] = useState<Record<string, boolean>>({})
  const isOpen = (key: string, first: boolean) => openRounds[key] ?? first

  return (
    <Sheet
      snap={snap}
      onSnap={onSnap}
      title="Nachrichten"
      subtitle={
        log.length === 0
          ? 'Noch ist nichts eingegangen'
          : named
            ? `${shown.length} zu ${named} · ${log.length} insgesamt`
            : fresh > 0
              ? `${fresh} neu · ${log.length} insgesamt`
              : `${log.length} Meldungen`
      }
    >
      {/* Die Spalten des Blattes: das ganze Blatt oder ein Haus. Bei einem
          einzigen Mitspieler gibt es nichts auseinanderzuhalten. */}
      {players.length > 1 && log.length > 0 && (
        <div
          className="-mx-1 mb-2.5 flex gap-1 overflow-x-auto px-1 pb-1"
          role="group"
          aria-label="Nachrichten filtern"
        >
          <FilterChip label="Alle" active={only === null} onPick={() => setOnly(null)} />
          {players.map((p) => (
            <FilterChip
              key={p.id}
              label={p.name}
              ink={PLAYER_COLORS[p.colorIndex % PLAYER_COLORS.length]!.ink}
              active={only === p.id}
              onPick={() => setOnly(only === p.id ? null : p.id)}
            />
          ))}
        </div>
      )}

      {log.length === 0 ? (
        <p className="text-ink-soft py-6 text-center text-[13px]">
          Sobald gewürfelt, gehandelt und angelandet wird, steht es hier.
        </p>
      ) : rounds.length === 0 ? (
        <p className="text-ink-soft py-6 text-center text-[13px]">
          Von {named} ist noch nichts zu berichten.
        </p>
      ) : (
        <div className="space-y-2">
          {rounds.map((group, i) => {
            const open = isOpen(group.key, i === 0)
            const neu = group.lines.filter((l) => l.id > sinceId).length
            return (
              <section key={group.key}>
                <button
                  type="button"
                  className="focusable flex w-full items-center gap-2 border-b border-black/10 py-1 text-left"
                  onClick={() => setOpenRounds((o) => ({ ...o, [group.key]: !open }))}
                  aria-expanded={open}
                >
                  <span
                    className={`text-ink-soft shrink-0 text-[10px] transition-transform ${open ? 'rotate-90' : ''}`}
                    aria-hidden
                  >
                    ▶
                  </span>
                  <span className="smallcaps flex-1 text-[11px] tracking-[0.2em]">
                    {group.title}
                  </span>
                  {neu > 0 && (
                    <span className="bg-gold/25 rounded-full px-1.5 py-0.5 text-[10px] font-bold">
                      {neu} neu
                    </span>
                  )}
                  <span className="text-ink-faint tnum text-[10px]">{group.lines.length}</span>
                </button>

                {open && (
                  <ol className="anim-fade mt-0.5 space-y-px">
                    {group.lines.map((line) => (
                      <li
                        key={line.id}
                        className={`flex gap-2 ${
                          line.id > sinceId
                            ? 'border-gold border-l-2 pl-2'
                            : 'border-l-2 border-transparent pl-2'
                        }`}
                      >
                        {/* Die Uhrzeit nur dort, wo eine Uhr läuft. */}
                        {realtime && (
                          <span className="tnum text-ink-faint shrink-0 py-0.5 text-[11px] leading-snug">
                            {clockText(line.at)}
                          </span>
                        )}
                        <p
                          className={`min-w-0 flex-1 py-0.5 text-[13px] leading-snug ${
                            line.tone === 'gut'
                              ? 'text-press'
                              : line.tone === 'schlecht'
                                ? 'text-rot'
                                : line.tone === 'wichtig'
                                  ? 'font-semibold'
                                  : ''
                          }`}
                        >
                          {line.text}
                        </p>
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            )
          })}
        </div>
      )}
    </Sheet>
  )
}

/**
 * One column of the Börsenblatt: everything, or one house.
 *
 * Carries the house's own colour, which is the same seal it wears on the
 * plan, in the HUD and on its course — so picking a column out of the row
 * needs no reading.
 */
function FilterChip({
  label,
  ink,
  active,
  onPick,
}: {
  label: string
  ink?: string
  active: boolean
  onPick: () => void
}) {
  return (
    <button
      onClick={onPick}
      aria-pressed={active}
      className={`btn-sm flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] transition ${
        active
          ? 'border-transparent text-white'
          : 'border-black/20 text-ink-soft hover:bg-black/5'
      }`}
      style={active ? { background: ink ?? 'var(--color-ink)' } : undefined}
    >
      {ink && (
        <span
          className="h-2 w-2 shrink-0 rounded-full border border-black/25"
          style={{ background: active ? '#ffffff' : ink }}
          aria-hidden
        />
      )}
      <span className="max-w-[7rem] truncate">{label}</span>
    </button>
  )
}

interface NewsGroup {
  key: string
  title: string
  lines: LogLine[]
}

/**
 * Fold the flat log into one section per day.
 *
 * What the round track does for a game of throws, the calendar does for one
 * that runs on real hours: a real-time season has no rounds at all, so the
 * journal used to arrive as a single undivided heap headed "Laufende Runde".
 *
 * The log already runs newest first, so the days do too.
 */
function groupByDay(log: LogLine[], now: number): NewsGroup[] {
  const groups: NewsGroup[] = []
  for (const line of log) {
    const key = dayKey(line.at)
    let group = groups.at(-1)
    if (!group || group.key !== key) {
      group = { key, title: dayTitle(line.at, now), lines: [] }
      groups.push(group)
    }
    group.lines.push(line)
  }
  return groups
}

const dayKey = (at: number) => {
  const d = new Date(at)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

/**
 * "Heute", "Gestern", or the day written out.
 *
 * A season is a day or two long, so nearly every heading is one of the first
 * two — and a date is a poor thing to have to work out when the answer is
 * "an hour ago".
 */
function dayTitle(at: number, now: number): string {
  if (dayKey(at) === dayKey(now)) return 'Heute'
  if (dayKey(at) === dayKey(now - 86_400_000)) return 'Gestern'
  return new Date(at).toLocaleDateString('de-DE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

/**
 * Fold the flat log into one section per round.
 *
 * The log runs newest first, and a "Runde N" line is written when that round
 * opens — so in this order a round's heading arrives *after* the entries that
 * belong to it. Anything above the first heading is the round in progress.
 */
function groupByRound(log: LogLine[]): NewsGroup[] {
  const groups: { key: string; title: string; lines: LogLine[] }[] = []
  let pending: LogLine[] = []

  for (const line of log) {
    const heading = /^Runde \d+/.exec(line.text)
    if (heading) {
      groups.push({ key: `r${line.id}`, title: line.text.replace(/\.$/, ''), lines: pending })
      pending = []
    } else {
      pending.push(line)
    }
  }
  if (pending.length > 0) {
    groups.unshift({ key: 'laufend', title: 'Laufende Runde', lines: pending })
  }
  return groups.filter((g) => g.lines.length > 0)
}

/**
 * Who is winning, in order, with the places written out.
 *
 * The Kontor used to list only the other houses, unsorted, so working out
 * where you stood meant reading every figure and doing the comparison in your
 * head. The placing is the question players actually ask; the money is the
 * footnote. Shown small in the Kontor and large at the Schlußabrechnung, but
 * from one component so the two can never fall out of step.
 */
function Rangliste({
  state,
  highlight,
  size = 'klein',
}: {
  state: GameState
  /** Draws this house's row out of the list — normally the one reading it. */
  highlight?: string
  size?: 'klein' | 'gross'
}) {
  const table = useMemo(() => standings(state), [state])
  const gross = size === 'gross'

  return (
    <ol className={gross ? 'stagger space-y-2' : 'space-y-0.5'}>
      {table.map((row) => {
        const color = PLAYER_COLORS[row.player.colorIndex % PLAYER_COLORS.length]!
        const you = row.player.id === highlight
        return (
          <li
            key={row.player.id}
            className={`flex items-center gap-2 rounded-sm ${
              gross ? 'paper-card p-2.5' : `px-1.5 py-1 ${you ? 'bg-ink/8' : ''}`
            }`}
          >
            <span
              className={`tnum shrink-0 text-right ${
                gross ? 'display w-6 text-xl' : 'w-4 text-[13px] font-bold'
              }`}
            >
              {row.rank}.
            </span>
            {gross ? (
              <Portrait traits={row.player.persona.portrait} size={40} />
            ) : (
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full border border-black/30"
                style={{ background: color.ink }}
              />
            )}
            <div className="min-w-0 flex-1">
              <p
                className={`truncate ${
                  gross ? 'text-sm font-semibold' : `text-[13px] ${you ? 'font-bold' : ''}`
                }`}
              >
                {row.player.name}
                {you && !gross && <span className="text-ink-soft font-normal"> · Sie</span>}
              </p>
              {gross && (
                <p className="text-ink-soft truncate text-[11px]">{playerLabel(row.player)}</p>
              )}
            </div>
            <span className={`tnum font-bold ${gross ? 'text-sm' : 'text-[13px]'}`}>
              {gross ? formatMoney(row.worth) : row.worth.toLocaleString('de-DE')}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="smallcaps text-ink-soft">{label}</dt>
      <dd className={`tnum ${strong ? 'font-bold' : ''}`}>{value}</dd>
    </div>
  )
}
