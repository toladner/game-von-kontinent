import type { Catalog } from '../t'

/**
 * The quayside before departure, and the moment of getting connected to it.
 *
 * "Am Kai" is the heading over the list of who has turned up. English has no
 * single word with the same ring, so it becomes "On the quay" — a place, not
 * a status. Everything here is written as if a shipping clerk were reading
 * out the register.
 */
export const LOBBY = {
  'lobby.beforeSailing': { de: 'Vor der Ausfahrt', en: 'Before sailing' },
  'lobby.title': { de: 'Am Kai', en: 'On the quay' },
  'lobby.code': { de: 'Code der Partie', en: 'Table code' },
  'lobby.codeNote': {
    de: 'Andere geben diesen Code auf der Eingangsseite ein.',
    en: 'The others enter this code on the entrance page.',
  },
  'lobby.connected': { de: 'Mit der Partie verbunden.', en: 'Connected to the table.' },
  'lobby.connecting': { de: 'Verbindung wird aufgebaut …', en: 'The line is being laid …' },
  'lobby.disconnected': {
    de: 'Verbindung unterbrochen — es wird erneut versucht.',
    en: 'The line is down — trying again.',
  },
  'lobby.registered': {
    de: 'Angemeldete Kaufleute ({n})',
    en: 'Merchants registered ({n})',
  },
  'lobby.nobodyYet': { de: 'Noch niemand am Kai.', en: 'Nobody on the quay yet.' },
  'lobby.opened': { de: 'eröffnet', en: 'opened' },
  'lobby.present': { de: 'anwesend', en: 'present' },
  'lobby.absent': { de: 'abwesend', en: 'absent' },
  'lobby.latecomersWelcome': {
    de: 'Nachzügler dürfen auch nach der Ausfahrt noch ein Schiff nehmen.',
    en: 'Latecomers may still take a ship after the fleet has sailed.',
  },
  'lobby.latecomersBarred': {
    de: 'Wer jetzt nicht am Kai steht, fährt nicht mit.',
    en: 'Whoever is not on the quay now does not sail.',
  },
  'lobby.terms': {
    de: '{n} Runden · {capital} Kapital',
    en: '{n} rounds · {capital} capital',
  },
  'lobby.terms.clock': {
    de: '{season} Saison · {pace} je Punkt · {capital} Kapital',
    en: '{season} season · {pace} a point · {capital} capital',
  },
  /*
   * Deliberately not "if you have already registered" — the reader of this
   * line is not the person who lost the seat; they cannot see this screen.
   * It is the table being told the answer so it can pass it on.
   */
  'lobby.yours': { de: 'Ihr Haus', en: 'Your house' },
  'lobby.lostSeatNote': {
    de: 'Kommt jemand nicht mehr in sein Haus? Mit dem Code oben und demselben Namen wie beim ersten Mal nimmt er seinen Platz zurück — auch wenn schon gespielt wird.',
    en: 'Somebody locked out of their house? With the code above and the same name as the first time, they take their seat back — even once play has begun.',
  },
  'lobby.change': { de: 'Bedingungen ändern', en: 'Change the terms' },
  'lobby.apply': { de: 'Übernehmen', en: 'Apply' },
  'lobby.discard': { de: 'Verwerfen', en: 'Discard' },
  'lobby.leave': { de: 'Verlassen', en: 'Leave' },
  'lobby.castOff': { de: 'Ausfahrt freigeben', en: 'Give the order to sail' },
  'lobby.waitingForHost': {
    de: 'Warten auf die Freigabe durch den Eröffner …',
    en: 'Waiting for the house that opened the table …',
  },
  'lobby.share': { de: 'Einladung teilen', en: 'Share the invitation' },

  // --- The moment between asking for a table and being sat down at it -----
  'connect.game': { de: 'Partie', en: 'Table' },
  'connect.lineDown': { de: 'Die Leitung steht nicht.', en: 'The line is not up.' },
  'connect.laying': { de: 'Die Leitung wird gelegt …', en: 'The line is being laid …' },
  'connect.watchAnyway': {
    de: 'Zusehen dürfen Sie trotzdem — ein Platz am Tisch wird daraus nicht.',
    en: 'You may still watch — it will not turn into a seat at the table.',
  },
  'connect.watch': { de: 'Nur zusehen', en: 'Watch only' },
  'connect.toTitle': { de: 'Zum Titelbild', en: 'To the title page' },
} satisfies Catalog
