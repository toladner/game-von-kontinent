import type { Continent, GoodCategory, KonjunkturCard } from '../engine/types'
import type { Localized } from '../i18n/locale'
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
 *
 * Both languages are written here side by side rather than looked up, because
 * a card is three or four words long and the English has to sound like a
 * shipping notice of the same decade — "Seas breaking aboard", not "Waves hit
 * the ship". Sea areas keep the name the trade used: the Grand Banks, the
 * Bight, the Plate.
 */

type L = Localized<string>

const L = (de: string, en: string): L => ({ de, en })

let n = 0
const card = (title: L, lines: Localized<readonly string[]>, effects: KonjunkturCard['effects']): KonjunkturCard => ({
  id: `kx${++n}`,
  title,
  lines,
  effects,
})

const HAUSSE = L('Hausse', 'Boom')
const BAISSE = L('Baisse', 'Slump')
const WARENBERICHT = L('Warenbericht', 'Market report')

const rounds = (count: number): L => L(`für ${count} Runden`, `for ${count} rounds`)
const swing = (percent: number): L =>
  L(
    `Verkaufspreise ${percent > 0 ? '+' : '−'} ${Math.abs(percent)} %`,
    `Selling prices ${percent > 0 ? '+' : '−'} ${Math.abs(percent)} %`,
  )

/** A price swing over one continent, in force for a while. */
const wind = (continent: Continent, region: L, percent: number, forRounds: number): KonjunkturCard =>
  card(
    percent > 0 ? HAUSSE : BAISSE,
    {
      de: [region.de, swing(percent).de, rounds(forRounds).de],
      en: [region.en, swing(percent).en, rounds(forRounds).en],
    },
    [
      {
        kind: 'regionalPriceDelta',
        continent,
        percent,
        rounds: forRounds,
        title: L(
          `${percent > 0 ? 'Hausse' : 'Baisse'} in ${region.de}`,
          `${percent > 0 ? 'Boom' : 'Slump'} in ${region.en}`,
        ),
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
const tone = (name: L, percent: number): L =>
  L(
    `${name.de} ${percent > 0 ? 'fester' : 'schwächer'}`,
    `${name.en} ${percent > 0 ? 'firmer' : 'weaker'}`,
  )

const goodSwing = (name: L, percent: number): L =>
  L(
    `${name.de} ${percent > 0 ? '+' : '−'} ${Math.abs(percent)} %`,
    `${name.en} ${percent > 0 ? '+' : '−'} ${Math.abs(percent)} %`,
  )

const ware = (goodId: number, name: L, story: L, percent: number, forRounds: number) =>
  card(
    WARENBERICHT,
    {
      de: [story.de, goodSwing(name, percent).de, rounds(forRounds).de],
      en: [story.en, goodSwing(name, percent).en, rounds(forRounds).en],
    },
    [
      {
        kind: 'goodPriceDelta',
        scope: { good: goodId },
        percent,
        rounds: forRounds,
        title: tone(name, percent),
      },
    ],
  )

/** The same, for a whole column of the Warenverzeichnis. */
const gruppe = (category: GoodCategory, name: L, story: L, percent: number, forRounds: number) =>
  card(
    WARENBERICHT,
    {
      de: [story.de, goodSwing(name, percent).de, rounds(forRounds).de],
      en: [story.en, goodSwing(name, percent).en, rounds(forRounds).en],
    },
    [
      {
        kind: 'goodPriceDelta',
        scope: { gruppe: category },
        percent,
        rounds: forRounds,
        title: tone(name, percent),
      },
    ],
  )

/** Heavy weather: everyone caught in that part of the world loses cargo. */
const storm = (continent: Continent, region: L, what: L, lose = 1): KonjunkturCard =>
  card(
    L('Sturmwarnung', 'Storm warning'),
    {
      de: [what.de, region.de, lose === 1 ? 'Ein Posten geht über Bord' : `${lose} Posten über Bord`],
      en: [
        what.en,
        region.en,
        lose === 1 ? 'One lot goes over the side' : `${lose} lots over the side`,
      ],
    },
    [
      {
        kind: 'stormInRegion',
        continent,
        lose,
        title: L(`${what.de} — ${region.de}`, `${what.en} — ${region.en}`),
      },
    ],
  )

/** The same weather, gentler: the cargo stays aboard and is worth half. */
const damage = (continent: Continent, region: L, what: L, count = 1): KonjunkturCard =>
  card(
    L('Havarie', 'Damage at sea'),
    {
      de: [
        what.de,
        region.de,
        count === 1 ? 'Ein Posten hat gelitten' : `${count} Posten haben gelitten`,
        'Erlös nur zur Hälfte',
      ],
      en: [
        what.en,
        region.en,
        count === 1 ? 'One lot has suffered' : `${count} lots have suffered`,
        'Proceeds halved',
      ],
    },
    [
      {
        kind: 'cargoDamagedInRegion',
        continent,
        count,
        title: L(`${what.de} — ${region.de}`, `${what.en} — ${region.en}`),
      },
    ],
  )

/**
 * One harbour shut.
 *
 * The only card that changes the shape of the plan rather than the numbers on
 * it — a route that was obvious is suddenly not, and a ship already bound
 * there has a decision to make. Which harbour is drawn when the card turns,
 * so one card serves every map and the news has a name to print.
 *
 * `region` arrives in the genitive for the German — "in einem Hafen
 * Südamerikas" — which English cannot copy, so the two lines are built apart.
 */
const sperre = (continent: Continent, region: L, what: L, forRounds: number) =>
  card(
    L('Hafensperre', 'Harbour closed'),
    {
      de: [what.de, `in einem Hafen ${region.de}`, 'Kein Handel', rounds(forRounds).de],
      en: [what.en, `in a harbour of ${region.en}`, 'No trade', rounds(forRounds).en],
    },
    [{ kind: 'portClosed', continent, rounds: forRounds, title: what }],
  )

/** Weather that costs time and nothing else. */
const delay = (continent: Continent, region: L, what: L, minutes: number): KonjunkturCard =>
  card(
    L('Aufenthalt', 'Delay'),
    {
      de: [what.de, region.de, 'Alle Schiffe dort', 'werden aufgehalten'],
      en: [what.en, region.en, 'Every ship there', 'is held up'],
    },
    [
      {
        kind: 'delayInRegion',
        continent,
        minutes,
        title: L(`${what.de} — ${region.de}`, `${what.en} — ${region.en}`),
      },
    ],
  )

// --- Places, weather and news, named once and used below --------------------

const EUROPA = L('Europa', 'Europe')
const NORDAMERIKA = L('Nordamerika', 'North America')
const SUEDAMERIKA = L('Südamerika', 'South America')
const AFRIKA = L('Afrika', 'Africa')
const OSTASIEN = L('Ostasien', 'East Asia')
const AUSTRALIEN = L('Australien', 'Australia')

export const KONJUNKTUR_ERWEITERT: readonly KonjunkturCard[] = [
  // The printed deck, entire.
  ...KONJUNKTUR_DECK,

  // --- Regionale Konjunktur ------------------------------------------------
  wind('europa', EUROPA, 25, 4),
  wind('europa', EUROPA, -20, 3),
  wind('nordamerika', NORDAMERIKA, 20, 4),
  wind('nordamerika', NORDAMERIKA, -15, 3),
  wind('suedamerika', SUEDAMERIKA, 30, 3),
  wind('suedamerika', SUEDAMERIKA, -20, 4),
  wind('afrika', AFRIKA, 25, 4),
  wind('afrika', AFRIKA, -15, 3),
  wind('asien', OSTASIEN, 30, 4),
  wind('asien', OSTASIEN, -25, 3),
  wind('ozeanien', AUSTRALIEN, 25, 5),

  // --- Wetter und Seeunfälle -----------------------------------------------
  storm(
    'europa',
    L('Nordsee und Ärmelkanal', 'North Sea and English Channel'),
    L('Schwerer Nordweststurm', 'Heavy north-westerly gale'),
  ),
  storm(
    'afrika',
    L('Vor Kap Hoorn und dem Kap', 'Off Cape Horn and the Cape'),
    L('Orkan', 'Hurricane-force gale'),
  ),
  storm('asien', L('Südchinesisches Meer', 'South China Sea'), L('Taifun', 'Typhoon')),
  storm('asien', L('Golf von Bengalen', 'Bay of Bengal'), L('Zyklon', 'Cyclone')),
  storm(
    'ozeanien',
    L('Große Australische Bucht', 'Great Australian Bight'),
    L('Schwere See', 'Heavy seas'),
  ),
  storm('nordamerika', L('Karibik', 'The Caribbean'), L('Hurrikan', 'Hurricane')),
  storm(
    'suedamerika',
    L('Vor der Küste Patagoniens', 'Off the coast of Patagonia'),
    L('Weststurm', 'Westerly gale'),
  ),

  // --- Der Warenbericht: was im Laderaum liegt, nicht wo es liegt ----------
  ware(29, L('Kaffee', 'Coffee'), L('Ernteausfall in Brasilien', 'Harvest failure in Brazil'), 40, 4),
  ware(29, L('Kaffee', 'Coffee'), L('Rekordernte in Brasilien', 'Record harvest in Brazil'), -25, 3),
  ware(
    31,
    L('Kautschuk', 'Crude rubber'),
    L('Plantagenstreik in Malaya', 'Plantation strike in Malaya'),
    35,
    4,
  ),
  ware(61, L('Tee', 'Tea'), L('Zollabkommen mit Ceylon', 'Tariff agreement with Ceylon'), 30, 3),
  ware(
    71,
    L('Wolle', 'Wool'),
    L('Schafschur in Australien beendet', 'Australian shearing over'),
    -20,
    3,
  ),
  ware(
    72,
    L('Zucker', 'Sugar'),
    L('Rübenernte unter den Erwartungen', 'Beet harvest below expectations'),
    30,
    3,
  ),
  ware(34, L('Kohle', 'Coal'), L('Grubenunglück im Ruhrgebiet', 'Pit disaster in the Ruhr'), 35, 4),
  ware(60, L('Tabak', 'Tobacco'), L('Mißernte in Virginia', 'Crop failure in Virginia'), 30, 3),
  ware(
    55,
    L('Salpeter', 'Saltpetre'),
    L('Chile drosselt die Ausfuhr', 'Chile throttles exports'),
    35,
    3,
  ),
  ware(53, L('Reis', 'Rice'), L('Überschwemmung im Delta', 'Flooding in the delta'), 30, 3),
  gruppe(
    'genuss',
    L('Kolonialwaren', 'Colonial produce'),
    L('Lebhafte Nachfrage in Übersee', 'Brisk demand overseas'),
    25,
    4,
  ),
  gruppe(
    'genuss',
    L('Kolonialwaren', 'Colonial produce'),
    L('Die Lager sind voll', 'The warehouses are full'),
    -20,
    3,
  ),
  gruppe(
    'bergbau',
    L('Bergbauerzeugnisse', 'Mining products'),
    L('Die Hütten fahren hoch', 'The smelters are firing up'),
    25,
    4,
  ),
  gruppe(
    'textil',
    L('Textilien', 'Textiles'),
    L('Die Webereien stehen still', 'The mills stand idle'),
    -20,
    3,
  ),
  gruppe(
    'edel',
    L('Edelwaren', 'Precious goods'),
    L('Unruhe an den Börsen', 'Unrest on the exchanges'),
    35,
    3,
  ),
  gruppe(
    'energie',
    L('Brennstoffe', 'Fuels'),
    L('Ein strenger Winter kündigt sich an', 'A hard winter is coming'),
    30,
    4,
  ),

  // --- Havarien: die Ladung überlebt, der Erlös nicht ----------------------
  damage(
    'europa',
    L('In der Biskaya', 'In the Bay of Biscay'),
    L('Überkommende See', 'Seas breaking aboard'),
  ),
  damage(
    'nordamerika',
    L('Auf der Neufundlandbank', 'On the Grand Banks'),
    L('Schwere Sturzsee', 'Heavy breaking seas'),
    2,
  ),
  damage(
    'asien',
    L('Im Monsun vor Malabar', 'In the monsoon off Malabar'),
    L('Wochenlanger Regen', 'Weeks of rain'),
  ),
  damage(
    'afrika',
    L('In der Kalmenzone', 'In the doldrums'),
    L('Hitze und Feuchte', 'Heat and damp'),
    2,
  ),
  damage(
    'suedamerika',
    L('Vor der Mündung des La Plata', 'Off the mouth of the Plate'),
    L('Pampero', 'Pampero'),
  ),
  damage(
    'ozeanien',
    L('In der Bass-Straße', 'In the Bass Strait'),
    L('Überkommende See', 'Seas breaking aboard'),
  ),

  // --- Aufenthalt: es kostet nur Zeit, und Zeit ist alles -------------------
  delay(
    'nordamerika',
    L('Auf der Neufundlandbank', 'On the Grand Banks'),
    L('Anhaltender Nebel', 'Persistent fog'),
    30,
  ),
  delay(
    'suedamerika',
    L('In der Magellanstraße', 'In the Strait of Magellan'),
    L('Weststurm mit Schnee', 'Westerly gale with snow'),
    45,
  ),
  delay(
    'afrika',
    L('Vor dem Kap der Guten Hoffnung', 'Off the Cape of Good Hope'),
    L('Steife Gegenbrise', 'Stiff head wind'),
    30,
  ),
  delay(
    'asien',
    L('Im Südchinesischen Meer', 'In the South China Sea'),
    L('Taifun vor dem Bug', 'Typhoon ahead'),
    45,
  ),
  delay(
    'europa',
    L('In der Deutschen Bucht', 'In the German Bight'),
    L('Zähe Nebelbank', 'A stubborn fog bank'),
    20,
  ),
  delay(
    'ozeanien',
    L('In der Torresstraße', 'In the Torres Strait'),
    L('Lotsenmangel', 'No pilots to be had'),
    20,
  ),
  card(
    L('Kanalsperre', 'Canal closed'),
    {
      de: ['Der Kanal ist auf Tage', 'nicht zu passieren', 'Umweg um das Kap'],
      en: ['The canal is impassable', 'for days to come', 'Round the Cape instead'],
    },
    [
      {
        kind: 'delayInRegion',
        continent: 'afrika',
        minutes: 45,
        title: L('Kanalsperre — Umweg um das Kap', 'Canal closed — round the Cape'),
      },
      {
        kind: 'delayInRegion',
        continent: 'asien',
        minutes: 45,
        title: L('Kanalsperre — Umweg um das Kap', 'Canal closed — round the Cape'),
      },
    ],
  ),
  card(
    L('Taifunwarnung', 'Typhoon warning'),
    {
      de: ['Südchinesisches Meer', 'Ein Posten geht über Bord', 'und die Fahrt verzögert sich'],
      en: ['South China Sea', 'One lot goes over the side', 'and the voyage is delayed'],
    },
    [
      {
        kind: 'stormInRegion',
        continent: 'asien',
        lose: 1,
        title: L('Taifun — Südchinesisches Meer', 'Typhoon — South China Sea'),
      },
      {
        kind: 'delayInRegion',
        continent: 'asien',
        minutes: 30,
        title: L('Taifun — Südchinesisches Meer', 'Typhoon — South China Sea'),
      },
    ],
  ),

  // --- Hafensperren: der Plan selbst ändert sich ---------------------------
  sperre('suedamerika', L('Südamerikas', 'South America'), L('Gelbfieber', 'Yellow fever'), 3),
  sperre('europa', L('Europas', 'Europe'), L('Hafenarbeiterstreik', 'Dock strike'), 2),
  sperre('asien', L('Ostasiens', 'East Asia'), L('Quarantäne', 'Quarantine'), 3),
  sperre(
    'afrika',
    L('Afrikas', 'Africa'),
    L('Die Fahrrinne ist versandet', 'The channel has silted up'),
    2,
  ),
  sperre('nordamerika', L('Nordamerikas', 'North America'), L('Eisgang', 'Drifting ice'), 2),
  sperre('ozeanien', L('Australiens', 'Australia'), L('Ausfuhrsperre', 'Export embargo'), 3),

  // --- Unglück an Bord ------------------------------------------------------
  card(
    L('Seeräuberei', 'Piracy'),
    {
      de: ['In der Straße von Malakka', 'Ein Posten Ihrer Ladung', 'ist verschwunden'],
      en: ['In the Strait of Malacca', 'One lot of your cargo', 'has vanished'],
    },
    [
      {
        kind: 'cargoLostByDrawer',
        lose: 1,
        title: L('Seeräuberei in der Straße von Malakka', 'Piracy in the Strait of Malacca'),
      },
    ],
  ),
  card(
    L('Feuer im Laderaum', 'Fire in the hold'),
    {
      de: ['Gelöscht, doch nicht rechtzeitig', 'Ein Posten ist verloren'],
      en: ['Put out, but not in time', 'One lot is lost'],
    },
    [{ kind: 'cargoLostByDrawer', lose: 1, title: L('Feuer im Laderaum', 'Fire in the hold') }],
  ),
  card(
    L('Wassereinbruch', 'Water in the hold'),
    {
      de: ['Die Ladung hat gelitten', 'Zwei Posten sind unverkäuflich'],
      en: ['The cargo has suffered', 'Two lots are unsaleable'],
    },
    [{ kind: 'cargoLostByDrawer', lose: 2, title: L('Wassereinbruch', 'Water in the hold') }],
  ),

  // --- Örtliche Zahlungen ---------------------------------------------------
  card(
    L('Hafenprämie', 'Harbour bounty'),
    {
      de: ['Für alle Schiffe', 'in europäischen Häfen', '8.000,—'],
      en: ['For all ships', 'in European harbours', '8,000.—'],
    },
    [
      {
        kind: 'regionalLevy',
        continent: 'europa',
        amount: 8_000,
        sign: 1,
        title: L('Hafenprämie in Europa', 'Harbour bounty in Europe'),
      },
    ],
  ),
  card(
    L('Liegegebühr', 'Berthing charge'),
    {
      de: ['Für alle Schiffe', 'in asiatischen Häfen', '6.000,—'],
      en: ['For all ships', 'in Asian harbours', '6,000.—'],
    },
    [
      {
        kind: 'regionalLevy',
        continent: 'asien',
        amount: 6_000,
        sign: -1,
        title: L('Liegegebühr in Asien', 'Berthing charge in Asia'),
      },
    ],
  ),
  card(
    L('Ausfuhrprämie', 'Export bounty'),
    {
      de: ['Für alle Schiffe', 'in südamerikanischen Häfen', '10.000,—'],
      en: ['For all ships', 'in South American harbours', '10,000.—'],
    },
    [
      {
        kind: 'regionalLevy',
        continent: 'suedamerika',
        amount: 10_000,
        sign: 1,
        title: L('Ausfuhrprämie in Südamerika', 'Export bounty in South America'),
      },
    ],
  ),
  card(
    L('Kanalgebühr', 'Canal dues'),
    {
      de: ['Für alle Schiffe', 'in afrikanischen Häfen', '5.000,—'],
      en: ['For all ships', 'in African harbours', '5,000.—'],
    },
    [
      {
        kind: 'regionalLevy',
        continent: 'afrika',
        amount: 5_000,
        sign: -1,
        title: L('Kanalgebühr in Afrika', 'Canal dues in Africa'),
      },
    ],
  ),

  // --- Zwei Wetterlagen auf einmal -----------------------------------------
  card(
    L('Handelsverlagerung', 'Trade shifts'),
    {
      de: ['Hausse in Ostasien', 'Baisse in Europa', 'für 3 Runden'],
      en: ['Boom in East Asia', 'Slump in Europe', 'for 3 rounds'],
    },
    [
      {
        kind: 'regionalPriceDelta',
        continent: 'asien',
        percent: 25,
        rounds: 3,
        title: L('Hausse in Ostasien', 'Boom in East Asia'),
      },
      {
        kind: 'regionalPriceDelta',
        continent: 'europa',
        percent: -15,
        rounds: 3,
        title: L('Baisse in Europa', 'Slump in Europe'),
      },
    ],
  ),
]
