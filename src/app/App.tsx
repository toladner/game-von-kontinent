import { ErrorBoundary } from '@ui/ErrorBoundary'
import { Setup } from '@ui/Setup'
import { Lobby } from '@ui/Lobby'
import { GameScreen } from '@ui/GameScreen'
import { useGame } from './store'
import type { ConnectionStatus } from './net'

export default function App() {
  return (
    <ErrorBoundary>
      <Screen />
    </ErrorBoundary>
  )
}

function Screen() {
  const state = useGame((s) => s.state)
  const net = useGame((s) => s.net)
  const notice = useGame((s) => s.notice)
  const leave = useGame((s) => s.leave)
  const join = useGame((s) => s.join)

  // Connected but the server has not sent the log yet.
  if (!state && net)
    return (
      <Connecting
        code={net.code}
        status={net.status}
        // Before there is any state, a message from the table can only be a
        // reason we are not at it.
        refused={notice}
        onLeave={leave}
        // A name is what asks for a seat; without one the server hands over
        // the log to watch and nothing else.
        onWatch={() => join(net.code, '')}
      />
    )
  if (!state) return <Setup />
  if (state.phase === 'lobby') return <Lobby />
  return <GameScreen />
}

/**
 * The moment between asking for a table and being sat down at it.
 *
 * This used to say "Die Leitung wird gelegt" and nothing else, for ever. That
 * was survivable while the only way here was typing a code you had just been
 * given; now the app walks back into the last table on its own, so a code that
 * no longer answers — a table long finished, a phone with no signal — would
 * strand the player on a screen with no buttons. The socket retries by itself,
 * so this only has to be honest about which of the two is happening, and leave
 * a door open.
 *
 * The third ending was the worst of the three, because nothing was wrong with
 * the line at all. A table closed to latecomers answers the request with a
 * refusal and no log: the message had arrived, been read and stored, and the
 * screen went on saying the wire was being laid. That one is terminal — no
 * amount of waiting turns a refusal into a seat — so it says so, and offers
 * the two things still on the table: watch, or go back.
 */
function Connecting({
  code,
  status,
  refused,
  onLeave,
  onWatch,
}: {
  code: string
  status: ConnectionStatus
  refused: string | null
  onLeave: () => void
  onWatch: () => void
}) {
  // A refusal outranks a dropped line: it is the answer, not the absence of one.
  const lost = !refused && status === 'getrennt'
  return (
    <div className="board-shell grid h-full place-items-center p-6 text-center">
      <div className="paper anim-rise rounded-lg px-8 py-7">
        <p className="smallcaps text-ink-soft text-[10px]">Partie</p>
        <p className="display tnum text-4xl tracking-[0.25em]">{code}</p>
        <p className={`mt-3 text-sm italic ${refused || lost ? 'text-rot' : 'text-ink-soft'}`}>
          {refused ?? (lost ? 'Die Leitung steht nicht.' : 'Die Leitung wird gelegt …')}
        </p>
        {refused ? (
          <>
            <p className="text-ink-faint mx-auto mt-1 max-w-[18rem] text-[12px] leading-snug">
              Zusehen dürfen Sie trotzdem — ein Platz am Tisch wird daraus nicht.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <button className="btn" onClick={onWatch}>
                Nur zusehen
              </button>
              <button className="btn" onClick={onLeave}>
                Zum Titelbild
              </button>
            </div>
          </>
        ) : (
          lost && (
            <>
              <p className="text-ink-faint mx-auto mt-1 max-w-[18rem] text-[12px] leading-snug">
                Es wird weiter versucht. Vielleicht ist diese Partie auch abgeschlossen.
              </p>
              <button className="btn mt-4" onClick={onLeave}>
                Zum Titelbild
              </button>
            </>
          )
        )}
      </div>
    </div>
  )
}
