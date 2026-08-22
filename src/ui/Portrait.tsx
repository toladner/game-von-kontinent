import { memo, useId } from 'react'
import type { PortraitTraits } from '@engine/persona'

/**
 * A procedurally engraved bust in an oval cameo.
 *
 * Everything is drawn from the seven trait numbers, so a trader's face is
 * derived from their name alone - no assets, no downloads, and the same
 * merchant looks the same on every device.
 */

const INKS = ['#3b2a17', '#2a3340', '#3a2230'] as const
const PAPER = '#e8dcc0'

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
  const ink = INKS[traits.ink] ?? INKS[0]

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
        <path
          d={
            traits.collar === 0
              ? 'M8 64 Q32 40 56 64 Z'
              : traits.collar === 1
                ? 'M6 64 Q32 42 58 64 Z M26 48 L32 58 L38 48'
                : 'M8 64 Q32 44 56 64 Z M24 47 L32 56 L40 47'
          }
          fill={ink}
          opacity="0.9"
        />
        {traits.collar > 0 && (
          <path d="M27 47 L32 57 L37 47" fill={PAPER} opacity="0.85" />
        )}

        {/* Kopf */}
        <ellipse
          cx="32"
          cy="28"
          rx={traits.face === 0 ? 11 : traits.face === 1 ? 12.5 : 10}
          ry={traits.face === 2 ? 15 : 13.5}
          fill={PAPER}
          stroke={ink}
          strokeWidth="1"
        />

        {/* Haar */}
        {traits.hair !== 3 && (
          <path
            d={
              traits.hair === 0
                ? 'M21 24 Q32 10 43 24 Q40 17 32 16 Q24 17 21 24 Z'
                : traits.hair === 1
                  ? 'M20 26 Q22 12 32 13 Q44 13 44 27 Q41 18 32 18 Q23 18 20 26 Z'
                  : 'M21 25 Q26 11 43 18 Q44 24 43 27 Q40 19 30 20 Q24 21 21 25 Z'
            }
            fill={ink}
          />
        )}

        {/* Augen */}
        <circle cx="27.5" cy="28" r="1.1" fill={ink} />
        <circle cx="36.5" cy="28" r="1.1" fill={ink} />
        <path d="M25 25.5 Q27.5 24.4 30 25.5" stroke={ink} strokeWidth="0.8" fill="none" />
        <path d="M34 25.5 Q36.5 24.4 39 25.5" stroke={ink} strokeWidth="0.8" fill="none" />

        {/* Nase und Mund */}
        <path d="M32 29 L31 33 L33 33.4" stroke={ink} strokeWidth="0.7" fill="none" />
        <path d="M29 37 Q32 38.6 35 37" stroke={ink} strokeWidth="0.9" fill="none" />

        {/* Bart */}
        {traits.beard === 1 && (
          <path d="M26 34.5 Q32 33 38 34.5 L37 36 Q32 34.6 27 36 Z" fill={ink} />
        )}
        {traits.beard === 2 && (
          <path d="M22 33 Q24 46 32 47 Q40 46 42 33 Q38 41 32 41 Q26 41 22 33 Z" fill={ink} />
        )}
        {traits.beard === 3 && (
          <>
            <path d="M25 34 Q32 32.4 39 34 L38 35.8 Q32 34 26 35.8 Z" fill={ink} />
            <path d="M28 40 Q32 44 36 40 Q32 42 28 40 Z" fill={ink} />
          </>
        )}
        {traits.beard === 4 && (
          <path d="M23 30 Q23 45 32 46 Q41 45 41 30 L41 37 Q38 42 32 42 Q26 42 23 37 Z" fill={ink} />
        )}

        {/* Kopfbedeckung */}
        {traits.headwear === 1 && (
          <>
            <path d="M18 19 H46 V21 H18 Z" fill={ink} />
            <path d="M22 19 V9 H42 V19 Z" fill={ink} />
          </>
        )}
        {traits.headwear === 2 && (
          <>
            <path d="M19 20 Q32 16 45 20 L45 22 Q32 18.5 19 22 Z" fill={ink} />
            <path d="M22 20 Q23 12 32 12 Q41 12 42 20 Z" fill={ink} />
            <path d="M22 18 H42 V19.5 H22 Z" fill={PAPER} opacity="0.5" />
          </>
        )}
        {traits.headwear === 3 && (
          <path d="M20 21 Q32 8 44 21 Q32 17 20 21 Z" fill={ink} />
        )}

        {/* Beiwerk */}
        {traits.accessory === 1 && (
          <>
            <circle cx="36.5" cy="28" r="4" fill="none" stroke={ink} strokeWidth="0.9" />
            <path d="M40 28 L45 24" stroke={ink} strokeWidth="0.6" />
          </>
        )}
        {traits.accessory === 2 && (
          <>
            <path d="M35 37.5 L45 40" stroke={ink} strokeWidth="1.3" />
            <ellipse cx="46.5" cy="40.5" rx="2.6" ry="2" fill={ink} />
            <path d="M46 37.5 Q48.6 34.6 47 32.4" stroke={ink} strokeWidth="0.6" fill="none" opacity="0.55" />
          </>
        )}
        {traits.accessory === 3 && (
          <path d="M24 46 Q32 50 40 46 L40 48 Q32 52 24 48 Z" fill={ink} opacity="0.8" />
        )}
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
