/**
 * Making sure a player is running the game that was last deployed.
 *
 * The service worker precaches the whole app so it will run offline, which is
 * the point — and the price is that an installed copy will happily serve
 * yesterday's build forever. The registration script the PWA plugin injects
 * only registers; it never asks whether there is anything newer, and the
 * browser's own check is roughly daily. So a fix could be deployed, verified
 * on the server, and still not be what the player is looking at.
 *
 * Three things close that gap:
 *
 *   - `updateViaCache: 'none'`, so the worker script itself is never answered
 *     out of the HTTP cache. Without it the browser can revalidate against a
 *     copy that is itself stale.
 *   - An explicit check on load, whenever the app comes back to the front,
 *     and on a slow timer. Coming back to the front is the one that matters
 *     for an installed app, which is opened and closed rather than reloaded.
 *   - A single reload once a new worker actually takes control. The worker is
 *     built with skipWaiting, so it claims the page as soon as it activates;
 *     without the reload the page keeps the old JavaScript it started with.
 */

/** How often to ask, while the game is on screen. */
const EVERY_MS = 15 * 60_000

export function keepUpToDate(): void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return

  /*
   * Whether this page was already being controlled when it loaded.
   *
   * On a first visit the worker installs and claims the page immediately,
   * which fires controllerchange for a build the page is already running.
   * Reloading on that would be a reload for nothing — and if anything ever
   * went wrong with the install, an endless one.
   */
  const wasControlled = navigator.serviceWorker.controller !== null
  let reloading = false

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!wasControlled || reloading) return
    reloading = true
    window.location.reload()
  })

  void navigator.serviceWorker
    .register(new URL('sw.js', document.baseURI).href, {
      scope: './',
      updateViaCache: 'none',
    })
    .then((registration) => {
      const check = () => {
        if (document.visibilityState !== 'visible') return
        void registration.update().catch(() => {
          // Offline, or the server is down. Nothing to do but try later —
          // the cached copy is exactly what it is for.
        })
      }

      check()
      document.addEventListener('visibilitychange', check)
      window.setInterval(check, EVERY_MS)
    })
    .catch(() => {
      // No worker means no offline play, which is a shame but not a failure:
      // the game runs perfectly well straight off the network.
    })
}
