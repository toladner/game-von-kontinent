import type { Good } from '../engine/types'
import { withEnglishGood } from './naming'

/**
 * The 72 Warenkarten.
 *
 * `buy`  - "EINKAUF", cross-checked against the Warenverzeichnis (liste.pdf),
 *          where every country lists the card number and the purchase price
 *          in thousands. That table is the authoritative, legible source.
 * `sell` - "VERKAUF", read off the photographed card sheet.
 *
 * A handful of sell prices sit at an unusually fat margin; they are flagged
 * with NOTE so they can be checked against the physical cards. Nothing in the
 * engine hardcodes these numbers - fixing one is a one-line edit here.
 */
const PRINTED: readonly Good[] = [
  { id: 1, name: 'Aluminium', buy: 100_000, sell: 130_000, category: 'bergbau' },
  { id: 2, name: 'Ananas', buy: 40_000, sell: 50_000, category: 'agrar' },
  { id: 3, name: 'Asbest', buy: 60_000, sell: 80_000, category: 'bergbau' },
  { id: 4, name: 'Bananen', buy: 80_000, sell: 100_000, category: 'agrar' },
  { id: 5, name: 'Baumwolle', buy: 160_000, sell: 200_000, category: 'textil' },
  { id: 6, name: 'Baumwollwaren', buy: 70_000, sell: 100_000, category: 'textil' },
  { id: 7, name: 'Baustoffe', buy: 140_000, sell: 180_000, category: 'industrie' },
  { id: 8, name: 'Bauxit', buy: 220_000, sell: 270_000, category: 'bergbau' },
  { id: 9, name: 'Blei', buy: 120_000, sell: 150_000, category: 'bergbau' },
  { id: 10, name: 'Chemikalien', buy: 130_000, sell: 170_000, category: 'industrie' },
  { id: 11, name: 'Chromerz', buy: 190_000, sell: 240_000, category: 'bergbau' },
  { id: 12, name: 'Diamanten', buy: 280_000, sell: 360_000, category: 'edel' },
  { id: 13, name: 'Eier', buy: 80_000, sell: 110_000, category: 'tier' },
  { id: 14, name: 'Eisenerz', buy: 250_000, sell: 320_000, category: 'bergbau' },
  { id: 15, name: 'Erdöl', buy: 260_000, sell: 320_000, category: 'energie' },
  { id: 16, name: 'Erdnüsse', buy: 70_000, sell: 90_000, category: 'agrar' },
  { id: 17, name: 'Kupfer', buy: 240_000, sell: 310_000, category: 'bergbau' },
  { id: 18, name: 'Felle', buy: 110_000, sell: 140_000, category: 'tier' },
  { id: 19, name: 'Fische', buy: 100_000, sell: 130_000, category: 'tier' },
  // NOTE verify: 120 -> 180 is a 1.5x margin, unusual for this price band.
  { id: 20, name: 'Fleischwaren', buy: 120_000, sell: 180_000, category: 'tier' },
  { id: 21, name: 'Gemüse', buy: 40_000, sell: 50_000, category: 'agrar' },
  { id: 22, name: 'Getreide', buy: 170_000, sell: 220_000, category: 'agrar' },
  { id: 23, name: 'Gold', buy: 300_000, sell: 360_000, category: 'edel' },
  { id: 24, name: 'Gummi', buy: 120_000, sell: 160_000, category: 'industrie' },
  { id: 25, name: 'Hanf', buy: 80_000, sell: 110_000, category: 'textil' },
  { id: 26, name: 'Häute', buy: 130_000, sell: 170_000, category: 'tier' },
  { id: 27, name: 'Holz', buy: 180_000, sell: 230_000, category: 'agrar' },
  { id: 28, name: 'Jod', buy: 60_000, sell: 80_000, category: 'industrie' },
  { id: 29, name: 'Kaffee', buy: 180_000, sell: 220_000, category: 'genuss' },
  { id: 30, name: 'Kakao', buy: 130_000, sell: 170_000, category: 'genuss' },
  { id: 31, name: 'Kautschuk', buy: 150_000, sell: 190_000, category: 'industrie' },
  { id: 32, name: 'Kobalt', buy: 160_000, sell: 200_000, category: 'bergbau' },
  { id: 33, name: 'Kochsalz', buy: 60_000, sell: 80_000, category: 'bergbau' },
  { id: 34, name: 'Kohle', buy: 120_000, sell: 160_000, category: 'energie' },
  { id: 35, name: 'Kopra', buy: 60_000, sell: 90_000, category: 'agrar' },
  // NOTE verify: 40 -> 60.
  { id: 36, name: 'Korinthen', buy: 40_000, sell: 60_000, category: 'genuss' },
  { id: 37, name: 'Korke', buy: 30_000, sell: 40_000, category: 'agrar' },
  { id: 38, name: 'Kraftwagen', buy: 200_000, sell: 260_000, category: 'industrie' },
  // NOTE verify: 40 -> 70 is the fattest margin on the sheet.
  { id: 39, name: 'Kunstdünger', buy: 40_000, sell: 70_000, category: 'industrie' },
  { id: 40, name: 'Manganerz', buy: 200_000, sell: 250_000, category: 'bergbau' },
  { id: 41, name: 'Maschinen', buy: 240_000, sell: 300_000, category: 'industrie' },
  { id: 42, name: 'Milchprodukte', buy: 60_000, sell: 80_000, category: 'tier' },
  { id: 43, name: 'Metallwaren', buy: 180_000, sell: 240_000, category: 'industrie' },
  { id: 44, name: 'Nickel', buy: 160_000, sell: 220_000, category: 'bergbau' },
  { id: 45, name: 'Ölsaaten', buy: 90_000, sell: 120_000, category: 'agrar' },
  { id: 46, name: 'Olivenöl', buy: 120_000, sell: 160_000, category: 'genuss' },
  { id: 47, name: 'Palmöl', buy: 90_000, sell: 130_000, category: 'agrar' },
  { id: 48, name: 'Papier', buy: 140_000, sell: 170_000, category: 'industrie' },
  { id: 49, name: 'Pelze', buy: 110_000, sell: 150_000, category: 'tier' },
  { id: 50, name: 'Platin', buy: 160_000, sell: 200_000, category: 'edel' },
  { id: 51, name: 'Phosphat', buy: 90_000, sell: 120_000, category: 'bergbau' },
  { id: 52, name: 'Quecksilber', buy: 90_000, sell: 130_000, category: 'bergbau' },
  { id: 53, name: 'Reis', buy: 60_000, sell: 80_000, category: 'agrar' },
  { id: 54, name: 'Seidenwaren', buy: 50_000, sell: 80_000, category: 'textil' },
  { id: 55, name: 'Salpeter', buy: 140_000, sell: 170_000, category: 'industrie' },
  { id: 56, name: 'Sisalhanf (Jute)', buy: 70_000, sell: 100_000, category: 'textil' },
  { id: 57, name: 'Schokolade', buy: 40_000, sell: 80_000, category: 'genuss' },
  { id: 58, name: 'Silber', buy: 120_000, sell: 150_000, category: 'edel' },
  { id: 59, name: 'Südfrüchte', buy: 90_000, sell: 130_000, category: 'agrar' },
  { id: 60, name: 'Tabak', buy: 100_000, sell: 150_000, category: 'genuss' },
  { id: 61, name: 'Tee', buy: 80_000, sell: 110_000, category: 'genuss' },
  { id: 62, name: 'Teppiche', buy: 40_000, sell: 80_000, category: 'textil' },
  { id: 63, name: 'Textilwaren', buy: 90_000, sell: 130_000, category: 'textil' },
  { id: 64, name: 'Uranerze', buy: 210_000, sell: 270_000, category: 'energie' },
  { id: 65, name: 'Vanille', buy: 20_000, sell: 40_000, category: 'genuss' },
  { id: 66, name: 'Vieh', buy: 130_000, sell: 170_000, category: 'tier' },
  { id: 67, name: 'Webwaren', buy: 90_000, sell: 130_000, category: 'textil' },
  { id: 68, name: 'Wein', buy: 80_000, sell: 110_000, category: 'genuss' },
  { id: 69, name: 'Werkzeuge', buy: 160_000, sell: 210_000, category: 'industrie' },
  { id: 70, name: 'Wolframerz', buy: 280_000, sell: 360_000, category: 'bergbau' },
  { id: 71, name: 'Wolle', buy: 180_000, sell: 240_000, category: 'textil' },
  { id: 72, name: 'Zucker', buy: 110_000, sell: 140_000, category: 'agrar' },
]

/**
 * The deck as the rest of the game sees it: the printed cards above with the
 * English names folded on. Nothing else changes — the numbers, the prices and
 * the categories are the transcription, untouched.
 */
export const GOODS: readonly Good[] = PRINTED.map(withEnglishGood)

export const GOODS_BY_ID: ReadonlyMap<number, Good> = new Map(GOODS.map((g) => [g.id, g]))

export function good(id: number): Good {
  const g = GOODS_BY_ID.get(id)
  if (!g) throw new Error(`Unknown good ${id}`)
  return g
}
