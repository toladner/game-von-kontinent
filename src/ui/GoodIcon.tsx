import { memo, useId, type ReactNode } from 'react'

/**
 * An engraved vignette of a good, in the cameo the traders wear.
 *
 * Same treatment as the portraits — paper ground, a hatch over it, ink line
 * work, an oval frame — so a Warenkarte and a merchant look like they came
 * out of the same box. Drawn rather than downloaded, for the same reasons:
 * no assets to ship, nothing to load, and it works offline on a phone.
 *
 * Ninety goods is a great many pictures, so they are composed rather than
 * drawn one by one. A dozen primitives carry the weight — a sack, a crate, a
 * cask, a bale, a bottle, an ingot — and each good picks one and adds the
 * detail that tells it apart: the bean on the coffee sack, the tap on the oil
 * cask. Goods that really are the same shape share one, which is honest: two
 * sacks of grain and rice differ by what is stencilled on them, and so do
 * these.
 */

const PAPER = '#e8dcc0'
const INK = '#3b2a17'

type Draw = () => ReactNode

/* ---------------------------------------------------------------------------
   Primitives. Everything is drawn inside a 64×64 box, centred on (32, 34),
   with room left for the oval frame to crop the corners.
   ------------------------------------------------------------------------ */

const line = { fill: 'none', stroke: INK, strokeWidth: 1.6, strokeLinejoin: 'round' } as const
const thin = { fill: 'none', stroke: INK, strokeWidth: 1.1, strokeLinecap: 'round' } as const

/** A tied sack: bulk goods by the hundredweight. */
const sack = (mark?: ReactNode) => (
  <g>
    <path d="M23 26 Q20 40 22 48 Q32 52 42 48 Q44 40 41 26 Q32 23 23 26 Z" {...line} />
    <path d="M23 26 Q26 21 32 21 Q38 21 41 26" {...line} />
    <path d="M26 23.5 Q32 26 38 23.5" {...thin} />
    {mark}
  </g>
)

/** A nailed crate: anything that travels boxed. */
const crate = (mark?: ReactNode) => (
  <g>
    <rect x="19" y="26" width="26" height="21" rx="1" {...line} />
    <path d="M19 32 H45 M19 41 H45" {...thin} />
    {mark}
  </g>
)

/** A cask: oils, wine, anything that pours. */
const cask = (mark?: ReactNode) => (
  <g>
    <path d="M24 25 Q19 34 24 46 Q32 49 40 46 Q45 34 40 25 Q32 22 24 25 Z" {...line} />
    <path d="M20.5 31 Q32 34 43.5 31 M20.5 40 Q32 43 43.5 40" {...thin} />
    {mark}
  </g>
)

/** A bound bale: fibres and cloth in the raw. */
const bale = (mark?: ReactNode) => (
  <g>
    <rect x="19" y="25" width="26" height="22" rx="3" {...line} />
    <path d="M27 25 V47 M37 25 V47" {...thin} />
    {mark}
  </g>
)

/** A bottle or flask. */
const bottle = (mark?: ReactNode) => (
  <g>
    <path d="M29 21 H35 V27 Q41 31 41 38 V46 Q32 49 23 46 V38 Q23 31 29 27 Z" {...line} />
    <path d="M23 38 Q32 41 41 38" {...thin} />
    {mark}
  </g>
)

/** Stacked ingots: the smelted metals. */
const ingots = (mark?: ReactNode) => (
  <g>
    <path d="M22 41 L26 35 H42 L46 41 Z" {...line} />
    <path d="M18 48 L22 42 H38 L42 48 Z" {...line} />
    <path d="M26 48 L30 42 H46 L50 48 Z" {...line} />
    {mark}
  </g>
)

/** Rough ore, straight from the working. */
const ore = (mark?: ReactNode) => (
  <g>
    <path d="M20 44 L25 30 L38 27 L46 36 L42 47 Z" {...line} />
    <path d="M25 30 L33 38 L46 36 M33 38 L31 47" {...thin} />
    {mark}
  </g>
)

/** A cut stone, faceted. */
const gem = (mark?: ReactNode) => (
  <g>
    <path d="M22 32 L28 24 H40 L46 32 L34 48 Z" {...line} />
    <path d="M22 32 H46 M28 24 L34 32 L40 24 M34 32 V48" {...thin} />
    {mark}
  </g>
)

/** A bolt of cloth. */
const bolt = (mark?: ReactNode) => (
  <g>
    <path d="M20 30 Q20 26 25 26 H44 Q39 26 39 30 V45 Q39 49 34 49 H21 Q26 49 26 45 V30 Z" {...line} />
    <path d="M39 30 Q44 30 44 26" {...thin} />
    <path d="M26 34 H39 M26 39 H39" {...thin} />
    {mark}
  </g>
)

/** A leafy branch, for what is picked rather than dug. */
const branch = (mark?: ReactNode) => (
  <g>
    <path d="M32 50 Q32 36 32 24" {...line} />
    <path d="M32 40 Q22 38 20 30 Q30 29 32 37" {...line} />
    <path d="M32 33 Q42 31 44 23 Q34 22 32 30" {...line} />
    {mark}
  </g>
)

/** A tin, for what is canned or refined. */
const tin = (mark?: ReactNode) => (
  <g>
    <ellipse cx="32" cy="27" rx="12" ry="4.5" {...line} />
    <path d="M20 27 V44 Q20 48 32 48 Q44 48 44 44 V27" {...line} />
    <ellipse cx="32" cy="27" rx="7" ry="2.4" {...thin} />
    {mark}
  </g>
)

/* --- small marks that sit on a primitive ------------------------------- */

const dot = (x: number, y: number, r = 2) => <circle cx={x} cy={y} r={r} fill={INK} />
const ring = (x: number, y: number, r = 3) => <circle cx={x} cy={y} r={r} {...thin} />
const stencil = (d: string) => <path d={d} {...thin} />

/* ---------------------------------------------------------------------------
   The goods. Keyed by Warenkarten-Nummer, so a content pack that adds a card
   adds a line here and nothing else changes.
   ------------------------------------------------------------------------ */

const ICONS: Readonly<Record<number, Draw>> = {
  // --- Metalle und Erze ---------------------------------------------------
  1: () => ingots(stencil('M28 38 H38')), // Aluminium
  8: () => ore(dot(30, 36, 1.6)), // Bauxit
  9: () => ingots(), // Blei
  11: () => ore(stencil('M27 34 L33 40')), // Chromerz
  14: () => ore(stencil('M26 33 L36 43')), // Eisenerz
  17: () => ingots(stencil('M24 45 H34')), // Kupfer
  32: () => ore(dot(36, 34, 1.4)), // Kobalt
  40: () => ore(stencil('M30 31 L30 42')), // Manganerz
  44: () => ingots(ring(34, 38, 2)), // Nickel
  50: () => ingots(gemMark()), // Platin
  52: () => bottle(dot(32, 42, 3)), // Quecksilber
  58: () => ingots(stencil('M26 44 H36 M30 41 V47')), // Silber
  64: () => ore(<g>{ring(33, 36, 3)}{dot(33, 36, 1)}</g>), // Uranerze
  70: () => ore(stencil('M28 36 H38')), // Wolframerz
  74: () => ingots(stencil('M28 38 H38 M28 41 H38')), // Zinn
  87: () => ingots(stencil('M27 44 L35 44 L27 47 L35 47')), // Zink

  // --- Edelsteine ----------------------------------------------------------
  12: () => gem(), // Diamanten
  23: () => ingots(stencil('M27 38 H41')), // Gold
  84: () => gem(stencil('M29 36 Q34 40 39 36')), // Jade
  88: () => gem(<g>{dot(31, 34, 1.2)}{dot(37, 34, 1.2)}</g>), // Opale
  77: () => (
    // Perlen — a string of them, which no other good is
    <g>
      <path d="M18 30 Q32 52 46 30" {...line} />
      {[22, 27, 32, 37, 42].map((x, i) => (
        <circle key={x} cx={x} cy={[36, 43, 45.5, 43, 36][i]} r="3.2" {...thin} />
      ))}
    </g>
  ),

  // --- Bergbau, mineralisch ------------------------------------------------
  3: () => ore(stencil('M24 40 H42')), // Asbest
  33: () => sack(stencil('M28 36 L32 32 L36 36 L32 40 Z')), // Kochsalz
  34: () => ore(<g>{dot(29, 37, 1.5)}{dot(37, 35, 1.5)}</g>), // Kohle
  51: () => sack(stencil('M27 37 H37')), // Phosphat
  55: () => sack(stencil('M28 34 H36 M32 34 V40')), // Salpeter

  // --- Energie und Chemie --------------------------------------------------
  15: () => cask(stencil('M44 36 H48 V40')), // Erdöl — with a tap
  10: () => bottle(stencil('M28 38 H36')), // Chemikalien
  28: () => bottle(dot(32, 40, 2.4)), // Jod
  39: () => sack(stencil('M27 35 L32 40 L37 35')), // Kunstdünger
  83: () => tin(stencil('M27 38 Q32 34 37 38')), // Lack
  85: () => tin(dot(32, 38, 2.2)), // Kampfer
  86: () => bottle(stencil('M28 36 H36 M28 40 H36')), // Chinin

  // --- Öle -----------------------------------------------------------------
  45: () => sack(dot(32, 36, 2)), // Ölsaaten
  46: () => bottle(<g>{stencil('M27 39 Q32 35 37 39')}{dot(32, 34, 1.6)}</g>), // Olivenöl
  47: () => cask(dot(32, 36, 2.2)), // Palmöl
  79: () => tin(stencil('M28 37 Q32 42 36 37')), // Kokosöl

  // --- Agrar, Säcke --------------------------------------------------------
  16: () => sack(stencil('M28 37 Q32 33 36 37')), // Erdnüsse
  21: () => sack(branchMark()), // Gemüse
  22: () => sack(stencil('M32 32 V42 M32 34 Q29 35 29 37 M32 34 Q35 35 35 37')), // Getreide
  53: () => sack(<g>{dot(29, 37, 1.2)}{dot(33, 35, 1.2)}{dot(36, 38, 1.2)}</g>), // Reis
  75: () => sack(<g>{dot(30, 37, 1.6)}{dot(35, 37, 1.6)}</g>), // Sojabohnen
  35: () => sack(stencil('M27 36 Q32 41 37 36')), // Kopra

  // --- Genuß ---------------------------------------------------------------
  29: () => sack(<g>{ring(32, 37, 3.4)}{stencil('M32 34 V40')}</g>), // Kaffee
  30: () => sack(stencil('M30 33 Q28 37 30 41 M34 33 Q36 37 34 41')), // Kakao
  61: () => branch(), // Tee — the bush itself, not another crate
  60: () => bale(stencil('M31 30 Q29 36 31 42')), // Tabak
  57: () => crate(stencil('M24 36 H40 M32 30 V43')), // Schokolade
  72: () => sack(stencil('M28 34 L36 40 M36 34 L28 40')), // Zucker
  76: () => crate(<g>{dot(27, 36, 1.3)}{dot(32, 34, 1.3)}{dot(37, 37, 1.3)}</g>), // Gewürze
  65: () => crate(stencil('M32 30 V43 M29 33 Q32 36 35 33')), // Vanille
  90: () => crate(stencil('M26 38 Q32 32 38 38')), // Ingwer
  68: () => bottle(stencil('M29 38 Q32 42 35 38')), // Wein
  36: () => sack(<g>{dot(29, 36, 1.2)}{dot(33, 38, 1.2)}{dot(36, 35, 1.2)}</g>), // Korinthen

  // --- Früchte -------------------------------------------------------------
  2: () => (
    // Ananas — the one fruit with a crown
    <g>
      <ellipse cx="32" cy="40" rx="10" ry="12" {...line} />
      <path d="M25 34 L39 46 M39 34 L25 46" {...thin} />
      <path d="M32 28 L28 20 M32 28 L32 18 M32 28 L36 20" {...line} />
    </g>
  ),
  4: () => (
    // Bananen — a hand of them
    <g>
      <path d="M20 28 Q22 46 38 48 Q28 42 26 27 Z" {...line} />
      <path d="M25 27 Q27 45 43 47 Q33 41 31 26 Z" {...line} />
      <path d="M30 26 Q32 44 48 46 Q38 40 36 25 Z" {...line} />
    </g>
  ),
  59: () => crate(<g>{ring(28, 37, 3)}{ring(36, 37, 3)}</g>), // Südfrüchte

  // --- Tier ----------------------------------------------------------------
  13: () => (
    // Eier — in a nest of straw
    <g>
      <ellipse cx="27" cy="36" rx="6" ry="7.5" {...line} />
      <ellipse cx="38" cy="38" rx="6" ry="7.5" {...line} />
      <path d="M18 46 Q32 52 46 46" {...line} />
    </g>
  ),
  19: () => (
    // Fische
    <g>
      <path d="M18 36 Q28 26 40 36 Q28 46 18 36 Z" {...line} />
      <path d="M40 36 L48 30 V42 Z" {...line} />
      {dot(25, 33, 1.4)}
    </g>
  ),
  20: () => crate(stencil('M26 36 Q32 31 38 36 M32 31 V42')), // Fleischwaren
  80: () => crate(stencil('M27 34 Q32 40 37 34')), // Lammfleisch
  18: () => (
    // Felle — a pelt on a stretcher
    <g>
      <path d="M32 20 Q24 24 22 34 Q20 44 26 48 Q32 44 38 48 Q44 44 42 34 Q40 24 32 20 Z" {...line} />
      <path d="M32 26 V44" {...thin} />
    </g>
  ),
  26: () => bale(stencil('M24 30 Q32 38 40 30')), // Häute
  49: () => (
    // Pelze — rolled, with the tail out
    <g>
      <rect x="20" y="28" width="24" height="18" rx="9" {...line} />
      <path d="M44 37 Q52 34 50 26" {...line} />
      <path d="M26 32 Q28 37 26 42 M32 32 Q34 37 32 42" {...thin} />
    </g>
  ),
  42: () => (
    // Milchprodukte — a churn
    <g>
      <path d="M26 24 H38 L41 46 Q32 50 23 46 Z" {...line} />
      <path d="M26 30 Q32 33 38 30" {...thin} />
    </g>
  ),
  81: () => crate(stencil('M26 38 H38 M32 33 V43')), // Butter
  66: () => (
    // Vieh — horns say cattle where a silhouette would not
    <g>
      <path d="M22 32 Q22 24 32 24 Q42 24 42 32 Q42 44 32 46 Q22 44 22 32 Z" {...line} />
      <path d="M22 30 Q16 26 18 20 M42 30 Q48 26 46 20" {...line} />
      {dot(27, 33, 1.5)}
      {dot(37, 33, 1.5)}
    </g>
  ),

  // --- Textil --------------------------------------------------------------
  5: () => (
    // Baumwolle — the boll
    <g>
      <circle cx="32" cy="34" r="5" {...line} />
      <circle cx="24" cy="38" r="4.5" {...line} />
      <circle cx="40" cy="38" r="4.5" {...line} />
      <path d="M32 39 V50" {...line} />
    </g>
  ),
  6: () => bolt(stencil('M29 43 H36')), // Baumwollwaren
  25: () => bale(stencil('M32 27 V45')), // Hanf
  56: () => bale(stencil('M28 27 V45 M36 27 V45')), // Sisalhanf
  63: () => bolt(), // Textilwaren
  67: () => bolt(stencil('M29 36 H36 M29 41 H36')), // Webwaren
  54: () => bolt(stencil('M27 43 Q32 39 38 43')), // Seidenwaren
  73: () => (
    // Rohseide — a skein
    <g>
      <ellipse cx="32" cy="36" rx="13" ry="9" {...line} />
      <path d="M24 30 Q32 40 40 30 M22 36 Q32 44 42 36" {...thin} />
      <path d="M32 45 V50" {...line} />
    </g>
  ),
  71: () => (
    // Wolle — a fleece
    <g>
      <path d="M20 38 Q18 30 25 29 Q27 23 34 25 Q42 23 43 30 Q49 33 45 40 Q40 47 32 46 Q23 46 20 38 Z" {...line} />
      <path d="M26 34 Q30 37 27 40 M34 32 Q38 35 35 39" {...thin} />
    </g>
  ),
  62: () => (
    // Teppiche — a rolled carpet, seen end-on
    <g>
      <rect x="18" y="28" width="28" height="16" rx="8" {...line} />
      <ellipse cx="18" cy="36" rx="4" ry="8" {...line} />
      <ellipse cx="18" cy="36" rx="1.8" ry="3.5" {...thin} />
      <path d="M28 30 V42 M36 30 V42" {...thin} />
    </g>
  ),

  // --- Wald und Bau --------------------------------------------------------
  27: () => (
    // Holz — sawn logs, end on
    <g>
      <ellipse cx="25" cy="32" rx="7" ry="6" {...line} />
      <ellipse cx="39" cy="32" rx="7" ry="6" {...line} />
      <ellipse cx="32" cy="43" rx="7" ry="6" {...line} />
      {ring(25, 32, 2.5)}
      {ring(39, 32, 2.5)}
      {ring(32, 43, 2.5)}
    </g>
  ),
  82: () => (
    // Teakholz — squared baulks rather than round logs
    <g>
      <rect x="18" y="27" width="13" height="11" {...line} />
      <rect x="33" y="27" width="13" height="11" {...line} />
      <rect x="25" y="40" width="13" height="11" {...line} />
      <path d="M21 30 H28 M36 30 H43 M28 43 H35" {...thin} />
    </g>
  ),
  89: () => (
    // Bambus — jointed canes
    <g>
      <path d="M26 20 V50 M38 20 V50" {...line} />
      <path d="M23 29 H29 M23 40 H29 M35 25 H41 M35 36 H41 M35 46 H41" {...thin} />
    </g>
  ),
  37: () => (
    // Korke — cut bungs
    <g>
      <rect x="20" y="28" width="11" height="16" rx="2" {...line} />
      <rect x="34" y="32" width="11" height="16" rx="2" {...line} />
      <path d="M20 33 H31 M34 37 H45" {...thin} />
    </g>
  ),
  7: () => (
    // Baustoffe — courses of brick
    <g>
      <rect x="18" y="28" width="28" height="7" {...line} />
      <rect x="18" y="35" width="28" height="7" {...line} />
      <rect x="18" y="42" width="28" height="7" {...line} />
      <path d="M32 28 V35 M25 35 V42 M39 35 V42 M32 42 V49" {...thin} />
    </g>
  ),
  48: () => (
    // Papier — a ream with one sheet lifting
    <g>
      <rect x="20" y="30" width="24" height="18" {...line} />
      <path d="M24 26 H48 L44 30" {...line} />
      <path d="M24 36 H40 M24 41 H40" {...thin} />
    </g>
  ),
  31: () => (
    // Kautschuk — the tapping cup on the trunk
    <g>
      <path d="M30 18 V48" {...line} />
      <path d="M30 30 Q22 32 20 40 Q28 41 30 36" {...line} />
      <path d="M34 40 H44 L42 48 H36 Z" {...line} />
    </g>
  ),
  24: () => (
    // Gummi — a solid block, cross-hatched
    <g>
      <rect x="20" y="28" width="24" height="20" rx="2" {...line} />
      <path d="M20 34 L44 34 M20 42 L44 42 M28 28 V48 M36 28 V48" {...thin} />
    </g>
  ),

  // --- Industrie -----------------------------------------------------------
  38: () => (
    // Kraftwagen
    <g>
      <path d="M17 42 V36 L24 30 H38 L45 36 V42 Z" {...line} />
      <path d="M25 31 V36 H38" {...thin} />
      <circle cx="24" cy="44" r="3.5" {...line} />
      <circle cx="40" cy="44" r="3.5" {...line} />
    </g>
  ),
  41: () => (
    // Maschinen — a gear
    <g>
      <circle cx="32" cy="36" r="10" {...line} />
      <circle cx="32" cy="36" r="4" {...line} />
      <path
        d="M32 24 V20 M32 48 V52 M20 36 H16 M44 36 H48 M24 28 L21 25 M40 44 L43 47 M24 44 L21 47 M40 28 L43 25"
        {...line}
      />
    </g>
  ),
  43: () => (
    // Metallwaren — plate and rivets
    <g>
      <rect x="19" y="29" width="26" height="18" rx="2" {...line} />
      {dot(24, 34, 1.4)}
      {dot(40, 34, 1.4)}
      {dot(24, 42, 1.4)}
      {dot(40, 42, 1.4)}
      <path d="M29 38 H35" {...thin} />
    </g>
  ),
  69: () => (
    // Werkzeuge — hammer and spanner crossed
    <g>
      <path d="M20 48 L38 26" {...line} />
      <path d="M35 22 L44 30 L40 34 L31 26 Z" {...line} />
      <path d="M44 48 L30 30" {...line} />
      <path d="M26 22 Q22 26 26 30 L30 26 Z" {...line} />
    </g>
  ),
  78: () => (
    // Porzellan — a bowl on a stand
    <g>
      <path d="M20 32 Q22 46 32 46 Q42 46 44 32 Z" {...line} />
      <path d="M20 32 H44" {...line} />
      <path d="M28 50 H36" {...line} />
      <path d="M32 46 V50" {...line} />
      {ring(32, 38, 4)}
    </g>
  ),
}

/** Platin gets a small mark of its own; kept out of the table for legibility. */
function gemMark(): ReactNode {
  return <path d="M28 38 L32 34 L36 38 L32 42 Z" {...thin} />
}

/** A sprig, reused by the goods that are picked rather than made. */
function branchMark(): ReactNode {
  return <path d="M32 42 Q32 34 32 31 M32 36 Q28 35 27 31 M32 34 Q36 33 37 29" {...thin} />
}

/**
 * Anything without a picture of its own falls back to a crate, which is how
 * an unfamiliar consignment arrives on a quay in any case.
 */
const FALLBACK: Draw = () => crate()

export const GoodIcon = memo(function GoodIcon({
  goodId,
  size = 34,
  title,
  className,
}: {
  goodId: number
  size?: number
  title?: string
  className?: string
}) {
  const uid = useId().replace(/:/g, '')
  const draw = ICONS[goodId] ?? FALLBACK

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={`shrink-0 ${className ?? ''}`}
      role={title ? 'img' : 'presentation'}
      aria-label={title}
    >
      <defs>
        <clipPath id={`g${uid}`}>
          <ellipse cx="32" cy="34" rx="25" ry="27" />
        </clipPath>
        <pattern id={`p${uid}`} width="3" height="3" patternUnits="userSpaceOnUse">
          <path d="M0 3 L3 0" stroke={INK} strokeWidth="0.5" opacity="0.35" />
        </pattern>
      </defs>

      <ellipse cx="32" cy="34" rx="26" ry="28" fill={PAPER} stroke={INK} strokeWidth="1.2" />
      <g clipPath={`url(#g${uid})`}>
        <rect x="0" y="0" width="64" height="64" fill={PAPER} />
        <rect x="0" y="0" width="64" height="64" fill={`url(#p${uid})`} opacity="0.5" />
        {draw()}
      </g>
      <ellipse cx="32" cy="34" rx="26" ry="28" fill="none" stroke={INK} strokeWidth="1.2" />
    </svg>
  )
})

/** Which Warenkarten have a picture of their own. Used by the tests. */
export const DRAWN_GOODS: readonly number[] = Object.keys(ICONS).map(Number)
