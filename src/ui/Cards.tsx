import type { Good, KonjunkturCard } from '@engine/types'

const fmt = (n: number) => n.toLocaleString('de-DE')

/**
 * A Warenkarte, as the Exportbank issues it: tan card stock, green press,
 * number top right, EINKAUF over VERKAUF.
 */
export function Warenkarte({
  good,
  price,
  sublabel,
  tone = 'normal',
  disabled,
  onClick,
  action,
}: {
  good: Good
  /** Overrides the printed price, e.g. the current sale quote. */
  price?: number
  sublabel?: string
  tone?: 'normal' | 'gut' | 'schlecht'
  disabled?: boolean
  onClick?: () => void
  action?: string
}) {
  const Tag = onClick ? 'button' : 'div'
  const toneClass =
    tone === 'gut' ? 'text-press' : tone === 'schlecht' ? 'text-rot' : 'text-press'

  return (
    <Tag
      className={`paper-card focusable relative block w-full rounded-[2px] px-3 py-2 text-left transition ${
        onClick && !disabled ? 'hover:-translate-y-0.5 hover:shadow-md' : ''
      } ${disabled ? 'opacity-45' : ''}`}
      onClick={onClick}
      disabled={disabled}
      type={onClick ? 'button' : undefined}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="smallcaps press-green text-[13px] leading-tight font-semibold">
          {good.name}
        </span>
        <span className="display press-green text-xl leading-none">{good.id}</span>
      </div>

      <dl className="teletype mt-1.5 space-y-0.5 text-[11px]">
        <div className="flex justify-between gap-2">
          <dt className="smallcaps text-ink-soft">Einkauf</dt>
          <dd className="tnum press-green">{fmt(good.buy)}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="smallcaps text-ink-soft">Verkauf</dt>
          <dd className={`tnum ${toneClass}`}>{fmt(price ?? good.sell)}</dd>
        </div>
      </dl>

      {sublabel && <p className="text-ink-soft mt-1 text-[10px] leading-tight">{sublabel}</p>}

      {action && (
        <span className="smallcaps text-ink-soft absolute right-2 bottom-1.5 text-[10px]">
          {action}
        </span>
      )}
    </Tag>
  )
}

/** A Konjunkturkarte: pale green slip, typewriter face, scissor-cut edge. */
export function KonjunkturSlip({ card }: { card: KonjunkturCard }) {
  return (
    <div className="paper-slip coupon-edge mx-auto w-full max-w-xs rotate-[-1.2deg] px-4 py-5">
      <p className="smallcaps text-center text-[10px] tracking-[0.3em] text-black/55">
        Konjunkturkarte
      </p>
      <hr className="my-2 border-t border-black/25" />
      <p className="display text-center text-xl">{card.title}</p>
      <div className="teletype mt-2 space-y-0.5 text-center text-[12px]">
        {card.lines.map((line, i) => (
          <p key={i}>{line}</p>
        ))}
      </div>
    </div>
  )
}
