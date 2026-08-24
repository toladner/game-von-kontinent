import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { manifest } from './manifest'

/**
 * Chrome's terms for installing a web app properly.
 *
 * Fail any of these and it does not refuse — it quietly installs a bookmark
 * shortcut instead, which looks identical until a standing notification turns
 * up on the player's telephone naming the origin, because a borrowed Chrome
 * window has no address bar to name it. That is not something the app can
 * detect at runtime or clear once it happens, so it is checked here.
 */
describe('what the browser is told this is', () => {
  const icons = manifest.icons ?? []

  it('names an icon of every size Chrome insists on', () => {
    for (const size of ['192x192', '512x512']) {
      expect(icons.some((i) => i.sizes === size)).toBe(true)
    }
  })

  it('offers one for launchers that crop', () => {
    expect(icons.some((i) => i.purpose === 'maskable')).toBe(true)
  })

  it('names files that are actually there', () => {
    expect(icons.length).toBeGreaterThan(0)
    for (const icon of icons) {
      // Declared relative to the manifest, which is served from the root.
      expect(existsSync(`public/${icon.src.replace(/^\.\//, '')}`)).toBe(true)
    }
  })

  it('keeps the notification icons on disk too', () => {
    // Not part of the manifest, but referenced by `notify` — and a 404 there
    // is a notification with a blank grey square where the ship should be.
    const notify = readFileSync('src/app/notify.ts', 'utf8')
    for (const [, src] of notify.matchAll(/(?:icon|badge): '\.\/([^']+)'/g)) {
      expect(existsSync(`public/${src}`)).toBe(true)
    }
  })

  it('says it is in German, and stays the same app across updates', () => {
    expect(manifest.lang).toBe('de')
    expect(manifest.id).toBe(manifest.start_url)
  })
})
