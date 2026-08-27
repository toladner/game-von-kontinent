import type { KonjunkturCard } from '../engine/types'
import { formatMoney } from '../i18n/locale'

/**
 * The 27 Konjunktur-Karten, transcribed from the photographed deck.
 *
 * Cards are pure data: `lines` is what the player reads on the card face,
 * `effects` is what the engine applies. Adding a card type later means adding
 * an effect variant in `@engine/types` and a case in the economy rules - the
 * deck itself stays declarative.
 *
 * The German is what is printed on the cards and is not to be improved. The
 * English beside it is a translation of a printed card, so it keeps the
 * telegraphic register of the original — "Verkaufspreise + 20 %" becomes
 * "Selling prices + 20 %", not a sentence explaining what that means. The
 * explaining is the Makler's job, and he does it elsewhere.
 */

let n = 0
const id = (kind: string) => `${kind}-${++n}`

const hausse = (percent: number): KonjunkturCard => ({
  id: id('hausse'),
  title: { de: 'Hausse', en: 'Boom' },
  lines: {
    de: [`Verkaufspreise + ${percent} %`],
    en: [`Selling prices + ${percent} %`],
  },
  effects: [{ kind: 'salePriceDelta', percent }],
})

const baisse = (percent: number): KonjunkturCard => ({
  id: id('baisse'),
  title: { de: 'Baisse', en: 'Slump' },
  lines: {
    de: [`Verkaufspreise — ${percent} %`],
    en: [`Selling prices — ${percent} %`],
  },
  effects: [{ kind: 'salePriceDelta', percent: -percent }],
})

const levy = (kind: 'steuer' | 'versicherung'): KonjunkturCard => ({
  id: id(kind),
  title:
    kind === 'steuer'
      ? { de: 'Steuer', en: 'Tax' }
      : { de: 'Versicherung', en: 'Insurance' },
  lines: {
    de: ['zahlbar von allen Schiffen', '10 % vom Warenwert', 'Verkaufspreise unverändert'],
    en: ['payable by all ships', '10 % of the value of goods', 'Selling prices unchanged'],
  },
  effects: [{ kind: 'leviedOnAllShips', levy: kind, percentOfCargoValue: 10 }],
})

const hafengebuehr = (): KonjunkturCard => ({
  id: id('hafengebuehr'),
  title: { de: 'Hafengebühr', en: 'Harbour dues' },
  lines: {
    de: ['für alle in einem Hafen', 'stehenden Schiffe', '5.000,—', 'Verkaufspreise + 20 %'],
    en: ['for all ships', 'lying in a harbour', '5,000.—', 'Selling prices + 20 %'],
  },
  effects: [
    { kind: 'portFeeAllInPort', amount: 5_000 },
    { kind: 'salePriceDelta', percent: 20 },
  ],
})

const entladegeld = (): KonjunkturCard => ({
  id: id('entladegeld'),
  title: { de: 'Entladegeld', en: 'Unloading charge' },
  lines: {
    de: ['3.000,—', 'Verkaufspreise — 10 %'],
    en: ['3,000.—', 'Selling prices — 10 %'],
  },
  effects: [
    { kind: 'feeForDrawer', amount: 3_000 },
    { kind: 'salePriceDelta', percent: -10 },
  ],
})

const telegramm = (amount: number, percent: number): KonjunkturCard => ({
  id: id('telegramm'),
  title: { de: 'Telegramm', en: 'Telegram' },
  lines: {
    de: [
      `Anweisung auf ${formatMoney('de', amount)}`,
      percent === 0
        ? 'Verkaufspreise unverändert'
        : `Verkaufspreise ${percent > 0 ? '+' : '—'} ${Math.abs(percent)} %`,
    ],
    en: [
      `Draft for ${formatMoney('en', amount)}`,
      percent === 0
        ? 'Selling prices unchanged'
        : `Selling prices ${percent > 0 ? '+' : '—'} ${Math.abs(percent)} %`,
    ],
  },
  effects: [
    { kind: 'payoutToDrawer', amount },
    ...(percent === 0 ? [] : [{ kind: 'salePriceDelta' as const, percent }]),
  ],
})

export const KONJUNKTUR_DECK: readonly KonjunkturCard[] = [
  hausse(20),
  hausse(20),
  hausse(20),
  hausse(20),
  hausse(25),
  hausse(25),
  hausse(25),
  hausse(25),
  baisse(10),
  baisse(10),
  baisse(10),
  baisse(10),
  baisse(10),
  baisse(20),
  baisse(20),
  baisse(20),
  baisse(20),
  baisse(20),
  levy('steuer'),
  levy('steuer'),
  levy('versicherung'),
  hafengebuehr(),
  hafengebuehr(),
  entladegeld(),
  telegramm(10_000, 10),
  telegramm(15_000, 0),
  telegramm(20_000, -10),
]

if (KONJUNKTUR_DECK.length !== 27) {
  throw new Error(`Konjunktur deck must hold 27 cards, has ${KONJUNKTUR_DECK.length}`)
}
