import { useMemo, useState } from 'react'
import { makePersona } from '@engine/persona'
import { Portrait } from './Portrait'
import { hasSavedGame, PLAYER_COLORS, useGame } from '@app/store'
import {
  CAPABILITIES,
  DEFAULT_OPTIONS,
  PACKS,
  type GameOptions,
  type JoinPolicy,
  type Table,
  type Travel,
} from '@app/options'

type Step = 'modus' | 'optionen' | 'tisch' | 'namen'

/**
 * Setup as a short walk, not a form.
 *
 * "Klassisch" is one tap away from the names screen and asks nothing else.
 * "Vollständig" opens the same settings the classic path silently assumes.
 */
export function Setup() {
  const begin = useGame((s) => s.begin)
  const resume = useGame((s) => s.resume)
  const canResume = useMemo(hasSavedGame, [])

  const [step, setStep] = useState<Step>('modus')
  const [options, setOptions] = useState<GameOptions>(DEFAULT_OPTIONS)
  const [names, setNames] = useState<string[]>(['', ''])

  const set = <K extends keyof GameOptions>(key: K, value: GameOptions[K]) =>
    setOptions((o) => ({ ...o, [key]: value }))

  const filled = names.map((n) => n.trim()).filter(Boolean)

  return (
    <div className="board-shell h-full overflow-y-auto">
      <div
        className="mx-auto flex min-h-full w-full max-w-2xl flex-col px-3 py-5 sm:px-6"
        style={{ paddingTop: 'calc(var(--safe-t) + 1.25rem)', paddingBottom: 'calc(var(--safe-b) + 1.5rem)' }}
      >
        <div className="paper anim-rise flex-1 rounded-lg p-5 sm:p-8">
          <header className="text-center">
            <p className="smallcaps text-ink-soft text-[10px]">
              Gesellschaftsspiel um den Import- und Exporthandel
            </p>
            <h1 className="display letterpress mt-2 text-3xl leading-[1.05] italic sm:text-5xl">
              Von Kontinent
              <br />
              zu Kontinent
            </h1>
            <hr className="rule-double mx-auto mt-4 w-2/3" />
          </header>

          {step === 'modus' && (
            <StepModus
              canResume={canResume}
              onResume={() => resume()}
              onJoin={() => {
                setOptions((o) => ({ ...o, table: 'online-beitreten' }))
                setStep('namen')
              }}
              onClassic={() => {
                setOptions({ ...DEFAULT_OPTIONS, mode: 'klassisch', totalRounds: 50 })
                setStep('namen')
              }}
              onFull={() => {
                setOptions((o) => ({ ...o, mode: 'vollstaendig' }))
                setStep('optionen')
              }}
            />
          )}

          {step === 'optionen' && (
            <StepOptionen
              options={options}
              set={set}
              onBack={() => setStep('modus')}
              onNext={() => setStep('tisch')}
            />
          )}

          {step === 'tisch' && (
            <StepTisch
              options={options}
              set={set}
              onBack={() => setStep('optionen')}
              onNext={() => setStep('namen')}
            />
          )}

          {step === 'namen' && (
            <StepNamen
              options={options}
              names={names}
              setNames={setNames}
              onBack={() => setStep(options.mode === 'klassisch' ? 'modus' : 'tisch')}
              onStart={() =>
                begin(filled, {
                  totalRounds: options.totalRounds,
                  startingCapital: options.startingCapital,
                })
              }
            />
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------

function Choice({
  title,
  blurb,
  selected,
  disabled,
  note,
  onClick,
}: {
  title: string
  blurb: string
  selected?: boolean
  disabled?: boolean
  note?: string
  onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`paper-card block w-full rounded-md p-3.5 text-left transition ${
        selected ? 'ring-ink ring-2' : ''
      } ${disabled ? 'opacity-55' : 'hover:-translate-y-0.5 hover:shadow-md'}`}
    >
      <span className="flex items-baseline justify-between gap-2">
        <span className="display text-lg leading-tight">{title}</span>
        {disabled && (
          <span className="smallcaps text-ink-faint shrink-0 text-[9px]">in Vorbereitung</span>
        )}
      </span>
      <span className="text-ink-soft mt-0.5 block text-xs leading-snug">{blurb}</span>
      {disabled && note && (
        <span className="text-ink-faint mt-1.5 block text-[10px] leading-snug italic">{note}</span>
      )}
    </button>
  )
}

function Nav({ onBack, onNext, nextLabel = 'Weiter', nextDisabled }: {
  onBack: () => void
  onNext?: () => void
  nextLabel?: string
  nextDisabled?: boolean
}) {
  return (
    <div className="mt-7 flex items-center justify-between gap-3">
      <button className="btn" onClick={onBack}>
        Zurück
      </button>
      {onNext && (
        <button className="btn btn-primary" onClick={onNext} disabled={nextDisabled}>
          {nextLabel}
        </button>
      )}
    </div>
  )
}

function Legend({ children }: { children: React.ReactNode }) {
  return <h2 className="smallcaps text-ink-soft mt-6 mb-2 text-[11px]">{children}</h2>
}

// ---------------------------------------------------------------------------

function StepModus({
  canResume,
  onResume,
  onClassic,
  onFull,
  onJoin,
}: {
  canResume: boolean
  onResume: () => void
  onClassic: () => void
  onFull: () => void
  onJoin: () => void
}) {
  return (
    <div className="anim-fade">
      <p className="text-ink-soft mx-auto mt-5 max-w-md text-center text-sm leading-relaxed">
        Sie führen ein Handelshaus. Kaufen Sie Waren dort, wo sie wachsen, und setzen Sie sie ab,
        wo sie fehlen.
      </p>

      <Legend>Wie möchten Sie spielen?</Legend>
      <div className="stagger space-y-2.5">
        <Choice
          title="Klassisch"
          blurb="Nach den Originalregeln: gedruckter Spielplan, Würfel, 50 Runden, an einem Gerät. Keine Einstellungen."
          onClick={onClassic}
        />
        <Choice
          title="Vollständig"
          blurb="Spielplan, Fahrtweise, Rundenzahl, Startkapital und Mitspieler selbst bestimmen."
          onClick={onFull}
        />
        <Choice
          title="Partie beitreten"
          blurb="Sie haben einen Code — die Partie ist bereits eingerichtet, Sie tragen nur Ihren Namen ein."
          disabled={!CAPABILITIES['table:online-beitreten']!.ready}
          note={CAPABILITIES['table:online-beitreten']!.note}
          onClick={onJoin}
        />
      </div>

      {canResume && (
        <button className="btn mt-6 w-full" onClick={onResume}>
          Angefangene Partie fortsetzen
        </button>
      )}
    </div>
  )
}

function StepOptionen({
  options,
  set,
  onBack,
  onNext,
}: {
  options: GameOptions
  set: <K extends keyof GameOptions>(k: K, v: GameOptions[K]) => void
  onBack: () => void
  onNext: () => void
}) {
  return (
    <div className="anim-fade">
      <Legend>Spielplan</Legend>
      <div className="space-y-2">
        {PACKS.map((p) => (
          <Choice
            key={p.id}
            title={p.name}
            blurb={p.blurb}
            selected={options.packId === p.id}
            disabled={!p.ready}
            onClick={p.ready ? () => set('packId', p.id) : undefined}
          />
        ))}
      </div>

      <Legend>Fahrtweise</Legend>
      <div className="space-y-2">
        <Choice
          title="Mit Würfel"
          blurb="Ein Wurf, so viele Punkte weit. Wie auf dem Brett."
          selected={options.travel === 'wuerfel'}
          onClick={() => set('travel', 'wuerfel' as Travel)}
        />
        <Choice
          title="In Echtzeit"
          blurb="Schiffe brauchen echte Zeit von Hafen zu Hafen — man schaut zwischendurch vorbei."
          selected={options.travel === 'echtzeit'}
          disabled={!CAPABILITIES['travel:echtzeit']!.ready}
          note={CAPABILITIES['travel:echtzeit']!.note}
        />
      </div>

      <Legend>Dauer</Legend>
      <div className="flex flex-wrap gap-2">
        {[20, 30, 50].map((r) => (
          <button
            key={r}
            className={`btn ${options.totalRounds === r ? 'btn-primary' : ''}`}
            onClick={() => set('totalRounds', r)}
          >
            {r} Runden{r === 50 ? ' (original)' : ''}
          </button>
        ))}
      </div>

      <Legend>Betriebskapital</Legend>
      <div className="flex flex-wrap gap-2">
        {[300_000, 500_000, 800_000].map((c) => (
          <button
            key={c}
            className={`btn tnum ${options.startingCapital === c ? 'btn-primary' : ''}`}
            onClick={() => set('startingCapital', c)}
          >
            {c.toLocaleString('de-DE')}
            {c === 500_000 ? ' (original)' : ''}
          </button>
        ))}
      </div>

      <Nav onBack={onBack} onNext={onNext} />
    </div>
  )
}

function StepTisch({
  options,
  set,
  onBack,
  onNext,
}: {
  options: GameOptions
  set: <K extends keyof GameOptions>(k: K, v: GameOptions[K]) => void
  onBack: () => void
  onNext: () => void
}) {
  return (
    <div className="anim-fade">
      <Legend>Wo wird gespielt?</Legend>
      <div className="space-y-2">
        <Choice
          title="An einem Gerät"
          blurb="Reihum, das Gerät wandert. Braucht keine Verbindung."
          selected={options.table === 'lokal'}
          onClick={() => set('table', 'lokal' as Table)}
        />
        <Choice
          title="Partie eröffnen"
          blurb="Sie eröffnen eine Partie und laden andere mit einem Code dazu."
          selected={options.table === 'online-eroeffnen'}
          disabled={!CAPABILITIES['table:online-eroeffnen']!.ready}
          note={CAPABILITIES['table:online-eroeffnen']!.note}
        />
      </div>
      <p className="text-ink-faint mt-2 text-[11px] italic">
        Einer Partie beitreten können Sie gleich auf der Eingangsseite — dort ist nichts
        einzurichten.
      </p>

      <Legend>Wer darf mitfahren?</Legend>
      <div className="space-y-2">
        <Choice
          title="Nur zu Beginn"
          blurb="Die Mitspieler stehen fest, bevor das erste Schiff ausläuft."
          selected={options.joinPolicy === 'nur-zu-beginn'}
          onClick={() => set('joinPolicy', 'nur-zu-beginn' as JoinPolicy)}
        />
        <Choice
          title="Jederzeit"
          blurb="Späte Ankömmlinge steigen mit eigenem Schiff und vollem Kapital ein."
          selected={options.joinPolicy === 'jederzeit'}
          onClick={() => set('joinPolicy', 'jederzeit' as JoinPolicy)}
        />
      </div>

      <Nav onBack={onBack} onNext={onNext} />
    </div>
  )
}

function StepNamen({
  options,
  names,
  setNames,
  onBack,
  onStart,
}: {
  options: GameOptions
  names: string[]
  setNames: React.Dispatch<React.SetStateAction<string[]>>
  onBack: () => void
  onStart: () => void
}) {
  const setName = (i: number, value: string) =>
    setNames((prev) => prev.map((n, j) => (j === i ? value : n)))
  const ready = names.some((n) => n.trim())

  return (
    <div className="anim-fade">
      <Legend>Die Mitspieler</Legend>
      <div className="stagger grid gap-2.5 sm:grid-cols-2">
        {names.map((name, i) => (
          <TraderSlot
            key={i}
            index={i}
            name={name}
            onChange={(v) => setName(i, v)}
            onRemove={
              names.length > 1 ? () => setNames((p) => p.filter((_, j) => j !== i)) : undefined
            }
          />
        ))}
      </div>

      {names.length < 6 && (
        <button className="btn mt-3 w-full" onClick={() => setNames((p) => [...p, ''])}>
          Weiteren Kaufmann eintragen
        </button>
      )}

      <p className="text-ink-faint mt-5 text-center text-[11px]">
        {options.mode === 'klassisch'
          ? 'Originalregeln · 50 Runden · an einem Gerät'
          : `${options.totalRounds} Runden · ${options.startingCapital.toLocaleString('de-DE')} Kapital · an einem Gerät`}
      </p>

      <Nav onBack={onBack} onNext={onStart} nextLabel="An Bord gehen" nextDisabled={!ready} />
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
    <div className="paper-card flex items-center gap-3 rounded-md p-3">
      <div className="shrink-0">
        {persona ? (
          <Portrait traits={persona.portrait} size={52} />
        ) : (
          <div className="border-ink-soft/40 grid h-13 w-13 place-items-center rounded-full border border-dashed p-4">
            <span className="text-ink-faint text-xs">?</span>
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <input
          className="focusable placeholder:text-ink-faint border-ink-soft/50 w-full border-0 border-b border-dashed bg-transparent px-0 py-1 text-base outline-none"
          placeholder={`${index + 1}. Kaufmann`}
          value={name}
          maxLength={22}
          onChange={(e) => onChange(e.target.value)}
          aria-label={`Name des ${index + 1}. Kaufmanns`}
        />
        {persona ? (
          <p className="text-ink-soft mt-1 truncate text-[11px]">
            {persona.rank} · {persona.house}
          </p>
        ) : (
          <p className="text-ink-faint mt-1 text-[11px]">Tragen Sie sich ein.</p>
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
            className="text-ink-faint hover:text-rot btn-sm text-xs"
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
