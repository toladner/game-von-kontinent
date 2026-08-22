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
 */

export interface PortraitTraits {
  readonly face: 0 | 1 | 2
  readonly hair: 0 | 1 | 2 | 3
  readonly beard: 0 | 1 | 2 | 3 | 4
  readonly headwear: 0 | 1 | 2 | 3
  readonly collar: 0 | 1 | 2
  readonly accessory: 0 | 1 | 2 | 3
  /** Index into the sepia ink ramp used for the engraving. */
  readonly ink: 0 | 1 | 2
}

export interface Persona {
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
  readonly portrait: PortraitTraits
}

const RANKS = [
  'Reeder',
  'Handelsherr',
  'Konsul',
  'Superkargo',
  'Kommerzienrat',
  'Kapitän zur See',
  'Großhändler',
  'Kontorherr',
] as const

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
] as const

const HOUSE_FORMS = [
  (n: string) => `${n} & Söhne`,
  (n: string) => `${n} & Co.`,
  (n: string) => `Kontor ${n}`,
  (n: string) => `Reederei ${n}`,
  (n: string) => `${n} Überseehandel`,
  (n: string) => `Handelshaus ${n}`,
  (n: string) => `${n} & Compagnie`,
] as const

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
] as const

function traits(rng: RngState): [PortraitTraits, RngState] {
  let s = rng
  const roll = (max: number) => {
    const [v, next] = nextInt(s, max)
    s = next
    return v
  }
  const t: PortraitTraits = {
    face: roll(3) as PortraitTraits['face'],
    hair: roll(4) as PortraitTraits['hair'],
    beard: roll(5) as PortraitTraits['beard'],
    headwear: roll(4) as PortraitTraits['headwear'],
    collar: roll(3) as PortraitTraits['collar'],
    accessory: roll(4) as PortraitTraits['accessory'],
    ink: roll(3) as PortraitTraits['ink'],
  }
  return [t, s]
}

/** Build a trader identity from the name the player typed. */
export function makePersona(playerName: string, salt = ''): Persona {
  let s = seedFrom(`persona:${playerName.trim().toLowerCase()}:${salt}`)
  const take = <T>(list: readonly T[]): T => {
    const [v, next] = pick(list, s)
    s = next
    return v
  }
  const head = take(HOUSE_HEADS)
  const form = take(HOUSE_FORMS)
  const rank = take(RANKS)
  const origin = take(ORIGINS)
  const motto = take(MOTTOS)
  const [portrait] = traits(s)
  return { rank, house: form(head), origin, motto, portrait }
}

// ---------------------------------------------------------------------------
// Harbour characters
// ---------------------------------------------------------------------------

const FIRST_NAMES = [
  'Aldo',
  'Berta',
  'Casimir',
  'Doris',
  'Emil',
  'Fatima',
  'Gustav',
  'Hedda',
  'Ivo',
  'Joana',
  'Knut',
  'Lorenzo',
  'Malin',
  'Nuno',
  'Olga',
  'Pieter',
  'Quirin',
  'Rosa',
  'Séverin',
  'Tomás',
  'Ulla',
  'Vittorio',
  'Wanda',
  'Yannick',
] as const

const LAST_NAMES = [
  'Baltus',
  'Cordero',
  'Dahlmann',
  'Esposito',
  'Ferreira',
  'Grimm',
  'Halvorsen',
  'Ibarra',
  'Jansen',
  'Kowalski',
  'Lindgren',
  'Moretti',
  'Nkemi',
  'Okonkwo',
  'Petrov',
  'Rasmussen',
  'Silva',
  'Tanaka',
  'Ubaldi',
  'Vermeer',
] as const

interface RoleDef {
  readonly role: string
  readonly lines: readonly string[]
}

/**
 * Lines are flavour, never rules text. They nudge without instructing, which
 * is how the game teaches itself instead of handing out a rulebook.
 */
const ROLES: readonly RoleDef[] = [
  {
    role: 'Hafenmeister',
    lines: [
      'Zwei Posten dürfen an Bord, mehr trägt das Papier nicht.',
      'Liegegeld wird fällig, wenn Sie trödeln. Nur zur Erinnerung.',
      'Ihr Kiel liegt tief. Das gefällt mir bei einem Kaufmann.',
    ],
  },
  {
    role: 'Warenmakler',
    lines: [
      'Was hier auf dem Kai stapelt, bringt hier auch nichts ein.',
      'Fremde Ware zahlt sich aus, eigene drückt den Preis.',
      'Kaufen Sie, solange die Notierung schläft.',
    ],
  },
  {
    role: 'Zollbeamter',
    lines: [
      'Papiere. — Gut. Der Nächste.',
      'Steuern kommen wie das Wetter: unangekündigt.',
      'Ich habe nichts gesehen, Sie haben nichts geladen.',
    ],
  },
  {
    role: 'Schiffsmäkler',
    lines: [
      'Nach Süden liegt der Wind günstig, sagt man.',
      'Wer zurückrudert, verliert den Kurs und den Ruf.',
      'Eine Passage ist schnell gebucht, eine Fracht nicht.',
    ],
  },
  {
    role: 'Kaischenkin',
    lines: [
      'Setzen Sie sich, der Kaffee ist von drüben.',
      'Gestern lag hier einer mit vollem Laderaum. Heute nicht mehr.',
      'Man erzählt sich, die Kurse steigen. Man erzählt sich viel.',
    ],
  },
  {
    role: 'Telegraphist',
    lines: [
      'Eine Depesche für Sie. Vielleicht. Später.',
      'Die Leitung nach Übersee ist heute launisch.',
      'Nachrichten reisen schneller als Ihr Dampfer.',
    ],
  },
  {
    role: 'Lademeister',
    lines: [
      'Vorsicht, das Netz hält nur, was es muß.',
      'Jede Kiste, die an Bord geht, will auch wieder herunter.',
      'Volle Luken, leere Kasse — kennt man.',
    ],
  },
  {
    role: 'Lotse',
    lines: [
      'Untiefen voraus, halten Sie sich an die Linie.',
      'Ich bringe Sie hinaus, den Rest macht der Würfel.',
      'Bei diesem Wetter zählt jeder Punkt Fahrt.',
    ],
  },
]

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
  while (out.length < count && guard++ < 40) {
    const def = take(ROLES)
    if (usedRoles.has(def.role)) continue
    usedRoles.add(def.role)
    const name = `${take(FIRST_NAMES)} ${take(LAST_NAMES)}`
    const line = take(def.lines)
    const [portrait, next] = traits(s)
    s = next
    out.push({ name, role: def.role, line, portrait })
  }
  return out
}
