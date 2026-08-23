import type { Country } from '../../../engine/types'

/**
 * The export countries east of Suez.
 *
 * Written in the same idiom as the printed Warenverzeichnis: a country ships
 * a handful of goods and those are the only ones its harbours sell. Numbers
 * below 73 are the original Warenkarten (`@content/goods`); 73 and up are the
 * additions this plan needs (`@content/goods-welt`).
 *
 * Chosen for what these coasts actually shipped in the early 1950s, which is
 * also what makes them worth sailing to: Malayan tin and rubber, Chinese silk
 * and porcelain, Australian wool and ores, New Zealand butter and mutton.
 */
export const COUNTRIES_WELT: readonly Country[] = [
  // --- Vorderasien und Indien ---------------------------------------------
  { id: 'arabien', name: 'Arabien und Aden', continent: 'asien', exports: [15, 26, 59, 76] },
  { id: 'irak', name: 'Irak', continent: 'asien', exports: [15, 22, 59] },
  { id: 'persien', name: 'Persien', continent: 'asien', exports: [15, 62, 55] },
  {
    id: 'pakistan',
    name: 'Pakistan',
    continent: 'asien',
    exports: [5, 26, 62, 71],
  },
  {
    id: 'indien',
    name: 'Indien',
    continent: 'asien',
    exports: [5, 29, 53, 56, 61, 63, 90],
  },
  { id: 'ceylon', name: 'Ceylon', continent: 'asien', exports: [30, 35, 61, 79] },
  { id: 'burma', name: 'Burma', continent: 'asien', exports: [22, 53, 82] },

  // --- Hinterindien und Insulinde -----------------------------------------
  { id: 'siam', name: 'Siam', continent: 'asien', exports: [53, 74, 82, 89] },
  { id: 'malaya', name: 'Malaya', continent: 'asien', exports: [31, 47, 74, 76] },
  {
    id: 'indonesien',
    name: 'Indonesien',
    continent: 'asien',
    exports: [15, 31, 35, 61, 76, 86],
  },
  { id: 'philippinen', name: 'Philippinen', continent: 'asien', exports: [24, 35, 72, 79] },

  // --- Ostasien ------------------------------------------------------------
  {
    id: 'china',
    name: 'China',
    continent: 'asien',
    exports: [61, 73, 75, 78, 83, 84, 89],
  },
  { id: 'hongkong', name: 'Hongkong', continent: 'asien', exports: [63, 67, 78, 84] },
  { id: 'formosa', name: 'Formosa', continent: 'asien', exports: [53, 72, 85] },
  {
    id: 'japan',
    name: 'Japan',
    continent: 'asien',
    exports: [19, 43, 63, 73, 77, 78],
  },

  // --- Ozeanien ------------------------------------------------------------
  {
    id: 'australien',
    name: 'Australien',
    continent: 'ozeanien',
    exports: [20, 22, 40, 66, 71, 87, 88],
  },
  {
    id: 'neuseeland',
    name: 'Neuseeland',
    continent: 'ozeanien',
    exports: [42, 71, 80, 81],
  },
]
