import type { Catalog } from '../t'

/**
 * The Börsenblatt — the running paper of what the table has done.
 *
 * Written in the register of a shipping column rather than a game log: ships
 * make port and set sail, houses take goods off the quay, the exchange speaks.
 * Names wrapped in `*…*` are set in the house's own colour by `Emph`.
 */
export const LOG = {
  'log.playerJoined': {
    de: '*{name}* nimmt in {port} den Handel auf.',
    en: '*{name}* opens for trade in {port}.',
  },
  'log.rolled': {
    de: '{name} würfelt {value}.',
    en: '{name} throws {value}.',
  },
  'log.arrived': {
    de: '{name} läuft {port} an.',
    en: '{name} makes port at {port}.',
  },
  'log.setSail': {
    de: '{name} setzt Segel nach {port}.',
    en: '{name} sets sail for {port}.',
  },
  'log.stoppedAtSea': {
    de: '{name} liegt auf freier See.',
    en: '{name} is lying in open water.',
  },
  'log.collision': {
    de: 'Zusammenstoß! {name} zahlt {victim} {amount} Schadenersatz und setzt eine Runde aus.',
    en: 'Collision! {name} pays {victim} {amount} in damages and misses a round.',
  },
  'log.bought': {
    de: '{name} kauft {good} für {price}.',
    en: '{name} buys {good} for {price}.',
  },
  'log.sold': {
    de: '{name} verkauft {good} für {price}{label}. {result} {amount}.',
    en: '{name} sells {good} for {price}{label}. {result} {amount}.',
  },
  'log.sold.ueberfluss': {
    de: ' (Verlustpreis, Ware wird hier selbst geführt)',
    en: ' (at a loss — the harbour ships it itself)',
  },
  'log.sold.notverkauf': {
    de: ' (Notverkauf an die Exportbank)',
    en: ' (forced sale to the Export Bank)',
  },
  'log.sold.schluss': {
    de: ' (Schlußabrechnung)',
    en: ' (final reckoning)',
  },
  'log.profit': { de: 'Gewinn', en: 'Profit' },
  'log.loss': { de: 'Verlust', en: 'Loss' },
  'log.cardDrawn': {
    de: '{name} hebt eine Konjunkturkarte ab: {title} — {lines}',
    en: '{name} turns a market card: {title} — {lines}',
  },
  'log.paid': {
    de: '{name} zahlt {amount} {reason}.',
    en: '{name} pays {amount} — {reason}.',
  },
  'log.paid.steuer': { de: 'Steuer', en: 'tax' },
  'log.paid.versicherung': { de: 'Versicherung', en: 'insurance' },
  'log.paid.hafengebuehr': { de: 'Hafengebühr', en: 'harbour dues' },
  'log.paid.entladegeld': { de: 'Entladegeld', en: 'unloading charge' },
  'log.paid.schaden': { de: 'Schadenersatz', en: 'damages' },
  'log.received': {
    de: '{name} erhält {amount}{reason}.',
    en: '{name} receives {amount}{reason}.',
  },
  'log.received.telegramm': { de: ' per Telegramm', en: ' by telegram' },
  'log.received.schaden': { de: ' als Schadenersatz', en: ' in damages' },
  'log.cargoLost': {
    de: '{name} verliert {good} ({value}) — {reason}.',
    en: '{name} loses {good} ({value}) — {reason}.',
  },
  'log.cargoDamaged': {
    de: '{good} von {name} hat gelitten — {reason}. Der Posten bleibt an Bord und bringt nur die Hälfte.',
    en: "{name}'s {good} has suffered — {reason}. The lot stays aboard and fetches half.",
  },
  'log.heldUp': {
    de: '{name} wird aufgehalten — {reason}. {cost}',
    en: '{name} is held up — {reason}. {cost}',
  },
  'log.heldUp.minutes.one': {
    de: 'Verlust: {n} Minute.',
    en: 'Lost: {n} minute.',
  },
  'log.heldUp.minutes.other': {
    de: 'Verlust: {n} Minuten.',
    en: 'Lost: {n} minutes.',
  },
  'log.heldUp.round': {
    de: 'Eine Runde wird ausgesetzt.',
    en: 'A round is missed.',
  },
  'log.portClosed': {
    de: '{title}. {port} ist bis auf weiteres für den Handel gesperrt.',
    en: '{title}. {port} is closed to trade until further notice.',
  },
  'log.portReopened': {
    de: '{port} ist wieder offen.',
    en: '{port} is open again.',
  },
  'log.weatherSet': {
    de: '{title}: Verkaufspreise {where} {sign} {percent} %.',
    en: '{title}: selling prices {where} {sign} {percent} %.',
  },
  'log.weatherSet.there': { de: 'dort', en: 'there' },
  'log.weatherSet.forThat': { de: 'dafür', en: 'for it' },
  'log.roundStarted': {
    de: 'Runde {round}.',
    en: 'Round {round}.',
  },
  'log.roundStarted.red': {
    de: 'Runde {round} — rotes Feld, die Konjunktur spricht mit.',
    en: 'Round {round} — a red square; the market has its say.',
  },
  'log.gameOver': {
    de: 'Die letzte Runde ist gefahren. Schlußabrechnung.',
    en: 'The last round is sailed. Final reckoning.',
  },
  'log.opening': {
    de: 'Die Exportbank kreditiert jedem Mitspieler {amount} Einheiten Betriebskapital.',
    en: 'The Export Bank advances every house {amount} units of working capital.',
  },
  'log.unknownGood': {
    de: 'Ware {id}',
    en: 'Good {id}',
  },
} satisfies Catalog
