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
  const leave = useGame((s) => s.leave)

  // Connected but the server has not sent the log yet.
  if (!state && net) return <Connecting code={net.code} status={net.status} onLeave={leave} />
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
 */
function Connecting({
  code,
  status,
  onLeave,
}: {
  code: string
  status: ConnectionStatus
  onLeave: () => void
}) {
  const lost = status === 'getrennt'
  return (
    <div className="board-shell grid h-full place-items-center p-6 text-center">
      <div className="paper anim-rise rounded-lg px-8 py-7">
        <p className="smallcaps text-ink-soft text-[10px]">Partie</p>
        <p className="display tnum text-4xl tracking-[0.25em]">{code}</p>
        <p className={`mt-3 text-sm italic ${lost ? 'text-rot' : 'text-ink-soft'}`}>
          {lost ? 'Die Leitung steht nicht.' : 'Die Leitung wird gelegt …'}
        </p>
        {lost && (
          <>
            <p className="text-ink-faint mx-auto mt-1 max-w-[18rem] text-[12px] leading-snug">
              Es wird weiter versucht. Vielleicht ist diese Partie auch abgeschlossen.
            </p>
            <button className="btn mt-4" onClick={onLeave}>
              Zum Titelbild
            </button>
          </>
        )}
      </div>
    </div>
  )
}
