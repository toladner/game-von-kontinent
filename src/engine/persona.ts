import { nextInt, pick, seedFrom, type RngState } from './rng'
import type { Localized } from '../i18n/locale'

/**
 * Procedural people.
 *
 * A player types a name and gets a whole trading identity: a rank, a house, a
 * home Kontor, a motto and an engraved portrait. Everything derives from the
 * name, so the same name always yields the same trader - your merchant is
 * recognisably yours without any account or storage.
 *
 * Harbour characters use the same machinery, seeded from port + round, so a
 * quay is populated by people who stay put between visits.
 *
 * Every list here is data. Adding a rank, a hat or a role widens the world
 * without touching a line of logic; the drawing tables in Portrait.tsx are
 * indexed by the same numbers these traits carry.
 */

/**
 * Houses were run by men and women both, and the game should show it. The
 * trait travels with the portrait because the drawing differs, and with the
 * persona because German ranks and roles are gendered.
 */
export type Gender = 'w' | 'm'

/**
 * The words below come in pairs, and the pairs are chosen by index.
 *
 * This matters more than it looks. A name is a seed: type "Ada" and you get
 * the same trader every time, which is what makes your merchant recognisably
 * yours without an account anywhere. If the English lists were a different
 * length, or in a different order, the same seed would land on a different
 * word — and changing the language would change who you are. Picking the
 * index and resolving the language afterwards keeps the person and translates
 * only what they are called.
 *
 * So every list here must stay the same length in both languages, and entry
 * *n* in one must be entry *n* in the other. A test checks it.
 */

export interface PortraitTraits {
  readonly gender: Gender
  /** Index into FACES: the shape of the skull. */
  readonly face: number
  /** Index into HAIR; which indices are drawn depends on nothing, but the
   *  generator only ever picks ones that suit the wearer. */
  readonly hair: number
  /** Index into BEARDS. Always 0 for a woman. */
  readonly beard: number
  readonly headwear: number
  readonly collar: number
  readonly accessory: number
  /** 0 young, 1 in their prime, 2 weathered — adds lines to the engraving. */
  readonly age: number
  /** Index into the sepia ink ramp used for the engraving. */
  readonly ink: number
}

export interface Persona {
  readonly gender: Gender
  readonly rank: Localized<string>
  readonly house: Localized<string>
  readonly origin: Localized<string>
  readonly motto: Localized<string>
  readonly portrait: PortraitTraits
}

export interface HarbourCharacter {
  readonly name: string
  readonly role: Localized<string>
  readonly line: Localized<string>
  readonly gender: Gender
  readonly portrait: PortraitTraits
}

// ---------------------------------------------------------------------------
// Words
// ---------------------------------------------------------------------------

/**
 * A title in both forms. Some, like Superkargo, simply do not inflect — and
 * in English almost none of them do, which is why so many pairs below have
 * the same word twice.
 */
interface Titled {
  readonly m: string
  readonly w: string
}

/** One title, in both languages and both forms. */
type Rank = Localized<Titled>

const RANKS: readonly Rank[] = [
  { de: { m: 'Reeder', w: 'Reederin' }, en: { m: 'Shipowner', w: 'Shipowner' } },
  { de: { m: 'Handelsherr', w: 'Handelsfrau' }, en: { m: 'Merchant', w: 'Merchant' } },
  { de: { m: 'Konsul', w: 'Konsulin' }, en: { m: 'Consul', w: 'Consul' } },
  { de: { m: 'Superkargo', w: 'Superkargo' }, en: { m: 'Supercargo', w: 'Supercargo' } },
  {
    de: { m: 'Kommerzienrat', w: 'Kommerzienrätin' },
    en: { m: 'Councillor of Commerce', w: 'Councillor of Commerce' },
  },
  {
    de: { m: 'Kapitän zur See', w: 'Kapitänin zur See' },
    en: { m: 'Master Mariner', w: 'Master Mariner' },
  },
  { de: { m: 'Großhändler', w: 'Großhändlerin' }, en: { m: 'Wholesaler', w: 'Wholesaler' } },
  {
    de: { m: 'Kontorherr', w: 'Kontorherrin' },
    en: { m: 'Head of the Counting House', w: 'Head of the Counting House' },
  },
  { de: { m: 'Exporteur', w: 'Exporteurin' }, en: { m: 'Exporter', w: 'Exporter' } },
  { de: { m: 'Bankier', w: 'Bankièrin' }, en: { m: 'Banker', w: 'Banker' } },
  { de: { m: 'Spediteur', w: 'Spediteurin' }, en: { m: 'Forwarding Agent', w: 'Forwarding Agent' } },
  { de: { m: 'Generalagent', w: 'Generalagentin' }, en: { m: 'General Agent', w: 'General Agent' } },
  { de: { m: 'Schiffseigner', w: 'Schiffseignerin' }, en: { m: "Ship's Husband", w: "Ship's Husband" } },
  { de: { m: 'Warenhändler', w: 'Warenhändlerin' }, en: { m: 'Goods Dealer', w: 'Goods Dealer' } },
  { de: { m: 'Prokurist', w: 'Prokuristin' }, en: { m: 'Chief Clerk', w: 'Chief Clerk' } },
  { de: { m: 'Frachtherr', w: 'Frachtherrin' }, en: { m: 'Freighter', w: 'Freighter' } },
  { de: { m: 'Kaufmann', w: 'Kauffrau' }, en: { m: 'Trader', w: 'Trader' } },
  {
    de: { m: 'Überseehändler', w: 'Überseehändlerin' },
    en: { m: 'Overseas Merchant', w: 'Overseas Merchant' },
  },
]

const HOUSE_HEADS = [
  'Brandt',
  'Vollmer',
  'Lindquist',
  'Sartorius',
  'Delacroix',
  'van Houten',
  'Marchetti',
  'Oosterhuis',
  'Grothe',
  'Falkenberg',
  'Ravensbeck',
  'Aumüller',
  'Steenkamp',
  'Wehrhahn',
  'Cordes',
  'Mendoza',
  'Kruse',
  'Thormählen',
  'Beaumont',
  'Nyholm',
  'Castellani',
  'Wiegand',
  'Larsson',
  'de Witt',
  'Barroso',
  'Fontaine',
  'Hövelmann',
  'Aalders',
  'Strandberg',
  'Perrault',
  'Ibsen',
  'Kastner',
  'Moreau',
  'Vanderlin',
  'Schuback',
  'Ohlendorff',
] as const

/**
 * A house name is the head's name in one of the customary forms. A few are
 * reserved: a house calls itself "& Töchter" only when a woman signs for it.
 */
interface HouseForm {
  readonly build: Localized<(name: string) => string>
  readonly only?: Gender
}

const HOUSE_FORMS: readonly HouseForm[] = [
  { build: { de: (n) => `${n} & Söhne`, en: (n) => `${n} & Sons` } },
  { build: { de: (n) => `${n} & Töchter`, en: (n) => `${n} & Daughters` }, only: 'w' },
  { build: { de: (n) => `${n} & Co.`, en: (n) => `${n} & Co.` } },
  { build: { de: (n) => `Kontor ${n}`, en: (n) => `${n} Counting House` } },
  { build: { de: (n) => `Reederei ${n}`, en: (n) => `${n} Shipping` } },
  { build: { de: (n) => `${n} Überseehandel`, en: (n) => `${n} Overseas Trading` } },
  { build: { de: (n) => `Handelshaus ${n}`, en: (n) => `${n} Merchant House` } },
  { build: { de: (n) => `${n} & Compagnie`, en: (n) => `${n} & Company` } },
  { build: { de: (n) => `${n} Nachf.`, en: (n) => `${n} Successors` } },
  { build: { de: (n) => `Gebr. ${n}`, en: (n) => `${n} Brothers` }, only: 'm' },
  { build: { de: (n) => `${n} Seehandel`, en: (n) => `${n} Maritime Trade` } },
  { build: { de: (n) => `${n} Ein- und Ausfuhr`, en: (n) => `${n} Import & Export` } },
  { build: { de: (n) => `Speditionshaus ${n}`, en: (n) => `${n} Forwarding` } },
  { build: { de: (n) => `${n} Wwe.`, en: (n) => `${n} Widow & Co.` }, only: 'w' },
]

/** Only the ones English spells differently need a pair; the rest stand. */
const ORIGINS: readonly Localized<string>[] = [
  { de: 'Hamburg', en: 'Hamburg' },
  { de: 'Bremen', en: 'Bremen' },
  { de: 'Lübeck', en: 'Lübeck' },
  { de: 'Antwerpen', en: 'Antwerp' },
  { de: 'Rotterdam', en: 'Rotterdam' },
  { de: 'Triest', en: 'Trieste' },
  { de: 'Genua', en: 'Genoa' },
  { de: 'Bordeaux', en: 'Bordeaux' },
  { de: 'Danzig', en: 'Danzig' },
  { de: 'Kopenhagen', en: 'Copenhagen' },
  { de: 'Lissabon', en: 'Lisbon' },
  { de: 'Marseille', en: 'Marseille' },
  { de: 'Bergen', en: 'Bergen' },
  { de: 'Stettin', en: 'Stettin' },
  { de: 'Le Havre', en: 'Le Havre' },
  { de: 'Cádiz', en: 'Cadiz' },
  { de: 'Venedig', en: 'Venice' },
  { de: 'Riga', en: 'Riga' },
  { de: 'Amsterdam', en: 'Amsterdam' },
  { de: 'Nantes', en: 'Nantes' },
  { de: 'Porto', en: 'Oporto' },
  { de: 'Königsberg', en: 'Königsberg' },
]

/**
 * House mottoes. Translated for sense rather than word for word — a proverb
 * that scans in one language and limps in the other is not a translation.
 */
const MOTTOS: readonly Localized<string>[] = [
  { de: 'Wer wartet, verliert die Fracht.', en: 'He who waits loses the freight.' },
  { de: 'Das Meer vergißt keine Rechnung.', en: 'The sea forgets no account.' },
  {
    de: 'Zwei Kisten sind besser als ein Versprechen.',
    en: 'Two crates beat one promise.',
  },
  { de: 'Ein voller Laderaum schläft nicht.', en: 'A full hold never sleeps.' },
  { de: 'Gute Ware findet ihren Hafen.', en: 'Good goods find their harbour.' },
  {
    de: 'Kaufe im Regen, verkaufe im Sonnenschein.',
    en: 'Buy in the rain, sell in the sunshine.',
  },
  { de: 'Der Kurs macht den Kaufmann.', en: 'The course makes the merchant.' },
  { de: 'Wind kostet nichts, Zeit sehr wohl.', en: 'Wind is free; time is not.' },
  { de: 'Kein Gewinn ohne Salzwasser.', en: 'No profit without salt water.' },
  { de: 'Erst wiegen, dann wagen.', en: 'Weigh first, venture after.' },
  { de: 'Ein leerer Laderaum ist ein verlorener Tag.', en: 'An empty hold is a lost day.' },
  { de: 'Frachtbrief vor Handschlag.', en: 'Bill of lading before handshake.' },
  {
    de: 'Der beste Hafen ist der, wo die Ware fehlt.',
    en: 'The best harbour is the one that wants what you carry.',
  },
  { de: 'Man rechnet in Kisten, nicht in Wünschen.', en: 'One reckons in crates, not in wishes.' },
  { de: 'Salz im Haar, Zahlen im Kopf.', en: 'Salt in the hair, figures in the head.' },
  { de: 'Wer alles lädt, verkauft nichts.', en: 'Load everything and you sell nothing.' },
  { de: 'Die Ebbe wartet auf keinen Kontrakt.', en: 'The ebb waits on no contract.' },
  { de: 'Zwei Häfen weiter zahlt man das Doppelte.', en: 'Two harbours on, they pay double.' },
]

const FIRST_NAMES_M = [
  'Aldo',
  'Anselm',
  'Bartholomé',
  'Casimir',
  'Cornelis',
  'Dierk',
  'Eduardo',
  'Emil',
  'Ferdinand',
  'Gustav',
  'Hinrich',
  'Ivo',
  'Jules',
  'Kasper',
  'Knut',
  'Leopold',
  'Lorenzo',
  'Matthias',
  'Nuno',
  'Olav',
  'Pieter',
  'Quirin',
  'Rafael',
  'Séverin',
  'Silvio',
  'Thorben',
  'Tomás',
  'Vittorio',
  'Willem',
  'Yannick',
] as const

const FIRST_NAMES_W = [
  'Agneta',
  'Beatrix',
  'Berta',
  'Clara',
  'Dorothea',
  'Doris',
  'Elsbeth',
  'Fatima',
  'Friederike',
  'Grete',
  'Hedda',
  'Henriette',
  'Ingeborg',
  'Joana',
  'Josefa',
  'Katharina',
  'Liese',
  'Malin',
  'Marlene',
  'Nele',
  'Olga',
  'Paula',
  'Rosa',
  'Ruth',
  'Sieglinde',
  'Theresa',
  'Ulla',
  'Valeska',
  'Wanda',
  'Wilhelmine',
] as const

const LAST_NAMES = [
  'Almeida',
  'Baltus',
  'Brenner',
  'Cavalcanti',
  'Cordero',
  'Dahlmann',
  'Duarte',
  'Engström',
  'Esposito',
  'Ferreira',
  'Fioravanti',
  'Gerlach',
  'Grimm',
  'Halvorsen',
  'Hulsmann',
  'Ibarra',
  'Iversen',
  'Jansen',
  'Janssens',
  'Kowalski',
  'Krogh',
  'Lindgren',
  'Lombardi',
  'Mensah',
  'Moretti',
  'Nkemi',
  'Norrgård',
  'Oduya',
  'Okonkwo',
  'Pais',
  'Petrov',
  'Rasmussen',
  'Silva',
  'Tanaka',
  'Ubaldi',
  'Vermeer',
] as const

// ---------------------------------------------------------------------------
// Faces
// ---------------------------------------------------------------------------

/**
 * Which trait indices suit whom. The renderer draws whatever number it is
 * handed; keeping the taste here means a new hairstyle is one path plus one
 * number in a list.
 */
const HAIR_M = [0, 1, 1, 2, 2, 3, 4, 5] as const
const HAIR_W = [4, 6, 6, 7, 7, 8, 9, 9] as const
const HEADWEAR_M = [0, 0, 0, 1, 2, 3] as const
const HEADWEAR_W = [0, 0, 0, 4, 5] as const
const ACCESSORY_M = [0, 0, 0, 1, 2, 3, 5] as const
const ACCESSORY_W = [0, 0, 0, 3, 4, 5] as const

function traits(rng: RngState, gender: Gender): [PortraitTraits, RngState] {
  let s = rng
  const roll = (max: number) => {
    const [v, next] = nextInt(s, max)
    s = next
    return v
  }
  const from = (list: readonly number[]) => list[roll(list.length)]!

  const t: PortraitTraits = {
    gender,
    face: roll(4),
    hair: from(gender === 'm' ? HAIR_M : HAIR_W),
    beard: gender === 'm' ? roll(6) : 0,
    headwear: from(gender === 'm' ? HEADWEAR_M : HEADWEAR_W),
    collar: roll(4),
    accessory: from(gender === 'm' ? ACCESSORY_M : ACCESSORY_W),
    age: roll(3),
    ink: roll(3),
  }
  return [t, s]
}

// ---------------------------------------------------------------------------
// Traders
// ---------------------------------------------------------------------------

/**
 * Build a trader identity from the name the player typed.
 *
 * Gender is the one thing the name does *not* decide. Rolling it from the
 * seed meant the switch flipped under your finger with every letter typed,
 * which reads as a fault rather than as character. It defaults to a Kaufmann
 * and only ever changes when someone taps the ♀/♂ switch. Harbour folk are
 * still drawn at random — see `person`.
 */
export function makePersona(playerName: string, salt = '', gender: Gender = 'm'): Persona {
  let s = seedFrom(`persona:${playerName.trim().toLowerCase()}:${salt}`)
  const take = <T>(list: readonly T[]): T => {
    const [v, next] = pick(list, s)
    s = next
    return v
  }
  const sex: Gender = gender

  const head = take(HOUSE_HEADS)
  const forms = HOUSE_FORMS.filter((f) => !f.only || f.only === sex)
  const form = take(forms)
  const rank = take(RANKS)
  const origin = take(ORIGINS)
  const motto = take(MOTTOS)
  const [portrait] = traits(s, sex)
  return {
    gender: sex,
    rank: { de: sex === 'w' ? rank.de.w : rank.de.m, en: sex === 'w' ? rank.en.w : rank.en.m },
    house: { de: form.build.de(head), en: form.build.en(head) },
    origin,
    motto,
    portrait,
  }
}

// ---------------------------------------------------------------------------
// Ships
// ---------------------------------------------------------------------------

const SHIP_FIRST = [
  'Stella', 'Nordstern', 'Amalie', 'Concordia', 'Fortuna', 'Albatros', 'Möwe',
  'Passat', 'Kormoran', 'Hanseat', 'Elbe', 'Providentia', 'Iris', 'Nautilus',
  'Sturmvogel', 'Adler', 'Delphin', 'Merkur', 'Anna Sophie', 'Seeschwalbe',
  'Windsbraut', 'Santa Clara', 'Pelikan', 'Kronprinz', 'Vineta', 'Freya',
  'Störtebeker', 'Aurora', 'Salamander', 'Wappen von Bremen',
] as const

const SHIP_SUFFIX = ['', '', '', ' II', ' III', ' von Bremen', ' von Triest', ' von Lübeck'] as const

/**
 * A vessel's name, and the master who answers for her.
 *
 * The name is a proper noun and stays put. The title in front of the master's
 * name does not: German has Kapitän and Kapitänin, English has "Master" for
 * both, and the letter she signs has to read properly either way.
 */
export interface ShipIdentity {
  readonly name: string
  readonly captain: Localized<string>
  readonly captainGender: Gender
}

export function makeShipIdentity(seedText: string): ShipIdentity {
  let s = seedFrom(`schiff:${seedText}`)
  const take = <T>(list: readonly T[]): T => {
    const [v, next] = pick(list, s)
    s = next
    return v
  }
  const name = `${take(SHIP_FIRST)}${take(SHIP_SUFFIX)}`
  const [coin, afterCoin] = nextInt(s, 2)
  s = afterCoin
  const sex: Gender = coin === 0 ? 'w' : 'm'
  const first = take(sex === 'w' ? FIRST_NAMES_W : FIRST_NAMES_M)
  const surname = take(LAST_NAMES)
  const captain = {
    de: `${sex === 'w' ? 'Kapitänin' : 'Kapitän'} ${first} ${surname}`,
    en: `Master ${first} ${surname}`,
  }
  return { name, captain, captainGender: sex }
}

// ---------------------------------------------------------------------------
// Harbour characters
// ---------------------------------------------------------------------------

interface RoleDef {
  readonly title: Localized<Titled>
  readonly lines: readonly Localized<string>[]
}

/**
 * Lines are flavour, never rules text. They nudge without instructing, which
 * is how the game teaches itself instead of handing out a rulebook.
 */
const ROLES: readonly RoleDef[] = [
  {
    title: {
      de: { m: 'Hafenmeister', w: 'Hafenmeisterin' },
      en: { m: 'Harbourmaster', w: 'Harbourmaster' },
    },
    lines: [
      {
        de: 'Zwei Posten dürfen an Bord, mehr trägt das Papier nicht.',
        en: 'Two lots aboard, no more — the paperwork will not carry it.',
      },
      {
        de: 'Liegegeld wird fällig, wenn Sie trödeln. Nur zur Erinnerung.',
        en: 'Berthing dues fall due if you dawdle. Just a reminder.',
      },
      {
        de: 'Ihr Kiel liegt tief. Das gefällt mir bei einem Kaufmann.',
        en: 'Your keel sits deep. I like that in a merchant.',
      },
      {
        de: 'Ohne Ladung auslaufen darf jeder. Klug ist es selten.',
        en: 'Anyone may sail with an empty hold. It is rarely clever.',
      },
    ],
  },
  {
    title: {
      de: { m: 'Warenmakler', w: 'Warenmaklerin' },
      en: { m: 'Goods Broker', w: 'Goods Broker' },
    },
    lines: [
      {
        de: 'Was hier auf dem Kai stapelt, bringt hier auch nichts ein.',
        en: 'What is stacked on this quay earns nothing on this quay.',
      },
      {
        de: 'Fremde Ware zahlt sich aus, eigene drückt den Preis.',
        en: 'Foreign goods pay; our own depress the price.',
      },
      {
        de: 'Kaufen Sie, solange die Notierung schläft.',
        en: 'Buy while the quotation is asleep.',
      },
      {
        de: 'Drei Häfen weiter kennt man Ihre Ware nicht. Umso besser.',
        en: 'Three harbours on, nobody knows your goods. So much the better.',
      },
    ],
  },
  {
    title: {
      de: { m: 'Zollbeamter', w: 'Zollbeamtin' },
      en: { m: 'Customs Officer', w: 'Customs Officer' },
    },
    lines: [
      {
        de: 'Papiere. — Gut. Der Nächste.',
        en: 'Papers. — Good. Next.',
      },
      {
        de: 'Steuern kommen wie das Wetter: unangekündigt.',
        en: 'Taxes come like the weather: unannounced.',
      },
      {
        de: 'Ich habe nichts gesehen, Sie haben nichts geladen.',
        en: 'I saw nothing, you loaded nothing.',
      },
    ],
  },
  {
    title: {
      de: { m: 'Schiffsmäkler', w: 'Schiffsmäklerin' },
      en: { m: 'Ship Broker', w: 'Ship Broker' },
    },
    lines: [
      {
        de: 'Nach Süden liegt der Wind günstig, sagt man.',
        en: 'The wind stands fair for the south, they say.',
      },
      {
        de: 'Wer zurückrudert, verliert den Kurs und den Ruf.',
        en: 'Turn back and you lose the course and the name with it.',
      },
      {
        de: 'Eine Passage ist schnell gebucht, eine Fracht nicht.',
        en: 'A passage is quickly booked; a freight is not.',
      },
    ],
  },
  {
    title: {
      de: { m: 'Kaischenk', w: 'Kaischenkin' },
      en: { m: 'Quayside Publican', w: 'Quayside Publican' },
    },
    lines: [
      {
        de: 'Setzen Sie sich, der Kaffee ist von drüben.',
        en: 'Sit down; the coffee came in from across the water.',
      },
      {
        de: 'Gestern lag hier einer mit vollem Laderaum. Heute nicht mehr.',
        en: 'Yesterday one lay here with a full hold. Not today.',
      },
      {
        de: 'Man erzählt sich, die Kurse steigen. Man erzählt sich viel.',
        en: 'They say prices are rising. They say a great deal.',
      },
    ],
  },
  {
    title: {
      de: { m: 'Telegraphist', w: 'Telegraphistin' },
      en: { m: 'Telegraphist', w: 'Telegraphist' },
    },
    lines: [
      {
        de: 'Eine Depesche für Sie. Vielleicht. Später.',
        en: 'A dispatch for you. Perhaps. Later.',
      },
      {
        de: 'Die Leitung nach Übersee ist heute launisch.',
        en: 'The overseas line is temperamental today.',
      },
      {
        de: 'Nachrichten reisen schneller als Ihr Dampfer.',
        en: 'News travels faster than your steamer.',
      },
    ],
  },
  {
    title: {
      de: { m: 'Lademeister', w: 'Lademeisterin' },
      en: { m: 'Loading Master', w: 'Loading Master' },
    },
    lines: [
      {
        de: 'Vorsicht, das Netz hält nur, was es muß.',
        en: 'Mind yourself — the net holds only what it must.',
      },
      {
        de: 'Jede Kiste, die an Bord geht, will auch wieder herunter.',
        en: 'Every crate that goes aboard wants to come off again.',
      },
      {
        de: 'Volle Luken, leere Kasse — kennt man.',
        en: 'Full hatches, empty cash box. We know the type.',
      },
    ],
  },
  {
    title: {
      de: { m: 'Lotse', w: 'Lotsin' },
      en: { m: 'Pilot', w: 'Pilot' },
    },
    lines: [
      {
        de: 'Untiefen voraus, halten Sie sich an die Linie.',
        en: 'Shoals ahead — keep to the line.',
      },
      {
        de: 'Ich bringe Sie hinaus, den Rest macht der Würfel.',
        en: 'I will see you out; the dice do the rest.',
      },
      {
        de: 'Bei diesem Wetter zählt jeder Punkt Fahrt.',
        en: 'In this weather every mark of sailing counts.',
      },
    ],
  },
  {
    title: {
      de: { m: 'Schauermann', w: 'Schauerfrau' },
      en: { m: 'Stevedore', w: 'Stevedore' },
    },
    lines: [
      {
        de: 'Zwölf Stunden am Haken, und noch immer ist der Kai voll.',
        en: 'Twelve hours on the hook and the quay is still full.',
      },
      {
        de: 'Was Sie hier stehen lassen, steht morgen noch da.',
        en: 'What you leave standing here will still be standing tomorrow.',
      },
      {
        de: 'Wir laden alles. Bezahlen müssen Sie selbst.',
        en: 'We load anything. Paying is your own affair.',
      },
    ],
  },
  {
    title: {
      de: { m: 'Kontorist', w: 'Kontoristin' },
      en: { m: 'Clerk', w: 'Clerk' },
    },
    lines: [
      {
        de: 'Die Bücher sagen mehr über Sie als Ihr Hut.',
        en: 'The books say more about you than your hat does.',
      },
      {
        de: 'Einkauf links, Verkauf rechts, dazwischen der Kummer.',
        en: 'Purchases left, sales right, and the grief in between.',
      },
      {
        de: 'Ich habe Ihre Zahlen gesehen. Kein Kommentar.',
        en: 'I have seen your figures. No comment.',
      },
    ],
  },
  {
    title: {
      de: { m: 'Segelmacher', w: 'Segelmacherin' },
      en: { m: 'Sailmaker', w: 'Sailmaker' },
    },
    lines: [
      {
        de: 'Ein Riß im Tuch kostet mehr als eine ganze Bahn.',
        en: 'A tear in the cloth costs more than a whole bolt.',
      },
      {
        de: 'Dampf hin oder her — ich habe hier immer zu tun.',
        en: 'Steam or no steam, there is always work for me here.',
      },
      {
        de: 'Nähen Sie beizeiten, dann fahren Sie länger.',
        en: 'Stitch in good time and you will sail the longer.',
      },
    ],
  },
  {
    title: {
      de: { m: 'Wirt', w: 'Wirtin' },
      en: { m: 'Innkeeper', w: 'Innkeeper' },
    },
    lines: [
      {
        de: 'Erst zahlen, dann klagen.',
        en: 'Pay first, complain after.',
      },
      {
        de: 'Am Nebentisch sitzt Ihre Konkurrenz. Sprechen Sie leiser.',
        en: 'Your rivals are at the next table. Speak lower.',
      },
      {
        de: 'Zwei Häfen hat jeder Mann: diesen und den nächsten.',
        en: 'Every man has two harbours: this one and the next.',
      },
    ],
  },
]

/** The Makler who keeps the quay's ledger — the guide, distinct from the crowd. */
const GUIDE_ROLE: Localized<Titled> = {
  de: { m: 'Kontormakler', w: 'Kontormaklerin' },
  en: { m: 'Harbour Broker', w: 'Harbour Broker' },
}

/** Picks the form of a title that suits the person wearing it. */
function titled(pair: Localized<Titled>, gender: Gender): Localized<string> {
  return {
    de: gender === 'w' ? pair.de.w : pair.de.m,
    en: gender === 'w' ? pair.en.w : pair.en.m,
  }
}

function person(rng: RngState): [{ name: string; gender: Gender; portrait: PortraitTraits }, RngState] {
  let s = rng
  const take = <T>(list: readonly T[]): T => {
    const [v, next] = pick(list, s)
    s = next
    return v
  }
  const [coin, afterCoin] = nextInt(s, 2)
  s = afterCoin
  const gender: Gender = coin === 0 ? 'w' : 'm'
  const name = `${take(gender === 'w' ? FIRST_NAMES_W : FIRST_NAMES_M)} ${take(LAST_NAMES)}`
  const [portrait, next] = traits(s, gender)
  s = next
  return [{ name, gender, portrait }, s]
}

/**
 * The people standing on a given quay. Seeded from the port so they are the
 * same crowd whenever you call there, and shift as the seasons (rounds) pass.
 */
export function harbourCharacters(
  portId: string,
  round: number,
  count = 2,
  salt = '',
): HarbourCharacter[] {
  let s = seedFrom(`quay:${portId}:${Math.floor(round / 6)}:${salt}`)
  const take = <T>(list: readonly T[]): T => {
    const [v, next] = pick(list, s)
    s = next
    return v
  }

  const out: HarbourCharacter[] = []
  const usedRoles = new Set<string>()
  let guard = 0
  while (out.length < count && guard++ < 60) {
    const def = take(ROLES)
    if (usedRoles.has(def.title.de.m)) continue
    usedRoles.add(def.title.de.m)
    const line = take(def.lines)
    const [who, next] = person(s)
    s = next
    out.push({
      name: who.name,
      role: titled(def.title, who.gender),
      line,
      gender: who.gender,
      portrait: who.portrait,
    })
  }
  return out
}

/**
 * The one person who is always on the quay when you tie up.
 *
 * Seeded from the port alone — no round — because the point of a guide is
 * that you recognise them. What they say comes from the game's state, not
 * from here; see `harbourAdvice`.
 */
export function harbourGuide(portId: string, salt = ''): HarbourCharacter {
  const s = seedFrom(`makler:${portId}:${salt}`)
  const [who] = person(s)
  return {
    name: who.name,
    role: titled(GUIDE_ROLE, who.gender),
    line: { de: '', en: '' },
    gender: who.gender,
    portrait: who.portrait,
  }
}
