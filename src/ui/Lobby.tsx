import { useState } from 'react'
import { Portrait } from './Portrait'
import { StepOptionen } from './Setup'
import { PLAYER_COLORS, playerLabel, useGame } from '@app/store'
import { optionsOf, settingsOf, type GameOptions } from '@app/options'
import { useT } from '@app/locale'

/**
 * The quayside before departure: who has arrived, and the code that brings
 * the others. The host casts off.
 */
export function Lobby() {
  const state = useGame((s) => s.state)!
  const net = useGame((s) => s.net)
  const dispatch = useGame((s) => s.dispatch)
  const leave = useGame((s) => s.leave)
  const reconfigure = useGame((s) => s.reconfigure)
  const notice = useGame((s) => s.notice)
  const { t, render, num, tn } = useT()

  const isHost = net === null || state.hostId === net.playerId
  const online = new Set(net?.online ?? [])

  /*
   * The terms, open for a second look.
   *
   * A table is set before anybody has arrived, which is the worst moment to
   * settle it: the third player turns up and says an hour a pip is a week of
   * waiting, and until now the answer was to open a new table and hand out a
   * new code. Nothing was stopping it — the settings are not in the log, they
   * are the ground the log is replayed on, and while the log holds nothing but
   * arrivals that ground can be moved without anything on it falling over.
   *
   * A draft rather than the settings themselves, because half-changed terms
   * should not be dealt to the other houses on their way through: the form is
   * this device's until it is handed in.
   */
  const [draft, setDraft] = useState<GameOptions | null>(null)
  const change = <K extends keyof GameOptions>(key: K, value: GameOptions[K]) =>
    setDraft((o) => (o ? { ...o, [key]: value } : o))

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
            <p className="smallcaps text-ink-soft text-[10px]">{t('lobby.beforeSailing')}</p>
            <h1 className="display letterpress mt-1 text-3xl italic">{t('lobby.title')}</h1>
            <hr className="rule-double mx-auto mt-4 w-2/3" />
          </header>

          {net && (
            <section className="mt-5 text-center">
              <p className="smallcaps text-ink-soft text-[10px]">{t('lobby.code')}</p>
              <p className="display tnum mt-1 text-5xl tracking-[0.25em]">{net.code}</p>
              <p className="text-ink-soft mt-2 text-xs">{t('lobby.codeNote')}</p>
              <ShareRow code={net.code} />
              <p
                className={`mt-3 text-[11px] ${
                  net.status === 'verbunden' ? 'text-press' : 'text-rot'
                }`}
              >
                {net.status === 'verbunden'
                  ? t('lobby.connected')
                  : net.status === 'verbindet'
                    ? t('lobby.connecting')
                    : t('lobby.disconnected')}
              </p>
            </section>
          )}

          <h2 className="smallcaps text-ink-soft mt-6 mb-2 text-[11px]">
            {t('lobby.registered', { n: state.players.length })}
          </h2>

          {state.players.length === 0 ? (
            <p className="text-ink-faint text-sm italic">{t('lobby.nobodyYet')}</p>
          ) : (
            <ul className="stagger space-y-2">
              {state.players.map((p) => {
                const color = PLAYER_COLORS[p.colorIndex % PLAYER_COLORS.length]!
                const here = net === null || online.has(p.id)
                /*
                 * Which of these houses is the reader's own.
                 *
                 * Nothing said so. Five portraits in five colours read as five
                 * strangers, and the one piece of information the reader wants
                 * first — which line is mine — was the one the register left
                 * out; the colour seal only helps once you already know your
                 * colour, which is what you came here to find out.
                 *
                 * At one device there is no "own": the whole table plays off
                 * this screen, and marking a line would be marking the wrong
                 * one for everybody but its owner.
                 */
                const yours = net !== null && p.id === net.playerId
                return (
                  <li
                    key={p.id}
                    className="paper-card flex items-center gap-3 rounded-md p-2.5"
                    style={{
                      // Wider rule and a wash of the house's own ink: the eye
                      // finds it down the left edge without reading a word.
                      borderLeft: `${yours ? 7 : 4}px solid ${color.ink}`,
                      ...(yours
                        ? { background: `color-mix(in srgb, ${color.ink} 8%, transparent)` }
                        : {}),
                    }}
                  >
                    <Portrait traits={p.persona.portrait} size={44} />
                    <div className="min-w-0 flex-1">
                      <p className="flex items-baseline gap-2 text-sm font-semibold">
                        <span className="truncate">{p.name}</span>
                        {/* Ahead of "eröffnet", because one house can be both
                            and whose house it is outranks who opened it. */}
                        {yours && (
                          <span
                            className="smallcaps shrink-0 text-[9px] font-bold"
                            style={{ color: color.ink }}
                          >
                            {t('lobby.yours')}
                          </span>
                        )}
                        {p.id === state.hostId && (
                          <span className="smallcaps text-ink-faint shrink-0 text-[9px]">
                            {t('lobby.opened')}
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
                        title={t(here ? 'lobby.present' : 'lobby.absent')}
                      />
                    )}
                  </li>
                )
              })}
            </ul>
          )}

          {/*
            How a house gets back in, said before it is needed.

            The dots above are the only sign that somebody is missing, and they
            say nothing about what to do — the person who could act on it is
            not reading this screen at all, because losing the seat is what
            took them off it. So this is written for the table to relay: the
            host reads it and can answer the question when it comes.

            Standing rather than raised when a dot goes dark. A dot goes dark
            for a moment whenever a telephone locks or a train enters a tunnel,
            and an instruction that appeared each time would read as an alarm
            about something that mends itself. Quiet and always there is the
            honest version.

            Only where there are seats to lose: a table played round one
            device has no code, no tokens and nothing to take back.
          */}
          {net && state.players.length > 0 && (
            <p className="text-ink-faint mt-3 text-[11px] leading-snug italic">
              {t('lobby.lostSeatNote')}
            </p>
          )}

          <p className="text-ink-faint mt-4 text-[11px]">
            {t(
              state.joinPolicy === 'jederzeit'
                ? 'lobby.latecomersWelcome'
                : 'lobby.latecomersBarred',
            )}
            {' · '}
            {/* Which figure governs depends on how the ships move, and saying
                "30 Runden" over a table sailing on a clock was a plain
                untruth — one the host can now walk into by changing it here. */}
            {state.config.travel === 'echtzeit'
              ? t('lobby.terms.clock', {
                  season: tn('setup.hours', state.config.realtime.durationHours),
                  pace: t('setup.minutes', { n: state.config.realtime.minutesPerPip }),
                  capital: num(state.config.startingCapital),
                })
              : t('lobby.terms', {
                  n: state.config.totalRounds,
                  capital: num(state.config.startingCapital),
                })}
          </p>

          {isHost && net && !draft && (
            <button
              className="btn mt-4 w-full"
              onClick={() => setDraft(optionsOf(state))}
            >
              {t('lobby.change')}
            </button>
          )}

          {draft && (
            <div className="mt-2">
              <hr className="rule-double mx-auto my-5 w-2/3" />
              <StepOptionen
                options={draft}
                set={change}
                // The form updates two fields at once where one implies the
                // other — fog brings real time with it — and it does that
                // through a setter of its own. Adapted rather than cast: the
                // draft can be put away while the form is open, and a setter
                // that assumed otherwise would be writing to nothing.
                setOptions={(update) =>
                  setDraft((o) =>
                    o ? (typeof update === 'function' ? update(o) : update) : o,
                  )
                }
                withJoinPolicy
                backLabel={t('lobby.discard')}
                nextLabel={t('lobby.apply')}
                onBack={() => setDraft(null)}
                onNext={() => {
                  reconfigure(settingsOf(draft))
                  setDraft(null)
                }}
              />
            </div>
          )}

          {notice && <p className="text-rot mt-3 text-center text-sm">{render(notice)}</p>}

          {/* One decision at a time. With the form open the buttons that
              matter are its own two, and leaving "Ausfahrt freigeben" beside
              them would let the host cast off over a draft he had not handed
              in — the terms he was looking at quietly not the terms he sailed
              under. */}
          {!draft && (
            <div className="mt-7 flex items-center justify-between gap-3">
              {/* Putting the game down, not walking out on it. The seat token
                  stays, which is what keeps the table on the entrance page and
                  what walks the app back in when it is next opened — a table
                  waiting to cast off is the one most worth coming back to.
                  This button used to give the seat up, on the strength of a
                  label that said no such thing; the place to actually give one
                  up is the ✕ beside the table in the list. */}
              <button className="btn" onClick={leave}>
                {t('lobby.leave')}
              </button>
              {isHost ? (
                <button
                  className="btn btn-primary"
                  disabled={state.players.length < 1}
                  onClick={() => dispatch({ type: 'start' })}
                >
                  {t('lobby.castOff')}
                </button>
              ) : (
                <p className="text-ink-soft text-xs italic">{t('lobby.waitingForHost')}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function ShareRow({ code }: { code: string }) {
  const { t } = useT()
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
      {t('lobby.share')}
    </button>
  )
}
