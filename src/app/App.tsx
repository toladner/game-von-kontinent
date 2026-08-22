import { Onboarding } from '@ui/Onboarding'
import { GameScreen } from '@ui/GameScreen'
import { useGame } from './store'

export default function App() {
  const state = useGame((s) => s.state)
  return <div className="h-full">{state ? <GameScreen /> : <Onboarding />}</div>
}
