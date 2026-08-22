import { memo, useId, type ReactNode } from 'react'
import type { PortraitTraits } from '@engine/persona'

/**
 * A procedurally engraved bust in an oval cameo.
 *
 * Everything is drawn from the trait numbers, so a trader's face is derived
 * from their name alone - no assets, no downloads, and the same merchant
 * looks the same on every device.
 *
 * The features live in lookup tables indexed by those numbers. Adding a
 * hairstyle is one entry here and one number in the generator's taste list;
 * nothing else in the app has to know.
 */

const INKS = ['#3b2a17', '#2a3340', '#3a2230'] as const
const PAPER = '#e8dcc0'

/** Head shapes. Everything worn on the head is scaled to match. */
const FACES = [
  { rx: 11, ry: 13.5 },
  { rx: 12.5, ry: 13.5 },
  { rx: 10, ry: 15 },
  { rx: 11.5, ry: 12.2 },
] as const

type Draw = (ink: string) => ReactNode

/**
 * Hair. Indices 0-5 are cut for men, 4 and 6-9 for women; the renderer draws
 * whichever number it is handed and leaves the taste to the generator.
 */
const HAIR: readonly Draw[] = [
  // 0 — kahl
  () => null,
  // 1 — kurz gescheitelt
  (ink) => <path d="M21 24 Q32 10 43 24 Q40 17 32 16 Q24 17 21 24 Z" fill={ink} />,
  // 2 — seitlich gekämmt
  (ink) => (
    <path d="M20 26 Q22 12 32 13 Q44 13 44 27 Q41 18 32 18 Q23 18 20 26 Z" fill={ink} />
  ),
  // 3 — mit Geheimratsecken
  (ink) => (
    <path d="M21 25 Q26 11 43 18 Q44 24 43 27 Q40 19 30 20 Q24 21 21 25 Z" fill={ink} />
  ),
  // 4 — kurz gelockt
  (ink) => (
    <g fill={ink}>
      <circle cx="24" cy="19" r="4" />
      <circle cx="29" cy="15.8" r="4.6" />
      <circle cx="35" cy="15.8" r="4.6" />
      <circle cx="40" cy="19" r="4" />
      <circle cx="21.6" cy="23" r="3.2" />
      <circle cx="42.4" cy="23" r="3.2" />
    </g>
  ),
  // 5 — Zopf im Nacken
  (ink) => (
    <g fill={ink}>
      <path d="M21 24 Q32 11 43 24 Q40 16 32 15.5 Q24 16 21 24 Z" />
      <path d="M42 24 Q46.5 27 45.5 33 Q45 37 43 39 Q45 33 43.5 29 Q42.8 26 41 25 Z" />
    </g>
  ),
  // 6 — lang und offen
  (ink) => (
    <path
      d="M19 30 Q18 13 32 12 Q46 13 45 30 Q45 40 43 47 Q41 34 41 26 Q38 18 32 18 Q26 18 23 26 Q23 34 21 47 Q19 40 19 30 Z"
      fill={ink}
    />
  ),
  // 7 — hochgesteckt
  (ink) => (
    <g fill={ink}>
      <path d="M20 26 Q20 13 32 13 Q44 13 44 26 Q41 18 32 18 Q23 18 20 26 Z" />
      <circle cx="32" cy="9.5" r="5" />
      <path d="M27 11 Q32 8 37 11" stroke={PAPER} strokeWidth="0.6" fill="none" opacity="0.5" />
    </g>
  ),
  // 8 — Zopf über der Schulter
  (ink) => (
    <g fill={ink}>
      <path d="M20 27 Q20 13 32 13 Q44 13 44 27 Q41 18 32 18 Q23 18 20 27 Z" />
      <path d="M42 25 Q47 32 46 41 Q45.4 47 43 50 Q45.6 41 44 34 Q43 28.6 40.6 25.6 Z" />
      <g stroke={PAPER} strokeWidth="0.55" opacity="0.55" fill="none">
        <path d="M42.4 31 L45.6 33" />
        <path d="M43.4 36 L46 38" />
        <path d="M43.6 41 L45.6 43" />
      </g>
    </g>
  ),
  // 9 — Bubikopf
  (ink) => (
    <path
      d="M20 30 Q19 13 32 13 Q45 13 44 30 Q44 34 43 37 Q42 26 40 22 Q37 18 32 18 Q27 18 24 22 Q22 26 21 37 Q20 34 20 30 Z"
      fill={ink}
    />
  ),
]

const BEARDS: readonly Draw[] = [
  () => null,
  // 1 — Schnurrbart
  (ink) => <path d="M26 34.5 Q32 33 38 34.5 L37 36 Q32 34.6 27 36 Z" fill={ink} />,
  // 2 — Vollbart
  (ink) => (
    <path d="M22 33 Q24 46 32 47 Q40 46 42 33 Q38 41 32 41 Q26 41 22 33 Z" fill={ink} />
  ),
  // 3 — Kinnbart
  (ink) => (
    <g fill={ink}>
      <path d="M25 34 Q32 32.4 39 34 L38 35.8 Q32 34 26 35.8 Z" />
      <path d="M28 40 Q32 44 36 40 Q32 42 28 40 Z" />
    </g>
  ),
  // 4 — langer Vollbart
  (ink) => (
    <path d="M23 30 Q23 45 32 46 Q41 45 41 30 L41 37 Q38 42 32 42 Q26 42 23 37 Z" fill={ink} />
  ),
  // 5 — Backenbart
  (ink) => (
    <g fill={ink}>
      <path d="M21.5 26 Q20.5 38 25.5 41.5 Q24 34 24.2 26.5 Z" />
      <path d="M42.5 26 Q43.5 38 38.5 41.5 Q40 34 39.8 26.5 Z" />
    </g>
  ),
]

const HEADWEAR: readonly Draw[] = [
  () => null,
  // 1 — Zylinder
  (ink) => (
    <g fill={ink}>
      <path d="M18 19 H46 V21 H18 Z" />
      <path d="M22 19 V9 H42 V19 Z" />
    </g>
  ),
  // 2 — Kapitänsmütze
  (ink) => (
    <g fill={ink}>
      <path d="M19 20 Q32 16 45 20 L45 22 Q32 18.5 19 22 Z" />
      <path d="M22 20 Q23 12 32 12 Q41 12 42 20 Z" />
      <path d="M22 18 H42 V19.5 H22 Z" fill={PAPER} opacity="0.5" />
    </g>
  ),
  // 3 — flache Kappe
  (ink) => <path d="M20 21 Q32 8 44 21 Q32 17 20 21 Z" fill={ink} />,
  // 4 — Haube
  (ink) => (
    <g>
      <path
        d="M17.5 30 Q17 11.5 32 10.5 Q47 11.5 46.5 30 Q44 21 40 18 Q37 15.5 32 15.5 Q27 15.5 24 18 Q20 21 17.5 30 Z"
        fill={ink}
      />
      <path d="M20 24 Q32 19 44 24" stroke={PAPER} strokeWidth="0.7" fill="none" opacity="0.45" />
      <path d="M19 29 Q22 40 27 43" stroke={ink} strokeWidth="1.1" fill="none" />
    </g>
  ),
  // 5 — Kopftuch
  (ink) => (
    <g fill={ink}>
      <path d="M19 27 Q19 12 32 12 Q45 12 45 27 Q42 19.5 32 19.5 Q22 19.5 19 27 Z" />
      <path d="M43 24 Q48 24 49 28 Q46 27.5 44.5 29 Q44.5 26 43 24 Z" />
    </g>
  ),
]

const COLLARS: readonly Draw[] = [
  // 0 — schlicht
  (ink) => <path d="M8 64 Q32 40 56 64 Z" fill={ink} opacity="0.9" />,
  // 1 — Hemdkragen mit Binder
  (ink) => (
    <g>
      <path d="M6 64 Q32 42 58 64 Z" fill={ink} opacity="0.9" />
      <path d="M26 47 L32 58 L38 47" fill={PAPER} opacity="0.85" />
      <path d="M32 50 L29.5 64 L34.5 64 Z" fill={ink} />
    </g>
  ),
  // 2 — Halstuch
  (ink) => (
    <g>
      <path d="M8 64 Q32 44 56 64 Z" fill={ink} opacity="0.9" />
      <path d="M24 47 L32 57 L40 47 Q32 52 24 47 Z" fill={PAPER} opacity="0.85" />
    </g>
  ),
  // 3 — Spitzenkragen
  (ink) => (
    <g>
      <path d="M7 64 Q32 43 57 64 Z" fill={ink} opacity="0.9" />
      <path
        d="M22 48 Q27 58 32 58 Q37 58 42 48 Q38 53 32 53 Q26 53 22 48 Z"
        fill={PAPER}
        opacity="0.85"
      />
      <circle cx="32" cy="55.5" r="1.4" fill={ink} />
    </g>
  ),
]

const ACCESSORIES: readonly Draw[] = [
  () => null,
  // 1 — Monokel
  (ink) => (
    <g>
      <circle cx="36.5" cy="28" r="4" fill="none" stroke={ink} strokeWidth="0.9" />
      <path d="M40 28 L45 24" stroke={ink} strokeWidth="0.6" />
    </g>
  ),
  // 2 — Pfeife
  (ink) => (
    <g>
      <path d="M35 37.5 L45 40" stroke={ink} strokeWidth="1.3" />
      <ellipse cx="46.5" cy="40.5" rx="2.6" ry="2" fill={ink} />
      <path
        d="M46 37.5 Q48.6 34.6 47 32.4"
        stroke={ink}
        strokeWidth="0.6"
        fill="none"
        opacity="0.55"
      />
    </g>
  ),
  // 3 — Schal
  (ink) => <path d="M24 46 Q32 50 40 46 L40 48 Q32 52 24 48 Z" fill={ink} opacity="0.8" />,
  // 4 — Ohrgehänge
  (ink) => (
    <g fill={ink}>
      <circle cx="21.8" cy="31.5" r="1.5" />
      <circle cx="42.2" cy="31.5" r="1.5" />
    </g>
  ),
  // 5 — Brille
  (ink) => (
    <g fill="none" stroke={ink} strokeWidth="0.85">
      <circle cx="27.5" cy="28" r="3.6" />
      <circle cx="36.5" cy="28" r="3.6" />
      <path d="M31.1 28 H32.9" />
      <path d="M23.9 27.2 L20.6 26" />
      <path d="M40.1 27.2 L43.4 26" />
    </g>
  ),
]

export interface PortraitProps {
  readonly traits: PortraitTraits
  readonly size?: number
  readonly className?: string
  readonly title?: string
}

export const Portrait = memo(function Portrait({
  traits,
  size = 56,
  className,
  title,
}: PortraitProps) {
  const uid = useId().replace(/:/g, '')
  const ink = INKS[traits.ink] ?? INKS[0]!
  const face = FACES[traits.face] ?? FACES[0]
  const woman = traits.gender === 'w'

  // Everything worn on the head is drawn for the default skull, then scaled
  // to whichever one this trader has — so a hat never floats off a long face.
  const sx = face.rx / FACES[0].rx
  const sy = face.ry / FACES[0].ry

  const draw = (table: readonly Draw[], i: number) => (table[i] ?? table[0]!)(ink)

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      role={title ? 'img' : 'presentation'}
      aria-label={title}
    >
      <defs>
        <clipPath id={`c${uid}`}>
          <ellipse cx="32" cy="33" rx="25" ry="28" />
        </clipPath>
        <pattern id={`h${uid}`} width="3" height="3" patternUnits="userSpaceOnUse">
          <path d="M0 3 L3 0" stroke={ink} strokeWidth="0.5" opacity="0.35" />
        </pattern>
      </defs>

      <ellipse cx="32" cy="33" rx="26" ry="29" fill={PAPER} stroke={ink} strokeWidth="1.2" />

      <g clipPath={`url(#c${uid})`}>
        <rect x="0" y="0" width="64" height="64" fill={PAPER} />
        <rect x="0" y="0" width="64" height="64" fill={`url(#h${uid})`} opacity="0.5" />

        {/* Schultern */}
        {draw(COLLARS, traits.collar)}

        <g transform={`translate(32 28) scale(${sx} ${sy}) translate(-32 -28)`}>
          {/* Kopf */}
          <ellipse
            cx="32"
            cy="28"
            rx={FACES[0].rx}
            ry={FACES[0].ry}
            fill={PAPER}
            stroke={ink}
            strokeWidth="1"
          />

          {/* Haar liegt unter Hut und Haube */}
          {draw(HAIR, traits.hair)}

          {/* Augen und Brauen */}
          <circle cx="27.5" cy="28" r="1.1" fill={ink} />
          <circle cx="36.5" cy="28" r="1.1" fill={ink} />
          <path
            d="M25 25.5 Q27.5 24.4 30 25.5"
            stroke={ink}
            strokeWidth={woman ? 0.6 : 0.9}
            fill="none"
          />
          <path
            d="M34 25.5 Q36.5 24.4 39 25.5"
            stroke={ink}
            strokeWidth={woman ? 0.6 : 0.9}
            fill="none"
          />

          {/* Nase und Mund */}
          <path d="M32 29 L31 33 L33 33.4" stroke={ink} strokeWidth="0.7" fill="none" />
          {woman ? (
            <path d="M29.4 36.8 Q32 38.8 34.6 36.8 Q32 37.8 29.4 36.8 Z" fill={ink} opacity="0.85" />
          ) : (
            <path d="M29 37 Q32 38.6 35 37" stroke={ink} strokeWidth="0.9" fill="none" />
          )}

          {/* Jahre auf See */}
          {traits.age >= 1 && (
            <g stroke={ink} strokeWidth="0.45" fill="none" opacity="0.55">
              <path d="M28.4 34.6 Q27.4 36.4 27.8 38" />
              <path d="M35.6 34.6 Q36.6 36.4 36.2 38" />
            </g>
          )}
          {traits.age === 2 && (
            <g stroke={ink} strokeWidth="0.45" fill="none" opacity="0.5">
              <path d="M30.6 22.6 Q32 21.8 33.4 22.6" />
              <path d="M22.6 29.4 Q24 30.4 24.4 31.6" />
              <path d="M41.4 29.4 Q40 30.4 39.6 31.6" />
            </g>
          )}

          {draw(BEARDS, traits.beard)}
          {draw(HEADWEAR, traits.headwear)}
          {draw(ACCESSORIES, traits.accessory)}
        </g>
      </g>

      <ellipse
        cx="32"
        cy="33"
        rx="25"
        ry="28"
        fill="none"
        stroke={ink}
        strokeWidth="0.6"
        opacity="0.6"
      />
    </svg>
  )
})
