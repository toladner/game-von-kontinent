/**
 * Der Regelstand: which edition of the rules a table sat down to.
 *
 * This game keeps no state. A table is its seed and its list of actions, and
 * the server finds out where every ship is by folding that list again from
 * the beginning — on every deploy, and every time a Durable Object wakes.
 * That is what makes saving, replay and networked play one problem instead of
 * three, and it has one sharp edge: change what a rule does and you have not
 * changed the game from here on, you have changed what already happened.
 *
 * It is not a hypothetical. Heavy weather was rebalanced while a seven-day
 * season was five days in, and six houses came back to books that had been
 * rewritten overnight — cargo that went over the side on the Tuesday was back
 * in the hold, and every sale that followed it had happened to a different
 * ship. The news each player had already read still said the old thing,
 * because that is client-side history; only the truth underneath had moved.
 *
 * So a table records the edition it was opened under and goes on playing it.
 * `GameMeta.regeln` is optional for the same reason `angebot` and `preise`
 * are: absent means a table from before the field existed, which is to say
 * edition 1. New tables are opened at `REGELSTAND`.
 *
 * Adding an edition means:
 *   - bump `REGELSTAND`;
 *   - give the rule a field below rather than reading the version number at
 *     the point of use, so the reducer asks what the rule *is* and not which
 *     year it came from;
 *   - state it for the older editions in `regelnFuer`;
 *   - and if a *card* changed, keep the old one — see
 *     `KONJUNKTUR_ERWEITERT_VOR_REFORM`.
 *
 * 1 — the game as first published.
 * 2 — heavy weather thinned out. Cargo is at risk at sea and safe in
 *     harbour; a gale finds some of the ships in it rather than every one;
 *     piracy went to the Strait of Malacca, where its card always said it
 *     was; water in the hold spoils rather than sinks; and the Taifunwarnung
 *     soaks and delays instead of sinking.
 */
export const REGELSTAND = 2

/** The rules an edition settles, as the reducer wants to ask them. */
export interface Regeln {
  /** Which edition this is, kept so a state can say what it is playing. */
  readonly regeln: number
  /** Whether cargo is at risk only at sea, or in harbour as well. */
  readonly weatherAtSeaOnly: boolean
  /**
   * Chance in a hundred that heavy weather finds a given ship. 100 is the
   * old certainty: every hull in the ocean, every time, which is not how
   * gales work and was most of why the extended deck felt like a tax.
   */
  readonly weatherCatchPercent: number
}

/**
 * Everything an edition decides, resolved from its number.
 *
 * Newest first, so the current rules read as the rules and the older ones as
 * the exceptions they are.
 */
export function regelnFuer(regeln: number): Regeln & { readonly reformedDeck: boolean } {
  if (regeln >= 2) {
    return {
      regeln: 2,
      weatherAtSeaOnly: true,
      // Measured, not guessed. See the season harness in the commit that
      // introduced this: four houses that never let a ship rest were losing
      // 3.9 posten a day at 100, and about one a day at this.
      weatherCatchPercent: 40,
      reformedDeck: true,
    }
  }
  return { regeln: 1, weatherAtSeaOnly: false, weatherCatchPercent: 100, reformedDeck: false }
}

/** What a content pack states, so a bare pack is at the current edition. */
export const AKTUELLE_REGELN: Regeln = {
  regeln: REGELSTAND,
  weatherAtSeaOnly: regelnFuer(REGELSTAND).weatherAtSeaOnly,
  weatherCatchPercent: regelnFuer(REGELSTAND).weatherCatchPercent,
}
