/// <reference lib="webworker" />

/**
 * Der Schiffsjunge — the one part of the game that is awake when nothing else is.
 *
 * It does two jobs. The first is the one the generated worker used to do
 * alone: hold the whole app in a cache so it starts without a network, and
 * step aside for a newer build the moment one is deployed.
 *
 * The second is why this file exists at all. An installed app that has been
 * swiped off the screen has no page, no timers and no socket — everything
 * else in the game is gone. A push from the Partieserver arrives here anyway,
 * because the browser starts this worker for a moment to receive it. That is
 * the only way a ship can make port at three in the morning and say so.
 *
 * Written by hand rather than generated, which is the trade: the precache
 * recipe below has to be kept honest, and in exchange the game can be reached
 * when it is not running.
 */
import { clientsClaim } from 'workbox-core'
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'

declare const self: ServiceWorkerGlobalScope & {
  /** Filled in at build time with every file of the app. */
  readonly __WB_MANIFEST: Array<{ url: string; revision: string | null }>
}

// ---------------------------------------------------------------------------
// The app itself, held offline
// ---------------------------------------------------------------------------

/*
 * Take over at once rather than waiting for every old page to close. The app
 * reloads itself when a new worker claims it (see `@app/updates`), so this is
 * the first half of "a deploy reaches the telephone in the same minute".
 */
self.skipWaiting()
clientsClaim()

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

/*
 * Every navigation is the app: it is a single page, and the harbour code
 * lives in the fragment. `/api` is excluded because the Partieserver is on
 * the same origin — answering the socket handshake or a table lookup with
 * index.html would be a strange way to fail.
 */
registerRoute(
  new NavigationRoute(createHandlerBoundToURL('index.html'), { denylist: [/^\/api\//] }),
)

// ---------------------------------------------------------------------------
// A word from the Partieserver
// ---------------------------------------------------------------------------

/** What the server seals into a push. Nothing else is ever sent. */
interface Notice {
  readonly title: string
  readonly body: string
  /** Collapses repeats: one arrival is one notice, however it was noticed. */
  readonly tag: string
  /** Where to land when it is tapped — the table it is about. */
  readonly url?: string
}

self.addEventListener('push', (event) => {
  // waitUntil, or the browser may put this worker back to sleep mid-sentence.
  event.waitUntil(announce(event.data ? safely(event.data) : null))
})

function safely(data: PushMessageData): Notice | null {
  try {
    const parsed = data.json() as Partial<Notice>
    if (typeof parsed.title !== 'string' || typeof parsed.body !== 'string') return null
    return { title: parsed.title, body: parsed.body, tag: parsed.tag ?? 'meldung', ...(parsed.url ? { url: parsed.url } : {}) }
  } catch {
    return null
  }
}

async function announce(notice: Notice | null): Promise<void> {
  /*
   * Nothing is said to somebody who is looking straight at it. The page
   * announces its own arrivals while it is alive; a push that fires at the
   * same moment would put a system notification over the harbour the player
   * is already watching.
   */
  const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
  if (windows.some((client) => client.focused)) return

  // A push whose payload did not survive still gets a notice: the browser
  // demands one, and "something happened" beats a silent lie.
  await self.registration.showNotification(notice?.title ?? 'Von Kontinent zu Kontinent', {
    // A push whose payload did not survive has no language either, so this
    // one line stays German — the app's own name is German too.
    body: notice?.body ?? 'Es gibt Neues von Ihrer Partie.',
    tag: notice?.tag ?? 'meldung',
    icon: './icon-192.png',
    // Android draws the badge from the alpha channel alone, so it wants the
    // one-colour mark rather than the parchment tile.
    badge: './badge-96.png',
    data: { url: notice?.url ?? './' },
  })
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const data = event.notification.data as { url?: string } | undefined
  event.waitUntil(land(data?.url ?? './'))
})

/**
 * Come back to the game, without opening a second copy of it.
 *
 * An app that is merely in the background already has a window; opening
 * another would leave the player with two harbours and one table.
 */
async function land(url: string): Promise<void> {
  const wanted = new URL(url, self.location.href).href
  const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
  const existing = windows[0]
  if (!existing) {
    await self.clients.openWindow(wanted)
    return
  }
  await existing.focus()
  // Usually the same table already, and reloading a game somebody is looking
  // at to put them where they are would be a poor way to answer a tap.
  if (existing.url !== wanted) await existing.navigate(wanted).catch(() => null)
}
