import type { Catalog } from '../t'

/**
 * The chart, the strip along the top, and the sheets that slide up over it.
 *
 * A few choices worth recording. *Kontor* is the merchant's own counting
 * house — his books, his hold, his standing — and "Counting house" keeps the
 * period. *Börsenblatt* is the exchange's daily sheet; English called the same
 * thing the shipping gazette, so the news sheet is "News" and its entries read
 * like a shipping column. *Schlußabrechnung* is the final settling of
 * accounts, not merely a score.
 */
export const GAME = {
  // --- The chart and the strip --------------------------------------------
  'game.spectator': { de: 'Zuschauer', en: 'Onlooker' },
  'game.spectator.note': {
    de: 'Sie haben keinen Platz an diesem Tisch und sehen nur zu.',
    en: 'You have no seat at this table and are only looking on.',
  },
  'game.house.aria': {
    de: '{place}{name}, {cash} Einheiten. Kontor öffnen.',
    en: '{place}{name}, {cash} units. Open the counting house.',
  },
  'game.house.place': { de: 'Platz {rank}, ', en: 'Place {rank}, ' },
  'game.market.flat': {
    de: 'Weltmarkt: Verkaufspreise unverändert',
    en: 'World market: selling prices unchanged',
  },
  'game.market.moved': {
    de: 'Weltmarkt: Verkaufspreise {direction} {percent} Prozent',
    en: 'World market: selling prices {direction} {percent} per cent',
  },
  'game.market.plus': { de: 'plus', en: 'plus' },
  'game.market.minus': { de: 'minus', en: 'minus' },

  // --- The dials along the strip, which only a screen reader reads --------
  'strip.news': { de: 'Nachrichten', en: 'News' },
  'strip.news.unread': { de: 'Nachrichten, {n} ungelesen', en: 'News, {n} unread' },
  'strip.fleet': { de: 'Flotte: {n} Schiffe', en: 'Fleet: {n} ships' },
  'strip.fleet.mail': {
    de: 'Flotte: {n} Schiffe, {mail} Briefe',
    en: 'Fleet: {n} ships, {mail} letters',
  },
  'strip.settings': { de: 'Einstellungen', en: 'Settings' },

  // --- The one thing to do next -------------------------------------------
  'game.roll': { de: 'Würfeln', en: 'Throw' },
  'game.moveLeft': { de: 'noch {n}', en: '{n} left' },
  'game.tapGreen': { de: 'grünen Punkt antippen', en: 'tap a green mark' },
  'game.endTurn': { de: 'Zug beenden', en: 'End the turn' },
  'game.openPort': { de: 'Hafen öffnen', en: 'Open the harbour' },
  'game.drawCard': { de: 'Konjunkturkarte abheben', en: 'Turn a market card' },

  // --- Season and round cells ---------------------------------------------
  'game.season': { de: 'Saison', en: 'Season' },
  'game.season.aria': { de: 'Noch {left} Saison', en: '{left} of the season left' },
  'game.round': { de: 'Runde', en: 'Round' },
  'game.round.aria': { de: 'Runde {round} von {total}{red}', en: 'Round {round} of {total}{red}' },
  'game.round.redField': { de: ', rotes Feld', en: ', a red square' },

  // --- What the ship is doing ----------------------------------------------
  'game.showOnPlan': { de: '{port} auf dem Plan zeigen', en: 'Show {port} on the chart' },
  'game.loading': { de: 'Wird beladen · Kurs auf {port}', en: 'Loading · course for {port}' },
  'game.underCourse': { de: 'Kurs auf {port}', en: 'Course for {port}' },
  'game.castsOff': {
    de: 'Legt ab {when} · Ankunft {eta}',
    en: 'Casts off {when} · arriving {eta}',
  },
  'game.arrivesAt': { de: 'Ankunft {eta} · {clock} Uhr', en: 'Arriving {eta} · at {clock}' },
  'game.harbour': { de: 'Hafen', en: 'Harbour' },
  'game.tapAHarbour': {
    de: 'Einen Hafen auf dem Plan antippen, um Kurs zu setzen.',
    en: 'Tap a harbour on the chart to set a course.',
  },

  // --- The season sheet -----------------------------------------------------
  'season.title': { de: 'Die Saison', en: 'The season' },
  'season.subtitle': {
    de: 'Schluß {end} Uhr · noch {left}',
    en: 'Closes at {end} · {left} left',
  },
  'season.worldMarket': { de: 'Weltmarkt', en: 'World market' },
  'season.quiet': {
    de: 'Die Börse meldet nichts. Preise stehen, wie das Warenverzeichnis sie führt.',
    en: 'The exchange reports nothing. Prices stand as the register of goods has them.',
  },
  'season.nextQuotation': { de: 'Nächste Notierung {when}', en: 'Next quotation {when}' },
  'season.fleet': { de: 'Die Flotte', en: 'The fleet' },
  'season.boundFor': { de: 'unterwegs nach {port}', en: 'bound for {port}' },
  'season.lyingIn': { de: 'liegt in {port}', en: 'lying at {port}' },
  'season.atSea': { de: 'See', en: 'sea' },
  'season.settings': { de: 'Einstellungen', en: 'Settings' },

  // --- The Kontor -----------------------------------------------------------
  'kontor.tab.cash': { de: 'Kasse', en: 'Accounts' },
  'kontor.tab.where': { de: 'Wohin?', en: 'Where to?' },
  'kontor.cash': { de: 'Barmittel', en: 'Cash' },
  'kontor.goodsValue': { de: 'Warenwert', en: 'Value of goods' },
  'kontor.worth': { de: 'Vermögen', en: 'Worth' },
  'kontor.hold': { de: 'Laderaum · {ship}', en: 'Hold · {ship}' },
  'kontor.damaged': { de: 'havariert', en: 'damaged' },
  'kontor.standings': { de: 'Die Rangliste', en: 'The standings' },
  'kontor.you': { de: ' · Sie', en: ' · you' },

  // --- The round sheet ------------------------------------------------------
  'roundSheet.title': { de: 'Runde {round}', en: 'Round {round}' },
  'roundSheet.subtitle': {
    de: 'von {total} · rote Felder bringen die Konjunktur ins Spiel',
    en: 'of {total} · red squares bring the market into play',
  },

  // --- The red field --------------------------------------------------------
  'konjunktur.title': { de: 'Rotes Feld', en: 'A red square' },
  'konjunktur.subtitle': {
    de: 'Vor dem Verkauf ist eine Karte abzuheben',
    en: 'A card must be turned before trading',
  },
  'konjunktur.draw': { de: 'Karte abheben', en: 'Turn the card' },
  'konjunktur.deck': { de: 'Konjunktur', en: 'Market' },

  // --- The final reckoning --------------------------------------------------
  'final.title': { de: 'Schlußabrechnung', en: 'Final reckoning' },
  'final.subtitle': { de: 'Wer hat den Handel gemacht?', en: 'Who made the trade?' },
  'final.newGame': { de: 'Neue Partie', en: 'A new game' },
  'final.explainer': {
    de: 'Die *letzte Runde* ist gefahren. Jedes Schiff hat den *nächsten Hafen* angelaufen und seine Ladung abgestoßen: was der Hafen *nicht selbst führt*, zum vollen Verkaufspreis — alles andere zu *75 % des Einkaufs*. Sieger ist das größte Vermögen.',
    en: 'The *last round* is sailed. Every ship has made *the nearest harbour* and landed her cargo: whatever the harbour *does not ship itself* at the full selling price — everything else at *75 % of what was paid*. The largest fortune wins.',
  },
  'final.closingSale': { de: 'Schlußverkauf', en: 'Closing sale' },
  'final.emptyHold': {
    de: 'Fuhr mit leerem Laderaum ein — nichts mehr abzurechnen.',
    en: 'Came in with an empty hold — nothing left to reckon.',
  },

  // --- The news sheet -------------------------------------------------------
  'news.title': { de: 'Nachrichten', en: 'News' },
  'news.empty': { de: 'Noch ist nichts eingegangen', en: 'Nothing has come in yet' },
  'news.wire.one': {
    de: '{n} Telegramm · {total} Meldungen insgesamt',
    en: '{n} telegram · {total} reports in all',
  },
  'news.wire.other': {
    de: '{n} Telegramme · {total} Meldungen insgesamt',
    en: '{n} telegrams · {total} reports in all',
  },
  'news.aboutHouse': { de: '{n} zu {name} · {total} insgesamt', en: '{n} on {name} · {total} in all' },
  'news.fresh': { de: '{n} neu · {total} insgesamt', en: '{n} new · {total} in all' },
  'news.count': { de: '{n} Meldungen', en: '{n} reports' },
  'news.filter': { de: 'Nachrichten filtern', en: 'Filter the news' },
  'news.all': { de: 'Alle', en: 'All' },
  'news.telegrams': { de: 'Telegramme', en: 'Telegrams' },
  'news.nothingYet': {
    de: 'Sobald gewürfelt, gehandelt und angelandet wird, steht es hier.',
    en: 'As soon as dice are thrown, goods traded and cargo landed, it will be here.',
  },
  'news.nothingOnWire': {
    de: 'Über den Draht ist noch nichts gekommen.',
    en: 'Nothing has come over the wire yet.',
  },
  'news.nothingAbout': {
    de: 'Von {name} ist noch nichts zu berichten.',
    en: 'There is nothing to report of {name} yet.',
  },
  'news.newCount': { de: '{n} neu', en: '{n} new' },
  'news.wires': { de: '{name} telegrafiert: „{text}“', en: '{name} wires: “{text}”' },
  'news.currentRound': { de: 'Laufende Runde', en: 'Round in progress' },
  'news.today': { de: 'Heute', en: 'Today' },
  'news.yesterday': { de: 'Gestern', en: 'Yesterday' },

  // --- Sending a telegram ---------------------------------------------------
  'telegram.label': { de: 'Telegramm an alle', en: 'Telegram to all' },
  'telegram.send': { de: 'Aufgeben', en: 'Hand it in' },
} satisfies Catalog
