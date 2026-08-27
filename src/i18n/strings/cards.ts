import type { Catalog } from '../t'

/**
 * The two pieces of card stock the game is made of.
 *
 * A Warenkarte is a form: EINKAUF over VERKAUF, a number in the corner, and
 * nothing that is not on the printed original. The English uses the words a
 * British shipping office of the period would have had set on the same form —
 * "Cost" and "Sale", not "Buy price" and "Sell price".
 *
 * The Konjunkturkarte's own face is content and lives with the deck; what is
 * here is the frame around it and the line the app adds underneath when a
 * card is standing over the whole world rather than being drawn at a quay.
 */
export const CARDS = {
  // --- Warenkarte ---------------------------------------------------------
  'card.buy': { de: 'Einkauf', en: 'Cost' },
  'card.sell': { de: 'Verkauf', en: 'Sale' },
  'card.number': {
    de: 'Warenverzeichnis Nummer {id}',
    en: 'Register of goods, number {id}',
  },

  // --- Konjunkturkarte ----------------------------------------------------
  'card.heading': { de: 'Konjunkturkarte', en: 'Market card' },

  /*
   * When and to whom a standing world card applies.
   *
   * The card face is the printed one, and it was written for a game where you
   * drew it yourself at a quayside. Left at that in real-time play it reads
   * as a bill with no date on it — which is exactly how it felt when the whole
   * fleet was charged the moment it turned. The card is unchanged; what it
   * needs is a line saying when it will reach you.
   */
  'card.standing.feeForDrawer': {
    de: 'Fällig, sobald gelöscht wird — einmal je Schiff, solange die Karte steht. Wer nichts an Land bringt, zahlt nichts.',
    en: 'Payable as soon as cargo is landed — once per ship, for as long as the card stands. Land nothing and you pay nothing.',
  },
  'card.standing.payoutToDrawer': {
    de: 'Geht an jedes Haus, das einen Hafen anläuft: ein Telegramm erreicht niemanden auf See.',
    en: 'Goes to every house that makes port: a telegram reaches nobody at sea.',
  },
  'card.standing.portFeeAllInPort': {
    de: 'Zahlt, wessen Schiff im Hafen liegt oder anlegt, solange die Karte steht.',
    en: 'Paid by whoever is lying in harbour, or comes alongside, while the card stands.',
  },
  'card.standing.leviedOnAllShips': {
    de: 'Zahlbar von allen Schiffen, auch auf See — ein Zehntel der Ladung, die an Bord ist. Ein leerer Laderaum kostet nichts.',
    en: 'Payable by all ships, at sea as well — a tenth of what is aboard. An empty hold costs nothing.',
  },
  'card.standing.stormInRegion': {
    de: 'Trifft jedes Schiff, das sich in dieser Ecke der Welt befindet — im Hafen wie auf See.',
    en: 'Strikes every ship in that corner of the world — in harbour as at sea.',
  },
  'card.standing.cargoDamagedInRegion': {
    de: 'Die Ladung bleibt an Bord, bringt aber nur die Hälfte. Wo Sie den Posten losschlagen, bleibt Ihre Sache.',
    en: 'The cargo stays aboard but fetches half. Where you get rid of it is your own affair.',
  },
  'card.standing.delayInRegion': {
    de: 'Trifft jedes Schiff, das dort gerade unterwegs ist. Wer im Hafen liegt, liegt sicher.',
    en: 'Strikes every ship under way there. Anyone lying in harbour lies safe.',
  },
  'card.standing.goodPriceDelta': {
    de: 'Gilt in jedem Hafen — es kommt darauf an, was Sie geladen haben, nicht wo Sie liegen.',
    en: 'Holds in every harbour — what matters is what you are carrying, not where you are.',
  },
  'card.standing.portClosed': {
    de: 'Welcher Hafen es trifft, steht in den Nachrichten. Hinfahren dürfen Sie weiter — vielleicht ist die Sperre aufgehoben, wenn Sie ankommen.',
    en: 'Which harbour it falls on is in the news. You may still sail there — the closure may be lifted by the time you arrive.',
  },
} satisfies Catalog
