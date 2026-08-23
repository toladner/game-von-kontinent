// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { askToNotify, lookingAway, notify, notifyState } from './notify'

/**
 * jsdom ships no Notification, which is itself the interesting case: a
 * browser without it must be told apart from one that has simply refused.
 */
function withNotification(permission: NotificationPermission, request?: () => Promise<string>) {
  const shown: { title: string; options?: NotificationOptions }[] = []
  class FakeNotification {
    static permission = permission
    static requestPermission = request ?? (async () => permission)
    constructor(title: string, options?: NotificationOptions) {
      shown.push({ title, options })
    }
  }
  ;(globalThis as { Notification?: unknown }).Notification = FakeNotification
  return shown
}

afterEach(() => {
  delete (globalThis as { Notification?: unknown }).Notification
  delete (navigator as { serviceWorker?: unknown }).serviceWorker
  vi.restoreAllMocks()
})

describe('whether the ship may speak', () => {
  it('tells a browser that cannot from one that will not', () => {
    expect(notifyState()).toBe('unsupported')
    withNotification('denied')
    expect(notifyState()).toBe('denied')
    withNotification('granted')
    expect(notifyState()).toBe('granted')
  })

  it('does not ask again once an answer has been given', async () => {
    const asked = vi.fn(async () => 'granted')
    withNotification('denied', asked)
    expect(await askToNotify()).toBe('denied')
    expect(asked).not.toHaveBeenCalled()
  })

  it('asks when nobody has yet been asked', async () => {
    const asked = vi.fn(async () => 'granted')
    withNotification('default', asked)
    expect(await askToNotify()).toBe('granted')
    expect(asked).toHaveBeenCalledOnce()
  })

  it('survives a browser that throws instead of answering', async () => {
    // Older Safari handed back a callback and threw on the promise form.
    withNotification('default', () => {
      throw new Error('nope')
    })
    expect(await askToNotify()).toBe('default')
  })

  it('says nothing at all when it has no permission', async () => {
    const shown = withNotification('default')
    await notify('Schiff eingelaufen', 'Dakar', 'ankunft:dakar')
    expect(shown).toHaveLength(0)
  })
})

describe('showing one', () => {
  beforeEach(() => {
    delete (navigator as { serviceWorker?: unknown }).serviceWorker
  })

  it('goes through the service worker when there is one', async () => {
    // Android refuses `new Notification()` outright, so the registration is
    // the path that has to work.
    const showNotification = vi.fn(
      async (_title: string, _options?: NotificationOptions) => undefined,
    )
    ;(navigator as { serviceWorker?: unknown }).serviceWorker = {
      getRegistration: async () => ({ showNotification }),
    }
    const direct = withNotification('granted')

    await notify('Schiff eingelaufen', 'Dakar', 'ankunft:dakar')
    expect(showNotification).toHaveBeenCalledOnce()
    expect(showNotification.mock.calls[0]![0]).toBe('Schiff eingelaufen')
    expect(direct).toHaveLength(0)
  })

  it('falls back to the plain constructor without a worker', async () => {
    const shown = withNotification('granted')
    await notify('Saison beendet', 'Die Schlußabrechnung liegt vor.', 'saison-ende')
    expect(shown).toHaveLength(1)
    expect(shown[0]!.title).toBe('Saison beendet')
    // The tag is what stops one arrival being announced twice.
    expect(shown[0]!.options?.tag).toBe('saison-ende')
  })

  it('does not throw when the browser refuses the constructor', async () => {
    withNotification('granted')
    ;(globalThis as { Notification?: unknown }).Notification = class {
      static permission = 'granted'
      constructor() {
        throw new Error('Illegal constructor')
      }
    }
    await expect(notify('a', 'b', 'c')).resolves.toBeUndefined()
  })
})

describe('whether anyone is watching', () => {
  it('is quiet while the player has the game in front of them', () => {
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
    expect(lookingAway()).toBe(false)
  })

  it('speaks up once the tab is in the background', () => {
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    expect(lookingAway()).toBe(true)
  })
})
