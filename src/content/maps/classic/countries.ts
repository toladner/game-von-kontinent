import type { Country } from '@engine/types'

/**
 * Export countries exactly as printed in the Warenverzeichnis (liste.pdf).
 * Numbers are Warenkarten-Nummern; see `@content/goods`.
 *
 * The United States are the one country whose list is broken down per city.
 * Those live as per-port overrides in `./ports`.
 */
export const COUNTRIES: readonly Country[] = [
  // --- Europa -------------------------------------------------------------
  { id: 'belgien', name: 'Belgien', continent: 'europa', exports: [21, 34, 41, 42, 43] },
  { id: 'daenemark', name: 'Dänemark', continent: 'europa', exports: [13, 20, 42] },
  { id: 'deutschland', name: 'Deutschland', continent: 'europa', exports: [7, 10, 34, 41, 43, 67, 69] },
  { id: 'england', name: 'England und Schottland', continent: 'europa', exports: [6, 10, 38, 54, 69] },
  { id: 'frankreich', name: 'Frankreich', continent: 'europa', exports: [8, 14, 41, 63, 68] },
  { id: 'griechenland', name: 'Griechenland', continent: 'europa', exports: [36, 46, 60, 68] },
  { id: 'jugoslawien', name: 'Jugoslawien', continent: 'europa', exports: [8, 22, 27, 17, 66] },
  { id: 'italien', name: 'Italien', continent: 'europa', exports: [7, 38, 41, 52, 59, 63] },
  { id: 'irland', name: 'Irland', continent: 'europa', exports: [13, 20, 42, 66] },
  { id: 'niederlande', name: 'Niederlande', continent: 'europa', exports: [13, 21, 42, 57, 63] },
  { id: 'norwegen', name: 'Norwegen', continent: 'europa', exports: [20, 27, 48] },
  { id: 'portugal', name: 'Portugal', continent: 'europa', exports: [19, 37, 67, 68, 70] },
  { id: 'russland', name: 'Rußland', continent: 'europa', exports: [15, 18, 22, 27, 17, 40, 49] },
  { id: 'schweden', name: 'Schweden', continent: 'europa', exports: [14, 27, 41, 48] },
  { id: 'spanien', name: 'Spanien', continent: 'europa', exports: [59, 67, 68] },
  { id: 'tuerkei', name: 'Türkei', continent: 'europa', exports: [21, 59, 60, 62, 71] },

  // --- Asien --------------------------------------------------------------
  { id: 'syrien', name: 'Syrien', continent: 'asien', exports: [22, 62, 67, 71] },

  // --- Nordamerika --------------------------------------------------------
  { id: 'costarica', name: 'Costarica', continent: 'nordamerika', exports: [4, 25, 27, 29, 30] },
  { id: 'cuba', name: 'Cuba', continent: 'nordamerika', exports: [2, 4, 11, 40, 60, 72] },
  { id: 'guatemala', name: 'Guatemala', continent: 'nordamerika', exports: [4, 24, 29] },
  { id: 'honduras', name: 'Honduras', continent: 'nordamerika', exports: [4, 27, 29, 35] },
  { id: 'kanada', name: 'Kanada', continent: 'nordamerika', exports: [1, 22, 27, 17, 44, 48, 49] },
  { id: 'neufundland', name: 'Neufundland', continent: 'nordamerika', exports: [14, 19] },
  { id: 'mexiko', name: 'Mexiko', continent: 'nordamerika', exports: [4, 5, 15, 23, 56] },
  // Per-city lists; see ports.ts for the overrides.
  { id: 'usa', name: 'Vereinigte Staaten', continent: 'nordamerika', exports: [] },

  // --- Südamerika ---------------------------------------------------------
  { id: 'argentinien', name: 'Argentinien', continent: 'suedamerika', exports: [20, 22, 45, 71] },
  { id: 'brasilien', name: 'Brasilien', continent: 'suedamerika', exports: [5, 24, 27, 29, 31, 72] },
  { id: 'chile', name: 'Chile', continent: 'suedamerika', exports: [18, 28, 39, 17, 55] },
  { id: 'columbien', name: 'Columbien', continent: 'suedamerika', exports: [4, 29, 50] },
  { id: 'ecuador', name: 'Ecuador', continent: 'suedamerika', exports: [4, 30, 53] },
  { id: 'guyana', name: 'Guyana', continent: 'suedamerika', exports: [8, 12, 53, 72] },
  { id: 'panama', name: 'Panama', continent: 'suedamerika', exports: [4, 29, 72] },
  { id: 'peru', name: 'Peru', continent: 'suedamerika', exports: [5, 15, 17, 72] },
  { id: 'uruguay', name: 'Uruguay', continent: 'suedamerika', exports: [18, 20, 26, 71] },
  { id: 'venezuela', name: 'Venezuela', continent: 'suedamerika', exports: [15, 26, 29, 30] },

  // --- Afrika -------------------------------------------------------------
  { id: 'algerien_tunesien', name: 'Algerien u. Tunesien', continent: 'afrika', exports: [21, 51, 68] },
  { id: 'aegypten', name: 'Ägypten', continent: 'afrika', exports: [5, 53] },
  { id: 'angola', name: 'Angola', continent: 'afrika', exports: [12, 29] },
  { id: 'aethiopien', name: 'Äthiopien', continent: 'afrika', exports: [22, 26, 29] },
  { id: 'dschibuti', name: 'Dschibuti (franz.)', continent: 'afrika', exports: [22, 26, 29] },
  { id: 'gabun', name: 'Gabun', continent: 'afrika', exports: [27, 29, 30] },
  { id: 'ghana', name: 'Ghana', continent: 'afrika', exports: [23, 27, 30, 40] },
  { id: 'kamerun', name: 'Kamerun', continent: 'afrika', exports: [4, 5] },
  { id: 'kenia_tansania', name: 'Kenia u. Tansania', continent: 'afrika', exports: [5, 26, 29, 56, 61] },
  { id: 'liberia', name: 'Liberia', continent: 'afrika', exports: [31, 47] },
  { id: 'libyen', name: 'Libyen', continent: 'afrika', exports: [33, 51, 59, 68] },
  { id: 'madagaskar', name: 'Madagaskar', continent: 'afrika', exports: [26, 29, 56, 65] },
  { id: 'marokko', name: 'Marokko', continent: 'afrika', exports: [22, 40, 51, 71] },
  { id: 'mauretanien_senegal', name: 'Mauretanien, Senegal', continent: 'afrika', exports: [4, 16, 27, 29] },
  { id: 'mocambique', name: 'Moçambique', continent: 'afrika', exports: [5, 35] },
  { id: 'nigeria', name: 'Nigeria', continent: 'afrika', exports: [16, 26, 47] },
  // The printed sheet gives Häute the card number 66 by mistake; Häute is 26.
  { id: 'somalia', name: 'Somalia', continent: 'afrika', exports: [26, 66] },
  { id: 'span_sahara', name: 'Span. Sahara', continent: 'afrika', exports: [14, 19, 26] },
  { id: 'sudan', name: 'Sudan', continent: 'afrika', exports: [5, 24] },
  {
    id: 'suedafrika_namibia',
    name: 'Südafr. Republik, Namibia',
    continent: 'afrika',
    exports: [3, 9, 12, 23, 32, 17, 58, 60, 67, 71, 72],
  },
  { id: 'kongo', name: 'Volksrep. Kongo', continent: 'afrika', exports: [27, 17, 47, 64] },
]

export const COUNTRIES_BY_ID: ReadonlyMap<string, Country> = new Map(
  COUNTRIES.map((c) => [c.id, c]),
)
