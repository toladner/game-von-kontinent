import type { Catalog } from '../t'

/**
 * What the app says when nobody is looking at it.
 *
 * These are the only phrases in the game composed on a server and read on a
 * telephone, so the language has to travel with the subscription rather than
 * being decided where the sentence is built — see `armPush`. At a table with
 * a German and an English player, one push is composed twice.
 */
export const NOTIFY = {
  'notify.arrived.title': { de: 'Schiff eingelaufen', en: 'Ship in port' },
  'notify.arrived.body': {
    de: 'Ihr Schiff liegt in {port}. Es wartet auf Order.',
    en: 'Your ship is lying at {port}, awaiting orders.',
  },
  'notify.arrived.somewhere': { de: 'Ihrem Ziel', en: 'her destination' },
  'notify.seasonOver.title': { de: 'Saison beendet', en: 'The season has closed' },
  'notify.seasonOver.body': {
    de: 'Die Schlußabrechnung liegt vor.',
    en: 'The final reckoning is ready.',
  },
  'notify.something': {
    de: 'Es gibt Neues von Ihrer Partie.',
    en: 'There is news from your table.',
  },
  'notify.test.body': {
    de: 'Probemeldung — so meldet sich Ihr Schiff.',
    en: 'A test notice — this is how your ship reports in.',
  },

  // --- The card that asks for permission ------------------------------------
  'notify.on': { de: 'Ihr Schiff meldet sich', en: 'Your ship will report in' },
  'notify.off': { de: 'Meldungen sind abgeschaltet', en: 'Notifications are switched off' },
  'notify.ask': { de: 'Soll sich Ihr Schiff melden?', en: 'Should your ship report in?' },
  'notify.tested': {
    de: 'Eine Probemeldung ist hinausgegangen. Kommt sie nicht an, sperrt das Gerät selbst — bei einer installierten App unter Einstellungen ▸ Apps ▸ Benachrichtigungen.',
    en: 'A test notice has gone out. If it does not arrive, the device itself is blocking it — for an installed app, under Settings ▸ Apps ▸ Notifications.',
  },
  'notify.whileClosed': {
    de: 'Sie erfahren, wenn ein Hafen erreicht ist und wenn die Saison schließt — auch wenn die App geschlossen ist.',
    en: 'You will hear when a harbour is reached and when the season closes — even with the app shut.',
  },
  'notify.whileOpen': {
    de: 'Sie erfahren, wenn ein Hafen erreicht ist und wenn die Saison schließt — solange die Seite geöffnet bleibt oder im Hintergrund läuft.',
    en: 'You will hear when a harbour is reached and when the season closes — as long as the page stays open or runs in the background.',
  },
  'notify.blocked': {
    de: 'Ihr Browser hat Meldungen für diese Seite gesperrt. Das läßt sich nur in den Einstellungen des Browsers wieder ändern.',
    en: 'Your browser has blocked notifications for this site. That can only be undone in the browser’s own settings.',
  },
  'notify.why': {
    de: 'Eine Fahrt dauert echte Stunden. Mit Meldungen können Sie das Gerät weglegen und erfahren trotzdem, wenn der Hafen erreicht ist.',
    en: 'A voyage takes real hours. With notifications you can put the device down and still hear when the harbour is reached.',
  },
  'notify.allow': { de: 'Erlauben', en: 'Allow' },
  'notify.test': { de: 'Probe', en: 'Test' },
} satisfies Catalog
