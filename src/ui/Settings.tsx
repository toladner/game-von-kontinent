import { useState } from 'react'
import { Sheet, type SheetSnap } from './Sheet'
import { NotifyCheck } from './NotifyCheck'
import { ShareRow } from './Lobby'
import { StepOptionen } from './Setup'
import { optionsOf, settingsOf, type GameOptions } from '@app/options'
import { useGame, type NetState } from '@app/store'
import type { GameState } from '@engine/state'
import { useLocaleStore, useT } from '@app/locale'
import { LOCALES, LOCALE_NAMES } from '@i18n/locale'

/**
 * The one place that is about the app rather than about the game.
 *
 * Everything here was previously either unreachable or hidden at the bottom of
 * a sheet about something else. Meldungen could only be answered once, on the
 * names screen, and never revisited. Leaving a game meant finding the red
 * button under the round track. And there was no way at all to go back to the
 * title page without giving the game up — which mattered enormously once the
 * app started walking itself back into the last table.
 *
 * The two ways out are deliberately not the same button. Leaving keeps the
 * seat and the save; abandoning throws both away. A player who wants the first
 * and gets the second has lost a game, so they are worded and weighted apart.
 */
export function SettingsSheet({
  state,
  net,
  snap,
  onSnap,
  onLeave,
  onAbandon,
}: {
  state: GameState
  net: NetState | null
  snap: SheetSnap
  onSnap: (s: SheetSnap) => void
  onLeave: () => void
  onAbandon: () => void
}) {
  const { t } = useT()
  const [confirming, setConfirming] = useState(false)
  const [draft, setDraft] = useState<GameOptions | null>(null)
  const reconfigure = useGame((s) => s.reconfigure)
  const realtime = state.config.travel === 'echtzeit'
  const isHost = net !== null && net.playerId === state.hostId

  return (
    <Sheet snap={snap} onSnap={onSnap} title={t('settings.title')} subtitle={t('settings.subtitle')}>
      <Group title={t('ui.language')}>
        <LanguagePicker />
        <p className="text-ink-faint mt-1.5 text-[12px] leading-snug">{t('ui.language.note')}</p>
      </Group>

      <Group title={t('settings.notices')}>
        <p className="text-ink-soft text-[12px] leading-snug">
          {t(realtime ? 'settings.notices.realtime' : 'settings.notices.dice')}
        </p>
        <NotifyCheck />
      </Group>

      <Group title={t('settings.game')}>
        {net ? (
          <>
            <dl className="teletype space-y-1 text-[13px]">
              <Row label={t('settings.table')} value={net.code} />
              <Row
                label={t('settings.line')}
                value={t(
                  net.status === 'verbunden'
                    ? 'settings.line.up'
                    : net.status === 'verbindet'
                      ? 'settings.line.connecting'
                      : 'settings.line.down',
                )}
              />
              <Row
                label={t('settings.atTable')}
                value={`${net.online.length} ${t('ui.of')} ${state.players.length}`}
              />
            </dl>
            <ShareRow code={net.code} />
          </>
        ) : (
          <p className="text-ink-soft text-[12px] leading-snug">{t('settings.local')}</p>
        )}
      </Group>

      {/*
        Changing a term after the ships have sailed.

        This used to be the lobby's business alone, on the sound reasoning
        that a table already at sea cannot have its rules moved under it. But
        the reasoning proves less than it was taken to prove: a term that
        changes what a past action *meant* rewrites the season, and a term
        that only bears on what is still to come does not. The server folds
        the log both ways and compares, so the host may ask and be told —
        which is better than the old answer, which was to refuse a question
        it had never actually looked at.

        Host only, and only at a table played over the wire: at one device
        there is nobody to be surprised by it but the person doing it.
      */}
      {isHost && (
        <Group title={t('settings.terms')}>
          {draft ? (
            <StepOptionen
              options={draft}
              set={(key, value) => setDraft((o) => (o ? { ...o, [key]: value } : o))}
              setOptions={(update) =>
                setDraft((o) => (o ? (typeof update === 'function' ? update(o) : update) : o))
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
          ) : (
            <>
              <button className="btn w-full" onClick={() => setDraft(optionsOf(state))}>
                {t('lobby.change')}
              </button>
              <p className="text-ink-faint mt-1.5 text-[12px] leading-snug">
                {t(state.phase === 'lobby' ? 'settings.terms.hint' : 'settings.terms.sailed')}
              </p>
            </>
          )}
        </Group>
      )}

      <Group title={t('settings.leaving')}>
        <button className="btn w-full" onClick={onLeave}>
          {t('settings.toTitle')}
        </button>
        <p className="text-ink-faint mt-1.5 text-[12px] leading-snug">
          {t(net ? 'settings.leave.net' : 'settings.leave.local')}
        </p>

        {confirming ? (
          <button className="btn btn-danger mt-4 w-full" onClick={onAbandon}>
            {t('settings.abandon.confirm')}
          </button>
        ) : (
          <button className="btn btn-danger mt-4 w-full" onClick={() => setConfirming(true)}>
            {t('settings.abandon')}
          </button>
        )}
        <p className="text-ink-faint mt-1.5 text-[12px] leading-snug">
          {t(net ? 'settings.abandon.net' : 'settings.abandon.local')}
        </p>
      </Group>
    </Sheet>
  )
}

/**
 * Two languages, side by side, each written in its own.
 *
 * A picker that says "German / English" in whichever language is currently
 * wrong is no use to the person who needs it most — somebody who has opened
 * the app and cannot read it. "Deutsch" and "English" are legible to their
 * own speakers whatever the app is currently set to, so neither is ever
 * looking for a word they do not know.
 */
export function LanguagePicker() {
  const locale = useLocaleStore((s) => s.locale)
  const setLocale = useLocaleStore((s) => s.setLocale)

  return (
    <div className="flex gap-2" role="group" aria-label={LOCALE_NAMES[locale]}>
      {LOCALES.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={option === locale}
          onClick={() => setLocale(option)}
          className={`btn flex-1 text-sm ${option === locale ? 'btn-primary' : ''}`}
          lang={option}
        >
          {LOCALE_NAMES[option]}
        </button>
      ))}
    </div>
  )
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6 first:mt-0">
      <h3 className="smallcaps text-ink-soft mb-2 text-[11px] tracking-[0.2em]">{title}</h3>
      {children}
    </section>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="smallcaps text-ink-soft">{label}</dt>
      <dd className="tnum font-bold">{value}</dd>
    </div>
  )
}
