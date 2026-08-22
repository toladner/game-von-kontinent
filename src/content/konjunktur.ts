import type { KonjunkturCard } from '@engine/types'

/**
 * The 27 Konjunktur-Karten, transcribed from the photographed deck.
 *
 * Cards are pure data: `lines` is what the player reads on the card face,
 * `effects` is what the engine applies. Adding a card type later means adding
 * an effect variant in `@engine/types` and a case in the economy rules - the
 * deck itself stays declarative.
 */

let n = 0
const id = (kind: string) => `${kind}-${++n}`

const hausse = (percent: number): KonjunkturCard => ({
  id: id('hausse'),
  title: 'Hausse',
  lines: [`Verkaufspreise + ${percent} %`],
  effects: [{ kind: 'salePriceDelta', percent }],
})

const baisse = (percent: number): KonjunkturCard => ({
  id: id('baisse'),
  title: 'Baisse',
  lines: [`Verkaufspreise — ${percent} %`],
  effects: [{ kind: 'salePriceDelta', percent: -percent }],
})

const levy = (kind: 'steuer' | 'versicherung'): KonjunkturCard => ({
  id: id(kind),
  title: kind === 'steuer' ? 'Steuer' : 'Versicherung',
  lines: ['zahlbar von allen Schiffen', '10 % vom Warenwert', 'Verkaufspreise unverändert'],
  effects: [{ kind: 'leviedOnAllShips', levy: kind, percentOfCargoValue: 10 }],
})

const hafengebuehr = (): KonjunkturCard => ({
  id: id('hafengebuehr'),
  title: 'Hafengebühr',
  lines: ['für alle in einem Hafen', 'stehenden Schiffe', '5.000,—', 'Verkaufspreise + 20 %'],
  effects: [
    { kind: 'portFeeAllInPort', amount: 5_000 },
    { kind: 'salePriceDelta', percent: 20 },
  ],
})

const entladegeld = (): KonjunkturCard => ({
  id: id('entladegeld'),
  title: 'Entladegeld',
  lines: ['3.000,—', 'Verkaufspreise — 10 %'],
  effects: [
    { kind: 'feeForDrawer', amount: 3_000 },
    { kind: 'salePriceDelta', percent: -10 },
  ],
})

const telegramm = (amount: number, percent: number): KonjunkturCard => ({
  id: id('telegramm'),
  title: 'Telegramm',
  lines: [
    `Anweisung auf ${amount.toLocaleString('de-DE')},—`,
    percent === 0
      ? 'Verkaufspreise unverändert'
      : `Verkaufspreise ${percent > 0 ? '+' : '—'} ${Math.abs(percent)} %`,
  ],
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
