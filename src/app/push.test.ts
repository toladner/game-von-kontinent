// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { armPush } from './push'

/**
 * Leaving an address, and the three ways of not leaving one.
 *
 * The failures matter as much as the success here: a browser that cannot do
 * push at all, a player who has not allowed notices, and a deployment with no
 * VAPID key are three different situations, and quietly treating them alike
 * would make "why do I get nothing?" impossible to answer later.
 */

const KEY = 'BPnt9drJNcmXVhyPa9bgck02XIDTt-bizjP1CWBn8u49g_kKzfbBvBUn4VzJY-PI7sdKouPfcxuRyWdo83Vz2Rk'

function unb64(text: string): Uint8Array {
  const s = atob(text.replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(s, (c) => c.charCodeAt(0))
}

/** A subscription of the shape `pushManager` hands out. */
function subscription(key: string) {
  const bytes = unb64(key)
  return {
    endpoint: 'https://fcm.googleapis.com/fcm/send/xyz',
    options: { applicationServerKey: bytes.buffer.slice(0) },
    unsubscribe: vi.fn(async () => true),
    toJSON: () => ({
      endpoint: 'https://fcm.googleapis.com/fcm/send/xyz',
      keys: { p256dh: 'p256dh-wert', auth: 'auth-wert' },
    }),
  }
}

interface Bench {
  readonly permission?: NotificationPermission
  readonly serverKey?: string | null
  readonly existing?: ReturnType<typeof subscription> | null
  /** Leave the browser without a push service at all. */
  readonly bare?: boolean
}

function bench({ permission = 'granted', serverKey = KEY, existing = null, bare = false }: Bench) {
  localStorage.setItem('vkzk.token.HAF3', 'platz-1')
  ;(globalThis as { Notification?: unknown }).Notification = { permission }
  if (!bare) (globalThis as { PushManager?: unknown }).PushManager = class {}

  const made = subscription(KEY)
  const pushManager = {
    getSubscription: vi.fn(async () => existing),
    subscribe: vi.fn(async () => made),
  }
  Object.defineProperty(navigator, 'serviceWorker', {
    value: { ready: Promise.resolve({ pushManager }) },
    configurable: true,
  })

  const posted: { url: string; body: unknown }[] = []
  const fetching = vi.fn(async (url: string, init?: RequestInit) => {
    if (url === '/api/push/key') {
      return { ok: true, json: async () => ({ key: serverKey }) } as unknown as Response
    }
    posted.push({ url, body: JSON.parse(String(init?.body)) })
    return { ok: true, json: async () => ({ ok: true }) } as unknown as Response
  })
  vi.stubGlobal('fetch', fetching)

  return { pushManager, posted, made }
}

afterEach(() => {
  delete (globalThis as { Notification?: unknown }).Notification
  delete (globalThis as { PushManager?: unknown }).PushManager
  delete (navigator as { serviceWorker?: unknown }).serviceWorker
  localStorage.clear()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('leaving an address the Partieserver can reach', () => {
  it('gives the table the subscription, against the seat token', async () => {
    const { posted } = bench({})
    expect(await armPush('HAF3')).toBe('gestellt')
    expect(posted).toHaveLength(1)
    expect(posted[0]!.url).toBe('/api/games/HAF3/push')
    expect(posted[0]!.body).toEqual({
      // The token is the only proof that this telephone is that house's.
      token: 'platz-1',
      sub: {
        endpoint: 'https://fcm.googleapis.com/fcm/send/xyz',
        keys: { p256dh: 'p256dh-wert', auth: 'auth-wert' },
      },
      // So the server knows which language to compose a notice in: it is
      // read on this telephone, not on the one that opened the table.
      locale: 'de',
    })
  })

  it('asks for a subscription only once notices are allowed', async () => {
    const { pushManager, posted } = bench({ permission: 'default' })
    expect(await armPush('HAF3')).toBe('ohne-erlaubnis')
    expect(pushManager.subscribe).not.toHaveBeenCalled()
    expect(posted).toHaveLength(0)
  })

  it('says so when the deployment has no key to sign with', async () => {
    const { pushManager } = bench({ serverKey: null })
    expect(await armPush('HAF3')).toBe('ohne-schlüssel')
    expect(pushManager.subscribe).not.toHaveBeenCalled()
  })

  it('is quiet on a browser with no push service at all', async () => {
    bench({ bare: true })
    expect(await armPush('HAF3')).toBe('unmöglich')
  })

  it('keeps a subscription that was made with the same key', async () => {
    const existing = subscription(KEY)
    const { pushManager } = bench({ existing })
    expect(await armPush('HAF3')).toBe('gestellt')
    expect(existing.unsubscribe).not.toHaveBeenCalled()
    expect(pushManager.subscribe).not.toHaveBeenCalled()
  })

  /*
   * A subscription is bound to the key it was made with. Kept across a key
   * rotation it stays perfectly valid and perfectly deaf: the push service
   * accepts nothing we can sign, and the app goes silent for reasons nobody
   * would ever guess from the outside.
   */
  it('throws away a subscription made with a key we no longer hold', async () => {
    const stale = subscription(
      'BJ7dVJIFa9wLTHM_wLBnvXJZDPBBQ9r6nQ0dhFGrRVoZLNCS-vSj4vNfLXVdVaWaJyEQKcOMFYlwOePLxRYyLGA',
    )
    const { pushManager } = bench({ existing: stale })
    expect(await armPush('HAF3')).toBe('gestellt')
    expect(stale.unsubscribe).toHaveBeenCalled()
    expect(pushManager.subscribe).toHaveBeenCalled()
  })

  it('does not leave an address for a table we hold no seat at', async () => {
    bench({})
    localStorage.clear()
    expect(await armPush('HAF3')).toBe('fehler')
  })
})
