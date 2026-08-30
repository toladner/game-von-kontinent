import type { Catalog } from '../t'

/**
 * The entrance: the title page, the options, and the register of names.
 *
 * This is the first English a new player reads, so it carries the most weight.
 * It stays in the game's own voice — a merchant house, an export bank, a
 * register of goods — rather than the voice of a settings screen. "Betriebs-
 * kapital" is working capital, the sum the bank advances; "An Bord gehen" is
 * the last button before a game starts, and "Go aboard" keeps the act rather
 * than saying "Start".
 *
 * The title itself is not translated. The game was published in German and
 * never in English, so an English title would be an invention rather than a
 * translation.
 */
export const SETUP = {
  'setup.tagline': {
    de: 'Gesellschaftsspiel um den Import- und Exporthandel',
    en: 'A board game of the import and export trade',
  },
  'setup.back': { de: 'Zurück', en: 'Back' },
  'setup.next': { de: 'Weiter', en: 'Next' },
  'setup.inPreparation': { de: 'in Vorbereitung', en: 'in preparation' },
  'setup.couldNotOpen': {
    de: 'Die Partie ließ sich nicht eröffnen.',
    en: 'The table could not be opened.',
  },

  // --- The title page ------------------------------------------------------
  'setup.premise': {
    de: 'Sie führen ein Handelshaus. Kaufen Sie Waren dort, wo sie wachsen, und setzen Sie sie ab, wo sie fehlen.',
    en: 'You run a merchant house. Buy goods where they grow, and sell them where they are wanted.',
  },
  'setup.howToPlay': { de: 'Wie möchten Sie spielen?', en: 'How would you like to play?' },
  'setup.classic': { de: 'Klassisch', en: 'Classic' },
  'setup.classic.blurb': {
    de: 'Nach den Originalregeln: gedruckter Spielplan, Würfel, 50 Runden, an einem Gerät.',
    en: 'By the original rules: the printed board, dice, 50 rounds, on one device.',
  },
  'setup.full': { de: 'Erweitert', en: 'Full' },
  'setup.full.blurb': {
    de: 'Spielplan, Fahrtweise, Dauer, Kapital und Mitspieler selbst bestimmen — auch über mehrere Geräte.',
    en: 'Choose the board, how ships travel, the length, the capital and the players — across several devices if you like.',
  },
  'setup.join': { de: 'Partie beitreten', en: 'Join a table' },
  'setup.join.blurb': {
    de: 'Sie haben einen Code — die Partie ist eingerichtet, Sie tragen nur Ihren Namen ein.',
    en: 'You have a code — the table is set, and you need only enter your name.',
  },
  'setup.resume': { de: 'Angefangene Partie fortsetzen', en: 'Resume the game in progress' },

  // --- The options ---------------------------------------------------------
  'setup.section.board': { de: 'Der Spielplan', en: 'The board' },
  'setup.section.board.hint': { de: 'Welche Küsten befahren werden.', en: 'Which coasts are sailed.' },
  'setup.field.plan': { de: 'Plan', en: 'Board' },
  'setup.field.plan.label': { de: 'Spielplan', en: 'Board' },

  'setup.section.travel': { de: 'Die Fahrt', en: 'The voyage' },
  'setup.section.travel.hint': {
    de: 'Wie die Schiffe von Hafen zu Hafen kommen.',
    en: 'How ships get from harbour to harbour.',
  },
  'setup.field.travel': { de: 'Fahrtweise', en: 'Travel' },
  'setup.field.sight': { de: 'Sicht', en: 'Sight' },
  'setup.field.pace': { de: 'Fahrzeit je Punkt', en: 'Sailing time per mark' },
  'setup.field.season': { de: 'Länge der Saison', en: 'Length of the season' },
  'setup.field.rounds': { de: 'Runden', en: 'Rounds' },
  'setup.minutes': { de: '{n} Min', en: '{n} min' },
  'setup.hours.one': { de: '{n} Std', en: '{n} hr' },
  'setup.hours.other': { de: '{n} Std', en: '{n} hrs' },
  'setup.pace.minutes': { de: 'Atlantik in {n} Min', en: 'Atlantic in {n} min' },
  'setup.pace.hours.one': { de: 'Atlantik in {n} Std', en: 'Atlantic in {n} hr' },
  'setup.pace.hours.other': { de: 'Atlantik in {n} Std', en: 'Atlantic in {n} hrs' },
  'setup.aWeek': { de: 'eine Woche', en: 'a week' },
  'setup.days.one': { de: '{n} Tag', en: '{n} day' },
  'setup.days.other': { de: '{n} Tage', en: '{n} days' },
  'setup.asPrinted': { de: 'wie im Original', en: 'as in the original' },

  'setup.travel.dice': { de: 'Mit Würfel', en: 'By dice' },
  'setup.travel.dice.hint': {
    de: 'Ein Wurf, so viele Punkte weit. Wie auf dem Brett.',
    en: 'One throw, that many marks. As on the board.',
  },
  'setup.travel.realtime': { de: 'In Echtzeit', en: 'In real time' },
  'setup.travel.realtime.hint': {
    de: 'Schiffe brauchen echte Zeit von Hafen zu Hafen. Kurs setzen, weggehen, später nachsehen — auch wenn niemand zuschaut, fahren die Schiffe weiter.',
    en: 'Ships take real hours from harbour to harbour. Set a course, go away, look again later — the ships sail on whether or not anyone is watching.',
  },
  'setup.sight.normal': { de: 'Normal', en: 'Normal' },
  'setup.sight.normal.hint': {
    de: 'Sie sehen jederzeit, wo jedes Fahrzeug steht, und Befehle wirken sofort.',
    en: 'You see where every vessel is at all times, and orders take effect at once.',
  },
  'setup.sight.realistic': { de: 'Realistisch', en: 'Realistic' },
  'setup.sight.realistic.hint': {
    de: 'Sie wissen nur, wo Sie selbst sind. Befehle an entfernte Kapitäne gehen per Brieftaube — ob sie ankommt, erfahren Sie nie. Schaltet die Echtzeitfahrt mit ein.',
    en: 'You know only where you are yourself. Orders to distant captains go by carrier pigeon — whether one arrives you never learn. Turns real-time sailing on with it.',
  },

  'setup.section.market': { de: 'Der Markt', en: 'The market' },
  'setup.section.market.hint': {
    de: 'Wo die Waren liegen und was sie einbringen.',
    en: 'Where the goods are and what they fetch.',
  },
  'setup.field.supply': { de: 'Angebot', en: 'Supply' },
  'setup.field.prices': { de: 'Preise', en: 'Prices' },
  'setup.field.market': { de: 'Konjunktur', en: 'Market cards' },
  'setup.supply.fixed': { de: 'Fest', en: 'Fixed' },
  'setup.supply.fixed.hint': {
    de: 'Jeder Hafen führt aus, was im Warenverzeichnis steht. So ist der Plan gedruckt.',
    en: 'Every harbour exports what the register of goods says. As the board is printed.',
  },
  'setup.supply.random': { de: 'Zufällig', en: 'Dealt afresh' },
  'setup.supply.random.hint': {
    de: 'Die Handelswege werden zu Spielbeginn neu ausgelost. Jeder Hafen behält seine Größe, aber niemand weiß mehr auswendig, wo der Kaffee liegt.',
    en: 'The trade routes are dealt again at the start. Every harbour keeps its size, but nobody knows by heart where the coffee is any more.',
  },
  'setup.prices.fixed': { de: 'Fest', en: 'Fixed' },
  'setup.prices.fixed.hint': {
    de: 'Ein Verkaufspreis je Ware, überall auf der Welt derselbe.',
    en: 'One selling price per good, the same the world over.',
  },
  'setup.prices.distance': { de: 'Nach Entfernung', en: 'By distance' },
  'setup.prices.distance.hint': {
    de: 'Je weiter eine Ware vom nächsten Hafen entfernt ist, der sie selbst ausführt, desto mehr bringt sie. Kurze Wege lohnen dann nicht mehr — die weite Fahrt zahlt sich aus.',
    en: 'The further a good is from the nearest harbour that ships it, the more it fetches. Short runs stop paying — the long haul is the earner.',
  },
  'setup.konjunktur.classic': { de: 'Klassisch', en: 'Classic' },
  'setup.konjunktur.classic.hint': {
    de: 'Die 27 gedruckten Karten. Hausse, Baisse, Steuer, Telegramm.',
    en: 'The 27 printed cards. Boom, slump, tax, telegram.',
  },
  'setup.konjunktur.extended': { de: 'Erweitert', en: 'Extended' },
  'setup.konjunktur.extended.hint': {
    de: 'Dazu Stürme, die Ladung über Bord gehen lassen, Hausse und Baisse über einzelnen Erdteilen, Seeräuber und örtliche Gebühren. Wo Sie stehen, zählt dann mit.',
    en: 'And gales that take cargo over the side, booms and slumps over single parts of the world, pirates and local dues. Where you are then counts for something.',
  },

  'setup.section.house': { de: 'Das Handelshaus', en: 'The merchant house' },
  'setup.section.house.hint': {
    de: 'Womit jeder Mitspieler anfängt.',
    en: 'What every player begins with.',
  },
  'setup.field.capital': { de: 'Betriebskapital', en: 'Working capital' },
  'setup.field.ships': { de: 'Schiffe je Haus', en: 'Ships per house' },
  'setup.ships.single': {
    de: 'wie im Original — keine Werft',
    en: 'as in the original — no shipyard',
  },
  'setup.ships.fleet': {
    de: 'Werften verkaufen; ein zweites Schiff kostet ein halbes Vermögen',
    en: 'the yards will sell; a second ship costs half a fortune',
  },

  // --- Where the game is played --------------------------------------------
  'setup.whereToPlay': { de: 'Wo wird gespielt?', en: 'Where will you play?' },
  'setup.oneDevice': { de: 'An einem Gerät', en: 'On one device' },
  'setup.oneDevice.blurb': {
    de: 'Reihum, das Gerät wandert. Braucht keine Verbindung.',
    en: 'In turn, passing the device round. Needs no connection.',
  },
  'setup.openTable': { de: 'Partie eröffnen', en: 'Open a table' },
  'setup.openTable.blurb': {
    de: 'Jeder spielt auf seinem eigenen Gerät. Sie bekommen einen Code zum Weitergeben.',
    en: 'Everyone plays on their own device. You get a code to pass on.',
  },
  'setup.joinNote': {
    de: 'Einer Partie beitreten können Sie gleich auf der Eingangsseite — dort ist nichts einzurichten.',
    en: 'You can join a table straight from the entrance page — there is nothing to set up there.',
  },
  'setup.section.crew.hint': {
    de: 'Ob nach der Ausfahrt noch jemand an Bord kommt.',
    en: 'Whether anybody may still come aboard once the ships have sailed.',
  },
  'setup.thatIsYou': {
    de: '{name} steht schon am Kai. Sie nehmen diesen Platz zurück, statt ein zweites Haus zu gründen.',
    en: '{name} is already on the quay. You take that seat back rather than founding a second house.',
  },
  'setup.thatIsYouAtSea': {
    de: '{name} ist schon unterwegs. Sie nehmen dieses Haus zurück, mit Kasse und Ladung, statt ein zweites zu gründen.',
    en: '{name} is already under way. You take that house back, cash and cargo with it, rather than founding a second one.',
  },
  'setup.takeSeatBack': { de: 'Platz zurücknehmen', en: 'Take the seat back' },
  'setup.whoMaySail': { de: 'Wer darf mitfahren?', en: 'Who may sail?' },
  'setup.atStartOnly': { de: 'Nur zu Beginn', en: 'Only at the start' },
  'setup.atStartOnly.blurb': {
    de: 'Die Mitspieler stehen fest, bevor das erste Schiff ausläuft.',
    en: 'The players are settled before the first ship sails.',
  },
  'setup.anyTime': { de: 'Jederzeit', en: 'At any time' },
  'setup.anyTime.blurb': {
    de: 'Späte Ankömmlinge steigen mit eigenem Schiff und vollem Kapital ein.',
    en: 'Latecomers join with a ship of their own and full capital.',
  },

  // --- The register of names ------------------------------------------------
  'setup.yourName': { de: 'Ihr Name', en: 'Your name' },
  'setup.players': { de: 'Die Mitspieler', en: 'The players' },
  'setup.addAnother': { de: 'Noch jemanden eintragen', en: 'Enter someone else' },
  'setup.othersEnterThemselves': {
    de: 'Die anderen tragen sich selbst ein, sobald sie den Code haben.',
    en: 'The others enter themselves once they have the code.',
  },
  'setup.summary.classic': {
    de: 'Originalregeln · 50 Runden · an einem Gerät',
    en: 'Original rules · 50 rounds · on one device',
  },
  // Two figures, so both come in already counted.
  'setup.summary.realtime': {
    de: 'Echtzeit · {pace} je Punkt · {hours} Saison',
    en: 'Real time · {pace} per mark · {hours} season',
  },
  'setup.summary.rounds': { de: '{n} Runden', en: '{n} rounds' },
  'setup.summary.capital': { de: '{amount} Kapital', en: '{amount} capital' },
  'setup.summary.ownDevices': { de: 'eigene Geräte', en: 'own devices' },
  'setup.summary.oneDevice': { de: 'ein Gerät', en: 'one device' },
  'setup.oneMoment': { de: 'Einen Augenblick …', en: 'One moment …' },
  'setup.goAboard': { de: 'An Bord gehen', en: 'Go aboard' },

  // --- The tables this device is sitting at --------------------------------
  'tables.heading': { de: 'Ihre Tische ({n})', en: 'Your tables ({n})' },
  'tables.unnamed': { de: 'Ohne Namen', en: 'No name given' },
  'tables.asking': { de: 'wird angefragt …', en: 'asking …' },
  'tables.noAnswer': { de: 'meldet sich nicht', en: 'no answer' },
  'tables.finished': { de: 'abgerechnet', en: 'reckoned up' },
  'tables.seated.one': { de: '{n} Haus am Tisch', en: '{n} house at the table' },
  'tables.seated.other': { de: '{n} Häuser am Tisch', en: '{n} houses at the table' },
  'tables.giveUp': { de: 'Platz an Tisch {code} aufgeben', en: 'Give up your seat at table {code}' },

  // --- Joining --------------------------------------------------------------
  'setup.tableCode': { de: 'Code der Partie', en: 'Table code' },
  'setup.noSuchTable': {
    de: 'Unter diesem Zeichen ist keine Partie zu finden.',
    en: 'No table is to be found under that code.',
  },
  'setup.tableFull': {
    de: 'Der Tisch ist besetzt — mehr als {n} Schiffe fahren nicht.',
    en: 'The table is full — no more than {n} ships sail.',
  },
  'setup.tableUnderWay': {
    de: 'Diese Partie ist unterwegs und nimmt keine Nachzügler auf. Wer schon ein Haus hier hat, trägt dessen Namen ein.',
    en: 'This game is under way and takes no latecomers. If a house here is already yours, enter its name.',
  },
  'setup.haveSeat': {
    de: 'Sie haben an diesem Tisch bereits einen Platz.',
    en: 'You already have a seat at this table.',
  },
  'setup.haveSeat.note': {
    de: 'Ihr Handelshaus wartet dort mit Namen, Kasse und Ladung. Ein Name ist nicht mehr einzutragen.',
    en: 'Your house is waiting there with its name, its cash and its cargo. There is no name left to enter.',
  },
  'setup.giveUpSeat': {
    de: 'Platz aufgeben und neu eintragen',
    en: 'Give up the seat and register again',
  },
  'setup.backAboard': { de: 'Zurück an Bord', en: 'Back aboard' },
  'setup.joinIt': { de: 'Beitreten', en: 'Join' },
  'setup.tableEmpty': {
    de: 'Der Tisch ist gedeckt, es sitzt noch niemand daran.',
    en: 'The table is laid; nobody is sitting at it yet.',
  },
  'setup.alreadyOnQuay': { de: 'Schon am Kai ({n})', en: 'Already on the quay ({n})' },

  // --- One name in the register ---------------------------------------------
  'setup.nthName': { de: '{n}. Name', en: 'Name {n}' },
  'setup.nthNameLabel': { de: 'Name der {n}. Person', en: 'Name of person {n}' },
  'setup.enterYourself': { de: 'Tragen Sie sich ein.', en: 'Enter your name.' },
  'setup.merchantEither': { de: 'Kauffrau oder Kaufmann', en: 'Merchant, woman or man' },
  'setup.merchantWoman': { de: 'Kauffrau', en: 'Merchant (woman)' },
  'setup.merchantMan': { de: 'Kaufmann', en: 'Merchant (man)' },
  'setup.strike': { de: 'Streichen', en: 'Strike out' },
} satisfies Catalog
