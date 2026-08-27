import { useState } from 'react'
import { useT } from '@app/locale'
import { askToNotify, notify, notifyState, type NotifyState } from '@app/notify'
import { armPush } from '@app/push'
import { useGame } from '@app/store'

/**
 * Whether the ship may speak up, asked as a card rather than a browser prompt.
 *
 * Shown twice: once on the names screen before the first voyage, because a
 * permission prompt in the middle of a harbour visit is an ambush and by the
 * time a ship is at sea it is already too late to be useful; and again under
 * Einstellungen, because permission is a thing people change their mind about
 * — and because a browser that was closed and reopened is exactly when someone
 * goes looking for why nothing is arriving.
 *
 * The test notice is there for the same reason. "Granted" is what the browser
 * says, not proof that anything actually appears: an installed app on a phone
 * can hold the permission and still be muted by the system. One tap settles it.
 */
export function NotifyCheck() {
  const { t } = useT()
  const code = useGame((s) => s.net?.code ?? null)
  const [state, setState] = useState<NotifyState>(() => notifyState())
  const [asking, setAsking] = useState(false)
  const [tried, setTried] = useState(false)

  if (state === 'unsupported') return null

  const ask = async () => {
    setAsking(true)
    const answer = await askToNotify()
    setState(answer)
    setAsking(false)
    // Permission is what a push subscription waits on, so the moment it is
    // given is the moment to leave the server an address — otherwise nothing
    // reaches a closed app until the next reconnect.
    if (answer === 'granted' && code) void armPush(code)
  }

  const test = async () => {
    setTried(true)
    // The title is the game's own name, which is not translated.
    await notify('Von Kontinent zu Kontinent', t('notify.test.body'), 'probe')
  }

  return (
    <div className="paper-card mt-4 flex items-center gap-3 rounded-md px-3.5 py-3">
      <span className="text-xl leading-none" aria-hidden>
        {state === 'denied' ? '🔕' : '🔔'}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] leading-tight font-semibold">
          {t(
            state === 'granted' ? 'notify.on' : state === 'denied' ? 'notify.off' : 'notify.ask',
          )}
        </p>
        <p className="text-ink-faint mt-0.5 text-[12px] leading-snug">
          {t(
            state === 'granted'
              ? tried
                ? 'notify.tested'
                : code
                  ? 'notify.whileClosed'
                  : 'notify.whileOpen'
              : state === 'denied'
                ? 'notify.blocked'
                : 'notify.why',
          )}
        </p>
      </div>
      {state === 'default' && (
        <button className="btn btn-sm shrink-0" onClick={() => void ask()} disabled={asking}>
          {asking ? '…' : t('notify.allow')}
        </button>
      )}
      {state === 'granted' && (
        <button className="btn btn-sm shrink-0" onClick={() => void test()}>
          {t('notify.test')}
        </button>
      )}
    </div>
  )
}
