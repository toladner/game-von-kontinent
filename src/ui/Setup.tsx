import { useEffect, useMemo, useState } from 'react'
import { makePersona, type Gender } from '@engine/persona'
import type { Seat } from '@engine/setup'
import { Portrait } from './Portrait'
import { hasSavedGame, PLAYER_COLORS, useGame } from '@app/store'
import {
  CAPABILITIES,
  DEFAULT_OPTIONS,
  PACKS,
  type GameOptions,
  type JoinPolicy,
  type Sicht,
  type Angebot,
  type Preise,
  type Table,
  type Travel,
} from '@app/options'

type Step = 'modus' | 'optionen' | 'tisch' | 'namen' | 'beitreten'

/**
 * A row on the names screen. `gender` stays undefined until someone taps the
 * ♀/♂ switch — until then the name itself decides, which is what keeps the
 * zero-friction path to one field and one button.
 */
interface Trader {
  readonly name: string
  readonly gender?: Gender
}

/**
 * Setup as a short walk, not a form.
 *
 * "Klassisch" is one tap from the names screen. "Vollständig" opens the same
 * settings the classic path silently assumes. Joining skips all of it — the
 * host already decided.
 */
export function Setup() {
  const begin = useGame((s) => s.begin)
  const host = useGame((s) => s.host)
  const join = useGame((s) => s.join)
  const resume = useGame((s) => s.resume)
  const canResume = useMemo(hasSavedGame, [])

  const [step, setStep] = useState<Step>('modus')
  const [options, setOptions] = useState<GameOptions>(DEFAULT_OPTIONS)
  const [names, setNames] = useState<Trader[]>([{ name: '' }, { name: '' }])
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  // An invitation link drops you straight on the join screen.
  const invited = useMemo(() => {
    const m = location.hash.match(/partie=([A-Za-z0-9]{3,8})/)
    return m ? m[1]!.toUpperCase() : ''
  }, [])
  useEffect(() => {
    if (invited) setStep('beitreten')
  }, [invited])

  const set = <K extends keyof GameOptions>(key: K, value: GameOptions[K]) =>
    setOptions((o) => ({ ...o, [key]: value }))

  const filled: Seat[] = names
    .map((t) => ({ ...t, name: t.name.trim() }))
    .filter((t) => t.name)

  const startGame = async () => {
    setProblem(null)
    if (options.table === 'online-eroeffnen') {
      setBusy(true)
      try {
        await host(filled[0] ?? { name: 'Handelshaus' }, {
          totalRounds: options.totalRounds,
          startingCapital: options.startingCapital,
          joinPolicy: options.joinPolicy,
          travel: options.travel === 'echtzeit' ? 'echtzeit' : 'runde',
          sicht: options.sicht,
          minutesPerPip: options.minutesPerPip,
          durationHours: options.durationHours,
          maxFleetSize: options.fleetLimit,
          angebot: options.angebot,
          preise: options.preise,
        })
      } catch (error) {
        setProblem(
          error instanceof Error ? error.message : 'Die Partie ließ sich nicht eröffnen.',
        )
      } finally {
        setBusy(false)
      }
      return
    }
    begin(filled, {
      totalRounds: options.totalRounds,
      startingCapital: options.startingCapital,
      travel: options.travel === 'echtzeit' ? 'echtzeit' : 'runde',
      sicht: options.sicht,
      minutesPerPip: options.minutesPerPip,
      durationHours: options.durationHours,
      maxFleetSize: options.fleetLimit,
      angebot: options.angebot,
      preise: options.preise,
    })
  }

  return (
    <div className="board-shell h-full overflow-y-auto">
      <div
        className="mx-auto flex min-h-full w-full max-w-2xl flex-col px-3 py-5 sm:px-6"
        style={{
          paddingTop: 'calc(var(--safe-t) + 1.25rem)',
          paddingBottom: 'calc(var(--safe-b) + 1.5rem)',
        }}
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
              onClassic={() => {
                setOptions({ ...DEFAULT_OPTIONS, mode: 'klassisch', totalRounds: 50 })
                setStep('namen')
              }}
              onFull={() => {
                setOptions((o) => ({ ...o, mode: 'vollstaendig' }))
                setStep('optionen')
              }}
              onJoin={() => setStep('beitreten')}
            />
          )}

          {step === 'optionen' && (
            <StepOptionen
              options={options}
              set={set}
              setOptions={setOptions}
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
              busy={busy}
              problem={problem}
              onBack={() => setStep(options.mode === 'klassisch' ? 'modus' : 'tisch')}
              onStart={() => void startGame()}
            />
          )}

          {step === 'beitreten' && (
            <StepBeitreten
              initialCode={invited}
              onBack={() => setStep('modus')}
              onJoin={(code, trader) => join(code, trader.name, trader.gender)}
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

/** A slider with the value read off above it. */
function Slider({
  label,
  value,
  min,
  max,
  step,
  format,
  hint,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  format: (v: number) => string
  hint?: string
  onChange: (v: number) => void
}) {
  return (
    <div className="paper-card rounded-md px-3.5 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="smallcaps text-ink-soft text-[11px]">{label}</span>
        <span className="tnum display text-xl">{format(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="accent-press mt-2 w-full"
        aria-label={label}
      />
      <div className="text-ink-faint flex justify-between text-[10px]">
        <span>{format(min)}</span>
        {hint && <span className="italic">{hint}</span>}
        <span>{format(max)}</span>
      </div>
    </div>
  )
}

function Nav({
  onBack,
  onNext,
  nextLabel = 'Weiter',
  nextDisabled,
}: {
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

/** Turns a pace in minutes into something a person can picture. */
function paceHint(minutesPerPip: number): string {
  // The Atlantic runs to roughly a dozen pips on the classic plan.
  const crossing = minutesPerPip * 12
  if (crossing < 60) return `Atlantik in ${crossing} Min`
  const hours = Math.round((crossing / 60) * 10) / 10
  return `Atlantik in ${hours} Std`
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
          blurb="Nach den Originalregeln: gedruckter Spielplan, Würfel, 50 Runden, an einem Gerät."
          onClick={onClassic}
        />
        <Choice
          title="Vollständig"
          blurb="Spielplan, Fahrtweise, Dauer, Kapital und Mitspieler selbst bestimmen — auch über mehrere Geräte."
          onClick={onFull}
        />
        <Choice
          title="Partie beitreten"
          blurb="Sie haben einen Code — die Partie ist eingerichtet, Sie tragen nur Ihren Namen ein."
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
  setOptions,
  onBack,
  onNext,
}: {
  options: GameOptions
  set: <K extends keyof GameOptions>(k: K, v: GameOptions[K]) => void
  setOptions: React.Dispatch<React.SetStateAction<GameOptions>>
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
          onClick={() => setOptions((o) => ({ ...o, travel: 'wuerfel', sicht: 'normal' }))}
        />
        <Choice
          title="In Echtzeit"
          blurb="Schiffe brauchen echte Zeit von Hafen zu Hafen. Kurs setzen, weggehen, später nachsehen — auch wenn niemand zuschaut, fahren die Schiffe weiter."
          selected={options.travel === 'echtzeit'}
          disabled={!CAPABILITIES['travel:echtzeit']!.ready}
          note={CAPABILITIES['travel:echtzeit']!.note}
          onClick={() => set('travel', 'echtzeit' as Travel)}
        />
      </div>

      <Legend>Sicht</Legend>
      <div className="space-y-2">
        <Choice
          title="Normal"
          blurb="Sie sehen jederzeit, wo jedes Fahrzeug steht, und Befehle wirken sofort."
          selected={options.sicht === 'normal'}
          onClick={() => set('sicht', 'normal' as Sicht)}
        />
        <Choice
          title="Realistisch"
          blurb="Sie wissen nur, wo Sie selbst sind. Befehle an entfernte Kapitäne gehen per Brieftaube — ob sie ankommt, erfahren Sie nie. Braucht Echtzeitfahrt."
          selected={options.sicht === 'realistisch'}
          disabled={!CAPABILITIES['sicht:realistisch']!.ready}
          note={CAPABILITIES['sicht:realistisch']!.note}
          onClick={() => {
            // Fog only means anything once ships take real time to arrive —
            // and once there is a captain elsewhere to lose sight of.
            setOptions((o) => ({
              ...o,
              sicht: 'realistisch',
              travel: 'echtzeit',
              fleetLimit: Math.max(o.fleetLimit, 2),
            }))
          }}
        />
      </div>

      <Legend>Der Markt</Legend>
      <div className="space-y-2">
        <Choice
          title="Angebot: fest"
          blurb="Jeder Hafen führt aus, was im Warenverzeichnis steht. So ist der Plan gedruckt."
          selected={options.angebot === 'fest'}
          onClick={() => set('angebot', 'fest' as Angebot)}
        />
        <Choice
          title="Angebot: zufällig"
          blurb="Die Handelswege werden zu Spielbeginn neu ausgelost. Jeder Hafen behält seine Größe, aber niemand weiß mehr auswendig, wo der Kaffee liegt."
          selected={options.angebot === 'zufaellig'}
          onClick={() => set('angebot', 'zufaellig' as Angebot)}
        />
      </div>

      <div className="mt-3 space-y-2">
        <Choice
          title="Preise: fest"
          blurb="Ein Verkaufspreis je Ware, überall auf der Welt derselbe."
          selected={options.preise === 'fest'}
          onClick={() => set('preise', 'fest' as Preise)}
        />
        <Choice
          title="Preise: nach Entfernung"
          blurb="Je weiter eine Ware vom nächsten Hafen entfernt ist, der sie selbst ausführt, desto mehr bringt sie. Kurze Wege lohnen dann nicht mehr — die weite Fahrt zahlt sich aus."
          selected={options.preise === 'entfernung'}
          onClick={() => set('preise', 'entfernung' as Preise)}
        />
      </div>

      <Legend>Reederei</Legend>
      <div className="space-y-2.5">
        <Slider
          label="Schiffe je Haus"
          value={options.fleetLimit}
          min={1}
          max={4}
          step={1}
          hint={
            options.fleetLimit === 1
              ? 'wie im Original — keine Werft'
              : 'Werften verkaufen; ein zweites Schiff kostet ein halbes Vermögen'
          }
          format={(v) => String(v)}
          onChange={(v) => set('fleetLimit', v)}
        />
      </div>

      <Legend>Dauer und Kapital</Legend>
      <div className="space-y-2.5">
        {options.travel === 'echtzeit' ? (
          <>
            <Slider
              label="Fahrzeit je Punkt"
              value={options.minutesPerPip}
              min={1}
              max={60}
              step={1}
              hint={paceHint(options.minutesPerPip)}
              format={(v) => `${v} Min`}
              onChange={(v) => set('minutesPerPip', v)}
            />
            <Slider
              label="Länge der Saison"
              value={options.durationHours}
              min={1}
              max={168}
              step={1}
              hint={
                options.durationHours >= 168
                  ? 'eine Woche'
                  : options.durationHours >= 24
                    ? `${Math.round(options.durationHours / 24)} Tage`
                    : undefined
              }
              format={(v) => `${v} Std`}
              onChange={(v) => set('durationHours', v)}
            />
          </>
        ) : (
          <Slider
            label="Runden"
            value={options.totalRounds}
            min={10}
            max={80}
            step={5}
            hint={options.totalRounds === 50 ? 'wie im Original' : undefined}
            format={(v) => String(v)}
            onChange={(v) => set('totalRounds', v)}
          />
        )}
        <Slider
          label="Betriebskapital"
          value={options.startingCapital}
          min={100_000}
          max={2_000_000}
          step={50_000}
          hint={options.startingCapital === 500_000 ? 'wie im Original' : undefined}
          format={(v) => v.toLocaleString('de-DE')}
          onChange={(v) => set('startingCapital', v)}
        />
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
          blurb="Jeder spielt auf seinem eigenen Gerät. Sie bekommen einen Code zum Weitergeben."
          selected={options.table === 'online-eroeffnen'}
          disabled={!CAPABILITIES['table:online-eroeffnen']!.ready}
          note={CAPABILITIES['table:online-eroeffnen']!.note}
          onClick={() => set('table', 'online-eroeffnen' as Table)}
        />
      </div>
      <p className="text-ink-faint mt-2 text-[11px] italic">
        Einer Partie beitreten können Sie gleich auf der Eingangsseite — dort ist nichts
        einzurichten.
      </p>

      {options.table === 'online-eroeffnen' && (
        <>
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
        </>
      )}

      <Nav onBack={onBack} onNext={onNext} />
    </div>
  )
}

function StepNamen({
  options,
  names,
  setNames,
  busy,
  problem,
  onBack,
  onStart,
}: {
  options: GameOptions
  names: Trader[]
  setNames: React.Dispatch<React.SetStateAction<Trader[]>>
  busy: boolean
  problem: string | null
  onBack: () => void
  onStart: () => void
}) {
  const online = options.table === 'online-eroeffnen'
  const setTrader = (i: number, value: Trader) =>
    setNames((prev) => prev.map((t, j) => (j === i ? value : t)))
  const ready = names.some((t) => t.name.trim())
  const slots = online ? names.slice(0, 1) : names

  return (
    <div className="anim-fade">
      <Legend>{online ? 'Ihr Name' : 'Die Mitspieler'}</Legend>
      <div className="stagger grid gap-2.5 sm:grid-cols-2">
        {slots.map((trader, i) => (
          <TraderSlot
            key={i}
            index={i}
            trader={trader}
            onChange={(v) => setTrader(i, v)}
            onRemove={
              !online && names.length > 1
                ? () => setNames((p) => p.filter((_, j) => j !== i))
                : undefined
            }
          />
        ))}
      </div>

      {!online && names.length < 6 && (
        <button className="btn mt-3 w-full" onClick={() => setNames((p) => [...p, { name: '' }])}>
          Noch jemanden eintragen
        </button>
      )}

      {online && (
        <p className="text-ink-soft mt-3 text-center text-xs">
          Die anderen tragen sich selbst ein, sobald sie den Code haben.
        </p>
      )}

      <p className="text-ink-faint mt-5 text-center text-[11px]">
        {options.mode === 'klassisch'
          ? 'Originalregeln · 50 Runden · an einem Gerät'
          : [
              options.travel === 'echtzeit'
                ? `Echtzeit · ${options.minutesPerPip} Min je Punkt · ${options.durationHours} Std Saison`
                : `${options.totalRounds} Runden`,
              `${options.startingCapital.toLocaleString('de-DE')} Kapital`,
              online ? 'eigene Geräte' : 'ein Gerät',
            ].join(' · ')}
      </p>

      {problem && <p className="text-rot mt-3 text-center text-sm">{problem}</p>}

      <Nav
        onBack={onBack}
        onNext={onStart}
        nextLabel={busy ? 'Einen Augenblick …' : online ? 'Partie eröffnen' : 'An Bord gehen'}
        nextDisabled={!ready || busy}
      />
    </div>
  )
}

function StepBeitreten({
  initialCode,
  onBack,
  onJoin,
}: {
  initialCode: string
  onBack: () => void
  onJoin: (code: string, trader: Trader) => void
}) {
  const [code, setCode] = useState(initialCode)
  const [trader, setTrader] = useState<Trader>({ name: '' })
  const clean = code.trim().toUpperCase()
  const ready = clean.length >= 3 && trader.name.trim().length > 0

  return (
    <div className="anim-fade">
      <Legend>Code der Partie</Legend>
      <input
        className="focusable paper-card tnum display w-full rounded-md px-3 py-3 text-center text-3xl tracking-[0.3em] uppercase outline-none"
        value={code}
        maxLength={8}
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
        placeholder="ABCD"
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        aria-label="Code der Partie"
      />

      <Legend>Ihr Name</Legend>
      <TraderSlot index={0} trader={trader} onChange={setTrader} />

      <Nav
        onBack={onBack}
        onNext={() => onJoin(clean, { ...trader, name: trader.name.trim() })}
        nextLabel="Beitreten"
        nextDisabled={!ready}
      />
    </div>
  )
}

function TraderSlot({
  index,
  trader,
  onChange,
  onRemove,
}: {
  index: number
  trader: Trader
  onChange: (v: Trader) => void
  onRemove?: () => void
}) {
  const trimmed = trader.name.trim()
  const persona = useMemo(
    () => (trimmed ? makePersona(trimmed, 'classic', trader.gender) : null),
    [trimmed, trader.gender],
  )
  const color = PLAYER_COLORS[index % PLAYER_COLORS.length]!
  // A Kaufmann unless someone says otherwise, and shown as such from the
  // start — so the switch never moves on its own while a name is typed.
  const chosen = persona?.gender ?? trader.gender ?? 'm'

  return (
    <div className="paper-card relative flex items-center gap-3 rounded-md p-3">
      {/* Bildnis mit dem Farbsiegel des Hauses */}
      <div className="relative shrink-0">
        {/* Der Schlüssel wechselt nur beim ersten Buchstaben, nicht bei
            jedem — das Bildnis blendet einmal auf und zappelt nicht. */}
        <div key={persona ? 'wer' : 'niemand'} className="anim-fade grid h-13 w-13 place-items-center">
          {persona ? (
            <Portrait traits={persona.portrait} size={52} />
          ) : (
            <div className="border-ink-soft/40 grid h-12 w-12 place-items-center rounded-full border border-dashed">
              <span className="text-ink-faint text-xs">?</span>
            </div>
          )}
        </div>
        <span
          className="border-paper absolute right-0 bottom-0 block h-3.5 w-3.5 rounded-full border-2 shadow-[0_0_0_1px_rgb(0_0_0/0.25)]"
          style={{ background: color.ink }}
          title={color.name}
        />
      </div>

      <div className="min-w-0 flex-1">
        <input
          className="focusable placeholder:text-ink-faint border-ink-soft/50 w-full border-0 border-b border-dashed bg-transparent py-1 pr-6 pl-0 text-base outline-none"
          placeholder={`${index + 1}. Name`}
          value={trader.name}
          maxLength={22}
          onChange={(e) => onChange({ ...trader, name: e.target.value })}
          aria-label={`Name der ${index + 1}. Person`}
        />

        <div className="mt-1.5 flex items-center gap-2">
          <p className="min-w-0 flex-1 truncate text-[11px] leading-tight">
            {persona ? (
              <span className="smallcaps text-ink-soft">Spieler {index + 1}</span>
            ) : (
              <span className="text-ink-faint italic">Tragen Sie sich ein.</span>
            )}
          </p>

          {/* Immer da, damit beim Tippen nichts aufspringt — nur blasser,
              solange noch niemand eingetragen ist. */}
          <div
            className={`flex shrink-0 overflow-hidden rounded-sm border border-black/20 transition-opacity duration-300 ${
              persona ? 'opacity-100' : 'opacity-40'
            }`}
            role="group"
            aria-label="Kauffrau oder Kaufmann"
          >
            {(['w', 'm'] as const).map((g) => (
              <button
                key={g}
                className={`btn-sm px-2 py-0.5 text-[12px] leading-none transition-colors ${
                  chosen === g
                    ? 'bg-ink/85 text-paper'
                    : 'text-ink-soft hover:bg-black/5'
                }`}
                aria-pressed={chosen === g}
                aria-label={g === 'w' ? 'Kauffrau' : 'Kaufmann'}
                onClick={() => onChange({ ...trader, gender: g })}
              >
                {g === 'w' ? '♀' : '♂'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {onRemove && (
        <button
          className="text-ink-faint hover:text-rot btn-sm absolute top-1.5 right-1.5 px-1 text-xs leading-none"
          onClick={onRemove}
          aria-label="Streichen"
        >
          ✕
        </button>
      )}
    </div>
  )
}
