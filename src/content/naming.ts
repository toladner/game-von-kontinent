import type { Country, Good, Port } from '../engine/types'
import type { Localized } from '../i18n/locale'

/**
 * The content in English, as an overlay rather than a second copy.
 *
 * The data files stay exactly as transcribed from the printed material —
 * the Warenverzeichnis, the card sheet, the board — because they are the
 * record of what the game actually says, and a translation living inside them
 * would make them harder to check against a photograph. So the German name
 * stays where it is, and the tables below are folded onto it as the data is
 * assembled: every good, country and harbour ends up carrying an optional
 * `en` beside its printed `name`.
 *
 * Doing it at assembly rather than at the point of use is what keeps the
 * engine free of any knowledge of this file. The reducer reads a field; it
 * does not consult a dictionary.
 *
 * "Only the differences" is meant literally: Hamburg, Dakar and Aluminium are
 * absent below because they are the same word in both languages, and a lookup
 * that misses leaves the printed name to stand. That keeps this file to the
 * cases where a choice was actually made.
 *
 * Where a choice *was* made, it is the one a shipping clerk of the period
 * would have made — Genoa and the Grand Banks rather than Genua and the
 * Neufundlandbank, Copra and Saltpetre rather than a modern gloss. Places keep
 * the board's own spelling wherever English had no settled form of its own,
 * which is why Spalato, Batavia and Vera Cruz are still there under those
 * names.
 */

// ---------------------------------------------------------------------------
// Goods
// ---------------------------------------------------------------------------

/**
 * The Warenkarten in English, by card number.
 *
 * Numbers, not names, because the card number is what the Warenverzeichnis
 * and every country's export list are keyed by — and because two goods that
 * are near-synonyms in German need telling apart deliberately. Felle, Häute
 * and Pelze are skins, hides and furs; Gummi and Kautschuk are rubber goods
 * and the raw sap they are made from.
 */
const GOODS_EN: Readonly<Record<number, string>> = {
  2: 'Pineapples',
  3: 'Asbestos',
  4: 'Bananas',
  5: 'Cotton',
  6: 'Cotton goods',
  7: 'Building materials',
  8: 'Bauxite',
  9: 'Lead',
  10: 'Chemicals',
  11: 'Chrome ore',
  12: 'Diamonds',
  13: 'Eggs',
  14: 'Iron ore',
  15: 'Crude oil',
  16: 'Groundnuts',
  17: 'Copper',
  18: 'Skins',
  19: 'Fish',
  20: 'Meat products',
  21: 'Vegetables',
  22: 'Grain',
  24: 'Rubber goods',
  25: 'Hemp',
  26: 'Hides',
  27: 'Timber',
  28: 'Iodine',
  29: 'Coffee',
  30: 'Cocoa',
  31: 'Crude rubber',
  32: 'Cobalt',
  33: 'Salt',
  34: 'Coal',
  35: 'Copra',
  36: 'Currants',
  37: 'Cork',
  38: 'Motor cars',
  39: 'Fertiliser',
  40: 'Manganese ore',
  41: 'Machinery',
  42: 'Dairy produce',
  43: 'Metal goods',
  45: 'Oilseeds',
  46: 'Olive oil',
  47: 'Palm oil',
  48: 'Paper',
  49: 'Furs',
  50: 'Platinum',
  51: 'Phosphate',
  52: 'Mercury',
  53: 'Rice',
  54: 'Silk goods',
  55: 'Saltpetre',
  56: 'Sisal (jute)',
  57: 'Chocolate',
  58: 'Silver',
  59: 'Citrus fruit',
  60: 'Tobacco',
  61: 'Tea',
  62: 'Carpets',
  63: 'Textiles',
  64: 'Uranium ores',
  65: 'Vanilla',
  66: 'Livestock',
  67: 'Woven goods',
  68: 'Wine',
  69: 'Tools',
  70: 'Tungsten ore',
  71: 'Wool',
  72: 'Sugar',
  73: 'Raw silk',
  74: 'Tin',
  75: 'Soya beans',
  76: 'Spices',
  77: 'Pearls',
  78: 'Porcelain',
  79: 'Coconut oil',
  80: 'Lamb',
  82: 'Teak',
  83: 'Lacquer',
  85: 'Camphor',
  86: 'Quinine',
  87: 'Zinc',
  88: 'Opals',
  89: 'Bamboo',
  90: 'Ginger',
}

// ---------------------------------------------------------------------------
// Countries
// ---------------------------------------------------------------------------

const COUNTRIES_EN: Readonly<Record<string, string>> = {
  belgien: 'Belgium',
  daenemark: 'Denmark',
  deutschland: 'Germany',
  england: 'England and Scotland',
  frankreich: 'France',
  griechenland: 'Greece',
  jugoslawien: 'Yugoslavia',
  italien: 'Italy',
  irland: 'Ireland',
  niederlande: 'Netherlands',
  norwegen: 'Norway',
  russland: 'Russia',
  schweden: 'Sweden',
  spanien: 'Spain',
  tuerkei: 'Turkey',
  syrien: 'Syria',
  costarica: 'Costa Rica',
  kanada: 'Canada',
  neufundland: 'Newfoundland',
  mexiko: 'Mexico',
  usa: 'United States',
  argentinien: 'Argentina',
  brasilien: 'Brazil',
  columbien: 'Colombia',
  algerien_tunesien: 'Algeria & Tunisia',
  aegypten: 'Egypt',
  aethiopien: 'Ethiopia',
  dschibuti: 'Djibouti (Fr.)',
  gabun: 'Gabon',
  kamerun: 'Cameroon',
  kenia_tansania: 'Kenya & Tanzania',
  libyen: 'Libya',
  madagaskar: 'Madagascar',
  marokko: 'Morocco',
  mauretanien_senegal: 'Mauritania, Senegal',
  mocambique: 'Mozambique',
  span_sahara: 'Sp. Sahara',
  suedafrika_namibia: 'S. African Republic, Namibia',
  kongo: "People's Rep. of Congo",
  arabien: 'Arabia and Aden',
  irak: 'Iraq',
  persien: 'Persia',
  indien: 'India',
  indonesien: 'Indonesia',
  philippinen: 'Philippines',
  hongkong: 'Hong Kong',
  australien: 'Australia',
  neuseeland: 'New Zealand',
}

// ---------------------------------------------------------------------------
// Harbours
// ---------------------------------------------------------------------------

const PORTS_EN: Readonly<Record<string, string>> = {
  kopenhagen: 'Copenhagen',
  ostende: 'Ostend',
  lissabon: 'Lisbon',
  genua: 'Genoa',
  neapel: 'Naples',
  triest: 'Trieste',
  piraeus: 'Piraeus (Athens)',
  algier: 'Algiers',
  tripolis: 'Tripoli',
  massaua: 'Massawa',
  dschibuti: 'Djibouti',
  mogadiscio: 'Mogadishu',
  daressalam: 'Dar es Salaam',
  mosambique: 'Mozambique',
  kapstadt: 'Cape Town',
  duala: 'Douala',
  capcoast: 'Cape Coast',
  habana: 'Havana',
  karatschi: 'Karachi',
  kalkutta: 'Calcutta',
  rangun: 'Rangoon',
  singapur: 'Singapore',
  schanghai: 'Shanghai',
  kanton: 'Canton',
}

// ---------------------------------------------------------------------------
// Folding the overlay onto the data
// ---------------------------------------------------------------------------

export function withEnglishGood<T extends Good>(good: T): T {
  const en = GOODS_EN[good.id]
  return en ? { ...good, en } : good
}

export function withEnglishCountry<T extends Country>(country: T): T {
  const en = COUNTRIES_EN[country.id]
  return en ? { ...country, en } : country
}

export function withEnglishPort<T extends Port>(port: T): T {
  const en = PORTS_EN[port.id]
  return en ? { ...port, en } : port
}

/** The six parts of the world, as the plan divides them. */
export const CONTINENT_NAMES: Readonly<Record<string, Localized<string>>> = {
  europa: { de: 'Europa', en: 'Europe' },
  asien: { de: 'Asien', en: 'Asia' },
  afrika: { de: 'Afrika', en: 'Africa' },
  nordamerika: { de: 'Nordamerika', en: 'North America' },
  suedamerika: { de: 'Südamerika', en: 'South America' },
  ozeanien: { de: 'Ozeanien', en: 'Oceania' },
}

export function continentLabel(id: string): Localized<string> {
  return CONTINENT_NAMES[id] ?? { de: id, en: id }
}

/** Every id the tables above claim to translate — checked by a test. */
export const TRANSLATED_IDS = {
  goods: Object.keys(GOODS_EN).map(Number),
  countries: Object.keys(COUNTRIES_EN),
  ports: Object.keys(PORTS_EN),
}
