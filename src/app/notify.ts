/**
 * Telling a player something happened while they were not looking.
 *
 * Real-time play is the whole reason this exists: a voyage takes real hours,
 * the point of it is that you put the phone down, and a game you have to sit
 * and watch has thrown that away. So the ship makes port and says so.
 *
 * Only ever while the page is alive — a browser tab or an installed app that
 * has been closed outright hears nothing, because that needs a push
 * subscription and a server willing to sign for it. The clock is deterministic
 * and the arrival time is known the moment a course is set, so what is here
 * is a timer rather than a poll, and it survives a backgrounded tab as well
 * as the browser's throttling allows.
 */

export type NotifyState = 'unsupported' | 'default' | 'granted' | 'denied'

/** Whether this browser can show a notification at all, and whether it may. */
export function notifyState(): NotifyState {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported'
  return Notification.permission as NotifyState
}

/**
 * Ask, once, for permission.
 *
 * Returns the resulting state rather than a boolean: "denied" and
 * "unsupported" want different words in front of a player, and a caller that
 * only sees `false` cannot tell them apart.
 */
export async function askToNotify(): Promise<NotifyState> {
  if (notifyState() === 'unsupported') return 'unsupported'
  if (Notification.permission !== 'default') return Notification.permission as NotifyState
  try {
    return (await Notification.requestPermission()) as NotifyState
  } catch {
    // Safari used to hand back a callback rather than a promise; either way,
    // a failure here is not worth breaking the setup screen over.
    return notifyState()
  }
}

/**
 * Show one.
 *
 * Through the service worker where there is one, because Android refuses
 * `new Notification()` outright and only honours `showNotification` from a
 * registration. Falls back to the constructor on desktop browsers without a
 * worker registered yet.
 *
 * `tag` collapses repeats: a ship arriving is one piece of news however many
 * times the timer and the event stream both notice it.
 */
export async function notify(title: string, body: string, tag: string): Promise<void> {
  if (notifyState() !== 'granted') return
  const options: NotificationOptions = {
    body,
    tag,
    icon: './icon-192.png',
    // Android draws the badge as a white silhouette from the alpha channel,
    // so it wants a transparent one-colour mark rather than the parchment
    // tile — the tile arrives as a filled square.
    badge: './badge-96.png',
  }
  try {
    const registration = await navigator.serviceWorker?.getRegistration()
    if (registration) {
      await registration.showNotification(title, options)
      return
    }
  } catch {
    // No worker, or it refused. Fall through to the plain constructor.
  }
  try {
    new Notification(title, options)
  } catch {
    // Some browsers throw here on mobile. Nothing more to try.
  }
}

/**
 * Whether the player is actually looking at the game right now.
 *
 * There is no point telling someone their ship has arrived while they are
 * watching it arrive.
 */
export function lookingAway(): boolean {
  return typeof document !== 'undefined' && document.visibilityState !== 'visible'
}
