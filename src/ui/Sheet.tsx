import { useEffect, useRef, type ReactNode } from 'react'

export type SheetSnap = 'closed' | 'peek' | 'full'

/**
 * How tall each level stands, as a share of the viewport. The stylesheet
 * holds the same numbers; these are here so a release can work out which
 * level the thumb ended up nearest to.
 */
const SHARE: Record<SheetSnap, number> = { closed: 0, peek: 0.42, full: 0.86 }

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

function snapHeights(): Record<SheetSnap, number> {
  const h = typeof window === 'undefined' ? 800 : window.innerHeight
  return { closed: 0, peek: SHARE.peek * h, full: SHARE.full * h }
}

/**
 * Which level a released drag belongs to.
 *
 * Nearest wins, rather than "did it move more than 40px in some direction":
 * a long haul upwards from a peek should land on full, and a long haul down
 * from full should close rather than stopping halfway because the first
 * threshold it crossed said so.
 */
export function nearestSnap(heightPx: number, viewport?: number): SheetSnap {
  const h = viewport ?? (typeof window === 'undefined' ? 800 : window.innerHeight)
  const levels: SheetSnap[] = ['closed', 'peek', 'full']
  return levels.reduce((best, level) =>
    Math.abs(SHARE[level] * h - heightPx) < Math.abs(SHARE[best] * h - heightPx) ? level : best,
  )
}

/**
 * The one panel the game speaks through.
 *
 * On a phone it is a bottom sheet you can drag between a peek and a full
 * view; on a wide screen the same content becomes a side rail. Keeping it to
 * a single surface is what stops the board being buried under panels.
 */
export function Sheet({
  snap,
  onSnap,
  title,
  subtitle,
  accent,
  children,
  footer,
}: {
  snap: SheetSnap
  onSnap: (snap: SheetSnap) => void
  title: string
  subtitle?: string
  accent?: string
  children: ReactNode
  footer?: ReactNode
}) {
  const asideRef = useRef<HTMLElement | null>(null)
  const drag = useRef<{ y: number; height: number; moved: boolean } | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      onSnap(snap === 'full' ? 'peek' : 'closed')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [snap, onSnap])

  /**
   * The gesture moves the sheet's height, not its position.
   *
   * Translating it upwards used to leave a strip of board showing underneath,
   * so the travel had to be clamped to a token 70px and the thing barely
   * budged. Growing it from the bottom edge is what a sheet actually does:
   * it follows the thumb the whole way, in both directions, and never comes
   * unstuck from the foot of the screen.
   */
  const onPointerDown = (e: React.PointerEvent) => {
    try {
      ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
    } catch {
      /* capture is a nicety, not a requirement */
    }
    const el = asideRef.current
    // Start from where the sheet actually stands; if the browser will not say
    // — mid-animation, or in a test — from where this level is meant to be.
    drag.current = {
      y: e.clientY,
      height: el?.offsetHeight || snapHeights()[snap],
      moved: false,
    }
    if (el) el.style.transition = 'none'
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current
    const el = asideRef.current
    if (!d || !el) return
    const dy = e.clientY - d.y
    if (Math.abs(dy) > 6) d.moved = true
    el.style.height = `${clamp(d.height - dy, 0, snapHeights().full)}px`
  }

  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current
    const el = asideRef.current
    if (!d) return
    drag.current = null

    if (el) {
      el.style.transition = ''
      // Hand the height back to the stylesheet; the transition carries it
      // from wherever the thumb left it to whichever level wins.
      el.style.height = ''
    }

    // A tap on the grip is a perfectly good way to ask for more room.
    if (!d.moved) return onSnap(snap === 'full' ? 'peek' : 'full')

    onSnap(nearestSnap(clamp(d.height - (e.clientY - d.y), 0, snapHeights().full)))
  }

  if (snap === 'closed') return null

  return (
    <aside
      ref={asideRef}
      className="paper anim-sheet sheet fixed inset-x-0 bottom-0 z-30 flex flex-col rounded-t-xl border-t border-black/25 shadow-[0_-8px_28px_rgb(0_0_0/0.35)] lg:inset-y-0 lg:right-0 lg:left-auto lg:w-[400px] lg:rounded-none lg:rounded-l-xl lg:border-t-0 lg:border-l lg:shadow-[-8px_0_28px_rgb(0_0_0/0.3)]"
      style={
        {
          // The rail on a wide screen ignores this and fills its column;
          // see the media query beside .sheet.
          '--sheet-h': snap === 'full' ? '86dvh' : '42dvh',
          paddingBottom: 'var(--safe-b)',
        } as React.CSSProperties
      }
      aria-label={title}
    >
      {/* Griff — groß genug für einen Daumen, und ein Tippen genügt auch. */}
      <div
        role="button"
        tabIndex={0}
        aria-label={snap === 'full' ? 'Verkleinern' : 'Vergrößern'}
        className="grid shrink-0 cursor-grab touch-none place-items-center px-4 py-3 active:cursor-grabbing lg:hidden"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') onSnap(snap === 'full' ? 'peek' : 'full')
        }}
      >
        <span className="block h-1.5 w-12 rounded-full bg-black/30" />
      </div>

      <header className="flex shrink-0 items-center gap-3 px-4 pt-0 pb-2 lg:pt-4">
        {accent && (
          <span
            className="h-8 w-1.5 shrink-0 rounded-full"
            style={{ background: accent }}
            aria-hidden
          />
        )}
        <div className="min-w-0 flex-1">
          <h2 className="display letterpress truncate text-xl leading-tight">{title}</h2>
          {subtitle && <p className="text-ink-soft truncate text-xs italic">{subtitle}</p>}
        </div>
        <button
          className="btn btn-sm !px-2 !py-0.5 text-xs lg:hidden"
          onClick={() => onSnap(snap === 'full' ? 'peek' : 'full')}
          aria-label={snap === 'full' ? 'Verkleinern' : 'Vergrößern'}
        >
          {snap === 'full' ? '▾' : '▴'}
        </button>
        {/* The rail is always full height, so collapsing it means nothing —
            what a wide screen needs is a way to put it away entirely. */}
        <button
          className="btn btn-sm hidden !px-2 !py-0.5 text-xs lg:block"
          onClick={() => onSnap('closed')}
          aria-label="Schließen"
        >
          ✕
        </button>
      </header>

      <hr className="rule mx-4 shrink-0" />

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3">{children}</div>

      {footer && (
        <div className="shrink-0 border-t border-black/15 px-4 py-3">{footer}</div>
      )}
    </aside>
  )
}

/** Segmented control — one thing on screen at a time. */
export function Tabs<T extends string>({
  value,
  onChange,
  items,
}: {
  value: T
  onChange: (v: T) => void
  items: readonly { readonly id: T; readonly label: string; readonly badge?: number }[]
}) {
  return (
    <div
      className="mb-3 flex gap-1 rounded-sm border border-black/20 bg-black/5 p-1"
      role="tablist"
    >
      {items.map((item) => {
        const active = item.id === value
        return (
          <button
            key={item.id}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.id)}
            className={`smallcaps btn-sm flex-1 rounded-[2px] px-1 text-[11px] transition ${
              active
                ? 'bg-paper text-ink shadow-[0_1px_2px_rgb(0_0_0/0.2)]'
                : 'text-ink-soft hover:bg-black/5'
            }`}
          >
            {item.label}
            {item.badge !== undefined && item.badge > 0 && (
              <span className="tnum ml-1 text-[10px] opacity-70">{item.badge}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
