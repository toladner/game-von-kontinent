import type { Port } from '../../../engine/types'
import { withEnglishPort } from '../../naming'

/**
 * Every Ausfuhrhafen printed on the classic board, at its real position.
 *
 * Real coordinates (rather than pixel positions traced off the scan) mean the
 * renderer owns the projection, the board can be zoomed without going soft,
 * and a future world map is just more entries in a list like this one.
 */
const p = (
  id: string,
  name: string,
  country: string,
  lat: number,
  lon: number,
  extra: Partial<Port> = {},
): Port => withEnglishPort({ kind: 'port', id, name, country, lat, lon, ...extra })

export const PORTS: readonly Port[] = [
  // --- Europa -------------------------------------------------------------
  p('leningrad', 'Leningrad', 'russland', 59.94, 30.31),
  p('stockholm', 'Stockholm', 'schweden', 59.33, 18.07),
  p('kopenhagen', 'Kopenhagen', 'daenemark', 55.68, 12.57),
  p('oslo', 'Oslo', 'norwegen', 59.91, 10.75),
  p('stavanger', 'Stavanger', 'norwegen', 58.97, 5.73),
  p('hamburg', 'Hamburg', 'deutschland', 53.55, 9.99),
  p('amsterdam', 'Amsterdam', 'niederlande', 52.37, 4.9),
  p('ostende', 'Ostende', 'belgien', 51.23, 2.92),
  p('london', 'London', 'england', 51.51, 0.05),
  p('glasgow', 'Glasgow', 'england', 55.86, -4.25),
  p('dublin', 'Dublin', 'irland', 53.35, -6.26),
  p('lehavre', 'Le Havre', 'frankreich', 49.49, 0.11),
  p('bordeaux', 'Bordeaux', 'frankreich', 44.84, -1.1),
  p('santander', 'Santander', 'spanien', 43.46, -3.81),
  p('lissabon', 'Lissabon', 'portugal', 38.72, -9.14),
  p('barcelona', 'Barcelona', 'spanien', 41.39, 2.17),
  p('marseille', 'Marseille', 'frankreich', 43.3, 5.37),
  p('genua', 'Genua', 'italien', 44.41, 8.93),
  p('neapel', 'Neapel', 'italien', 40.84, 14.25),
  p('triest', 'Triest', 'italien', 45.65, 13.78),
  p('spalato', 'Spalato', 'jugoslawien', 43.51, 16.44),
  p('piraeus', 'Piräus (Athen)', 'griechenland', 37.94, 23.65),
  p('istanbul', 'Istanbul', 'tuerkei', 41.01, 28.98),

  // --- Asien --------------------------------------------------------------
  p('beirut', 'Beirut', 'syrien', 33.89, 35.5),

  // --- Afrika -------------------------------------------------------------
  p('rabat', 'Rabat', 'marokko', 34.02, -6.84),
  p('algier', 'Algier', 'algerien_tunesien', 36.75, 3.06),
  p('tunis', 'Tunis', 'algerien_tunesien', 36.8, 10.18),
  p('tripolis', 'Tripolis', 'libyen', 32.89, 13.19),
  p('tobruk', 'Tobruk', 'libyen', 32.08, 23.97),
  p('portsaid', 'Port Said', 'aegypten', 31.26, 32.3),
  p('ptsudan', 'Pt. Sudan', 'sudan', 19.62, 37.22),
  p('massaua', 'Massaua', 'aethiopien', 15.61, 39.45),
  p('dschibuti', 'Dschibuti', 'dschibuti', 11.59, 43.15),
  p('berbera', 'Berbera', 'somalia', 10.44, 45.01),
  p('mogadiscio', 'Mogadiscio', 'somalia', 2.04, 45.34),
  p('mombasa', 'Mombasa', 'kenia_tansania', -4.04, 39.67),
  p('daressalam', 'Daressalam', 'kenia_tansania', -6.79, 39.28),
  p('mosambique', 'Mosambique', 'mocambique', -15.03, 40.73),
  p('majunga', 'Majunga', 'madagaskar', -15.72, 46.32),
  p('beira', 'Beira', 'mocambique', -19.84, 34.84),
  p('laurencomarques', 'Laurenco-Marques', 'mocambique', -25.97, 32.57),
  p('portelizabeth', 'Port Elizabeth', 'suedafrika_namibia', -33.96, 25.6),
  p('kapstadt', 'Kapstadt', 'suedafrika_namibia', -33.92, 18.42),
  p('luederitz', 'Lüderitz', 'suedafrika_namibia', -26.65, 15.16),
  p('swakopmund', 'Swakopmund', 'suedafrika_namibia', -22.68, 14.53),
  p('benguela', 'Benguela', 'angola', -12.58, 13.41),
  p('banana', 'Banana', 'kongo', -6.0, 12.4),
  p('loanga', 'Loanga', 'gabun', -0.72, 8.78),
  p('duala', 'Duala', 'kamerun', 4.05, 9.7),
  p('lagos', 'Lagos', 'nigeria', 6.45, 3.39),
  p('capcoast', 'Cap Coast', 'ghana', 5.11, -1.25),
  p('monrovia', 'Monrovia', 'liberia', 6.31, -10.8),
  p('gambia', 'Gambia', 'mauretanien_senegal', 13.45, -16.58),
  p('dakar', 'Dakar', 'mauretanien_senegal', 14.72, -17.47),
  p('villacisneros', 'Villa Cisneros', 'span_sahara', 23.68, -15.95),

  // --- Nordamerika --------------------------------------------------------
  p('stjohn', 'St. John', 'neufundland', 47.56, -52.71),
  p('quebec', 'Quebec', 'kanada', 46.81, -71.21),
  p('halifax', 'Halifax', 'kanada', 44.65, -63.57),
  p('boston', 'Boston', 'usa', 42.36, -71.06, { exports: [7, 34, 38, 41] }),
  p('newyork', 'New York', 'usa', 40.71, -74.01, { exports: [38, 41, 62, 67, 69, 71] }),
  p('norfolk', 'Norfolk', 'usa', 36.85, -76.29, { exports: [5, 10, 34] }),
  p('charleston', 'Charleston', 'usa', 32.78, -79.93, { exports: [4, 19, 20, 22, 56] }),
  p('jacksonville', 'Jacksonville', 'usa', 30.33, -81.66, { exports: [21, 27, 39, 51, 59] }),
  p('miami', 'Miami', 'usa', 25.76, -80.19, { exports: [15, 26, 29, 45, 17, 38, 72] }),
  p('neworleans', 'New Orleans', 'usa', 29.15, -89.4, { exports: [1, 5, 15, 27] }),
  p('habana', 'Habana', 'cuba', 23.13, -82.38),
  p('progreso', 'Progreso', 'mexiko', 21.28, -89.66),
  p('veracruz', 'Vera Cruz', 'mexiko', 19.19, -96.14),
  p('truxillo', 'Truxillo', 'honduras', 15.91, -85.95),
  p('limon', 'Limon', 'costarica', 10.0, -83.03),
  p('colon', 'Colon', 'panama', 9.36, -79.9),
  p('cartagena', 'Cartagena', 'columbien', 10.39, -75.51),
  p('caracas', 'Caracas', 'venezuela', 10.6, -66.93),
  // Pacific side
  p('vancouver', 'Vancouver', 'kanada', 49.28, -123.12),
  p('astoria', 'Astoria', 'usa', 46.19, -123.83, { exports: [10, 17, 41, 45, 72] }),
  p('sanfrancisco', 'San Francisco', 'usa', 37.77, -122.42, { exports: [5, 14, 15, 20, 22, 27, 17] }),
  p('sandiego', 'San Diego', 'usa', 32.72, -117.16, { exports: [22, 39, 17, 51, 60, 69] }),
  p('mazatlan', 'Mazatlan', 'mexiko', 23.25, -106.41),
  p('sanblas', 'San Blas', 'mexiko', 21.54, -105.29),
  p('acapulco', 'Acapulco', 'mexiko', 16.86, -99.88),
  p('sanjose', 'S. José', 'guatemala', 13.93, -90.83),

  // --- Südamerika ---------------------------------------------------------
  p('buenaventura', 'Buenaventura', 'columbien', 3.88, -77.03),
  p('guayaquil', 'Guayaquil', 'ecuador', -2.19, -79.88),
  p('callao', 'Callao', 'peru', -12.05, -77.14),
  p('antofagasta', 'Antofagasta', 'chile', -23.65, -70.4),
  p('valparaiso', 'Valparaiso', 'chile', -33.05, -71.62),
  p('puertomontt', 'Puerto Montt', 'chile', -41.47, -72.94),
  p('magallanes', 'Magallanes', 'chile', -53.16, -70.91),
  p('santacruz', 'Santa Cruz', 'argentinien', -50.02, -68.52),
  p('rivadavia', 'Rivadavia', 'argentinien', -45.86, -67.48),
  p('bahiablanca', 'Bahia Blanca', 'argentinien', -38.72, -62.27),
  p('buenosaires', 'Buenos Aires', 'argentinien', -34.6, -58.38),
  p('montevideo', 'Montevideo', 'uruguay', -34.9, -56.19),
  p('riogrande', 'Rio Grande', 'brasilien', -32.03, -52.1),
  p('desterro', 'Desterro', 'brasilien', -27.6, -48.55),
  p('riodejaneiro', 'Rio de Janeiro', 'brasilien', -22.91, -43.17),
  p('saosalvador', 'Sao Salvador', 'brasilien', -12.97, -38.51),
  p('recife', 'Recife', 'brasilien', -8.05, -34.88),
  p('fortaleza', 'Fortaleza', 'brasilien', -3.73, -38.53),
  p('parabelem', 'Para Belem', 'brasilien', -1.46, -48.5),
  p('cayenne', 'Cayenne', 'guyana', 4.94, -52.33),
  p('paramaribo', 'Paramaribo', 'guyana', 5.85, -55.2),
  p('georgetown', 'Georgetown', 'guyana', 6.8, -58.16),
]

export const PORTS_BY_ID: ReadonlyMap<string, Port> = new Map(PORTS.map((x) => [x.id, x]))

/** Ausgangshäfen, deliberately spread across all four continents. */
export const START_PORTS: readonly string[] = [
  'hamburg',
  'newyork',
  'buenosaires',
  'kapstadt',
  'lissabon',
  'habana',
  'daressalam',
  'valparaiso',
  'london',
  'riodejaneiro',
  'dakar',
  'sanfrancisco',
]
