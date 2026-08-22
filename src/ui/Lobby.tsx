import { Portrait } from './Portrait'
import { PLAYER_COLORS, playerLabel, useGame } from '@app/store'

/**
 * The quayside before departure: who has arrived, and the code that brings
 * the others. The host casts off.
 */
export function Lobby() {
  const state = useGame((s) => s.state)!
  const net = useGame((s) => s.net)
  const dispatch = useGame((s) => s.dispatch)
  const abandon = useGame((s) => s.abandon)
  const notice = useGame((s) => s.notice)

  const isHost = net === null || state.hostId === net.playerId
  const online = new Set(net?.online ?? [])

  return (
    <div className="board-shell h-full overflow-y-auto">
      <div
        className="mx-auto flex min-h-full w-full max-w-xl flex-col px-3 py-5 sm:px-6"
        style={{
          paddingTop: 'calc(var(--safe-t) + 1.25rem)',
          paddingBottom: 'calc(var(--safe-b) + 1.5rem)',
        }}
      >
        <div className="paper anim-rise flex-1 rounded-lg p-5 sm:p-8">
          <header className="text-center">
            <p className="smallcaps text-ink-soft text-[10px]">Vor der Ausfahrt</p>
            <h1 className="display letterpress mt-1 text-3xl italic">Am Kai</h1>
            <hr className="rule-double mx-auto mt-4 w-2/3" />
          </header>

          {net && (
            <section className="mt-5 text-center">
              <p className="smallcaps text-ink-soft text-[10px]">Code der Partie</p>
              <p className="display tnum mt-1 text-5xl tracking-[0.25em]">{net.code}</p>
              <p className="text-ink-soft mt-2 text-xs">
                Andere geben diesen Code auf der Eingangsseite ein.
              </p>
              <ShareRow code={net.code} />
              <p
                className={`mt-3 text-[11px] ${
                  net.status === 'verbunden' ? 'text-press' : 'text-rot'
                }`}
              >
                {net.status === 'verbunden'
                  ? 'Mit der Partie verbunden.'
                  : net.status === 'verbindet'
                    ? 'Verbindung wird aufgebaut …'
                    : 'Verbindung unterbrochen — es wird erneut versucht.'}
              </p>
            </section>
          )}

          <h2 className="smallcaps text-ink-soft mt-6 mb-2 text-[11px]">
            Angemeldete Kaufleute ({state.players.length})
          </h2>

          {state.players.length === 0 ? (
            <p className="text-ink-faint text-sm italic">Noch niemand am Kai.</p>
          ) : (
            <ul className="stagger space-y-2">
              {state.players.map((p) => {
                const color = PLAYER_COLORS[p.colorIndex % PLAYER_COLORS.length]!
                const here = net === null || online.has(p.id)
                return (
                  <li
                    key={p.id}
                    className="paper-card flex items-center gap-3 rounded-md p-2.5"
                    style={{ borderLeft: `4px solid ${color.ink}` }}
                  >
                    <Portrait traits={p.persona.portrait} size={44} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {p.name}
                        {p.id === state.hostId && (
                          <span className="smallcaps text-ink-faint ml-2 text-[9px]">
                            eröffnet
                          </span>
                        )}
                      </p>
                      <p className="text-ink-soft truncate text-[11px]">{playerLabel(p)}</p>
                    </div>
                    {net && (
                      <span
                        className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                          here ? 'bg-press' : 'bg-ink-faint'
                        }`}
                        title={here ? 'anwesend' : 'abwesend'}
                      />
                    )}
                  </li>
                )
              })}
            </ul>
          )}

          <p className="text-ink-faint mt-4 text-[11px]">
            {state.joinPolicy === 'jederzeit'
              ? 'Nachzügler dürfen auch nach der Ausfahrt noch ein Schiff nehmen.'
              : 'Wer jetzt nicht am Kai steht, fährt nicht mit.'}
            {' · '}
            {state.config.totalRounds} Runden ·{' '}
            {state.config.startingCapital.toLocaleString('de-DE')} Kapital
          </p>

          {notice && <p className="text-rot mt-3 text-center text-sm">{notice}</p>}

          <div className="mt-7 flex items-center justify-between gap-3">
            <button className="btn" onClick={abandon}>
              Verlassen
            </button>
            {isHost ? (
              <button
                className="btn btn-primary"
                disabled={state.players.length < 1}
                onClick={() => dispatch({ type: 'start' })}
              >
                Ausfahrt freigeben
              </button>
            ) : (
              <p className="text-ink-soft text-xs italic">
                Warten auf die Freigabe durch den Eröffner …
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function ShareRow({ code }: { code: string }) {
  const url = `${location.origin}${location.pathname}#partie=${code}`
  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: 'Von Kontinent zu Kontinent', url })
      else await navigator.clipboard.writeText(url)
    } catch {
      /* the code is on screen either way */
    }
  }
  return (
    <button className="btn btn-sm mt-3 text-xs" onClick={share}>
      Einladung teilen
    </button>
  )
}
