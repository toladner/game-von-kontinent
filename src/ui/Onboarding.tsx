import { useMemo, useState } from 'react'
import { makePersona } from '@engine/persona'
import { Portrait } from './Portrait'
import { hasSavedGame, PLAYER_COLORS, useGame } from '@app/store'

/**
 * The whole entry ritual: type a name, watch a trader appear, go aboard.
 * No rulebook, no options wall - two taps from the front page to the first
 * purchase.
 */
export function Onboarding() {
  const begin = useGame((s) => s.begin)
  const resume = useGame((s) => s.resume)
  const [names, setNames] = useState<string[]>(['', ''])
  const [rounds, setRounds] = useState(30)
  const canResume = useMemo(hasSavedGame, [])

  const setName = (i: number, value: string) =>
    setNames((prev) => prev.map((n, j) => (j === i ? value : n)))

  const filled = names.map((n) => n.trim()).filter(Boolean)
  const ready = filled.length >= 1

  return (
    <div className="board-shell flex min-h-full items-start justify-center overflow-y-auto p-4 sm:p-8">
      <div className="paper w-full max-w-3xl rounded-sm p-6 sm:p-10">
        <header className="relative text-center">
          <p className="smallcaps text-ink-soft text-xs">Gesellschaftsspiel um den</p>
          <p className="smallcaps text-ink-soft text-xs">Import- und Exporthandel</p>
          <h1 className="display letterpress mt-3 text-4xl italic sm:text-6xl">
            Von Kontinent
            <br />
            zu Kontinent
          </h1>
          <hr className="rule-double mx-auto mt-5 w-2/3" />
        </header>

        <p className="text-ink-soft mx-auto mt-5 max-w-xl text-center text-sm leading-relaxed">
          Sie führen ein Handelshaus. Die Exportbank kreditiert Ihnen{' '}
          <span className="tnum">500.000</span> Einheiten. Kaufen Sie Waren dort, wo sie wachsen,
          und setzen Sie sie ab, wo sie fehlen. Wer nach der letzten Runde am meisten besitzt,
          gewinnt.
        </p>

        <section className="mt-8">
          <h2 className="smallcaps text-ink-soft mb-3 text-xs">Die Mitspieler</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {names.map((name, i) => (
              <TraderSlot
                key={i}
                index={i}
                name={name}
                onChange={(v) => setName(i, v)}
                onRemove={
                  names.length > 1
                    ? () => setNames((prev) => prev.filter((_, j) => j !== i))
                    : undefined
                }
              />
            ))}
          </div>

          {names.length < 6 && (
            <button className="btn mt-3" onClick={() => setNames((p) => [...p, ''])}>
              Weiteren Kaufmann eintragen
            </button>
          )}
        </section>

        <section className="mt-8">
          <h2 className="smallcaps text-ink-soft mb-3 text-xs">Dauer der Partie</h2>
          <div className="flex flex-wrap gap-2">
            {[20, 30, 50].map((r) => (
              <button
                key={r}
                className={`btn ${rounds === r ? 'btn-primary' : ''}`}
                onClick={() => setRounds(r)}
              >
                {r} Runden
                {r === 50 ? ' (original)' : r === 20 ? ' (kurz)' : ''}
              </button>
            ))}
          </div>
        </section>

        <hr className="rule my-8" />

        <div className="flex flex-wrap items-center justify-between gap-3">
          {canResume ? (
            <button className="btn" onClick={() => resume()}>
              Angefangene Partie fortsetzen
            </button>
          ) : (
            <span />
          )}
          <button
            className="btn btn-primary text-lg"
            disabled={!ready}
            onClick={() => begin(filled, rounds)}
          >
            An Bord gehen
          </button>
        </div>
      </div>
    </div>
  )
}

function TraderSlot({
  index,
  name,
  onChange,
  onRemove,
}: {
  index: number
  name: string
  onChange: (v: string) => void
  onRemove?: () => void
}) {
  const trimmed = name.trim()
  const persona = useMemo(() => (trimmed ? makePersona(trimmed, 'classic') : null), [trimmed])
  const color = PLAYER_COLORS[index % PLAYER_COLORS.length]!

  return (
    <div className="paper-card flex items-center gap-3 rounded-sm p-3">
      <div className="shrink-0">
        {persona ? (
          <Portrait traits={persona.portrait} size={56} />
        ) : (
          <div className="border-ink-soft/40 grid h-14 w-14 place-items-center rounded-full border border-dashed">
            <span className="text-ink-faint text-xs">?</span>
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <input
          className="focusable placeholder:text-ink-faint w-full border-0 border-b border-dashed border-ink-soft/50 bg-transparent px-0 py-1 text-lg outline-none"
          placeholder={`Name des ${index + 1}. Kaufmanns`}
          value={name}
          maxLength={22}
          onChange={(e) => onChange(e.target.value)}
          aria-label={`Name des ${index + 1}. Kaufmanns`}
        />
        {persona ? (
          <p className="text-ink-soft mt-1 truncate text-xs">
            {persona.rank} · {persona.house}
            <br />
            <span className="text-ink-faint">aus {persona.origin}</span>
          </p>
        ) : (
          <p className="text-ink-faint mt-1 text-xs">Tragen Sie sich ins Register ein.</p>
        )}
      </div>

      <div className="flex shrink-0 flex-col items-center gap-1">
        <span
          className="block h-4 w-4 rounded-full border border-black/30"
          style={{ background: color.ink }}
          title={color.name}
        />
        {onRemove && (
          <button
            className="text-ink-faint hover:text-rot text-xs"
            onClick={onRemove}
            aria-label="Streichen"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  )
}
