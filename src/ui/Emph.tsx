import { Fragment, type CSSProperties } from 'react'

/**
 * Bold the words that matter, marked *like this* in the engine's copy.
 *
 * The Makler talks in whole sentences, which is right for the setting but
 * hard to skim — the port, the good and the sum are what a player is actually
 * looking for. Marking them where the sentence is written keeps the emphasis
 * with the meaning rather than leaving the UI to guess at it with a regex,
 * and it is the same convention everywhere the game speaks, so a reader
 * learns very quickly that the heavy words are the actionable ones.
 */
export function Emph({
  text,
  strong = 'text-ink font-bold',
  strongStyle,
}: {
  text: string
  strong?: string
  /** Für Auszeichnungen, deren Farbe erst zur Laufzeit feststeht — die Häuser. */
  strongStyle?: CSSProperties
}) {
  return (
    <>
      {text
        .split(/(\*[^*]+\*)/g)
        .filter(Boolean)
        .map((part, i) =>
          part.length > 2 && part.startsWith('*') && part.endsWith('*') ? (
            <strong key={i} className={strong} style={strongStyle}>
              {part.slice(1, -1)}
            </strong>
          ) : (
            <Fragment key={i}>{part}</Fragment>
          ),
        )}
    </>
  )
}
