import { useEffect, useMemo, useRef, useState } from 'react'
import { useT, type Translate } from '@app/locale'
import { LanguagePicker } from './Settings'
import { YourTables } from './YourTables'
import type { KnownTable } from '@app/net'
import { forgetSeat, hasSeatAt, tableInfo, type TableLookup, type TableSeat } from '@app/net'
import { makePersona, type Gender } from '@engine/persona'
import { MAX_PLAYERS } from '@engine/reducer'
import type { Seat } from '@engine/setup'
import { NotifyCheck } from './NotifyCheck'
import { Portrait } from './Portrait'
import { hasSavedGame, PLAYER_COLORS, useGame } from '@app/store'
import {
  CAPABILITIES,
  DEFAULT_OPTIONS,
  isReady,
  PACKS,
  type GameOptions,
  type JoinPolicy,
  type Sicht,
  type Angebot,
  type Preise,
  type Konjunktur,
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
 * "Klassisch" is one tap from the names screen. "Erweitert" opens the same
 * settings the classic path silently assumes. Joining skips all of it — the
 * host already decided.
 */
export function Setup() {
  const { t } = useT()
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
          packId: options.packId,
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
          konjunktur: options.konjunktur,
        })
      } catch (error) {
        setProblem(
          error instanceof Error ? error.message : t('setup.couldNotOpen'),
        )
      } finally {
        setBusy(false)
      }
      return
    }
    begin(filled, {
      packId: options.packId,
      totalRounds: options.totalRounds,
      startingCapital: options.startingCapital,
      travel: options.travel === 'echtzeit' ? 'echtzeit' : 'runde',
      sicht: options.sicht,
      minutesPerPip: options.minutesPerPip,
      durationHours: options.durationHours,
      maxFleetSize: options.fleetLimit,
      angebot: options.angebot,
      preise: options.preise,
      konjunktur: options.konjunktur,
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
            <p className="smallcaps text-ink-soft text-[10px]">{t('setup.tagline')}</p>
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
              // The seat is already held, so there is no name to ask for and no
              // code to type: this is the join the code box performs, with
              // both halves already known.
              onOpenTable={(table) => join(table.code, table.name, table.gender)}
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
  note?: string | null
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
        {disabled && <InPreparation />}
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
    <div className="px-3.5 py-3">
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

/**
 * A group of related settings on one sheet of paper.
 *
 * The options page had grown to fourteen full-width cards in a flat list, so
 * every setting shouted as loudly as every other and the eye had nothing to
 * hold on to. Grouping them under headings and putting the group on one card
 * is what turns a list into a form.
 */
function Section({
  title,
  hint,
  children,
}: {
  title: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <section className="mt-7 first:mt-0">
      <h2 className="smallcaps text-ink-soft mb-1 text-[11px] tracking-[0.2em]">{title}</h2>
      {hint && <p className="text-ink-faint mb-2 text-[12px] leading-snug">{hint}</p>}
      <div className="paper-card divide-y divide-black/10 rounded-md">{children}</div>
    </section>
  )
}

/**
 * One setting: what it is called, the control, and a line on what it does.
 *
 * The explanation stays — it is the reason the long cards existed — but it
 * sits under the control as a note rather than being the size of a headline.
 */
function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="px-3.5 py-3">
      <div className="flex items-center justify-between gap-3">
        <span className="smallcaps text-ink-soft shrink-0 text-[11px]">{label}</span>
        {children}
      </div>
      {hint && <p className="text-ink-faint mt-1.5 text-[12px] leading-snug">{hint}</p>}
    </div>
  )
}

export interface DropdownOption<T extends string> {
  readonly id: T
  readonly label: string
  /** Shown under the control once chosen, so the choice explains itself. */
  readonly hint?: string
  readonly disabled?: boolean
}

/**
 * A dropdown that can explain itself.
 *
 * This began as a native `<select>`, which is the right instinct — it already
 * knows how to be a wheel on a phone and a listbox on a desktop. But an
 * `<option>` may only ever hold one line of plain text in the browser's own
 * font, and these settings need a sentence apiece in the Kontor's face. That
 * is the one thing native cannot do, so it is rebuilt: a button, a popover
 * listbox, and the keyboard handling that a select would have given free.
 *
 * Closes on Escape, on a click outside, and on choosing. Arrow keys and
 * Home/End walk the list, because a control that traps a keyboard user is
 * worse than a plain select with no descriptions at all.
 */
function Dropdown<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T
  options: readonly DropdownOption<T>[]
  onChange: (value: T) => void
  label: string
}) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(() => Math.max(0, options.findIndex((o) => o.id === value)))
  const root = useRef<HTMLDivElement>(null)
  const chosen = options.find((o) => o.id === value)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const pick = (option: DropdownOption<T>) => {
    if (option.disabled) return
    onChange(option.id)
    setOpen(false)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') return setOpen(false)
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault()
      setActive(Math.max(0, options.findIndex((o) => o.id === value)))
      return setOpen(true)
    }
    if (!open) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => Math.min(options.length - 1, i + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(0, i - 1))
    } else if (e.key === 'Home') {
      e.preventDefault()
      setActive(0)
    } else if (e.key === 'End') {
      e.preventDefault()
      setActive(options.length - 1)
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      const option = options[active]
      if (option) pick(option)
    }
  }

  return (
    <div ref={root} className="relative min-w-0 flex-1">
      <button
        type="button"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={onKeyDown}
        className="focusable border-ink/25 bg-paper flex w-full items-center justify-between gap-2 rounded-[2px] border px-2.5 py-1.5 text-left"
      >
        <span className="smallcaps min-w-0 flex-1 truncate text-[13px] font-bold">
          {chosen?.label ?? value}
        </span>
        <span
          className={`text-ink-soft shrink-0 text-[9px] transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden
        >
          ▼
        </span>
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label={label}
          tabIndex={-1}
          onKeyDown={onKeyDown}
          className="paper anim-fade absolute right-0 left-0 z-30 mt-1 max-h-[19rem] overflow-y-auto rounded-md py-1 shadow-xl"
        >
          {options.map((option, i) => {
            const selected = option.id === value
            return (
              <li key={option.id} role="option" aria-selected={selected}>
                <button
                  type="button"
                  disabled={option.disabled}
                  onClick={() => pick(option)}
                  onMouseEnter={() => setActive(i)}
                  className={`block w-full px-3 py-2 text-left transition ${
                    option.disabled ? 'opacity-45' : i === active ? 'bg-ink/8' : ''
                  }`}
                >
                  <span className="flex items-baseline gap-2">
                    <span
                      className={`smallcaps flex-1 text-[13px] ${selected ? 'font-bold' : 'font-semibold'}`}
                    >
                      {option.label}
                    </span>
                    {/* Ein blasser Eintrag ohne Grund ist nur rätselhaft. */}
                    {option.disabled && <InPreparation />}
                    {selected && (
                      <span className="text-press shrink-0 text-[12px]" aria-hidden>
                        ✓
                      </span>
                    )}
                  </span>
                  {option.hint && (
                    <span className="text-ink-soft mt-0.5 block text-[12px] leading-snug">
                      {option.hint}
                    </span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

/** Said in two places, and it is the same badge in both. */
function InPreparation() {
  const { t } = useT()
  return (
    <span className="smallcaps text-ink-faint shrink-0 text-[9px]">
      {t('setup.inPreparation')}
    </span>
  )
}

/** The note belonging to whichever option is currently chosen. */
function hintFor<T extends string>(options: readonly DropdownOption<T>[], value: T): string {
  return options.find((o) => o.id === value)?.hint ?? ''
}

function Nav({
  onBack,
  onNext,
  nextLabel,
  nextDisabled,
}: {
  onBack: () => void
  onNext?: () => void
  nextLabel?: string
  nextDisabled?: boolean
}) {
  const { t } = useT()
  return (
    <div className="mt-7 flex items-center justify-between gap-3">
      <button className="btn" onClick={onBack}>
        {t('setup.back')}
      </button>
      {onNext && (
        <button className="btn btn-primary" onClick={onNext} disabled={nextDisabled}>
          {nextLabel ?? t('setup.next')}
        </button>
      )}
    </div>
  )
}

/*
 * What each setting offers, and what choosing it means.
 *
 * Kept as data next to the control rather than as prose inside it, so the
 * blurb that used to fill a whole card can sit under the dropdown as one
 * line — and so adding a mode is a row here rather than another card.
 */

const travelOptions = (T: Translate): readonly DropdownOption<Travel>[] => [
  {
    id: 'wuerfel',
    label: T.t('setup.travel.dice'),
    hint: T.t('setup.travel.dice.hint'),
  },
  {
    id: 'echtzeit',
    label: T.t('setup.travel.realtime'),
    hint: T.t('setup.travel.realtime.hint'),
  },
]

const sichtOptions = (T: Translate): readonly DropdownOption<Sicht>[] => [
  {
    id: 'normal',
    label: T.t('setup.sight.normal'),
    hint: T.t('setup.sight.normal.hint'),
  },
  {
    id: 'realistisch',
    label: T.t('setup.sight.realistic'),
    hint: isReady('sicht:realistisch')
      ? T.t('setup.sight.realistic.hint')
      : (CAPABILITIES['sicht:realistisch']!.note?.[T.locale] ?? ''),
    // Fertig genug, um im Verzeichnis zu stehen, nicht fertig genug, um
    // gespielt zu werden — siehe den Eintrag in options.ts.
    disabled: !isReady('sicht:realistisch'),
  },
]

const angebotOptions = (T: Translate): readonly DropdownOption<Angebot>[] => [
  { id: 'fest', label: T.t('setup.supply.fixed'), hint: T.t('setup.supply.fixed.hint') },
  { id: 'zufaellig', label: T.t('setup.supply.random'), hint: T.t('setup.supply.random.hint') },
]

const preiseOptions = (T: Translate): readonly DropdownOption<Preise>[] => [
  { id: 'fest', label: T.t('setup.prices.fixed'), hint: T.t('setup.prices.fixed.hint') },
  {
    id: 'entfernung',
    label: T.t('setup.prices.distance'),
    hint: T.t('setup.prices.distance.hint'),
  },
]

const konjunkturOptions = (T: Translate): readonly DropdownOption<Konjunktur>[] => [
  {
    id: 'klassisch',
    label: T.t('setup.konjunktur.classic'),
    hint: T.t('setup.konjunktur.classic.hint'),
  },
  {
    id: 'erweitert',
    label: T.t('setup.konjunktur.extended'),
    hint: T.t('setup.konjunktur.extended.hint'),
  },
]

/** Turns a pace in minutes into something a person can picture. */
function paceHint(T: Translate, minutesPerPip: number): string {
  // The Atlantic runs to roughly a dozen pips on the classic plan.
  const crossing = minutesPerPip * 12
  if (crossing < 60) return T.t('setup.pace.minutes', { n: crossing })
  return T.t('setup.pace.hours', { n: Math.round((crossing / 60) * 10) / 10 })
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
  onOpenTable,
}: {
  canResume: boolean
  onResume: () => void
  onClassic: () => void
  onFull: () => void
  onJoin: () => void
  /** Straight back into a table this device already has a seat at. */
  onOpenTable: (table: KnownTable) => void
}) {
  const { t } = useT()
  return (
    <div className="anim-fade">
      <p className="text-ink-soft mx-auto mt-5 max-w-md text-center text-sm leading-relaxed">
        {t('setup.premise')}
      </p>

      <Legend>{t('setup.howToPlay')}</Legend>
      <div className="stagger space-y-2.5">
        <Choice
          title={t('setup.classic')}
          blurb={t('setup.classic.blurb')}
          onClick={onClassic}
        />
        <Choice title={t('setup.full')} blurb={t('setup.full.blurb')} onClick={onFull} />

        {/* Die beiden darüber eröffnen eine Partie, die darunter tritt einer
            fremden bei. Ein Strich sagt das schneller als ein Satz — und
            steht in einem eigenen Kästchen, damit space-y ihm Luft läßt,
            statt ihn wie eine weitere Karte anzusetzen. */}
        <div className="py-1.5" aria-hidden>
          <hr className="mx-auto w-2/3 border-t border-black/15" />
        </div>

        <Choice title={t('setup.join')} blurb={t('setup.join.blurb')} onClick={onJoin} />
      </div>

      {/* Directly under the way in by code, because it is the same errand:
          getting back to a table. One of them needs the code typed, the
          other has it already. */}
      <YourTables onOpen={onOpenTable} />

      {canResume && (
        <button className="btn mt-6 w-full" onClick={onResume}>
          {t('setup.resume')}
        </button>
      )}

      {/* Here as well as under Einstellungen, because somebody who opens the
          app in a language they cannot read needs it before there is a game
          to open the settings from. */}
      <div className="mt-8">
        <Legend>{t('ui.language')}</Legend>
        <LanguagePicker />
      </div>
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
  const T = useT()
  const { t, num, locale } = T
  return (
    <div className="anim-fade">
      <Section title={t('setup.section.board')} hint={t('setup.section.board.hint')}>
        <Field
          label={t('setup.field.plan')}
          hint={PACKS.find((p) => p.id === options.packId)?.blurb[locale]}
        >
          <Dropdown
            label={t('setup.field.plan.label')}
            value={options.packId}
            // The blurb rides inside the list too, so the plans can be
            // compared without choosing one to find out what it is.
            options={PACKS.filter((p) => p.ready).map((p) => ({
              id: p.id,
              label: p.name[locale],
              hint: p.blurb[locale],
            }))}
            onChange={(id) => set('packId', id)}
          />
        </Field>
      </Section>

      <Section title={t('setup.section.travel')} hint={t('setup.section.travel.hint')}>
        <Field
          label={t('setup.field.travel')}
          hint={hintFor(travelOptions(T), options.travel)}
        >
          <Dropdown
            label={t('setup.field.travel')}
            value={options.travel}
            options={travelOptions(T)}
            onChange={(travel) =>
              // Fog only means anything once ships take real time to arrive,
              // so going back to dice has to take it with them.
              setOptions((o) => ({
                ...o,
                travel,
                sicht: travel === 'wuerfel' ? 'normal' : o.sicht,
              }))
            }
          />
        </Field>

        <Field label={t('setup.field.sight')} hint={hintFor(sichtOptions(T), options.sicht)}>
          <Dropdown
            label={t('setup.field.sight')}
            value={options.sicht}
            options={sichtOptions(T)}
            onChange={(sicht) =>
              setOptions((o) =>
                sicht === 'realistisch'
                  ? // Nothing to lose sight of without real time and a second
                    // captain, so choosing fog brings both with it.
                    { ...o, sicht, travel: 'echtzeit', fleetLimit: Math.max(o.fleetLimit, 2) }
                  : { ...o, sicht },
              )
            }
          />
        </Field>

        {options.travel === 'echtzeit' ? (
          <>
            <Slider
              label={t('setup.field.pace')}
              value={options.minutesPerPip}
              min={1}
              max={60}
              step={1}
              hint={paceHint(T, options.minutesPerPip)}
              format={(v) => t('setup.minutes', { n: v })}
              onChange={(v) => set('minutesPerPip', v)}
            />
            <Slider
              label={t('setup.field.season')}
              value={options.durationHours}
              min={1}
              max={168}
              step={1}
              hint={
                options.durationHours >= 168
                  ? t('setup.aWeek')
                  : options.durationHours >= 24
                    ? t('setup.days', { n: Math.round(options.durationHours / 24) })
                    : undefined
              }
              format={(v) => t('setup.hours', { n: v })}
              onChange={(v) => set('durationHours', v)}
            />
          </>
        ) : (
          <Slider
            label={t('setup.field.rounds')}
            value={options.totalRounds}
            min={10}
            max={80}
            step={5}
            hint={options.totalRounds === 50 ? t('setup.asPrinted') : undefined}
            format={(v) => String(v)}
            onChange={(v) => set('totalRounds', v)}
          />
        )}
      </Section>

      <Section title={t('setup.section.market')} hint={t('setup.section.market.hint')}>
        <Field label={t('setup.field.supply')} hint={hintFor(angebotOptions(T), options.angebot)}>
          <Dropdown
            label={t('setup.field.supply')}
            value={options.angebot}
            options={angebotOptions(T)}
            onChange={(v) => set('angebot', v)}
          />
        </Field>
        <Field label={t('setup.field.prices')} hint={hintFor(preiseOptions(T), options.preise)}>
          <Dropdown
            label={t('setup.field.prices')}
            value={options.preise}
            options={preiseOptions(T)}
            onChange={(v) => set('preise', v)}
          />
        </Field>
        <Field
          label={t('setup.field.market')}
          hint={hintFor(konjunkturOptions(T), options.konjunktur)}
        >
          <Dropdown
            label={t('setup.field.market')}
            value={options.konjunktur}
            options={konjunkturOptions(T)}
            onChange={(v) => set('konjunktur', v)}
          />
        </Field>
      </Section>

      <Section title={t('setup.section.house')} hint={t('setup.section.house.hint')}>
        <Slider
          label={t('setup.field.capital')}
          value={options.startingCapital}
          min={100_000}
          max={2_000_000}
          step={50_000}
          hint={options.startingCapital === 500_000 ? t('setup.asPrinted') : undefined}
          format={(v) => num(v)}
          onChange={(v) => set('startingCapital', v)}
        />
        <Slider
          label={t('setup.field.ships')}
          value={options.fleetLimit}
          min={1}
          max={4}
          step={1}
          hint={t(options.fleetLimit === 1 ? 'setup.ships.single' : 'setup.ships.fleet')}
          format={(v) => String(v)}
          onChange={(v) => set('fleetLimit', v)}
        />
      </Section>

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
  const { t, locale } = useT()
  return (
    <div className="anim-fade">
      <Legend>{t('setup.whereToPlay')}</Legend>
      <div className="space-y-2">
        <Choice
          title={t('setup.oneDevice')}
          blurb={t('setup.oneDevice.blurb')}
          selected={options.table === 'lokal'}
          onClick={() => set('table', 'lokal' as Table)}
        />
        <Choice
          title={t('setup.openTable')}
          blurb={t('setup.openTable.blurb')}
          selected={options.table === 'online-eroeffnen'}
          disabled={!CAPABILITIES['table:online-eroeffnen']!.ready}
          note={CAPABILITIES['table:online-eroeffnen']!.note?.[locale] ?? null}
          onClick={() => set('table', 'online-eroeffnen' as Table)}
        />
      </div>
      <p className="text-ink-faint mt-2 text-[11px] italic">{t('setup.joinNote')}</p>

      {options.table === 'online-eroeffnen' && (
        <>
          <Legend>{t('setup.whoMaySail')}</Legend>
          <div className="space-y-2">
            <Choice
              title={t('setup.atStartOnly')}
              blurb={t('setup.atStartOnly.blurb')}
              selected={options.joinPolicy === 'nur-zu-beginn'}
              onClick={() => set('joinPolicy', 'nur-zu-beginn' as JoinPolicy)}
            />
            <Choice
              title={t('setup.anyTime')}
              blurb={t('setup.anyTime.blurb')}
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
  const { t, num } = useT()
  const online = options.table === 'online-eroeffnen'
  const setTrader = (i: number, value: Trader) =>
    setNames((prev) => prev.map((t, j) => (j === i ? value : t)))
  const ready = names.some((t) => t.name.trim())
  const slots = online ? names.slice(0, 1) : names

  return (
    <div className="anim-fade">
      <Legend>{t(online ? 'setup.yourName' : 'setup.players')}</Legend>
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

      {!online && names.length < MAX_PLAYERS && (
        <button className="btn mt-3 w-full" onClick={() => setNames((p) => [...p, { name: '' }])}>
          {t('setup.addAnother')}
        </button>
      )}

      {online && (
        <p className="text-ink-soft mt-3 text-center text-xs">
          {t('setup.othersEnterThemselves')}
        </p>
      )}

      {options.travel === 'echtzeit' && <NotifyCheck />}

      <p className="text-ink-faint mt-5 text-center text-[11px]">
        {options.mode === 'klassisch'
          ? t('setup.summary.classic')
          : [
              options.travel === 'echtzeit'
                ? t('setup.summary.realtime', {
                    pace: options.minutesPerPip,
                    hours: options.durationHours,
                  })
                : t('setup.summary.rounds', { n: options.totalRounds }),
              t('setup.summary.capital', { amount: num(options.startingCapital) }),
              t(online ? 'setup.summary.ownDevices' : 'setup.summary.oneDevice'),
            ].join(' · ')}
      </p>

      {problem && <p className="text-rot mt-3 text-center text-sm">{problem}</p>}

      <Nav
        onBack={onBack}
        onNext={onStart}
        nextLabel={t(
          busy ? 'setup.oneMoment' : online ? 'setup.openTable' : 'setup.goAboard',
        )}
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
  const { t } = useT()
  const [code, setCode] = useState(initialCode)
  const [trader, setTrader] = useState<Trader>({ name: '' })
  /** Bumped when a seat is given up, so the check below runs again. */
  const [given, setGiven] = useState(0)
  const clean = code.trim().toUpperCase()
  const look = useTableAhead(clean)
  const seats = look?.ok ? look.info.players : null

  /**
   * Warum dieser Tisch niemanden mehr aufnimmt — oder null, wenn er es tut.
   *
   * Wer schon einen Platz hat, kehrt zurück statt beizutreten; für ihn gilt
   * weder das volle Haus noch der geschlossene Beitritt.
   */
  const shut =
    look === null || !look.ok
      ? look?.reason === 'unbekannt'
        ? t('setup.noSuchTable')
        : null
      : look.info.players.length >= MAX_PLAYERS
        ? t('setup.tableFull', { n: MAX_PLAYERS })
        : look.info.phase !== 'lobby' && look.info.meta.joinPolicy !== 'jederzeit'
          ? t('setup.tableUnderWay')
          : null

  /*
   * A seat already held at this table.
   *
   * The server recognises the device by its token, not by what is typed, so
   * any name at all used to walk you back into your own house — which looks
   * like the app ignoring you. It is not ignoring you: there is nothing to
   * ask. So it stops asking, and says whose seat it is going back to.
   */
  const known = useMemo(() => (clean.length >= 3 ? hasSeatAt(clean) : false), [clean, given])
  const ready =
    clean.length >= 3 && (known || (trader.name.trim().length > 0 && shut === null))

  return (
    <div className="anim-fade">
      <Legend>{t('setup.tableCode')}</Legend>
      <input
        className="focusable paper-card tnum display w-full rounded-md px-3 py-3 text-center text-3xl tracking-[0.3em] uppercase outline-none"
        value={code}
        maxLength={8}
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
        placeholder="ABCD"
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        aria-label={t('setup.tableCode')}
      />

      {seats && <TableAhead seats={seats} />}

      {known ? (
        <div className="paper-card mt-4 rounded-md px-3.5 py-3">
          <p className="text-[13px] leading-tight font-semibold">{t('setup.haveSeat')}</p>
          <p className="text-ink-faint mt-0.5 text-[12px] leading-snug">
            {t('setup.haveSeat.note')}
          </p>
          <button
            className="btn btn-sm mt-2.5"
            onClick={() => {
              forgetSeat(clean)
              setGiven((n) => n + 1)
            }}
          >
            {t('setup.giveUpSeat')}
          </button>
        </div>
      ) : (
        <>
          <Legend>{t('setup.yourName')}</Legend>
          {/* Der Platz, den der Server wirklich vergeben wird: die Farben gehen
              in der Reihenfolge des Beitritts hinaus, der nächste freie ist
              also genau der hinter den schon angemeldeten. Ohne das saß jeder
              Beitretende in der Anmeldung als Spieler 1 in Blau und wurde beim
              Beitreten der Vierte in Ocker. */}
          <TraderSlot index={seats?.length ?? 0} trader={trader} onChange={setTrader} />
        </>
      )}

      {!known && shut && <p className="text-rot mt-3 text-center text-[12px] leading-snug">{shut}</p>}

      <Nav
        onBack={onBack}
        onNext={() => onJoin(clean, { ...trader, name: trader.name.trim() })}
        nextLabel={t(known ? 'setup.backAboard' : 'setup.joinIt')}
        nextDisabled={!ready}
      />
    </div>
  )
}

/** Wie oft die Anmeldung beim Tisch nachfragt, solange sie offen steht. */
const AHEAD_INTERVAL = 4000

/**
 * Der Tisch, an den man sich setzen will, während man den Code tippt.
 *
 * Gefragt wird über dieselbe Auskunft, die auch die Einladung benutzt — kein
 * Platz wird dabei belegt und keine Anwesenheit gemeldet. Sie wird alle paar
 * Sekunden erneuert, damit ein Haus, das sich in der Zwischenzeit einträgt,
 * auch in der Anmeldung erscheint und die eigene Farbe entsprechend wandert.
 */
function useTableAhead(code: string): TableLookup | null {
  const [look, setLook] = useState<TableLookup | null>(null)

  useEffect(() => {
    if (code.length < 3) {
      setLook(null)
      return
    }
    let alive = true
    let timer: ReturnType<typeof setInterval> | null = null
    const ask = async () => {
      const next = await tableInfo(code)
      if (alive) setLook(next)
    }
    // Erst nach einer kurzen Pause fragen: sonst geht für jeden Buchstaben
    // eines vierstelligen Codes eine Anfrage hinaus.
    const first = setTimeout(() => {
      void ask()
      timer = setInterval(() => void ask(), AHEAD_INTERVAL)
    }, 300)
    return () => {
      alive = false
      clearTimeout(first)
      if (timer) clearInterval(timer)
    }
  }, [code])

  return look
}

/** Wer schon am Kai steht, in der Reihenfolge, in der er gekommen ist. */
function TableAhead({ seats }: { seats: readonly TableSeat[] }) {
  const { t } = useT()
  if (seats.length === 0) {
    return (
      <p className="text-ink-faint anim-fade mt-3 text-center text-[12px] italic">
        {t('setup.tableEmpty')}
      </p>
    )
  }
  return (
    <div className="anim-fade mt-4">
      <Legend>{t('setup.alreadyOnQuay', { n: seats.length })}</Legend>
      <ul className="space-y-1.5">
        {seats.map((seat) => {
          const color = PLAYER_COLORS[seat.colorIndex % PLAYER_COLORS.length]!
          return (
            <li
              key={seat.id}
              className="paper-card flex items-center gap-2.5 rounded-md py-1.5 pr-3 pl-2"
              style={{ borderLeft: `4px solid ${color.ink}` }}
            >
              <Portrait traits={seat.portrait} size={30} />
              <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{seat.name}</span>
              <span className="smallcaps text-ink-faint shrink-0 text-[10px]">
                {t('ui.seatNumber', { n: seat.colorIndex + 1 })}
              </span>
            </li>
          )
        })}
      </ul>
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
  const { t, locale } = useT()
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
          title={color.name[locale]}
        />
      </div>

      <div className="min-w-0 flex-1">
        <input
          className="focusable placeholder:text-ink-faint border-ink-soft/50 w-full border-0 border-b border-dashed bg-transparent py-1 pr-6 pl-0 text-base outline-none"
          placeholder={t('setup.nthName', { n: index + 1 })}
          value={trader.name}
          maxLength={22}
          onChange={(e) => onChange({ ...trader, name: e.target.value })}
          aria-label={t('setup.nthNameLabel', { n: index + 1 })}
        />

        <div className="mt-1.5 flex items-center gap-2">
          <p className="min-w-0 flex-1 truncate text-[11px] leading-tight">
            {persona ? (
              <span className="smallcaps text-ink-soft">
                {t('ui.seatNumber', { n: index + 1 })}
              </span>
            ) : (
              <span className="text-ink-faint italic">{t('setup.enterYourself')}</span>
            )}
          </p>

          {/* Immer da, damit beim Tippen nichts aufspringt — nur blasser,
              solange noch niemand eingetragen ist. */}
          <div
            className={`flex shrink-0 overflow-hidden rounded-sm border border-black/20 transition-opacity duration-300 ${
              persona ? 'opacity-100' : 'opacity-40'
            }`}
            role="group"
            aria-label={t('setup.merchantEither')}
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
                aria-label={t(g === 'w' ? 'setup.merchantWoman' : 'setup.merchantMan')}
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
          aria-label={t('setup.strike')}
        >
          ✕
        </button>
      )}
    </div>
  )
}
