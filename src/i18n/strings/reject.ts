import type { Catalog } from '../t'

/**
 * Why an order was refused.
 *
 * These used to be German sentences written straight into the reducer. They
 * are keys now for a reason that goes beyond translation: at a table played
 * across several devices the refusal is composed on whichever machine holds
 * the game and read on another, and those two need not be set to the same
 * language. A key travels; a sentence would arrive in somebody else's.
 *
 * The voice is the harbourmaster's, not the computer's — flat, factual, and
 * never apologetic. "The office is shut", not "Sorry, you can't trade now".
 */
export const REJECT = {
  'reject.gameOver': {
    de: 'Das Spiel ist beendet.',
    en: 'The game is over.',
  },
  'reject.notStarted': {
    de: 'Die Partie hat noch nicht begonnen.',
    en: 'The game has not begun.',
  },
  'reject.noDiceInRealtime': {
    de: 'In der Echtzeitfahrt wird nicht gewürfelt.',
    en: 'No dice are thrown when the ships sail in real time.',
  },
  'reject.marketTurnsItself': {
    de: 'Der Weltmarkt dreht die Karten von selbst.',
    en: 'The world market turns its own cards.',
  },
  'reject.courseRealtimeOnly': {
    de: 'Kurse werden nur in der Echtzeitfahrt gesetzt.',
    en: 'Courses are only set when the ships sail in real time.',
  },
  'reject.unknownMerchant': {
    de: 'Unbekannter Kaufmann.',
    en: 'No such merchant.',
  },
  'reject.actorMissing': {
    de: 'Es fehlt die Angabe, wer handelt.',
    en: 'There is no word of who is acting.',
  },
  'reject.notYourTurn': {
    de: 'Sie sind nicht am Zug.',
    en: 'It is not your turn.',
  },
  'reject.notRollPhase': {
    de: 'Jetzt ist nicht gewürfelt.',
    en: 'This is not the moment to throw.',
  },
  'reject.noVoyage': {
    de: 'Es ist keine Fahrt im Gange.',
    en: 'No voyage is under way.',
  },
  'reject.noLineOrShuttle': {
    de: 'Dorthin führt keine Linie — oder es wäre ein Pendeln.',
    en: 'No line runs there — or it would be doubling back.',
  },
  'reject.noCardDue': {
    de: 'Keine Karte fällig.',
    en: 'No card is due.',
  },
  'reject.deckEmpty': {
    de: 'Das Päckchen ist leer.',
    en: 'The pack is empty.',
  },
  'reject.unknownCard': {
    de: 'Unbekannte Karte {id}',
    en: 'No such card: {id}',
  },
  'reject.noTradeAtSea': {
    de: 'Auf See wird nicht gehandelt.',
    en: 'No trade is done at sea.',
  },
  'reject.kontorClosed': {
    de: 'Das Kontor ist geschlossen.',
    en: 'The counting house is shut.',
  },
  'reject.yourShipNotInPort': {
    de: 'Ihr Schiff liegt nicht im Hafen.',
    en: 'Your ship is not in port.',
  },
  'reject.portBarred': {
    de: '{title} — der Hafen ist gesperrt.',
    en: '{title} — the harbour is closed to trade.',
  },
  'reject.notExportedHere': {
    de: 'Diese Ware führt der Hafen nicht aus.',
    en: 'This harbour does not export that good.',
  },
  'reject.twoGoodsPerPort': {
    de: 'In einem Hafen dürfen nur zwei Waren gekauft werden.',
    en: 'Only two goods may be bought in any one harbour.',
  },
  'reject.oneOfEachKind': {
    de: 'Von einer Warengattung nur eine Karte.',
    en: 'One card only from any one class of goods.',
  },
  'reject.holdFull.one': {
    de: 'Der Laderaum faßt nur {n} Posten.',
    en: 'The hold takes only {n} lot.',
  },
  'reject.holdFull.other': {
    de: 'Der Laderaum faßt nur {n} Posten.',
    en: 'The hold takes only {n} lots.',
  },
  'reject.bankOutOfCards': {
    de: 'Die Exportbank hat keine Karte mehr davon.',
    en: 'The Export Bank has no more of those.',
  },
  'reject.insufficientFunds': {
    de: 'Die Barmittel reichen nicht.',
    en: 'There is not enough cash.',
  },
  'reject.notAboard': {
    de: 'Diese Ware ist nicht an Bord.',
    en: 'That good is not aboard.',
  },
  'reject.gameNotRunning': {
    de: 'Die Partie fährt nicht.',
    en: 'The game is not under way.',
  },
  'reject.notYourShip': {
    de: 'Dieses Schiff gehört nicht zu Ihrem Haus.',
    en: 'That ship does not belong to your house.',
  },
  'reject.needPigeon': {
    de: 'Zu diesem Kapitän müssen Sie eine Taube schicken.',
    en: 'That captain must be reached by pigeon.',
  },
  'reject.shipNotInPort': {
    de: 'Das Schiff liegt nicht im Hafen.',
    en: 'The ship is not in port.',
  },
  'reject.alreadyThere': {
    de: 'Es liegt bereits dort.',
    en: 'She is lying there already.',
  },
  'reject.alreadyOnThatCourse': {
    de: 'Diesen Kurs hält sie bereits.',
    en: 'She is on that course already.',
  },
  'reject.noLine': {
    de: 'Dorthin führt keine Linie.',
    en: 'No line runs there.',
  },
  'reject.oneHouseOneShip': {
    de: 'Ein Haus, ein Schiff — so will es die Anleitung.',
    en: 'One house, one ship — so the rulebook has it.',
  },
  'reject.fleetLimit': {
    de: 'Mehr als {n} Schiffe verwaltet kein Haus.',
    en: 'No house runs more than {n} ships.',
  },
  'reject.noYardAtSea': {
    de: 'Auf See kauft man kein Schiff.',
    en: 'Ships are not bought at sea.',
  },
  'reject.yardsInPortOnly': {
    de: 'Werften gibt es nur im Hafen.',
    en: 'Yards are found in harbour only.',
  },
  'reject.yardDoesNotStock': {
    de: 'Dieses Schiff führt die Werft nicht.',
    en: 'This yard does not build that vessel.',
  },
  'reject.noPigeonNeeded': {
    de: 'Befehle wirken hier ohne Umweg über eine Taube.',
    en: 'Orders carry here without troubling a pigeon.',
  },
  'reject.pigeonsAshoreOnly': {
    de: 'Tauben steigen nur an Land auf.',
    en: 'Pigeons are only put up from land.',
  },
  'reject.noLoft': {
    de: 'Hier gibt es keinen Taubenschlag.',
    en: 'There is no loft here.',
  },
  'reject.tellCaptainYourself': {
    de: 'Sie stehen an Bord — sagen Sie es dem Kapitän selbst.',
    en: 'You are aboard — tell the captain yourself.',
  },
  'reject.loftUnpaid': {
    de: 'Der Taubenschlag will bezahlt werden.',
    en: 'The loft wants paying.',
  },
  'reject.noPigeonRoute': {
    de: 'Dorthin fliegt keine Taube.',
    en: 'No pigeon flies that far.',
  },
  'reject.mailAshoreOnly': {
    de: 'Post gibt es nur an Land.',
    en: 'Mail is handed over ashore.',
  },
  'reject.mailInPortOnly': {
    de: 'Post gibt es nur im Hafen.',
    en: 'Mail is handed over in harbour.',
  },
  'reject.noMail': {
    de: 'Es liegt nichts für Sie bereit.',
    en: 'Nothing is waiting for you.',
  },
  'reject.switchInPortOnly': {
    de: 'Man wechselt das Schiff nur im Hafen.',
    en: 'One changes ship in harbour only.',
  },
  'reject.shipElsewhere': {
    de: 'Dieses Schiff liegt in einem anderen Hafen.',
    en: 'That ship is lying in another harbour.',
  },
  'reject.turnNotOver': {
    de: 'Der Zug ist noch nicht zu Ende.',
    en: 'The turn is not finished.',
  },
  'reject.verkaufszwang': {
    de: 'Verkaufszwang: mindestens eine Warengattung, die dieser Hafen nicht führt, muß abgesetzt werden.',
    en: 'Forced sale: at least one class of goods this harbour does not itself export must be sold here.',
  },
  'reject.nameTaken': {
    de: 'Dieser Kaufmann ist bereits eingetragen.',
    en: 'That merchant is already on the register.',
  },
  // The Partieserver's own refusals. They are about the table rather than
  // about the game — who may speak, and when — but they arrive at a player
  // through the same slot, so they read in the same voice.
  'reject.unreadable': {
    de: 'Unlesbare Nachricht.',
    en: 'Unreadable message.',
  },
  'reject.noSuchGame': {
    de: 'Diese Partie gibt es nicht.',
    en: 'There is no such game.',
  },
  'reject.notSeated': {
    de: 'Sie sitzen nicht mit am Tisch.',
    en: 'You are not seated at this table.',
  },
  'reject.joinViaLobby': {
    de: 'Beitritt läuft über die Anmeldung.',
    en: 'Joining is done at the entrance.',
  },
  /*
   * Said to a host who is trying to change a term that would move the season
   * that has already been played. Names the reason rather than the rule: a
   * merchant does not care that the server folds a log, they care that
   * yesterday would come out differently.
   */
  'reject.termsWouldRewrite': {
    de: 'Das änderte, was schon geschehen ist — die Partie liefe von vorn anders. Die alten Bedingungen stehen weiter.',
    en: 'That would change what has already happened — the season would come out differently. The old terms stand.',
  },
  'reject.termsWouldStrand': {
    de: 'Unter diesen Bedingungen käme nicht jeder mit. Die alten stehen weiter.',
    en: 'Not every house would come along under those terms. The old ones stand.',
  },
  'reject.noSuchSeat': {
    de: 'Diesen Platz gibt es an diesem Tisch nicht.',
    en: 'There is no such seat at this table.',
  },
  'reject.seatTaken': {
    de: 'In diesem Platz sitzt gerade jemand.',
    en: 'Somebody is sitting in that seat right now.',
  },
  'reject.hostConfigures': {
    de: 'Nur wer die Partie eröffnet hat, ändert die Bedingungen.',
    en: 'Only the house that opened the table may change its terms.',
  },
  'reject.hostStarts': {
    de: 'Nur wer die Partie eröffnet hat, gibt sie frei.',
    en: 'Only the house that opened the table may start it.',
  },
  'reject.ownHouseOnly': {
    de: 'Sie handeln nur für Ihr eigenes Haus.',
    en: 'You act for your own house alone.',
  },
  'reject.nobodyToPlay': {
    de: 'Es ist niemand am Zug.',
    en: 'Nobody is to play.',
  },
  'reject.othersTurn': {
    de: '{name} ist am Zug.',
    en: 'It is {name}’s turn.',
  },
  'reject.noLatecomers': {
    de: 'Diese Partie nimmt keine Nachzügler auf.',
    en: 'This game takes no latecomers.',
  },
  'reject.onlyAtTableMayWire': {
    de: 'Nur wer mit am Tisch sitzt, kann telegrafieren.',
    en: 'Only those at the table may send a wire.',
  },
  'reject.emptyTelegram': {
    de: 'Ein leeres Telegramm nimmt die Post nicht an.',
    en: 'The post office will not take an empty telegram.',
  },
  'reject.alreadyRunning': {
    de: 'Die Partie läuft bereits.',
    en: 'The game is already under way.',
  },
  'reject.needOneMerchant': {
    de: 'Es braucht mindestens einen Kaufmann.',
    en: 'At least one merchant is needed.',
  },
  'reject.clockNotSet': {
    de: 'Der Weltuhr fehlt der Anschlag.',
    en: 'The world clock has not been set going.',
  },
  'reject.tableFull': {
    de: 'Mehr als {n} Schiffe fahren nicht.',
    en: 'No more than {n} ships sail.',
  },
} satisfies Catalog
