/**
 * Leaving an address where the Partieserver can reach us.
 *
 * `@app/notify` handles the notices this app can raise by itself, and they
 * are the ones that arrive while the page is alive. An installed app that has
 * been swiped off the screen has no page at all: its timers are gone, its
 * socket is closed, and nothing in the browser is running our code. The only
 * thing that still reaches it is a push, which the browser's own push service
 * delivers and which starts the service worker for a moment to receive.
 *
 * That is what this file arranges. The browser hands out a subscription — an
 * address at its push service, plus a key that only it can read with — and we
 * give it to the table we are sitting at, against the seat token, so the
 * server knows which house the address belongs to.
 *
 * Asked again on every reconnect, deliberately: a subscription can be rotated
 * by the browser, and the cheapest way to keep the server's copy current is
 * to hand it the present one every time we sit down.
 */
import { storedToken } from './net'

export type PushArm =
  | 'gestellt'
  /** The browser cannot do this at all — no worker, or no push service. */
  | 'unmöglich'
  /** Notices are not allowed, so there is nothing to subscribe for. */
  | 'ohne-erlaubnis'
  /** The server has no VAPID key configured; push is off for this deployment. */
  | 'ohne-schlüssel'
  | 'fehler'

export async function armPush(code: string): Promise<PushArm> {
  if (
    typeof navigator === 'undefined' ||
    !('serviceWorker' in navigator) ||
    typeof window === 'undefined' ||
    !('PushManager' in window) ||
    !('Notification' in window)
  ) {
    return 'unmöglich'
  }
  // Subscribing without permission would prompt at a moment nobody chose, and
  // Chrome refuses it outright for a `userVisibleOnly` subscription anyway.
  if (Notification.permission !== 'granted') return 'ohne-erlaubnis'

  const token = storedToken(code)
  if (!token) return 'fehler'

  try {
    const key = await serverKey()
    if (!key) return 'ohne-schlüssel'

    const registration = await navigator.serviceWorker.ready
    let subscription = await registration.pushManager.getSubscription()

    /*
     * A subscription is bound to the key it was made with. If the server's
     * key has changed — a rotation, or a different deployment — the old
     * address still exists and still receives nothing we can sign for, so it
     * is thrown away rather than kept as a puzzle for later.
     */
    if (subscription && !madeWith(subscription, key)) {
      await subscription.unsubscribe().catch(() => false)
      subscription = null
    }

    subscription ??= await registration.pushManager.subscribe({
      // Every push must produce a notification. That is the browser's price
      // for waking a closed app, and it happens to be exactly what we want.
      userVisibleOnly: true,
      applicationServerKey: unb64(key),
    })

    const res = await fetch(`/api/games/${encodeURIComponent(code)}/push`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token, sub: subscription.toJSON() }),
    })
    return res.ok ? 'gestellt' : 'fehler'
  } catch {
    // A refused subscription, a push service that will not answer, a server
    // that is down. None of it is worth breaking a harbour round over.
    return 'fehler'
  }
}

/** The public half of the server's VAPID pair, asked for once per attempt. */
async function serverKey(): Promise<string | null> {
  const res = await fetch('/api/push/key')
  if (!res.ok) return null
  const body = (await res.json()) as { key?: string | null }
  return body.key ?? null
}

function madeWith(subscription: PushSubscription, key: string): boolean {
  const applied = subscription.options.applicationServerKey
  return applied ? b64(new Uint8Array(applied)) === key : false
}

function b64(raw: Uint8Array): string {
  let s = ''
  for (const byte of raw) s += String.fromCharCode(byte)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function unb64(text: string): Uint8Array<ArrayBuffer> {
  const s = atob(text.replace(/-/g, '+').replace(/_/g, '/'))
  const out = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i)
  return out
}
