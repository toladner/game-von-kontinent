import type { Port } from '../../../engine/types'

/**
 * The Ausfuhrhäfen east of Suez.
 *
 * Same shape as the classic list: real coordinates, so the renderer owns the
 * projection and the plan can be zoomed without going soft. Added to the
 * printed board's harbours rather than replacing them — the world plan is the
 * original with the far side of the Indian Ocean filled in.
 */
const p = (
  id: string,
  name: string,
  country: string,
  lat: number,
  lon: number,
  extra: Partial<Port> = {},
): Port => ({ kind: 'port', id, name, country, lat, lon, ...extra })

export const PORTS_WELT: readonly Port[] = [
  // --- Rotes Meer, Persischer Golf ----------------------------------------
  p('aden', 'Aden', 'arabien', 12.79, 45.04),
  p('basra', 'Basra', 'irak', 30.51, 47.78),
  p('abadan', 'Abadan', 'persien', 30.34, 48.3),

  // --- Indien und Ceylon ---------------------------------------------------
  p('karatschi', 'Karatschi', 'pakistan', 24.86, 67.01),
  p('bombay', 'Bombay', 'indien', 19.08, 72.88),
  p('colombo', 'Colombo', 'ceylon', 6.93, 79.86),
  p('madras', 'Madras', 'indien', 13.08, 80.27),
  p('kalkutta', 'Kalkutta', 'indien', 22.57, 88.36),
  p('rangun', 'Rangun', 'burma', 16.87, 96.2),

  // --- Hinterindien und Insulinde -----------------------------------------
  p('bangkok', 'Bangkok', 'siam', 13.75, 100.5),
  p('penang', 'Penang', 'malaya', 5.41, 100.34),
  p('singapur', 'Singapur', 'malaya', 1.29, 103.85),
  p('padang', 'Padang', 'indonesien', -0.95, 100.35),
  p('batavia', 'Batavia', 'indonesien', -6.13, 106.81),
  p('surabaya', 'Surabaya', 'indonesien', -7.25, 112.75),
  p('manila', 'Manila', 'philippinen', 14.6, 120.98),

  // --- Ostasien ------------------------------------------------------------
  p('hongkong', 'Hongkong', 'hongkong', 22.32, 114.17),
  p('kanton', 'Kanton', 'china', 23.13, 113.26),
  p('schanghai', 'Schanghai', 'china', 31.23, 121.47),
  p('tientsin', 'Tientsin', 'china', 39.0, 117.7),
  p('taipeh', 'Kilung', 'formosa', 25.13, 121.74),
  p('nagasaki', 'Nagasaki', 'japan', 32.74, 129.87),
  p('kobe', 'Kobe', 'japan', 34.69, 135.2),
  p('yokohama', 'Yokohama', 'japan', 35.44, 139.64),

  // --- Australien und Neuseeland ------------------------------------------
  p('darwin', 'Darwin', 'australien', -12.46, 130.84),
  p('fremantle', 'Fremantle', 'australien', -32.05, 115.74),
  p('adelaide', 'Adelaide', 'australien', -34.93, 138.6),
  p('melbourne', 'Melbourne', 'australien', -37.81, 144.96),
  p('sydney', 'Sydney', 'australien', -33.87, 151.21),
  p('brisbane', 'Brisbane', 'australien', -27.47, 153.03),
  p('auckland', 'Auckland', 'neuseeland', -36.85, 174.76),
  p('wellington', 'Wellington', 'neuseeland', -41.29, 174.78),
]

/**
 * Ausgangshäfen the world plan adds to the printed board's list.
 *
 * Spread across the new coasts so a table of six is not all dealt into the
 * same sea, and kept to the big entrepôts a house would actually be based in.
 */
export const START_PORTS_WELT: readonly string[] = [
  'singapur',
  'bombay',
  'schanghai',
  'sydney',
  'yokohama',
  'kalkutta',
  'batavia',
  'hongkong',
  'melbourne',
  'colombo',
]
