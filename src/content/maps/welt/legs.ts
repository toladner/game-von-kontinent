import type { RouteLeg } from '../classic/legs'

/**
 * The Schiffahrtslinien east of Suez.
 *
 * Two lines tie this half of the plan to the printed board: the Suez Canal
 * out of Port Said, and the old Cape route from Kapstadt across the Indian
 * Ocean to Fremantle. Both were the real long-haul routes, and having both
 * matters in play — the canal is short and busy, the Cape is long and empty,
 * so the choice between them is a real one.
 *
 * The Pacific is the outer edge of the plan, exactly as the Atlantic-centred
 * printed board leaves it. There is no lane from Japan to California: a cargo
 * going that way sails west, the long way, as most of it did.
 *
 * `via` waypoints keep lanes in open water — round Ceylon rather than over
 * it, through the Malacca Strait rather than across Sumatra.
 */
const L = (
  a: string,
  b: string,
  via?: readonly (readonly [number, number])[],
  steps?: number,
): RouteLeg =>
  steps === undefined
    ? via
      ? { a, b, via }
      : { a, b }
    : via
      ? { a, b, via, steps }
      : { a, b, steps }

export const LEGS_WELT: readonly RouteLeg[] = [
  // --- Das Rote Meer hinaus in den Indischen Ozean ------------------------
  // Port Said to Pt. Sudan is already on the printed board; these carry that
  // chain on past Aden, which is where the world plan begins.
  L('ptsudan', 'aden', [
    [15.0, 41.5],
    [12.6, 43.4],
  ]),
  L('dschibuti', 'aden', [[12.3, 44.2]]),
  L('berbera', 'aden', [[12.0, 45.3]]),

  // --- Persischer Golf ------------------------------------------------------
  L('aden', 'abadan', [
    [12.5, 51.0],
    [22.0, 59.5],
    [26.5, 56.6],
    [28.5, 51.0],
  ]),
  L('abadan', 'basra', [[30.0, 48.5]]),

  // --- Arabisches Meer, Indien ---------------------------------------------
  L('aden', 'karatschi', [
    [13.5, 52.5],
    [20.0, 62.0],
  ]),
  L('karatschi', 'bombay', [[21.5, 69.0]]),
  L('bombay', 'colombo', [
    [14.0, 73.0],
    [8.5, 76.0],
  ]),
  L('colombo', 'madras', [
    [6.0, 81.5],
    [10.0, 81.0],
  ]),
  L('madras', 'kalkutta', [
    [15.5, 82.5],
    [20.0, 87.0],
  ]),
  L('kalkutta', 'rangun', [
    [20.0, 90.5],
    [17.5, 94.5],
  ]),
  // The long way round Ceylon, straight across the Indian Ocean.
  L('colombo', 'padang', [
    [4.0, 88.0],
    [2.0, 96.0],
  ]),

  // --- Golf von Bengalen nach Malakka --------------------------------------
  L('rangun', 'penang', [
    [14.0, 97.0],
    [8.0, 98.0],
  ]),
  L('penang', 'singapur', [
    [3.5, 100.5],
    [1.5, 102.5],
  ]),
  L('padang', 'singapur', [
    [-1.0, 103.0],
    [0.8, 104.2],
  ]),
  L('bangkok', 'singapur', [
    [11.0, 101.5],
    [5.0, 103.5],
  ]),

  // --- Insulinde -----------------------------------------------------------
  L('singapur', 'batavia', [[-4.0, 105.5]]),
  L('batavia', 'surabaya', [[-6.0, 110.0]]),
  L('singapur', 'manila', [
    [4.0, 108.0],
    [12.0, 117.0],
  ]),
  L('surabaya', 'darwin', [
    [-8.5, 118.0],
    [-10.5, 125.0],
  ]),

  // --- Südchinesisches Meer und Ostasien -----------------------------------
  L('singapur', 'hongkong', [
    [6.0, 106.5],
    [15.0, 111.0],
    [20.0, 113.5],
  ]),
  L('manila', 'hongkong', [[18.0, 117.0]]),
  L('hongkong', 'kanton', [[22.6, 113.7]]),
  L('hongkong', 'taipeh', [
    [22.5, 118.0],
    [24.5, 120.5],
  ]),
  L('hongkong', 'schanghai', [
    [25.0, 119.5],
    [29.0, 122.5],
  ]),
  L('schanghai', 'tientsin', [
    [34.0, 122.5],
    [38.0, 120.0],
  ]),
  L('taipeh', 'nagasaki', [[28.0, 126.0]]),
  L('schanghai', 'nagasaki', [[31.5, 126.0]]),
  L('nagasaki', 'kobe', [[33.5, 132.5]]),
  L('kobe', 'yokohama', [[34.4, 137.5]]),
  L('manila', 'yokohama', [
    [20.0, 124.0],
    [28.0, 133.0],
  ]),

  // --- Australien -----------------------------------------------------------
  L('darwin', 'brisbane', [
    [-13.5, 137.0],
    [-13.0, 144.5],
    [-20.0, 149.5],
  ]),
  L('brisbane', 'sydney', [[-31.0, 153.5]]),
  L('sydney', 'melbourne', [
    [-37.5, 150.0],
    [-39.0, 147.0],
  ]),
  L('melbourne', 'adelaide', [[-38.5, 140.5]]),
  L('adelaide', 'fremantle', [
    [-35.5, 133.0],
    [-34.5, 124.0],
    [-34.0, 118.0],
  ]),
  L('fremantle', 'darwin', [
    [-25.0, 112.0],
    [-18.0, 118.0],
    [-13.5, 127.0],
  ]),
  // Singapore to Western Australia: the ore and wool run.
  L('singapur', 'fremantle', [
    [-3.0, 105.0],
    [-15.0, 110.0],
    [-26.0, 113.0],
  ]),

  // --- Neuseeland -----------------------------------------------------------
  L('sydney', 'auckland', [
    [-34.0, 158.0],
    [-35.5, 168.0],
  ]),
  L('auckland', 'wellington', [[-39.0, 175.5]]),

  // --- Die Kaproute: der lange Weg nach Osten -------------------------------
  // No canal dues and no traffic, but a very long way indeed.
  L('kapstadt', 'fremantle', [
    [-36.0, 25.0],
    [-38.0, 45.0],
    [-38.0, 70.0],
    [-36.0, 95.0],
  ]),
  L('daressalam', 'colombo', [
    [-5.0, 45.0],
    [0.0, 60.0],
    [4.0, 72.0],
  ]),
  L('majunga', 'bombay', [
    [-10.0, 50.0],
    [0.0, 58.0],
    [10.0, 66.0],
  ]),
]
