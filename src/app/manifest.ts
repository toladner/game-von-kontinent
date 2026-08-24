import type { ManifestOptions } from 'vite-plugin-pwa'

/**
 * What the browser is told this thing is.
 *
 * Kept out of the Vite config so it can be checked by a test, because every
 * mistake here is silent. It shipped with `icons: []` for months: the app
 * looked fine in a tab, and only on a telephone did it turn out that Chrome
 * will not install a web app without them. What you get instead is a bookmark
 * shortcut that opens in a borrowed Chrome window — and since that window has
 * no address bar, Chrome posts a standing notification naming the origin so
 * the player can still tell where they are. Nothing in the app put it there
 * and nothing in the app could take it away; the icons could.
 */
export const manifest: Partial<ManifestOptions> = {
  id: './',
  name: 'Von Kontinent zu Kontinent',
  short_name: 'Kontinente',
  description: 'Import- und Exporthandel auf hoher See.',
  lang: 'de',
  theme_color: '#0f3b54',
  background_color: '#9dd3e0',
  display: 'standalone',
  orientation: 'any',
  start_url: './',
  icons: [
    { src: './icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: './icon-512.png', sizes: '512x512', type: 'image/png' },
    // Android crops to whatever shape the launcher uses, so this one keeps the
    // ship well inside the circle and lets the parchment be what gets cut away.
    { src: './icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
}
