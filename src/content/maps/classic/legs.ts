/**
 * The Schiffahrtslinien of the classic board.
 *
 * A leg says "these two ports are connected by open water, and the line runs
 * roughly through these waypoints". The map builder chops each leg into the
 * evenly spaced pips a ship counts off when it moves, so the number of dots
 * follows real distance instead of being hand-tallied off the scan.
 *
 * `via` exists so lanes go around capes instead of across continents.
 */
export interface RouteLeg {
  readonly a: string
  readonly b: string
  /** Intermediate waypoints as [lat, lon], in open water. */
  readonly via?: readonly (readonly [number, number])[]
  /** Force a pip count instead of deriving it from distance. */
  readonly steps?: number
}

const L = (
  a: string,
  b: string,
  via?: readonly (readonly [number, number])[],
  steps?: number,
): RouteLeg => (steps === undefined ? (via ? { a, b, via } : { a, b }) : via ? { a, b, via, steps } : { a, b, steps })

export const LEGS: readonly RouteLeg[] = [
  // --- Ostsee, Nordsee, Ärmelkanal ----------------------------------------
  L('leningrad', 'stockholm', [[59.8, 24.0]]),
  L('stockholm', 'kopenhagen', [[56.0, 16.5]]),
  L('kopenhagen', 'oslo', [[57.8, 10.9]]),
  L('oslo', 'stavanger', [[58.1, 8.5]]),
  L('kopenhagen', 'hamburg', [[54.6, 9.0], [54.2, 8.2]]),
  L('hamburg', 'amsterdam', [[53.9, 6.5]]),
  L('amsterdam', 'ostende', [[52.0, 3.3]]),
  L('ostende', 'london', [[51.4, 1.6]]),
  L('stavanger', 'glasgow', [[57.8, 0.0], [56.5, -3.5]]),
  L('glasgow', 'dublin', [[55.2, -5.9], [54.2, -5.6]]),
  L('dublin', 'london', [[51.6, -6.4], [49.9, -5.8], [50.3, -1.5]]),
  L('london', 'lehavre', [[50.6, 0.9]]),
  L('lehavre', 'bordeaux', [[48.5, -5.3], [45.7, -2.2]]),
  L('bordeaux', 'santander', [[44.2, -2.6]]),
  L('santander', 'lissabon', [[43.4, -9.4], [40.0, -9.6]]),

  // --- Mittelmeer ----------------------------------------------------------
  L('lissabon', 'barcelona', [[36.6, -7.5], [35.9, -5.5], [36.6, -1.0], [38.5, 0.8]]),
  L('barcelona', 'marseille', [[42.2, 4.0]]),
  L('marseille', 'genua', [[43.4, 7.3]]),
  L('genua', 'neapel', [[41.4, 11.5]]),
  L('neapel', 'triest', [[38.2, 15.7], [40.3, 18.6], [43.0, 15.0]]),
  L('triest', 'spalato', [[44.5, 14.5]]),
  L('spalato', 'piraeus', [[41.0, 18.3], [38.0, 20.5]]),
  L('piraeus', 'istanbul', [[38.9, 25.1], [40.4, 26.2]]),
  L('piraeus', 'beirut', [[35.2, 27.5], [34.5, 32.5]]),
  L('neapel', 'tunis', [[38.0, 12.2]]),
  L('tunis', 'algier', [[37.3, 6.5]]),
  L('algier', 'rabat', [[36.3, -1.5], [35.8, -5.4], [35.0, -6.3]]),
  L('tunis', 'tripolis', [[34.5, 11.8]]),
  L('tripolis', 'tobruk', [[32.6, 18.5]]),
  L('tobruk', 'portsaid', [[31.8, 28.0]]),
  L('beirut', 'portsaid', [[32.5, 33.5]]),

  // --- Suez, Rotes Meer, Ostafrika ----------------------------------------
  L('portsaid', 'ptsudan', [[29.9, 32.6], [27.5, 34.0], [23.5, 36.5]]),
  L('ptsudan', 'massaua', [[17.5, 38.6]]),
  L('massaua', 'dschibuti', [[13.5, 42.5]]),
  L('dschibuti', 'berbera', [[11.7, 44.2]]),
  L('berbera', 'mogadiscio', [[11.8, 51.5], [7.0, 50.0]]),
  L('mogadiscio', 'mombasa', [[-1.0, 42.5]]),
  L('mombasa', 'daressalam', [[-5.5, 39.6]]),
  L('daressalam', 'mosambique', [[-11.0, 40.8]]),
  L('mosambique', 'majunga', [[-15.4, 43.5]]),
  L('mosambique', 'beira', [[-17.5, 38.0]]),
  L('majunga', 'beira', [[-18.5, 42.0]]),
  L('beira', 'laurencomarques', [[-23.0, 35.6]]),
  L('laurencomarques', 'portelizabeth', [[-29.5, 31.5]]),
  L('portelizabeth', 'kapstadt', [[-34.9, 22.0], [-34.6, 19.5]]),

  // --- Westafrika ----------------------------------------------------------
  L('kapstadt', 'luederitz', [[-30.5, 16.0]]),
  L('luederitz', 'swakopmund', [[-24.5, 14.4]]),
  L('swakopmund', 'benguela', [[-17.5, 11.3]]),
  L('benguela', 'banana', [[-9.0, 12.3]]),
  L('banana', 'loanga', [[-3.5, 10.5]]),
  L('loanga', 'duala', [[1.5, 8.2]]),
  L('duala', 'lagos', [[4.2, 6.2]]),
  L('lagos', 'capcoast', [[4.6, 1.0]]),
  L('capcoast', 'monrovia', [[4.2, -6.0]]),
  L('monrovia', 'gambia', [[9.0, -14.5]]),
  L('gambia', 'dakar', [[14.0, -17.3]]),
  L('dakar', 'villacisneros', [[18.5, -17.0]]),
  L('villacisneros', 'rabat', [[27.5, -14.0], [31.5, -10.0]]),

  // --- Atlantiküberquerungen ----------------------------------------------
  L('london', 'stjohn', [[50.0, -12.0], [49.5, -25.0], [48.5, -40.0]]),
  L('lissabon', 'newyork', [[38.6, -20.0], [38.5, -35.0], [39.5, -55.0], [40.3, -68.0]]),
  L('villacisneros', 'habana', [[24.0, -25.0], [22.0, -45.0], [21.5, -62.0], [22.5, -75.0]]),
  L('dakar', 'recife', [[10.0, -22.0], [2.0, -30.0]]),
  L('kapstadt', 'riodejaneiro', [[-33.0, 8.0], [-30.0, -10.0], [-26.0, -30.0]]),
  L('kapstadt', 'buenosaires', [[-38.0, 5.0], [-40.0, -20.0], [-38.0, -45.0]]),

  // --- Nordamerika, Ostküste ----------------------------------------------
  L('stjohn', 'halifax', [[45.8, -58.0]]),
  L('halifax', 'quebec', [[46.5, -59.5], [49.2, -64.5], [48.3, -68.5]]),
  L('halifax', 'boston', [[43.5, -67.0]]),
  L('boston', 'newyork', [[41.2, -71.0]]),
  L('newyork', 'norfolk', [[38.5, -74.5]]),
  L('norfolk', 'charleston', [[34.5, -76.5]]),
  L('charleston', 'jacksonville', [[31.5, -80.4]]),
  L('jacksonville', 'miami', [[27.5, -80.0]]),
  L('miami', 'habana', [[24.4, -81.5]]),
  L('miami', 'neworleans', [[25.0, -83.5], [27.5, -87.5]]),
  L('neworleans', 'veracruz', [[26.0, -93.0]]),
  L('veracruz', 'progreso', [[20.5, -92.0]]),
  L('progreso', 'habana', [[22.0, -86.0]]),
  L('habana', 'truxillo', [[20.5, -84.0], [17.5, -84.5]]),
  L('truxillo', 'limon', [[13.0, -82.5]]),
  L('limon', 'colon', [[10.0, -81.0]]),
  L('colon', 'cartagena', [[10.0, -77.5]]),
  L('cartagena', 'caracas', [[11.5, -71.0]]),
  L('habana', 'cartagena', [[19.0, -78.5], [14.0, -76.0]]),

  // --- Südamerika, Ostküste ------------------------------------------------
  L('caracas', 'georgetown', [[10.5, -60.5]]),
  L('georgetown', 'paramaribo', [[7.2, -56.5]]),
  L('paramaribo', 'cayenne', [[6.0, -53.5]]),
  L('cayenne', 'parabelem', [[3.0, -49.5]]),
  L('parabelem', 'fortaleza', [[-1.0, -43.0]]),
  L('fortaleza', 'recife', [[-5.0, -35.0]]),
  L('recife', 'saosalvador', [[-10.5, -36.0]]),
  L('saosalvador', 'riodejaneiro', [[-18.0, -38.5]]),
  L('riodejaneiro', 'desterro', [[-25.5, -46.0]]),
  L('desterro', 'riogrande', [[-30.0, -49.5]]),
  L('riogrande', 'montevideo', [[-34.0, -53.0]]),
  L('montevideo', 'buenosaires', [[-35.0, -57.0]]),
  L('buenosaires', 'bahiablanca', [[-37.5, -57.5]]),
  L('bahiablanca', 'rivadavia', [[-42.5, -63.5]]),
  L('rivadavia', 'santacruz', [[-48.0, -66.0]]),
  L('santacruz', 'magallanes', [[-52.0, -68.5]]),

  // --- Kap Hoorn und Südamerika, Westküste --------------------------------
  L('magallanes', 'puertomontt', [[-54.9, -71.5], [-52.0, -75.5], [-46.0, -75.5]]),
  L('puertomontt', 'valparaiso', [[-37.0, -73.8]]),
  L('valparaiso', 'antofagasta', [[-28.5, -71.5]]),
  L('antofagasta', 'callao', [[-18.0, -71.5]]),
  L('callao', 'guayaquil', [[-6.5, -81.5]]),
  L('guayaquil', 'buenaventura', [[0.5, -80.5]]),
  L('buenaventura', 'sanjose', [[6.5, -78.5], [7.5, -84.0], [11.0, -88.0]]),

  // --- Nordamerika, Westküste ---------------------------------------------
  L('sanjose', 'acapulco', [[15.0, -95.5]]),
  L('acapulco', 'sanblas', [[19.0, -104.5]]),
  L('sanblas', 'mazatlan', [[22.4, -106.2]]),
  L('mazatlan', 'sandiego', [[24.5, -111.5], [28.5, -115.5]]),
  L('sandiego', 'sanfrancisco', [[34.5, -121.0]]),
  L('sanfrancisco', 'astoria', [[41.5, -124.8]]),
  L('astoria', 'vancouver', [[48.0, -125.5], [48.8, -123.5]]),
]
