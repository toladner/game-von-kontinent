import { Component, type ErrorInfo, type ReactNode } from 'react'

/**
 * A white screen tells the player nothing and tells us less.
 *
 * The game state itself is safe: local games are a seed plus an action list in
 * localStorage, and networked games live on the server. So the honest thing to
 * offer is "carry on" — a re-render usually suffices — and only then a reset.
 */
interface Props {
  readonly children: ReactNode
}

interface State {
  readonly error: Error | null
  readonly attempt: number
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null, attempt: 0 }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Von Kontinent zu Kontinent — Fehler in der Darstellung', error, info)
  }

  private retry = () => {
    this.setState((s) => ({ error: null, attempt: s.attempt + 1 }))
  }

  private reset = () => {
    try {
      localStorage.removeItem('vkzk.partie.v1')
    } catch {
      /* nothing to clear */
    }
    location.reload()
  }

  override render() {
    const { error } = this.state
    if (!error) return <div key={this.state.attempt}>{this.props.children}</div>

    return (
      <div className="board-shell grid h-full place-items-center p-5">
        <div className="paper max-w-md rounded-lg p-6 text-center">
          <p className="smallcaps text-ink-soft text-[10px]">Störung im Kontor</p>
          <h1 className="display letterpress mt-1 text-2xl">Da ist etwas verrutscht</h1>
          <hr className="rule my-4" />
          <p className="text-ink-soft text-sm">
            Die Partie selbst ist nicht verloren — sie liegt als Zugliste vor und wird beim
            Fortsetzen neu abgespielt.
          </p>
          <pre className="teletype text-ink-faint mt-3 max-h-24 overflow-auto text-left text-[10px] whitespace-pre-wrap">
            {error.message}
          </pre>
          <div className="mt-5 flex justify-center gap-3">
            <button className="btn btn-primary" onClick={this.retry}>
              Weiterspielen
            </button>
            <button className="btn" onClick={this.reset}>
              Neu beginnen
            </button>
          </div>
        </div>
      </div>
    )
  }
}
