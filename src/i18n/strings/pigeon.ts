import type { Catalog } from '../t'

/**
 * The carrier pigeon: the only way to reach a captain you cannot see.
 *
 * German inflects the captain's title by gender — Kapitän / Kapitänin — and
 * then the pronouns follow. English does neither, so what is three phrases in
 * German is one in English. Rather than pretend the two languages have the
 * same shape, both are written out and the gendered variants simply resolve to
 * the same English line.
 */
export const PIGEON = {
  'pigeon.title': { de: 'Brieftaube', en: 'Carrier pigeon' },
  'pigeon.to.w': {
    de: 'An die Kapitänin der {ship} — {name}',
    en: 'To the master of the {ship} — {name}',
  },
  'pigeon.to.m': {
    de: 'An den Kapitän der {ship} — {name}',
    en: 'To the master of the {ship} — {name}',
  },
  'pigeon.release': { de: 'Taube auflassen · {cost}', en: 'Release the pigeon · {cost}' },
  'pigeon.dispatch': { de: 'Depesche', en: 'Dispatch' },
  'pigeon.lastReported': {
    de: 'Zuletzt gemeldet: {port}, Stand {time} Uhr{bound}.',
    en: 'Last reported: {port}, as of {time}{bound}.',
  },
  'pigeon.bound': { de: ', bestimmt nach {port}', en: ', bound for {port}' },
  'pigeon.noReport': {
    de: 'Von diesem Schiff liegt keine Meldung vor.',
    en: 'There is no report of this ship.',
  },
  'pigeon.addressedTo': { de: 'Adressiert an', en: 'Addressed to' },
  'pigeon.addressedTo.hint': {
    de: 'Wo vermuten Sie das Schiff? Irren Sie sich, liest den Brief niemand.',
    en: 'Where do you suppose the ship is? Guess wrong and nobody reads the letter.',
  },
  'pigeon.order': { de: 'Order: fahre nach', en: 'Order: sail for' },
  'pigeon.order.hint.w': {
    de: 'Was sie tun soll, wenn der Brief ankommt.',
    en: 'What she is to do if the letter arrives.',
  },
  'pigeon.order.hint.m': {
    de: 'Was er tun soll, wenn der Brief ankommt.',
    en: 'What he is to do if the letter arrives.',
  },
  'pigeon.replyPlease': { de: 'Um Antwort wird gebeten', en: 'A reply is requested' },
  'pigeon.replyTo': { de: 'Antwort nach', en: 'Reply to' },
  'pigeon.replyTo.hint.w': {
    de: 'Dorthin schickt sie ihre Taube. Sie müssen selbst dort sein, um den Brief zu holen.',
    en: 'That is where she sends her pigeon. You must be there yourself to collect the letter.',
  },
  'pigeon.replyTo.hint.m': {
    de: 'Dorthin schickt er seine Taube. Sie müssen selbst dort sein, um den Brief zu holen.',
    en: 'That is where he sends his pigeon. You must be there yourself to collect the letter.',
  },
  'pigeon.noConfirmation': {
    de: 'Ob die Taube ankommt, erfahren Sie nicht. Manche kommen nie an.',
    en: 'Whether the pigeon arrives you will not learn. Some never do.',
  },
  'pigeon.searchPort': { de: 'Hafen suchen …', en: 'Search for a harbour …' },
  'pigeon.noSuchPort': { de: 'Kein solcher Hafen.', en: 'No such harbour.' },
} satisfies Catalog
