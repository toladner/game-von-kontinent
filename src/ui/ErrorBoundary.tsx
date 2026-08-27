import { Component, Fragment, type ErrorInfo, type ReactNode } from 'react'
import { t } from '@i18n'
import { currentLocale } from '@app/locale'
import { forgetTable } from '@app/net'

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
    // The app now walks back into the last online table on its own at
    // start-up. Without this, a reload would land straight back on whatever
    // was crashing, and "Neu beginnen" would be a loop rather than a way out.
    forgetTable()
    location.reload()
  }

  override render() {
    const { error } = this.state
    // A Fragment, not a div: a wrapper element with height:auto would break
    // the height:100% chain the whole layout hangs from.
    if (!error) return <Fragment key={this.state.attempt}>{this.props.children}</Fragment>

    /*
     * Read from the store rather than through the hook: this is a class
     * component, and it is the one place in the app that has to keep working
     * when everything else has stopped. A hook here would be one more thing
     * that could throw on the screen whose job is to catch throwing.
     */
    const locale = currentLocale()
    const say = (key: Parameters<typeof t>[1]) => t(locale, key)

    return (
      <div className="board-shell grid h-full place-items-center p-5">
        <div className="paper max-w-md rounded-lg p-6 text-center">
          <p className="smallcaps text-ink-soft text-[10px]">{say('crash.heading')}</p>
          <h1 className="display letterpress mt-1 text-2xl">{say('crash.title')}</h1>
          <hr className="rule my-4" />
          <p className="text-ink-soft text-sm">{say('crash.note')}</p>
          <pre className="teletype text-ink-faint mt-3 max-h-24 overflow-auto text-left text-[10px] whitespace-pre-wrap">
            {error.message}
          </pre>
          <div className="mt-5 flex justify-center gap-3">
            <button className="btn btn-primary" onClick={this.retry}>
              {say('crash.continue')}
            </button>
            <button className="btn" onClick={this.reset}>
              {say('crash.restart')}
            </button>
          </div>
        </div>
      </div>
    )
  }
}
