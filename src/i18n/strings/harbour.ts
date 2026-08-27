import type { Catalog } from '../t'

/**
 * The harbour sheet: the quay, the offer, the chart, and the card a harbour
 * shows when it is only being looked at from the sea.
 *
 * Two things in here are worth naming rather than translating word for word.
 * *Verkaufszwang* is the printed rule that a ship must land at least one class
 * of goods the harbour does not itself export — "forced sale" is the closest
 * English trade has, and it keeps the compulsion. *Ablegen* is casting off;
 * English says "sail" for the same act, which is shorter and reads better on
 * a button than the literal "cast off from the quay".
 */
export const HARBOUR = {
  // --- The head of the sheet ----------------------------------------------
  'port.enter': { de: 'Hafen betreten', en: 'Go ashore' },
  'port.watching': {
    de: '{name} ist am Zug — Sie sehen mit.',
    en: 'It is {name}’s turn — you are looking on.',
  },
  'port.closure': { de: 'Hafensperre', en: 'Harbour closed' },
  'port.closure.note': {
    de: 'Das Kontor ist geschlossen — hier wird weder gekauft noch verkauft, bis die Sperre aufgehoben ist.',
    en: 'The counting house is shut — nothing is bought or sold here until the closure is lifted.',
  },

  // --- The one-line ledger ------------------------------------------------
  'port.cash': { de: 'Kasse', en: 'Cash' },
  'port.purchases': { de: 'Einkauf', en: 'Purchases' },
  'port.cargo': { de: 'Ladung', en: 'Cargo' },
  'port.worldMarket': {
    de: 'Weltmarkt: Verkaufspreise {sign} {percent} %',
    en: 'World market: selling prices {sign} {percent} %',
  },

  // --- The one button at the foot -----------------------------------------
  'port.next': { de: 'Weiter zu {step}', en: 'On to {step}' },
  'port.chooseOnMap': { de: 'Hafen auf der Karte wählen', en: 'Choose a harbour on the chart' },
  'port.mustSellFirst': { de: 'Erst absetzen — Verkaufszwang', en: 'Sell first — forced sale' },
  'port.sailEmpty.confirm': {
    de: 'Wirklich ohne Ladung ablegen?',
    en: 'Really sail with an empty hold?',
  },
  'port.sailEmpty': { de: 'Ohne Ladung ablegen', en: 'Sail with an empty hold' },
  'port.sail': { de: 'Ablegen', en: 'Cast off' },

  // --- Selling -------------------------------------------------------------
  'port.sell.action': { de: 'verkaufen', en: 'sell' },
  'port.sell.holdEmpty': {
    de: 'Der Laderaum ist leer. Kaufen Sie, was hier wächst.',
    en: 'The hold is empty. Buy what grows here.',
  },
  'port.sell.damaged': { de: 'Havariert — Erlös zur Hälfte', en: 'Damaged — proceeds halved' },
  'port.sell.damagedAndGlut': {
    de: 'Havariert — Erlös zur Hälfte, und hier selbst geführt',
    en: 'Damaged — proceeds halved, and the harbour ships it itself',
  },
  'port.sell.glut': {
    de: 'Hier selbst geführt — nur Verlustpreis',
    en: 'Shipped from here itself — a loss price only',
  },
  'port.sell.margin': {
    de: '{sign}{amount} gegenüber Einkauf',
    en: '{sign}{amount} on what you paid',
  },
  'port.sell.betterElsewhere': { de: 'Besser anderswo:', en: 'Better elsewhere:' },
  'port.sell.pips': { de: '({n} Pkt.)', en: '({n} pts)' },
  'port.sell.proceeds': { de: 'Erlös', en: 'Proceeds' },

  // --- Buying --------------------------------------------------------------
  'port.buy.action': { de: 'kaufen', en: 'buy' },
  'port.buy.short': {
    de: 'Barmittel reichen nicht — es fehlen {amount}',
    en: 'Not enough cash — {amount} short',
  },
  'port.block.gesperrt': { de: 'Der Hafen ist gesperrt', en: 'The harbour is closed' },
  'port.block.nicht-im-angebot': { de: 'wird hier nicht geführt', en: 'not shipped from here' },
  'port.block.ausverkauft': {
    de: 'Exportbank ausverkauft — beide Karten im Umlauf',
    en: 'Export Bank sold out — both cards are in play',
  },
  'port.block.kein-geld': { de: 'Barmittel reichen nicht', en: 'Not enough cash' },
  'port.block.schon-geladen': {
    de: 'in diesem Hafen bereits gekauft',
    en: 'already bought in this harbour',
  },
  'port.block.ladeschluss': {
    de: 'Ladeschluß — zwei Waren je Hafen',
    en: 'Loading closed — two goods to a harbour',
  },
  'port.block.laderaum-voll': { de: 'Laderaum voll', en: 'Hold full' },

  // --- The chart -----------------------------------------------------------
  'report.holdEmpty': {
    de: 'Ihr Laderaum ist leer. Kaufen Sie zuerst unter „Angebot“ — danach steht hier, wer Ihre Ware nimmt und was sie einbringt.',
    en: 'Your hold is empty. Buy something under “On offer” first — after that this says who will take it and what it fetches.',
  },
  'report.nothingReachable': {
    de: 'Von hier aus ist nichts abzusetzen. Fahren Sie weiter.',
    en: 'Nothing can be sold within reach of here. Sail on.',
  },
  'report.note': {
    de: 'Diese Häfen führen Ihre Ware *nicht* selbst und zahlen daher den vollen Preis. Der Betrag ist der Gewinn gegenüber Ihrem Einkauf, die Punkte sind die Entfernung.',
    en: 'These harbours do *not* ship your goods themselves and so pay the full price. The figure is the profit on what you paid; the points are the distance.',
  },
  'report.note.course': {
    de: ' Antippen zeigt den Hafen auf dem Plan; „Kurs setzen“ schickt das Schiff hin.',
    en: ' Tapping shows the harbour on the chart; “Set a course” sends the ship there.',
  },
  'report.note.look': {
    de: ' Antippen zeigt den Hafen auf dem Plan.',
    en: ' Tapping shows the harbour on the chart.',
  },
  'report.takes': { de: ' Fahrt · nimmt ', en: ' of sailing · takes ' },
  'report.takesWithClock': { de: ' · {duration} Fahrt · nimmt ', en: ' · {duration} sailing · takes ' },
  'report.lots': { de: '{n} Posten', en: '{n} lots' },
  'report.staysAboard': { de: ' · {n} bleibt an Bord', en: ' · {n} stays aboard' },
  'report.open': { de: 'Öffnen', en: 'Open' },
  'report.setCourse': { de: 'Kurs auf {port} setzen', en: 'Set a course for {port}' },

  // --- Stepping ashore -----------------------------------------------------
  'landfall.passerby': {
    de: '{role} {name}, im Vorbeigehen: „{line}“',
    en: '{role} {name}, in passing: “{line}”',
  },

  // --- A harbour looked at from the sea ------------------------------------
  'preview.alreadyHere': { de: 'Sie liegen bereits hier.', en: 'You are lying here already.' },
  'preview.alreadyBound': {
    de: 'Dorthin ist Ihr Schiff bereits unterwegs.',
    en: 'Your ship is already bound there.',
  },
  'preview.changeCourse': { de: 'Kurs ändern auf {port}', en: 'Change course for {port}' },
  'preview.setCourse': { de: 'Kurs auf {port} setzen', en: 'Set a course for {port}' },
  'preview.noLine': { de: 'Dorthin führt keine Linie.', en: 'No line runs there.' },
  'preview.underWay': { de: 'Das Schiff ist unterwegs.', en: 'The ship is under way.' },
  'preview.distance': { de: 'Entfernung', en: 'Distance' },
  'preview.passage': { de: 'Fahrt', en: 'Passage' },
  'preview.noTurningBack': {
    de: 'Auf hoher See dreht kein Schiff bei. Sie läuft erst den nächsten Punkt an; von dort gilt der neue Kurs.',
    en: 'No ship puts about in open water. She runs on to the next mark first; the new course holds from there.',
  },
  'preview.willTake': { de: 'Nimmt Ihnen ab', en: 'Will take off you' },
  'preview.yourCargo': { de: 'Ihre Ladung', en: 'Your cargo' },
  'preview.holdEmpty': {
    de: 'Ihr Laderaum ist leer — hier wäre nichts abzusetzen.',
    en: 'Your hold is empty — there would be nothing to sell here.',
  },
  'preview.shipsItItself': {
    de: 'Dieser Hafen führt Ihre Waren selbst. Er zahlte nur den Verlustpreis.',
    en: 'This harbour ships your goods itself. It would pay only the loss price.',
  },
  'preview.exports': { de: 'Führt aus', en: 'Exports' },
  'preview.exportsNone': { de: 'Von hier geht nichts hinaus.', en: 'Nothing goes out from here.' },
} satisfies Catalog
