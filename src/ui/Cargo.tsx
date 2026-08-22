import { memo } from 'react'
import type { CargoItem } from '@engine/state'
import type { EngineContext } from '@engine/context'
import type { GoodCategory, Vehicle } from '@engine/types'

/**
 * What is actually in the hold, as crates rather than a list of words.
 *
 * Each crate is stencilled with its Warenkarten number and tinted by trade
 * category, so a glance at the hold tells you what you are carrying. Empty
 * slots only appear once a vehicle has a limit — the original steamer has none.
 */

const CATEGORY_INK: Record<GoodCategory, string> = {
  agrar: '#6f8f43',
  genuss: '#8a5a2a',
  tier: '#a2564a',
  bergbau: '#66707a',
  edel: '#a9863f',
  energie: '#3f4450',
  industrie: '#476a8c',
  textil: '#7d5f92',
}

export const Crate = memo(function Crate({
  number,
  category,
  size = 34,
  label,
  dim,
}: {
  number: number
  category: GoodCategory
  size?: number
  label?: string
  dim?: boolean
}) {
  const ink = CATEGORY_INK[category]
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      role="img"
      aria-label={label ?? `Ware ${number}`}
      style={{ opacity: dim ? 0.35 : 1 }}
    >
      {/* Kiste */}
      <rect x="3" y="8" width="34" height="28" rx="1.5" fill="#c8a877" stroke="#5c452a" strokeWidth="1.6" />
      <rect x="3" y="8" width="34" height="6" fill="#d9bd8f" opacity="0.7" />
      {/* Bänder */}
      <path d="M3 16h34M3 30h34" stroke="#5c452a" strokeWidth="1.2" opacity="0.55" />
      <path d="M3 8l34 28M37 8L3 36" stroke="#5c452a" strokeWidth="0.9" opacity="0.22" />
      {/* Farbmarke der Warengattung */}
      <rect x="3" y="8" width="5" height="28" fill={ink} opacity="0.85" />
      {/* Nummer, wie aufgeschablont */}
      <text
        x="23"
        y="28"
        textAnchor="middle"
        fontSize="14"
        fontFamily="var(--font-display)"
        fontWeight="700"
        fill="#4a3520"
      >
        {number}
      </text>
    </svg>
  )
})

export function CargoHold({
  ctx,
  cargo,
  vehicle,
  size = 34,
  max,
}: {
  ctx: EngineContext
  cargo: readonly CargoItem[]
  vehicle: Vehicle
  size?: number
  /** Cap how many crates are drawn; the rest are summarised. */
  max?: number
}) {
  const shown = max ? cargo.slice(0, max) : cargo
  const hidden = cargo.length - shown.length
  const empties =
    vehicle.capacity === null ? 0 : Math.max(0, vehicle.capacity - cargo.length)

  if (cargo.length === 0 && empties === 0) {
    return <p className="text-ink-faint text-xs italic">Der Laderaum ist leer.</p>
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      {shown.map((item) => {
        const good = ctx.goodsById.get(item.goodId)
        return (
          <Crate
            key={item.uid}
            number={item.goodId}
            category={good?.category ?? 'agrar'}
            size={size}
            label={good?.name}
          />
        )
      })}

      {hidden > 0 && (
        <span className="tnum text-ink-soft ml-0.5 text-xs">+{hidden}</span>
      )}

      {Array.from({ length: Math.min(empties, 8) }, (_, i) => (
        <span
          key={`empty-${i}`}
          className="border-ink-soft/35 inline-block rounded-[2px] border border-dashed"
          style={{ width: size * 0.85, height: size * 0.7 }}
          aria-hidden
        />
      ))}
    </div>
  )
}
