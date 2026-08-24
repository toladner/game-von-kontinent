import type { Continent, GoodCategory, KonjunkturCard } from '../engine/types'
import { KONJUNKTUR_DECK } from './konjunktur'

/**
 * The erweiterte Konjunktur.
 *
 * The printed 27 cards are excellent and slightly monotonous: nearly all of
 * them move every price on the board by a percentage, which on a plan with
 * five oceans means nothing about *where* you are ever matters. These cards
 * pick out a part of the world instead. A storm in the Indian Ocean is news
 * if you are in it and gossip if you are not, and that difference is the
 * whole reason to have a big map.
 *
 * Written in the register of the originals — a Börsenblatt notice, not a
 * fantasy event — and kept to effects the engine can state plainly afterwards
 * so no player is left wondering what just happened to their cash.
 *
 * The printed deck is included whole: this is the classic game with more
 * weather, not a different game.
 */

let n = 0
const card = (
  title: string,
  lines: readonly string[],
  effects: KonjunkturCard['effects'],
): KonjunkturCard => ({ id: `kx${++n}`, title, lines, effects })

/** A price swing over one continent, in force for a while. */
const wind = (
  continent: Continent,
  region: string,
  percent: number,
  rounds: number,
): KonjunkturCard =>
  card(
    percent > 0 ? 'Hausse' : 'Baisse',
    [
      `${region}`,
      `Verkaufspreise ${percent > 0 ? '+' : '−'} ${Math.abs(percent)} %`,
      `für ${rounds} Runden`,
    ],
    [
      {
        kind: 'regionalPriceDelta',
        continent,
        percent,
        rounds,
        title: `${percent > 0 ? 'Hausse' : 'Baisse'} in ${region}`,
      },
    ],
  )

/**
 * Heavy weather comes in three severities, and they are worth having all
 * three of. A gale that takes cargo is the loudest and the least interesting:
 * a number goes down and there is nothing left to decide. A gale that spoils
 * cargo leaves the posten in the hold at half its worth, so it becomes a
 * question of which harbour will still take it and whether it is worth the
 * freight. A gale that merely holds a ship up costs nothing at all except the
 * one thing a real-time season is actually made of.
 */

/**
 * A report on one ware, or on a whole column of the register.
 *
 * The other cards all ask where a merchant is. This one asks what is in the
 * hold, which is a different question and the first reason in the game to
 * have read the Warenverzeichnis: a firm coffee market is worth nothing to a
 * house carrying tin, and everything to the one that filled up in Santos.
 */
const ware = (goodId: number, name: string, story: string, percent: number, rounds: number) =>
  card(
    percent > 0 ? 'Warenbericht' : 'Warenbericht',
    [story, `${name} ${percent > 0 ? '+' : '−'} ${Math.abs(percent)} %`, `für ${rounds} Runden`],
    [
      {
        kind: 'goodPriceDelta',
        scope: { good: goodId },
        percent,
        rounds,
        title: `${name} ${percent > 0 ? 'fester' : 'schwächer'}`,
      },
    ],
  )

/** The same, for a whole column of the Warenverzeichnis. */
const gruppe = (
  category: GoodCategory,
  name: string,
  story: string,
  percent: number,
  rounds: number,
) =>
  card(
    'Warenbericht',
    [story, `${name} ${percent > 0 ? '+' : '−'} ${Math.abs(percent)} %`, `für ${rounds} Runden`],
    [
      {
        kind: 'goodPriceDelta',
        scope: { gruppe: category },
        percent,
        rounds,
        title: `${name} ${percent > 0 ? 'fester' : 'schwächer'}`,
      },
    ],
  )

/** Heavy weather: everyone caught in that part of the world loses cargo. */
const storm = (continent: Continent, region: string, what: string, lose = 1): KonjunkturCard =>
  card(
    'Sturmwarnung',
    [what, `${region}`, lose === 1 ? 'Ein Posten geht über Bord' : `${lose} Posten über Bord`],
    [{ kind: 'stormInRegion', continent, lose, title: `${what} — ${region}` }],
  )

/** The same weather, gentler: the cargo stays aboard and is worth half. */
const damage = (continent: Continent, region: string, what: string, count = 1): KonjunkturCard =>
  card(
    'Havarie',
    [
      what,
      `${region}`,
      count === 1 ? 'Ein Posten hat gelitten' : `${count} Posten haben gelitten`,
      'Erlös nur zur Hälfte',
    ],
    [{ kind: 'cargoDamagedInRegion', continent, count, title: `${what} — ${region}` }],
  )

/**
 * One harbour shut.
 *
 * The only card that changes the shape of the plan rather than the numbers on
 * it — a route that was obvious is suddenly not, and a ship already bound
 * there has a decision to make. Which harbour is drawn when the card turns,
 * so one card serves every map and the news has a name to print.
 */
const sperre = (continent: Continent, region: string, what: string, rounds: number) =>
  card(
    'Hafensperre',
    [what, `in einem Hafen ${region}`, 'Kein Handel', `für ${rounds} Runden`],
    [{ kind: 'portClosed', continent, rounds, title: what }],
  )

/** Weather that costs time and nothing else. */
const delay = (
  continent: Continent,
  region: string,
  what: string,
  minutes: number,
): KonjunkturCard =>
  card(
    'Aufenthalt',
    [what, `${region}`, 'Alle Schiffe dort', 'werden aufgehalten'],
    [{ kind: 'delayInRegion', continent, minutes, title: `${what} — ${region}` }],
  )

export const KONJUNKTUR_ERWEITERT: readonly KonjunkturCard[] = [
  // The printed deck, entire.
  ...KONJUNKTUR_DECK,

  // --- Regionale Konjunktur ------------------------------------------------
  wind('europa', 'Europa', 25, 4),
  wind('europa', 'Europa', -20, 3),
  wind('nordamerika', 'Nordamerika', 20, 4),
  wind('nordamerika', 'Nordamerika', -15, 3),
  wind('suedamerika', 'Südamerika', 30, 3),
  wind('suedamerika', 'Südamerika', -20, 4),
  wind('afrika', 'Afrika', 25, 4),
  wind('afrika', 'Afrika', -15, 3),
  wind('asien', 'Ostasien', 30, 4),
  wind('asien', 'Ostasien', -25, 3),
  wind('ozeanien', 'Australien', 25, 5),

  // --- Wetter und Seeunfälle -----------------------------------------------
  storm('europa', 'Nordsee und Ärmelkanal', 'Schwerer Nordweststurm'),
  storm('afrika', 'Vor Kap Hoorn und dem Kap', 'Orkan'),
  storm('asien', 'Südchinesisches Meer', 'Taifun'),
  storm('asien', 'Golf von Bengalen', 'Zyklon'),
  storm('ozeanien', 'Große Australische Bucht', 'Schwere See'),
  storm('nordamerika', 'Karibik', 'Hurrikan'),
  storm('suedamerika', 'Vor der Küste Patagoniens', 'Weststurm'),

  // --- Der Warenbericht: was im Laderaum liegt, nicht wo es liegt ----------
  ware(29, 'Kaffee', 'Ernteausfall in Brasilien', 40, 4),
  ware(29, 'Kaffee', 'Rekordernte in Brasilien', -25, 3),
  ware(31, 'Kautschuk', 'Plantagenstreik in Malaya', 35, 4),
  ware(61, 'Tee', 'Zollabkommen mit Ceylon', 30, 3),
  ware(71, 'Wolle', 'Schafschur in Australien beendet', -20, 3),
  ware(72, 'Zucker', 'Rübenernte unter den Erwartungen', 30, 3),
  ware(34, 'Kohle', 'Grubenunglück im Ruhrgebiet', 35, 4),
  ware(60, 'Tabak', 'Mißernte in Virginia', 30, 3),
  ware(55, 'Salpeter', 'Chile drosselt die Ausfuhr', 35, 3),
  ware(53, 'Reis', 'Überschwemmung im Delta', 30, 3),
  gruppe('genuss', 'Kolonialwaren', 'Lebhafte Nachfrage in Übersee', 25, 4),
  gruppe('genuss', 'Kolonialwaren', 'Die Lager sind voll', -20, 3),
  gruppe('bergbau', 'Bergbauerzeugnisse', 'Die Hütten fahren hoch', 25, 4),
  gruppe('textil', 'Textilien', 'Die Webereien stehen still', -20, 3),
  gruppe('edel', 'Edelwaren', 'Unruhe an den Börsen', 35, 3),
  gruppe('energie', 'Brennstoffe', 'Ein strenger Winter kündigt sich an', 30, 4),

  // --- Havarien: die Ladung überlebt, der Erlös nicht ----------------------
  damage('europa', 'In der Biskaya', 'Überkommende See'),
  damage('nordamerika', 'Auf der Neufundlandbank', 'Schwere Sturzsee', 2),
  damage('asien', 'Im Monsun vor Malabar', 'Wochenlanger Regen'),
  damage('afrika', 'In der Kalmenzone', 'Hitze und Feuchte', 2),
  damage('suedamerika', 'Vor der Mündung des La Plata', 'Pampero'),
  damage('ozeanien', 'In der Bass-Straße', 'Überkommende See'),

  // --- Aufenthalt: es kostet nur Zeit, und Zeit ist alles -------------------
  delay('nordamerika', 'Auf der Neufundlandbank', 'Anhaltender Nebel', 30),
  delay('suedamerika', 'In der Magellanstraße', 'Weststurm mit Schnee', 45),
  delay('afrika', 'Vor dem Kap der Guten Hoffnung', 'Steife Gegenbrise', 30),
  delay('asien', 'Im Südchinesischen Meer', 'Taifun vor dem Bug', 45),
  delay('europa', 'In der Deutschen Bucht', 'Zähe Nebelbank', 20),
  delay('ozeanien', 'In der Torresstraße', 'Lotsenmangel', 20),
  card(
    'Kanalsperre',
    ['Der Kanal ist auf Tage', 'nicht zu passieren', 'Umweg um das Kap'],
    [
      {
        kind: 'delayInRegion',
        continent: 'afrika',
        minutes: 45,
        title: 'Kanalsperre — Umweg um das Kap',
      },
      {
        kind: 'delayInRegion',
        continent: 'asien',
        minutes: 45,
        title: 'Kanalsperre — Umweg um das Kap',
      },
    ],
  ),
  card(
    'Taifunwarnung',
    ['Südchinesisches Meer', 'Ein Posten geht über Bord', 'und die Fahrt verzögert sich'],
    [
      { kind: 'stormInRegion', continent: 'asien', lose: 1, title: 'Taifun — Südchinesisches Meer' },
      {
        kind: 'delayInRegion',
        continent: 'asien',
        minutes: 30,
        title: 'Taifun — Südchinesisches Meer',
      },
    ],
  ),

  // --- Hafensperren: der Plan selbst ändert sich ---------------------------
  sperre('suedamerika', 'Südamerikas', 'Gelbfieber', 3),
  sperre('europa', 'Europas', 'Hafenarbeiterstreik', 2),
  sperre('asien', 'Ostasiens', 'Quarantäne', 3),
  sperre('afrika', 'Afrikas', 'Die Fahrrinne ist versandet', 2),
  sperre('nordamerika', 'Nordamerikas', 'Eisgang', 2),
  sperre('ozeanien', 'Australiens', 'Ausfuhrsperre', 3),

  // --- Unglück an Bord ------------------------------------------------------
  card(
    'Seeräuberei',
    ['In der Straße von Malakka', 'Ein Posten Ihrer Ladung', 'ist verschwunden'],
    [{ kind: 'cargoLostByDrawer', lose: 1, title: 'Seeräuberei in der Straße von Malakka' }],
  ),
  card(
    'Feuer im Laderaum',
    ['Gelöscht, doch nicht rechtzeitig', 'Ein Posten ist verloren'],
    [{ kind: 'cargoLostByDrawer', lose: 1, title: 'Feuer im Laderaum' }],
  ),
  card(
    'Wassereinbruch',
    ['Die Ladung hat gelitten', 'Zwei Posten sind unverkäuflich'],
    [{ kind: 'cargoLostByDrawer', lose: 2, title: 'Wassereinbruch' }],
  ),

  // --- Örtliche Zahlungen ---------------------------------------------------
  card(
    'Hafenprämie',
    ['Für alle Schiffe', 'in europäischen Häfen', '8.000,—'],
    [
      {
        kind: 'regionalLevy',
        continent: 'europa',
        amount: 8_000,
        sign: 1,
        title: 'Hafenprämie in Europa',
      },
    ],
  ),
  card(
    'Liegegebühr',
    ['Für alle Schiffe', 'in asiatischen Häfen', '6.000,—'],
    [
      {
        kind: 'regionalLevy',
        continent: 'asien',
        amount: 6_000,
        sign: -1,
        title: 'Liegegebühr in Asien',
      },
    ],
  ),
  card(
    'Ausfuhrprämie',
    ['Für alle Schiffe', 'in südamerikanischen Häfen', '10.000,—'],
    [
      {
        kind: 'regionalLevy',
        continent: 'suedamerika',
        amount: 10_000,
        sign: 1,
        title: 'Ausfuhrprämie in Südamerika',
      },
    ],
  ),
  card(
    'Kanalgebühr',
    ['Für alle Schiffe', 'in afrikanischen Häfen', '5.000,—'],
    [
      {
        kind: 'regionalLevy',
        continent: 'afrika',
        amount: 5_000,
        sign: -1,
        title: 'Kanalgebühr in Afrika',
      },
    ],
  ),

  // --- Zwei Wetterlagen auf einmal -----------------------------------------
  card(
    'Handelsverlagerung',
    ['Hausse in Ostasien', 'Baisse in Europa', 'für 3 Runden'],
    [
      {
        kind: 'regionalPriceDelta',
        continent: 'asien',
        percent: 25,
        rounds: 3,
        title: 'Hausse in Ostasien',
      },
      {
        kind: 'regionalPriceDelta',
        continent: 'europa',
        percent: -15,
        rounds: 3,
        title: 'Baisse in Europa',
      },
    ],
  ),
]
