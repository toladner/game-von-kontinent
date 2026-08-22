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
      className={`focusable block w-full rounded-[2px] px-3 py-2 text-left transition ${
        disabled ? 'card-dead' : 'paper-card'
      } ${onClick && !disabled ? 'hover:-translate-y-0.5 hover:shadow-md' : ''}`}
      onClick={onClick}
      disabled={disabled}
      type={onClick ? 'button' : undefined}
    >
      {/* The name and the two figures are what the eye is hunting for, so
          they carry the weight; everything else on the card is a label. */}
      <div className="flex items-baseline justify-between gap-2">
        <span className="smallcaps press-green text-[15px] leading-tight font-bold">
          {good.name}
        </span>
        <span className="display press-green text-xl leading-none">{good.id}</span>
      </div>

      <dl className="teletype mt-1.5 flex flex-wrap gap-x-5 gap-y-0.5 text-[13px]">
        <div className="flex items-baseline gap-1.5">
          <dt className="smallcaps text-ink-soft text-[11px]">Einkauf</dt>
          <dd className="tnum press-green font-bold">{fmt(good.buy)}</dd>
        </div>
        <div className="flex items-baseline gap-1.5">
          <dt className="smallcaps text-ink-soft text-[11px]">Verkauf</dt>
          <dd className={`tnum font-bold ${toneClass}`}>{fmt(price ?? good.sell)}</dd>
        </div>
      </dl>

      {/* Reason and call to action share a row, so neither can sit on top of
          the other however long the reason runs. */}
      {(sublabel || action) && (
        <div className="mt-1.5 flex items-end justify-between gap-2">
          <p className="text-ink-soft min-w-0 flex-1 text-[12px] leading-tight">{sublabel}</p>
          {action && (
            <span className="smallcaps bg-ink/85 text-paper shrink-0 rounded-[2px] px-2 py-1 text-[11px] leading-none font-semibold">
              {action}
            </span>
          )}
        </div>
      )}
    </Tag>
  )
}

/** A Konjunkturkarte: pale green slip, typewriter face, scissor-cut edge. */
export function KonjunkturSlip({ card }: { card: KonjunkturCard }) {
  return (
    <div className="paper-slip coupon-edge w-full rotate-[-1.2deg] px-4 py-5">
      <p className="smallcaps text-center text-[10px] tracking-[0.3em] text-black/55">
        Konjunkturkarte
      </p>
      <hr className="my-2 border-t border-black/25" />
      <p className="display text-center text-xl">{card.title}</p>
      <div className="teletype mt-2 space-y-0.5 text-center text-[13px]">
        {card.lines.map((line, i) => (
          <p key={i}>{line}</p>
        ))}
      </div>
    </div>
  )
}
