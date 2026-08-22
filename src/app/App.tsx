import { Setup } from '@ui/Setup'
import { Lobby } from '@ui/Lobby'
import { GameScreen } from '@ui/GameScreen'
import { useGame } from './store'

export default function App() {
  const state = useGame((s) => s.state)
  const net = useGame((s) => s.net)

  // Connected but the server has not sent the log yet.
  if (!state && net) return <Connecting code={net.code} />
  if (!state) return <Setup />
  if (state.phase === 'lobby') return <Lobby />
  return <GameScreen />
}

function Connecting({ code }: { code: string }) {
  return (
    <div className="board-shell grid h-full place-items-center p-6 text-center">
      <div className="paper anim-rise rounded-lg px-8 py-7">
        <p className="smallcaps text-ink-soft text-[10px]">Partie</p>
        <p className="display tnum text-4xl tracking-[0.25em]">{code}</p>
        <p className="text-ink-soft mt-3 text-sm italic">Die Leitung wird gelegt …</p>
      </div>
    </div>
  )
}
