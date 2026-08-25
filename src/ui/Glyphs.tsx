/**
 * The small marks on the instrument strip, engraved rather than typed.
 *
 * Everything else in this game that stands for a thing is drawn: the goods
 * wear engraved cameos, the traders wear portraits cut the same way, the
 * harbours are dots on a chart. The strip was the one place still using
 * emoji, and emoji are not a house style — they are whichever house style the
 * telephone happens to ship, so 📰 came out a glossy tabloid on one device, a
 * flat outline on the next, and the strip looked assembled from two boxes.
 *
 * Same line work as the Warenkarten vignettes, without their oval frame: at
 * eighteen pixels a cameo is a smudge, and these are buttons on a paper strip
 * rather than pictures on card stock. The ink is `currentColor`, so a glyph
 * reddens with the cell it sits in when the season is closing.
 */

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const

/** Thinner, for the rules of type and other detail that must not shout. */
const hair = { ...stroke, strokeWidth: 1.1 } as const

function Glyph({ size = 18, children }: { size?: number; children: React.ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="shrink-0" aria-hidden>
      {children}
    </svg>
  )
}

/**
 * A folded broadsheet: the Börsenblatt.
 *
 * A masthead bar and three rules of type — enough for a newspaper at this
 * size, and any more would close up into a grey block. The back page rolls
 * away to the right, which is what stops it reading as a plain document.
 */
export function NewsGlyph({ size }: { size?: number }) {
  return (
    <Glyph size={size}>
      <path d="M16.5 8.5h4v8.5a1.7 1.7 0 0 1-1.7 1.7H16.5" {...stroke} />
      <path d="M3.5 5.5h13v13h-13z" {...stroke} />
      <path d="M6 8.3h8" {...stroke} strokeWidth="2.1" />
      <path d="M6 11.6h8M6 14h8M6 16.3h5" {...hair} />
    </Glyph>
  )
}

/**
 * A toothed wheel, off an engineer's plate: die Einstellungen.
 *
 * The emoji gear was a solid disc at this size — a dark pill with nothing
 * legible in it. Drawn as six radial teeth around a hollow rim and a hub, it
 * keeps daylight between its parts and reads as machinery rather than a blob,
 * which is the whole difference at eighteen pixels.
 */
export function GearGlyph({ size }: { size?: number }) {
  const teeth = [0, 60, 120, 180, 240, 300]
  return (
    <Glyph size={size}>
      {teeth.map((deg) => {
        const rad = (deg * Math.PI) / 180
        const [cos, sin] = [Math.cos(rad), Math.sin(rad)]
        return (
          <path
            key={deg}
            d={`M${12 + 6.4 * cos} ${12 + 6.4 * sin}L${12 + 9.3 * cos} ${12 + 9.3 * sin}`}
            {...stroke}
            strokeWidth="2.4"
            strokeLinecap="butt"
          />
        )
      })}
      <circle cx="12" cy="12" r="6.4" {...stroke} />
      <circle cx="12" cy="12" r="2.3" {...hair} />
    </Glyph>
  )
}

/**
 * A stock anchor: the Flotte, and the button that finds one's own ship.
 *
 * Ring, stock and arms — the silhouette every chart in the period used, and
 * the one shape in this set that needs no explaining at any size.
 */
export function AnchorGlyph({ size }: { size?: number }) {
  return (
    <Glyph size={size}>
      <circle cx="12" cy="4.6" r="1.9" {...stroke} />
      <path d="M12 6.5v13.2" {...stroke} />
      <path d="M7.6 9.2h8.8" {...stroke} />
      <path d="M4.6 13.8a7.4 7.4 0 0 0 14.8 0" {...stroke} />
      <path d="M4.6 13.8 3 16.4M19.4 13.8 21 16.4" {...hair} />
    </Glyph>
  )
}
