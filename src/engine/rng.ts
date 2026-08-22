/**
 * Deterministic, serialisable RNG.
 *
 * The generator state lives inside GameState, so a game is fully described by
 * its seed plus the list of actions taken. That is what makes saves, replays,
 * bug reports and (later) networked play cheap.
 */
export interface RngState {
  readonly s: number
}

export function seedFrom(text: string): RngState {
  let h = 2166136261 >>> 0
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619) >>> 0
  }
  return { s: h >>> 0 }
}

/** mulberry32 - small, fast, good enough for dice and shuffles. */
export function nextFloat(state: RngState): [number, RngState] {
  let t = (state.s + 0x6d2b79f5) >>> 0
  const next: RngState = { s: t }
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, next]
}

/** Integer in [0, max). */
export function nextInt(state: RngState, max: number): [number, RngState] {
  const [f, s] = nextFloat(state)
  return [Math.floor(f * max), s]
}

/** Dice roll in [1, sides]. */
export function rollDie(state: RngState, sides: number): [number, RngState] {
  const [n, s] = nextInt(state, sides)
  return [n + 1, s]
}

export function shuffle<T>(items: readonly T[], state: RngState): [T[], RngState] {
  const out = [...items]
  let s = state
  for (let i = out.length - 1; i > 0; i--) {
    const [j, next] = nextInt(s, i + 1)
    s = next
    const tmp = out[i]!
    out[i] = out[j]!
    out[j] = tmp
  }
  return [out, s]
}

export function pick<T>(items: readonly T[], state: RngState): [T, RngState] {
  if (items.length === 0) throw new Error('pick from empty list')
  const [i, s] = nextInt(state, items.length)
  return [items[i]!, s]
}
