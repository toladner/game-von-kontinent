import type { Catalog } from '../t'

/**
 * The Kontormakler — the broker who walks a newcomer round a harbour.
 *
 * This is the game's whole tutorial, so the English has to carry the same
 * weight as the German: a person talking, not a hint system. He is deferential
 * but not servile, speaks in short declaratives, and never says "you should" —
 * he says what is true of the harbour and leaves the decision where it
 * belongs.
 *
 * `*…*` marks a word for bold; it is placed by hand in each language because
 * the word worth picking out of a sentence is rarely in the same position
 * twice.
 */
export const ADVICE = {
  // --- The three steps of the round, as the tabs label them ---------------
  'advice.tab.verkaufen': { de: 'Ladung', en: 'Cargo' },
  'advice.tab.kaufen': { de: 'Angebot', en: 'On offer' },
  'advice.tab.wohin': { de: 'Wohin?', en: 'Where to?' },

  // --- 1. The hold --------------------------------------------------------
  'advice.verkaufszwang': {
    de: 'Die Börse verlangt einen Abschluß: Sie müssen hier *eine Ware absetzen*, die dieser Hafen nicht selbst führt. Vorher kommen Sie nicht hinaus.',
    en: 'The exchange wants a deal done: you must *sell a good here* that this harbour does not ship itself. Until you do, you are not leaving.',
  },
  'advice.hierVerkaufen': {
    de: '*{good}* nimmt man Ihnen hier ab — *{price}*, das sind *{profit}* über Ihrem Einkauf.',
    en: 'They will take *{good}* off your hands here — *{price}*, which is *{profit}* above what you paid.',
  },
  'advice.nichtsAbzusetzen.one': {
    de: 'Für Ihre *eine Ware* zahlt hier niemand den vollen Preis. Heben Sie sie auf.',
    en: 'Nobody here pays full price for your *one good*. Hold on to it.',
  },
  'advice.nichtsAbzusetzen.other': {
    de: 'Für Ihre *{n} Posten* zahlt hier niemand den vollen Preis. Heben Sie sie auf.',
    en: 'Nobody here pays full price for your *{n} lots*. Hold on to them.',
  },
  'advice.nichtsAnBord': {
    de: 'Ihr *Laderaum ist leer* — abzusetzen gibt es hier also nichts.',
    en: 'Your *hold is empty* — so there is nothing to sell here.',
  },

  // --- 2. The quay --------------------------------------------------------
  'advice.leerNachladen.one': {
    de: 'Und *leer verdient kein Schiff*. Hier wird *{good}* verladen, ab *{price}*. Nehmen Sie *noch einen Posten* mit.',
    en: 'And *an empty ship earns nothing*. They load *{good}* here, from *{price}*. Take *one more lot* with you.',
  },
  'advice.leerNachladen.other': {
    de: 'Und *leer verdient kein Schiff*. Hier wird *{good}* verladen, ab *{price}*. Nehmen Sie bis zu *{n} Posten* mit.',
    en: 'And *an empty ship earns nothing*. They load *{good}* here, from *{price}*. Take up to *{n} lots* with you.',
  },
  'advice.nachladen.one': {
    de: 'Hier dürfen Sie noch *eine Ware* laden — der Laderaum selbst hat keine Grenze.',
    en: 'You may still load *one good* here — the hold itself has no limit.',
  },
  'advice.nachladen.other': {
    de: 'Hier dürfen Sie noch *{n} Waren* laden — der Laderaum selbst hat keine Grenze.',
    en: 'You may still load *{n} goods* here — the hold itself has no limit.',
  },
  'advice.keinAngebot': {
    de: 'Dieser Hafen führt *nichts aus*. Zu laden gibt es hier nichts — anderswo schon.',
    en: 'This harbour *exports nothing*. There is nothing to load here — elsewhere there is.',
  },
  'advice.ladeschluss': {
    de: '*Ladeschluß* — zwei Waren je Hafen, und die haben Sie. Mehr geht hier nicht an Bord.',
    en: '*Loading closed* — two goods to a harbour, and you have them. Nothing more goes aboard here.',
  },
  'advice.zuTeuer': {
    de: 'Was hier verladen wird, ist Ihnen heute zu teuer — das Billigste kostet *{cheapest}*, Ihre Kasse hält *{cash}*.',
    en: 'What they load here is beyond you today — the cheapest is *{cheapest}*, and your cash box holds *{cash}*.',
  },

  // --- 3. The chart -------------------------------------------------------
  'advice.nichtsZuPlanen': {
    de: 'Ohne Ladung ist *jeder Hafen gleich weit*. Kaufen Sie erst etwas, dann lohnt der Blick auf die Karte.',
    en: 'With nothing aboard, *every harbour is equally far*. Buy something first; then the chart is worth a look.',
  },
  'advice.weiterfahren.one': {
    de: '*{port}* führt Ihre Ware nicht selbst und zahlt voll — *{profit}* bei *{n} Punkt* Fahrt.',
    en: '*{port}* does not ship your good itself and pays in full — *{profit}* for *{n} mark* of sailing.',
  },
  'advice.weiterfahren.other': {
    de: '*{port}* führt Ihre Ware nicht selbst und zahlt voll — *{profit}* bei *{n} Punkten* Fahrt.',
    en: '*{port}* does not ship your good itself and pays in full — *{profit}* for *{n} marks* of sailing.',
  },
  'advice.keinMarkt': {
    de: 'Für diese Ladung findet sich von hier aus kein Markt. Fahren Sie trotzdem — anderswo sieht es anders aus.',
    en: 'There is no market for this cargo within reach of here. Sail anyway — it looks different elsewhere.',
  },

  // --- The greeting on the gangway ---------------------------------------
  'advice.offer.0': {
    de: 'Ich führe hier die Bücher — wenn Sie nicht weiterwissen, fragen Sie mich.',
    en: 'I keep the books here — if you are at a loss, ask me.',
  },
  'advice.offer.1': {
    de: 'Solange Ihr Schiff hier liegt, stehe ich für Sie am Kai.',
    en: 'As long as your ship lies here, I am on the quay for you.',
  },
  'advice.offer.2': {
    de: 'Ich kenne jeden Kontrakt in diesem Hafen. Fragen kostet nichts.',
    en: 'I know every contract in this harbour. Asking costs nothing.',
  },
  'advice.offer.3': {
    de: 'Wenn Sie nicht wissen, was zu tun ist: ich bin gleich hier.',
    en: 'If you do not know what to do, I am right here.',
  },
  'advice.offer.4': {
    de: 'Man schickt mich zu jedem fremden Schiff. Heute also zu Ihnen.',
    en: 'They send me to every strange ship. Today that means you.',
  },
  'advice.greeting.home': {
    de: 'Wieder daheim in {port}.',
    en: 'Home again in {port}.',
  },
  'advice.greeting.welcome': {
    de: 'Willkommen in {port}!',
    en: 'Welcome to {port}!',
  },
  'advice.greeting.exportsNone': {
    de: 'Ausgeführt wird von hier nichts.',
    en: 'Nothing is exported from here.',
  },
  'advice.greeting.exportsSome': {
    de: 'Von hier gehen *{goods}* in alle Welt.',
    en: '*{goods}* go from here to all the world.',
  },
  'advice.greeting.exportsMany': {
    de: 'Von hier gehen *{goods}* und anderes in alle Welt.',
    en: '*{goods}* and more go from here to all the world.',
  },
  'advice.greeting.holdEmpty': {
    de: 'Ihr *Laderaum ist leer*.',
    en: 'Your *hold is empty*.',
  },
  'advice.greeting.buyerHere': {
    de: 'Und Ihre *{good}* *findet hier einen Abnehmer*.',
    en: 'And your *{good}* *will find a buyer here*.',
  },
  'advice.greeting.noBuyer.one': {
    de: 'Ihren *einen Posten* nimmt hier allerdings niemand.',
    en: 'Your *one lot*, though, is wanted by nobody here.',
  },
  'advice.greeting.noBuyer.other': {
    de: 'Ihre *{n} Posten* nimmt hier allerdings niemand.',
    en: 'Your *{n} lots*, though, are wanted by nobody here.',
  },

  // --- What a Konjunkturkarte just did to the house that turned it --------
  'advice.card.payout': {
    de: 'Sie erhalten {amount}.',
    en: 'You receive {amount}.',
  },
  'advice.card.payout.detail': {
    de: 'Eine telegrafische Überweisung an Ihr Kontor. Sonst ändert sich nichts.',
    en: 'A telegraphic transfer to your counting house. Nothing else changes.',
  },
  'advice.card.fee': {
    de: 'Sie zahlen {amount}.',
    en: 'You pay {amount}.',
  },
  'advice.card.fee.detail': {
    de: 'Entladegeld, nur für Ihr Schiff. Die Mitspieler bleiben verschont.',
    en: 'An unloading charge, on your ship alone. The others are spared.',
  },
  'advice.card.payNothing': {
    de: 'Sie zahlen nichts.',
    en: 'You pay nothing.',
  },
  'advice.card.portFee.detail': {
    de: 'Hafengebühr — fällig für jedes Schiff, das gerade in einem Hafen liegt.',
    en: 'Harbour dues — payable by every ship lying in a harbour just now.',
  },
  'advice.card.portFee.atSea': {
    de: 'Hafengebühr trifft nur Schiffe, die in einem Hafen liegen. Ihres liegt auf See.',
    en: 'Harbour dues fall only on ships lying in harbour. Yours is at sea.',
  },
  'advice.card.levy.detail': {
    de: '{levy}: {percent} % vom Warenwert Ihrer Ladung ({held}). Gilt für alle Mitspieler.',
    en: '{levy}: {percent} % of the value of your cargo ({held}). It falls on every house.',
  },
  'advice.card.levy.empty': {
    de: '{levy} bemißt sich am Warenwert an Bord — Ihr Laderaum ist leer, also bleibt es bei null.',
    en: '{levy} is reckoned on the value aboard — your hold is empty, so it comes to nothing.',
  },
  'advice.card.levy.steuer': { de: 'Steuer', en: 'Tax' },
  'advice.card.levy.versicherung': { de: 'Versicherung', en: 'Insurance' },
  'advice.card.regional': {
    de: '{title}: {sign}{percent} %.',
    en: '{title}: {sign}{percent} %.',
  },
  'advice.card.regional.detail': {
    de: 'Gilt {n} Runden lang für jeden Verkauf in diesem Erdteil — für Sie wie für die Mitspieler. Anderswo ändert sich nichts.',
    en: 'It holds for {n} rounds on every sale in this part of the world — for you as for the others. Elsewhere nothing changes.',
  },
  'advice.card.storm.one': {
    de: 'Jedes Schiff in See in diesem Gebiet verliert einen Posten — den teuersten zuerst. Wer im Hafen liegt oder anderswo fährt, kommt davon.',
    en: 'Every ship at sea in these waters loses a lot — the dearest first. Anyone lying in harbour, or sailing elsewhere, is spared.',
  },
  'advice.card.storm.other': {
    de: 'Jedes Schiff in See in diesem Gebiet verliert {n} Posten — den teuersten zuerst. Wer im Hafen liegt oder anderswo fährt, kommt davon.',
    en: 'Every ship at sea in these waters loses {n} lots — the dearest first. Anyone lying in harbour, or sailing elsewhere, is spared.',
  },
  'advice.card.storm.some.one': {
    de: 'Wen es erwischt, verliert einen Posten — den teuersten zuerst. Nicht jedes Schiff im Sturm trifft es, und wer im Hafen liegt, kommt davon.',
    en: 'Whichever ships it catches lose a lot — the dearest first. Not every ship in a gale is caught, and one lying in harbour is spared.',
  },
  'advice.card.storm.some.other': {
    de: 'Wen es erwischt, verliert {n} Posten — die teuersten zuerst. Nicht jedes Schiff im Sturm trifft es, und wer im Hafen liegt, kommt davon.',
    en: 'Whichever ships it catches lose {n} lots — the dearest first. Not every ship in a gale is caught, and one lying in harbour is spared.',
  },
  'advice.card.damage.some.one': {
    de: 'Wen es erwischt, bringt einen Posten beschädigt ein — den teuersten zuerst. Er bleibt an Bord und bringt nur den halben Erlös.',
    en: 'Whichever ships it catches bring a lot in damaged — the dearest first. It stays aboard and fetches only half.',
  },
  'advice.card.damage.some.other': {
    de: 'Wen es erwischt, bringt {n} Posten beschädigt ein — die teuersten zuerst. Sie bleiben an Bord und bringen nur den halben Erlös.',
    en: 'Whichever ships it catches bring {n} lots in damaged — the dearest first. They stay aboard and fetch only half.',
  },
  'advice.card.damage.one': {
    de: 'Jedes Schiff in See in diesem Gebiet bringt einen Posten beschädigt ein — den teuersten zuerst. Er bleibt an Bord und bringt nur den halben Erlös.',
    en: 'Every ship at sea in these waters brings a lot in damaged — the dearest first. It stays aboard and fetches only half.',
  },
  'advice.card.damage.other': {
    de: 'Jedes Schiff in See in diesem Gebiet bringt {n} Posten beschädigt ein — die teuersten zuerst. Sie bleiben an Bord und bringen nur den halben Erlös.',
    en: 'Every ship at sea in these waters brings {n} lots in damaged — the dearest first. They stay aboard and fetch only half.',
  },
  'advice.card.cargoDamaged.one': {
    de: 'Ein Posten Ihrer Ladung ist beschädigt, der teuerste zuerst — er bleibt an Bord und bringt nur den halben Erlös.',
    en: 'One lot of your cargo is damaged, the dearest first — it stays aboard and fetches only half.',
  },
  'advice.card.cargoDamaged.other': {
    de: '{n} Posten Ihrer Ladung sind beschädigt, die teuersten zuerst — sie bleiben an Bord und bringen nur den halben Erlös.',
    en: '{n} lots of your cargo are damaged, the dearest first — they stay aboard and fetch only half.',
  },
  'advice.card.cargoLost.one': {
    de: 'Sie verlieren einen Posten Ihrer Ladung, den teuersten zuerst.',
    en: 'You lose a lot of your cargo, the dearest first.',
  },
  'advice.card.cargoLost.other': {
    de: 'Sie verlieren {n} Posten Ihrer Ladung, den teuersten zuerst.',
    en: 'You lose {n} lots of your cargo, the dearest first.',
  },
  'advice.card.cargoLost.empty': {
    de: 'Ihr Laderaum ist leer — diesmal gibt es nichts zu verlieren.',
    en: 'Your hold is empty — this time there is nothing to lose.',
  },
  'advice.card.regionalLevy.receive': {
    de: 'Sie erhalten {amount}.',
    en: 'You receive {amount}.',
  },
  'advice.card.regionalLevy.pay': {
    de: 'Sie zahlen {amount}.',
    en: 'You pay {amount}.',
  },
  'advice.card.regionalLevy.detail': {
    de: '{title} — fällig für jedes Schiff, das gerade in einem Hafen dieses Erdteils liegt. Liegen Sie anderswo, betrifft es Sie nicht.',
    en: '{title} — payable by every ship lying in a harbour of this part of the world. If you are elsewhere, it does not touch you.',
  },
  'advice.card.prices': {
    de: 'Verkaufspreise {sign}{percent} %.',
    en: 'Selling prices {sign}{percent} %.',
  },
  'advice.card.prices.up': {
    de: 'Hausse: alles, was Sie in diesem Hafen absetzen, bringt entsprechend mehr.',
    en: 'A boom: everything you sell in this harbour fetches that much more.',
  },
  'advice.card.prices.down': {
    de: 'Baisse: was Sie in diesem Hafen absetzen, bringt entsprechend weniger. Aufheben ist erlaubt.',
    en: 'A slump: what you sell in this harbour fetches that much less. Holding on is allowed.',
  },
  'advice.card.silent': {
    de: 'Die Börse schweigt.',
    en: 'The exchange says nothing.',
  },
  'advice.card.silent.detail': {
    de: 'Diese Karte kostet Sie nichts und bringt Ihnen nichts.',
    en: 'This card costs you nothing and brings you nothing.',
  },
} satisfies Catalog
