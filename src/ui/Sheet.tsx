import { useEffect, useRef, type ReactNode } from 'react'

export type SheetSnap = 'closed' | 'peek' | 'full'

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
  const drag = useRef<{ y: number; from: SheetSnap; moved: boolean } | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && snap === 'full') onSnap('peek')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [snap, onSnap])

  const height = snap === 'full' ? '86dvh' : snap === 'peek' ? '42dvh' : '0dvh'

  /**
   * The gesture is driven straight at the element rather than through React
   * state: a re-render per pointermove is both janky and easy to get wrong,
   * and the previous version read a stale value on release.
   */
  const onPointerDown = (e: React.PointerEvent) => {
    try {
      ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
    } catch {
      /* capture is a nicety, not a requirement */
    }
    drag.current = { y: e.clientY, from: snap, moved: false }
    if (asideRef.current) asideRef.current.style.transition = 'none'
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d) return
    const dy = e.clientY - d.y
    if (Math.abs(dy) > 6) d.moved = true
    if (asideRef.current) {
      asideRef.current.style.transform = `translateY(${Math.max(-70, dy)}px)`
    }
  }

  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d) return
    drag.current = null
    const dy = e.clientY - d.y

    if (asideRef.current) {
      asideRef.current.style.transform = ''
      asideRef.current.style.transition = ''
    }

    // A tap on the grip is a perfectly good way to ask for more room.
    if (!d.moved) {
      onSnap(d.from === 'full' ? 'peek' : 'full')
      return
    }
    if (dy < -40) onSnap('full')
    else if (dy > 40) onSnap(d.from === 'full' ? 'peek' : 'closed')
  }

  if (snap === 'closed') return null

  return (
    <aside
      ref={asideRef}
      className="paper anim-sheet sheet fixed inset-x-0 bottom-0 z-30 flex flex-col rounded-t-xl border-t border-black/25 shadow-[0_-8px_28px_rgb(0_0_0/0.35)] lg:inset-y-0 lg:right-0 lg:left-auto lg:w-[400px] lg:rounded-none lg:rounded-l-xl lg:border-t-0 lg:border-l lg:shadow-[-8px_0_28px_rgb(0_0_0/0.3)]"
      style={{ height, paddingBottom: 'var(--safe-b)' }}
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
