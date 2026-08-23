import type { Good } from '../engine/types'

/**
 * The Warenkarten the printed game never needed.
 *
 * The original board stops at the Suez Canal, so its 72 cards are the goods
 * of Europe, Africa and the Americas. A world plan reaching to Shanghai and
 * Sydney wants the cargoes those coasts actually shipped, so this list adds
 * them — numbered from 73 on, leaving the printed cards untouched at their
 * original numbers.
 *
 * Priced in the same idiom as the originals: Einkauf in whole tens of
 * thousands, Verkauf a plausible margin above it, and the rare and difficult
 * goods dearer than the bulk ones.
 */
export const GOODS_WELT: readonly Good[] = [
  { id: 73, name: 'Rohseide', buy: 200_000, sell: 260_000, category: 'textil' },
  { id: 74, name: 'Zinn', buy: 180_000, sell: 240_000, category: 'bergbau' },
  { id: 75, name: 'Sojabohnen', buy: 60_000, sell: 90_000, category: 'agrar' },
  { id: 76, name: 'Gewürze', buy: 90_000, sell: 130_000, category: 'genuss' },
  { id: 77, name: 'Perlen', buy: 240_000, sell: 320_000, category: 'bergbau' },
  { id: 78, name: 'Porzellan', buy: 70_000, sell: 100_000, category: 'industrie' },
  { id: 79, name: 'Kokosöl', buy: 70_000, sell: 100_000, category: 'agrar' },
  { id: 80, name: 'Lammfleisch', buy: 110_000, sell: 150_000, category: 'tier' },
  { id: 81, name: 'Butter', buy: 60_000, sell: 90_000, category: 'tier' },
  { id: 82, name: 'Teakholz', buy: 150_000, sell: 200_000, category: 'agrar' },
  { id: 83, name: 'Lack', buy: 80_000, sell: 110_000, category: 'industrie' },
  { id: 84, name: 'Jade', buy: 220_000, sell: 290_000, category: 'bergbau' },
  { id: 85, name: 'Kampfer', buy: 100_000, sell: 140_000, category: 'industrie' },
  { id: 86, name: 'Chinin', buy: 130_000, sell: 180_000, category: 'industrie' },
  { id: 87, name: 'Zink', buy: 140_000, sell: 180_000, category: 'bergbau' },
  { id: 88, name: 'Opale', buy: 200_000, sell: 270_000, category: 'bergbau' },
  { id: 89, name: 'Bambus', buy: 30_000, sell: 45_000, category: 'agrar' },
  { id: 90, name: 'Ingwer', buy: 50_000, sell: 70_000, category: 'genuss' },
]
