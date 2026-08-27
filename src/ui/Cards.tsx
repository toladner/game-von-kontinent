import { konjunkturTenor } from '@engine/selectors'
import type { Good, KonjunkturCard } from '@engine/types'
import { GoodIcon } from './GoodIcon'
import { useT } from '@app/locale'
import { named } from '@i18n/locale'
import type { MsgKey } from '@i18n'

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
  const { t, num, locale } = useT()
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
      {/* The vignette sits where a stencil would be on the real crate, and
          the name and the two figures keep the weight — they are what the eye
          is hunting for; everything else on the card is a label. */}
      <div className="flex items-start gap-2.5">
        <GoodIcon goodId={good.id} size={38} className={disabled ? 'opacity-60' : ''} />

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="smallcaps press-green text-[15px] leading-tight font-bold">
              {named(good)[locale]}
            </span>
            {/* Die Nummer aus dem Warenverzeichnis — kein Bestand.
                Groß und in Pressgrün neben zwei Geldbeträgen las sie sich wie
                eine Menge: „Kaffee 29" klingt nach neunundzwanzig Sack. Klein,
                blaß und mit vorangestelltem Nº ist sie das, was sie ist: die
                Ordnungsnummer, unter der die Ware im Verzeichnis steht. */}
            <span
              className="display text-ink-faint shrink-0 text-[12px] leading-none"
              aria-label={t('card.number', { id: good.id })}
            >
              N<sup className="text-[8px]">o</sup> {good.id}
            </span>
          </div>

          <dl className="teletype mt-1.5 flex flex-wrap gap-x-5 gap-y-0.5 text-[13px]">
            <div className="flex items-baseline gap-1.5">
              <dt className="smallcaps text-ink-soft text-[11px]">{t('card.buy')}</dt>
              <dd className="tnum press-green font-bold">{num(good.buy)}</dd>
            </div>
            <div className="flex items-baseline gap-1.5">
              <dt className="smallcaps text-ink-soft text-[11px]">{t('card.sell')}</dt>
              <dd className={`tnum font-bold ${toneClass}`}>{num(price ?? good.sell)}</dd>
            </div>
          </dl>
        </div>
      </div>

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

/**
 * When and to whom a standing world card applies.
 *
 * The card face is the printed one, and it was written for a game where you
 * drew it yourself at a quayside. Left at that in real-time play it reads as a
 * bill with no date on it — which is exactly how it felt when the whole fleet
 * was charged the moment it turned. The card is unchanged; what it needs is a
 * line saying when it will reach you.
 *
 * Returns the key rather than the sentence, so the slip below can render it in
 * whichever language it is being read in.
 */
const STANDING: Partial<Record<KonjunkturCard['effects'][number]['kind'], MsgKey>> = {
  feeForDrawer: 'card.standing.feeForDrawer',
  payoutToDrawer: 'card.standing.payoutToDrawer',
  portFeeAllInPort: 'card.standing.portFeeAllInPort',
  leviedOnAllShips: 'card.standing.leviedOnAllShips',
  stormInRegion: 'card.standing.stormInRegion',
  cargoDamagedInRegion: 'card.standing.cargoDamagedInRegion',
  delayInRegion: 'card.standing.delayInRegion',
  goodPriceDelta: 'card.standing.goodPriceDelta',
  portClosed: 'card.standing.portClosed',
}

function standingNote(card: KonjunkturCard): MsgKey | null {
  for (const effect of card.effects) {
    const key = STANDING[effect.kind]
    if (key) return key
  }
  return null
}

export function KonjunkturSlip({
  card,
  standing = false,
}: {
  card: KonjunkturCard
  /** Turned for the whole world and in force until the next one. */
  standing?: boolean
}) {
  const { t, locale } = useT()
  const note = standing ? standingNote(card) : null
  // Good news on green paper, bad on red, and the cards that cut both ways on
  // the straw-coloured stock — the temper of the card before a word is read.
  const tenor = konjunkturTenor(card)
  return (
    <div className={`paper-slip slip-${tenor} coupon-edge w-full rotate-[-1.2deg] px-4 py-5`}>
      <p className="smallcaps text-center text-[10px] tracking-[0.3em] text-black/55">
        {t('card.heading')}
      </p>
      <hr className="my-2 border-t border-black/25" />
      <p className="display text-center text-xl">{card.title[locale]}</p>
      <div className="teletype mt-2 space-y-0.5 text-center text-[13px]">
        {card.lines[locale].map((line, i) => (
          <p key={i}>{line}</p>
        ))}
      </div>
      {note && (
        <>
          <hr className="mt-3 mb-2 border-t border-dashed border-black/20" />
          <p className="text-center text-[11px] leading-snug text-black/60">{t(note)}</p>
        </>
      )}
    </div>
  )
}
