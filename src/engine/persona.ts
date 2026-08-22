import { nextInt, pick, seedFrom, type RngState } from './rng'

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
  readonly rank: string
  readonly house: string
  readonly origin: string
  readonly motto: string
  readonly portrait: PortraitTraits
}

export interface HarbourCharacter {
  readonly name: string
  readonly role: string
  readonly line: string
  readonly gender: Gender
  readonly portrait: PortraitTraits
}

// ---------------------------------------------------------------------------
// Words
// ---------------------------------------------------------------------------

/** A title in both forms. Some, like Superkargo, simply do not inflect. */
interface Titled {
  readonly m: string
  readonly w: string
}

const RANKS: readonly Titled[] = [
  { m: 'Reeder', w: 'Reederin' },
  { m: 'Handelsherr', w: 'Handelsfrau' },
  { m: 'Konsul', w: 'Konsulin' },
  { m: 'Superkargo', w: 'Superkargo' },
  { m: 'Kommerzienrat', w: 'Kommerzienrätin' },
  { m: 'Kapitän zur See', w: 'Kapitänin zur See' },
  { m: 'Großhändler', w: 'Großhändlerin' },
  { m: 'Kontorherr', w: 'Kontorherrin' },
  { m: 'Exporteur', w: 'Exporteurin' },
  { m: 'Bankier', w: 'Bankièrin' },
  { m: 'Spediteur', w: 'Spediteurin' },
  { m: 'Generalagent', w: 'Generalagentin' },
  { m: 'Schiffseigner', w: 'Schiffseignerin' },
  { m: 'Warenhändler', w: 'Warenhändlerin' },
  { m: 'Prokurist', w: 'Prokuristin' },
  { m: 'Frachtherr', w: 'Frachtherrin' },
  { m: 'Kaufmann', w: 'Kauffrau' },
  { m: 'Überseehändler', w: 'Überseehändlerin' },
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
  readonly build: (name: string) => string
  readonly only?: Gender
}

const HOUSE_FORMS: readonly HouseForm[] = [
  { build: (n) => `${n} & Söhne` },
  { build: (n) => `${n} & Töchter`, only: 'w' },
  { build: (n) => `${n} & Co.` },
  { build: (n) => `Kontor ${n}` },
  { build: (n) => `Reederei ${n}` },
  { build: (n) => `${n} Überseehandel` },
  { build: (n) => `Handelshaus ${n}` },
  { build: (n) => `${n} & Compagnie` },
  { build: (n) => `${n} Nachf.` },
  { build: (n) => `Gebr. ${n}`, only: 'm' },
  { build: (n) => `${n} Seehandel` },
  { build: (n) => `${n} Ein- und Ausfuhr` },
  { build: (n) => `Speditionshaus ${n}` },
  { build: (n) => `${n} Wwe.`, only: 'w' },
]

const ORIGINS = [
  'Hamburg',
  'Bremen',
  'Lübeck',
  'Antwerpen',
  'Rotterdam',
  'Triest',
  'Genua',
  'Bordeaux',
  'Danzig',
  'Kopenhagen',
  'Lissabon',
  'Marseille',
  'Bergen',
  'Stettin',
  'Le Havre',
  'Cádiz',
  'Venedig',
  'Riga',
  'Amsterdam',
  'Nantes',
  'Porto',
  'Königsberg',
] as const

const MOTTOS = [
  'Wer wartet, verliert die Fracht.',
  'Das Meer vergißt keine Rechnung.',
  'Zwei Kisten sind besser als ein Versprechen.',
  'Ein voller Laderaum schläft nicht.',
  'Gute Ware findet ihren Hafen.',
  'Kaufe im Regen, verkaufe im Sonnenschein.',
  'Der Kurs macht den Kaufmann.',
  'Wind kostet nichts, Zeit sehr wohl.',
  'Kein Gewinn ohne Salzwasser.',
  'Erst wiegen, dann wagen.',
  'Ein leerer Laderaum ist ein verlorener Tag.',
  'Frachtbrief vor Handschlag.',
  'Der beste Hafen ist der, wo die Ware fehlt.',
  'Man rechnet in Kisten, nicht in Wünschen.',
  'Salz im Haar, Zahlen im Kopf.',
  'Wer alles lädt, verkauft nichts.',
  'Die Ebbe wartet auf keinen Kontrakt.',
  'Zwei Häfen weiter zahlt man das Doppelte.',
] as const

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
    rank: sex === 'w' ? rank.w : rank.m,
    house: form.build(head),
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

/** A vessel's name, and the master who answers for her. */
export interface ShipIdentity {
  readonly name: string
  readonly captain: string
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
  const captain = `${sex === 'w' ? 'Kapitänin' : 'Kapitän'} ${first} ${take(LAST_NAMES)}`
  return { name, captain, captainGender: sex }
}

// ---------------------------------------------------------------------------
// Harbour characters
// ---------------------------------------------------------------------------

interface RoleDef extends Titled {
  readonly lines: readonly string[]
}

/**
 * Lines are flavour, never rules text. They nudge without instructing, which
 * is how the game teaches itself instead of handing out a rulebook.
 */
const ROLES: readonly RoleDef[] = [
  {
    m: 'Hafenmeister',
    w: 'Hafenmeisterin',
    lines: [
      'Zwei Posten dürfen an Bord, mehr trägt das Papier nicht.',
      'Liegegeld wird fällig, wenn Sie trödeln. Nur zur Erinnerung.',
      'Ihr Kiel liegt tief. Das gefällt mir bei einem Kaufmann.',
      'Ohne Ladung auslaufen darf jeder. Klug ist es selten.',
    ],
  },
  {
    m: 'Warenmakler',
    w: 'Warenmaklerin',
    lines: [
      'Was hier auf dem Kai stapelt, bringt hier auch nichts ein.',
      'Fremde Ware zahlt sich aus, eigene drückt den Preis.',
      'Kaufen Sie, solange die Notierung schläft.',
      'Drei Häfen weiter kennt man Ihre Ware nicht. Umso besser.',
    ],
  },
  {
    m: 'Zollbeamter',
    w: 'Zollbeamtin',
    lines: [
      'Papiere. — Gut. Der Nächste.',
      'Steuern kommen wie das Wetter: unangekündigt.',
      'Ich habe nichts gesehen, Sie haben nichts geladen.',
    ],
  },
  {
    m: 'Schiffsmäkler',
    w: 'Schiffsmäklerin',
    lines: [
      'Nach Süden liegt der Wind günstig, sagt man.',
      'Wer zurückrudert, verliert den Kurs und den Ruf.',
      'Eine Passage ist schnell gebucht, eine Fracht nicht.',
    ],
  },
  {
    m: 'Kaischenk',
    w: 'Kaischenkin',
    lines: [
      'Setzen Sie sich, der Kaffee ist von drüben.',
      'Gestern lag hier einer mit vollem Laderaum. Heute nicht mehr.',
      'Man erzählt sich, die Kurse steigen. Man erzählt sich viel.',
    ],
  },
  {
    m: 'Telegraphist',
    w: 'Telegraphistin',
    lines: [
      'Eine Depesche für Sie. Vielleicht. Später.',
      'Die Leitung nach Übersee ist heute launisch.',
      'Nachrichten reisen schneller als Ihr Dampfer.',
    ],
  },
  {
    m: 'Lademeister',
    w: 'Lademeisterin',
    lines: [
      'Vorsicht, das Netz hält nur, was es muß.',
      'Jede Kiste, die an Bord geht, will auch wieder herunter.',
      'Volle Luken, leere Kasse — kennt man.',
    ],
  },
  {
    m: 'Lotse',
    w: 'Lotsin',
    lines: [
      'Untiefen voraus, halten Sie sich an die Linie.',
      'Ich bringe Sie hinaus, den Rest macht der Würfel.',
      'Bei diesem Wetter zählt jeder Punkt Fahrt.',
    ],
  },
  {
    m: 'Schauermann',
    w: 'Schauerfrau',
    lines: [
      'Zwölf Stunden am Haken, und noch immer ist der Kai voll.',
      'Was Sie hier stehen lassen, steht morgen noch da.',
      'Wir laden alles. Bezahlen müssen Sie selbst.',
    ],
  },
  {
    m: 'Kontorist',
    w: 'Kontoristin',
    lines: [
      'Die Bücher sagen mehr über Sie als Ihr Hut.',
      'Einkauf links, Verkauf rechts, dazwischen der Kummer.',
      'Ich habe Ihre Zahlen gesehen. Kein Kommentar.',
    ],
  },
  {
    m: 'Segelmacher',
    w: 'Segelmacherin',
    lines: [
      'Ein Riß im Tuch kostet mehr als eine ganze Bahn.',
      'Dampf hin oder her — ich habe hier immer zu tun.',
      'Nähen Sie beizeiten, dann fahren Sie länger.',
    ],
  },
  {
    m: 'Wirt',
    w: 'Wirtin',
    lines: [
      'Erst zahlen, dann klagen.',
      'Am Nebentisch sitzt Ihre Konkurrenz. Sprechen Sie leiser.',
      'Zwei Häfen hat jeder Mann: diesen und den nächsten.',
    ],
  },
]

/** The Makler who keeps the quay's ledger — the guide, distinct from the crowd. */
const GUIDE_ROLE: Titled = { m: 'Kontormakler', w: 'Kontormaklerin' }

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
    if (usedRoles.has(def.m)) continue
    usedRoles.add(def.m)
    const line = take(def.lines)
    const [who, next] = person(s)
    s = next
    out.push({
      name: who.name,
      role: who.gender === 'w' ? def.w : def.m,
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
    role: who.gender === 'w' ? GUIDE_ROLE.w : GUIDE_ROLE.m,
    line: '',
    gender: who.gender,
    portrait: who.portrait,
  }
}
