import type { Catalog } from '../t'

/**
 * The house's own affairs: what it owns, what it has been told, and what the
 * merchant has written down.
 *
 * The register here is a shipping office's: a vessel is "she", a hold has a
 * capacity rather than a size, and a letter is dated from the port it was
 * written in. "Übersteigen" — stepping across from one deck to another — has
 * no single English verb, so it becomes "Go aboard her".
 */
export const FLEET = {
  'fleet.subtitle.ships.one': { de: '{n} Schiff', en: '{n} ship' },
  'fleet.subtitle.ships.other': { de: '{n} Schiffe', en: '{n} ships' },
  'fleet.subtitle.mail.one': {
    de: '{n} Brief unterwegs zu Ihnen',
    en: '{n} letter on its way to you',
  },
  'fleet.subtitle.mail.other': {
    de: '{n} Briefe unterwegs zu Ihnen',
    en: '{n} letters on their way to you',
  },
  'fleet.tab.fleet': { de: 'Flotte', en: 'Fleet' },
  'fleet.tab.mail': { de: 'Post', en: 'Mail' },
  'fleet.tab.notebook': { de: 'Notizbuch', en: 'Notebook' },

  // --- The yard ------------------------------------------------------------
  'fleet.yard': { de: 'Werft', en: 'Shipyard' },
  'fleet.yard.hold': { de: 'Laderaum {capacity}', en: 'Hold {capacity}' },
  'fleet.yard.fast': { de: 'schnell', en: 'fast' },
  'fleet.yard.slow': { de: 'langsam', en: 'slow' },
  'fleet.yard.normal': { de: 'normal', en: 'ordinary' },
  'fleet.yard.tooDear': { de: 'Barmittel reichen nicht', en: 'not enough cash' },

  // --- Mail ----------------------------------------------------------------
  'fleet.mail.collect.one': { de: '{n} Brief abholen', en: 'Collect {n} letter' },
  'fleet.mail.collect.other': { de: '{n} Briefe abholen', en: 'Collect {n} letters' },
  'fleet.mail.nothingHere': {
    de: 'Im Postamt von {port} liegt nichts für Sie.',
    en: 'Nothing is waiting for you at the post office in {port}.',
  },
  'fleet.mail.ashoreOnly': { de: 'Post gibt es nur an Land.', en: 'Mail is handed over ashore.' },
  'fleet.mail.read': { de: 'Gelesene Briefe', en: 'Letters read' },
  'fleet.mail.none': { de: 'Noch keine Nachricht erhalten.', en: 'No word has reached you yet.' },
  'fleet.mail.dateline': { de: '{port}, den {time} Uhr', en: '{port}, at {time}' },
  'fleet.mail.body': {
    de: 'Die *{ship}* liegt hier{bound}. {lots} Posten an Bord.',
    en: 'The *{ship}* is lying here{bound}. {lots} lots aboard.',
  },
  'fleet.mail.bound': { de: ', bestimmt nach {port}', en: ', bound for {port}' },
  'fleet.mail.awaitingOrders': { de: ' und wartet auf Order', en: ' and awaiting orders' },

  // --- A vessel in the list ------------------------------------------------
  'fleet.aboard': { de: 'Sie sind an Bord', en: 'You are aboard' },
  'fleet.atSea': { de: 'auf See', en: 'at sea' },
  'fleet.lastReported': { de: 'Zuletzt gemeldet: {where}', en: 'Last reported: {where}' },
  'fleet.asOf': { de: ' · Stand {time} Uhr', en: ' · as of {time}' },
  'fleet.boundFor': { de: 'Unterwegs nach {port}', en: 'Under way for {port}' },
  'fleet.arriving': { de: ' · Ankunft {when}', en: ' · arriving {when}' },
  'fleet.lyingIn': { de: 'Liegt in {port}', en: 'Lying at {port}' },
  'fleet.cargoAsReported': {
    de: 'Ladung nach letzter Meldung.',
    en: 'Cargo as last reported.',
  },
  'fleet.board': { de: 'Übersteigen', en: 'Go aboard her' },
  'fleet.sendPigeon': { de: 'Taube schicken', en: 'Send a pigeon' },

  // --- The notebook --------------------------------------------------------
  'fleet.notebook.note': {
    de: 'Das Kontor führt kein Verzeichnis Ihrer Schiffe. Was Sie nicht aufschreiben, wissen Sie nicht mehr.',
    en: 'The counting house keeps no register of your ships. What you do not write down, you no longer know.',
  },
  'fleet.notebook.placeholder': {
    de: 'Stella II — 14:20 Lissabon, Order nach Dakar. Taube am 14:25.',
    en: 'Stella II — 14:20 Lisbon, ordered to Dakar. Pigeon at 14:25.',
  },
  'fleet.notebook.label': { de: 'Notizbuch', en: 'Notebook' },
  'fleet.notebook.save': { de: 'Eintragen', en: 'Enter it' },
} satisfies Catalog
