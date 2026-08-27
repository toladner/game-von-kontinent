import type { Locale } from './locale'
import { translator, type Vars } from './t'
import { ADVICE } from './strings/advice'
import { CARDS } from './strings/cards'
import { FLEET } from './strings/fleet'
import { GAME } from './strings/game'
import { HARBOUR } from './strings/harbour'
import { LOBBY } from './strings/lobby'
import { LOG } from './strings/log'
import { NOTIFY } from './strings/notify'
import { PIGEON } from './strings/pigeon'
import { TIME } from './strings/time'
import { REJECT } from './strings/reject'
import { SETUP } from './strings/setup'
import { UI } from './strings/ui'

export * from './locale'
export type { Phrase, Var, Vars } from './t'

/**
 * Every phrase in the game, in both languages, in one object.
 *
 * Merged flat rather than nested so a key is a single string the type checker
 * can check in full — `t(locale, 'reject.noLine')` either exists or does not
 * compile. The split into files is for the people editing them, not for the
 * lookup.
 */
export const STRINGS = {
  ...REJECT,
  ...LOG,
  ...NOTIFY,
  ...PIGEON,
  ...TIME,
  ...ADVICE,
  ...CARDS,
  ...FLEET,
  ...GAME,
  ...HARBOUR,
  ...LOBBY,
  ...SETUP,
  ...UI,
}

export type MsgKey = keyof typeof STRINGS

/**
 * The stem of a one/other pair — `advice.nachladen`, not `.one`.
 *
 * Exported so a wrapper around `tn` can be typed as tightly as `tn` itself:
 * without it the hook would have to accept any key at all, and a plural call
 * on a singular phrase would compile and render the key.
 */
export type MsgStem = {
  [K in MsgKey]: K extends `${infer B}.one` ? B : never
}[MsgKey]

export const { t, tn } = translator(STRINGS)

/**
 * A phrase plus the holes filled in, kept unrendered until somebody knows
 * which language to render it in.
 *
 * This is what the reducer emits instead of a sentence. At a table spread
 * across several devices the game is reduced on one machine and read on
 * another, and the two need not be set to the same language — so a refusal
 * travels as a key and becomes words only at the edge, in the language of
 * whoever is looking at it.
 */
export interface Message {
  readonly key: MsgKey
  readonly vars?: Vars
}

export function msg(key: MsgKey, vars?: Vars): Message {
  return vars ? { key, vars } : { key }
}

export function render(locale: Locale, message: Message): string {
  return t(locale, message.key, message.vars)
}
