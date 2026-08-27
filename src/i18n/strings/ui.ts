import type { Catalog } from '../t'

/**
 * The interface itself: buttons, headings, the small print under them.
 *
 * House style, and the reason the English is not a word-for-word rendering:
 * the German copy is written in the register of a 1950s trading house, and
 * the English has to be written in the same register rather than translated
 * into modern app English. "Kurs setzen" is "Set a course", not "Go". A
 * harbour has a *counting house*, not an office. Ships are "she".
 */
export const UI = {
  // --- Words that turn up everywhere -------------------------------------
  'ui.cancel': { de: 'Abbrechen', en: 'Cancel' },
  'ui.close': { de: 'Schließen', en: 'Close' },
  'ui.back': { de: 'Zurück', en: 'Back' },
  'ui.of': { de: 'von', en: 'of' },
  'ui.pip.one': { de: '{n} Punkt', en: '{n} mark' },
  'ui.pip.other': { de: '{n} Punkte', en: '{n} marks' },

  'ui.watchingOnly': {
    de: 'Sie sitzen nicht mit am Tisch — Sie sehen nur zu.',
    en: 'You are not seated at this table — you are only watching.',
  },
  'ui.noConnection': {
    de: 'Keine Verbindung zur Partie. Es wird erneut versucht.',
    en: 'No line to the game. Trying again.',
  },
  'ui.seatNumber': { de: 'Spieler {n}', en: 'Player {n}' },

  // --- The house's own strip, top left ------------------------------------
  'hud.holdEmpty': { de: 'Laderaum leer', en: 'Hold empty' },
  'hud.aboard.one': { de: '{n} Posten an Bord', en: '{n} lot aboard' },
  'hud.aboard.other': { de: '{n} Posten an Bord', en: '{n} lots aboard' },
  // The German is a ledger's shorthand and stays in the singular however many
  // are left, as it was written; English will not carry that off.
  'hud.purchasesLeft.one': { de: '{n} Kauf frei', en: '{n} purchase left' },
  'hud.purchasesLeft.other': { de: '{n} Kauf frei', en: '{n} purchases left' },

  // --- The chart's own controls -------------------------------------------
  'board.zoomOut': { de: 'Weiter weg', en: 'Further out' },
  'board.toMyShip': { de: 'Zum eigenen Schiff', en: 'To your own ship' },

  // --- Elsewhere -----------------------------------------------------------
  'cargo.holdEmpty': { de: 'Der Laderaum ist leer.', en: 'The hold is empty.' },

  // --- The chart itself ---------------------------------------------------
  'board.chart': {
    de: 'Spielplan mit Schiffahrtslinien',
    en: 'Chart with the shipping lines',
  },
  'board.zoomIn': { de: 'Näher heran', en: 'Closer in' },
  'sheet.shrink': { de: 'Verkleinern', en: 'Shrink' },
  'sheet.grow': { de: 'Vergrößern', en: 'Expand' },

  // --- When the app itself has come off the rails -------------------------
  'crash.heading': { de: 'Störung im Kontor', en: 'Trouble in the counting house' },
  'crash.title': { de: 'Da ist etwas verrutscht', en: 'Something has slipped' },
  'crash.note': {
    de: 'Die Partie selbst ist nicht verloren — sie liegt als Zugliste vor und wird beim Fortsetzen neu abgespielt.',
    en: 'The game itself is not lost — it is kept as a list of moves and is played again from the start when you resume.',
  },
  'crash.continue': { de: 'Weiterspielen', en: 'Carry on' },
  'crash.restart': { de: 'Neu beginnen', en: 'Begin again' },
  'net.couldNotOpen': {
    de: 'Die Exportbank meldet: Partie konnte nicht eröffnet werden.',
    en: 'The Export Bank reports: the table could not be opened.',
  },

  // --- Language ----------------------------------------------------------
  'ui.language': { de: 'Sprache', en: 'Language' },
  'ui.language.note': {
    de: 'Gilt sofort und für alles — Karten, Berichte und Meldungen. Der Spielstand bleibt derselbe.',
    en: 'Takes effect at once and everywhere — cards, reports and notifications. The saved game is unaffected.',
  },

  // --- Settings sheet -----------------------------------------------------
  'settings.title': { de: 'Einstellungen', en: 'Settings' },
  'settings.subtitle': { de: 'Meldungen und diese Partie', en: 'Notifications and this game' },
  'settings.notices': { de: 'Meldungen', en: 'Notifications' },
  'settings.notices.realtime': {
    de: 'Die Schiffe fahren weiter, während Sie anderes tun. Eine Meldung sagt Ihnen, wenn eines angelegt hat.',
    en: 'The ships sail on while you do other things. A notification tells you when one has made port.',
  },
  'settings.notices.dice': {
    de: 'In der Würfelpartie bewegt sich nichts ohne Wurf, es gibt also wenig zu melden. Die Einstellung gilt trotzdem für die nächste Echtzeitpartie.',
    en: 'In a dice game nothing moves without a throw, so there is little to report. The setting still holds for your next real-time game.',
  },
  'settings.game': { de: 'Diese Partie', en: 'This game' },
  'settings.table': { de: 'Tisch', en: 'Table' },
  'settings.line': { de: 'Leitung', en: 'Line' },
  'settings.line.up': { de: 'steht', en: 'open' },
  'settings.line.connecting': { de: 'wird gelegt', en: 'being laid' },
  'settings.line.down': { de: 'unterbrochen', en: 'cut' },
  'settings.atTable': { de: 'Am Tisch', en: 'At the table' },
  'settings.local': {
    de: 'An einem Gerät gespielt. Der Spielstand liegt hier auf dem Gerät und wird nach jedem Zug fortgeschrieben.',
    en: 'Played on one device. The game is saved here and written on after every turn.',
  },
  'settings.leaving': { de: 'Verlassen', en: 'Leaving' },
  'settings.toTitle': { de: 'Zum Titelbild', en: 'To the title page' },
  'settings.leave.net': {
    de: 'Die Partie läuft weiter und Ihr Platz bleibt Ihrer. Beim nächsten Öffnen sind Sie von selbst wieder an Bord.',
    en: 'The game runs on and your seat stays yours. Next time you open it you are aboard again of your own accord.',
  },
  'settings.leave.local': {
    de: 'Der Spielstand bleibt erhalten. Auf der Eingangsseite steht »Angefangene Partie fortsetzen«.',
    en: 'The saved game is kept. The entrance page offers “Resume the game in progress”.',
  },
  'settings.abandon': { de: 'Partie aufgeben', en: 'Abandon the game' },
  'settings.abandon.confirm': {
    de: 'Wirklich aufgeben — alles verwerfen',
    en: 'Abandon it — discard everything',
  },
  'settings.abandon.net': {
    de: 'Gibt Ihren Platz an diesem Tisch auf. Zurück kämen Sie nur als neuer Mitspieler.',
    en: 'Gives up your seat at this table. You could only come back as a new player.',
  },
  'settings.abandon.local': {
    de: 'Löscht den Spielstand. Das läßt sich nicht rückgängig machen.',
    en: 'Deletes the saved game. This cannot be undone.',
  },
} satisfies Catalog
