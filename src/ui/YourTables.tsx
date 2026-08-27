import { useEffect, useMemo, useState } from 'react'
import { forgetSeat, knownTables, tableInfo, type KnownTable, type TableInfo } from '@app/net'
import { useT } from '@app/locale'
import { Portrait } from './Portrait'
import { PLAYER_COLORS } from '@app/store'

/**
 * Every table this device is sitting at, on the entrance page.
 *
 * A house can be at three tables at once — one with the family, one with
 * people at work, one that has been going for a fortnight — and until now the
 * app remembered exactly one of them: the last. Getting back to any of the
 * others meant having written the four-character code down somewhere, which is
 * not a thing anybody does.
 *
 * The seats were always on the device; only the list was missing. So this is a
 * register rather than a feature: what it shows is what `knownTables` finds,
 * and tapping a line is the same join the code box performs, with the code
 * already filled in.
 *
 * Each table is asked once how it stands — who is seated, whether it has
 * finished — because "four merchants, still sailing" is what decides which
 * one to open, and a code alone decides nothing. Asked once on mount and not
 * polled: this is a page people pass through, not one they watch.
 */
export function YourTables({ onOpen }: { onOpen: (table: KnownTable) => void }) {
  const { t, tn, locale } = useT()
  const [tables, setTables] = useState<KnownTable[]>(() => knownTables())
  const [looked, setLooked] = useState<Record<string, TableInfo | null>>({})

  const codes = useMemo(() => tables.map((table) => table.code).join(','), [tables])

  useEffect(() => {
    if (tables.length === 0) return
    let alive = true
    void Promise.all(
      tables.map(async (table) => {
        const look = await tableInfo(table.code)
        return [table.code, look.ok ? look.info : null] as const
      }),
    ).then((rows) => {
      if (alive) setLooked(Object.fromEntries(rows))
    })
    return () => {
      alive = false
    }
    // Keyed on the codes rather than the array, which is rebuilt on every
    // render and would ask the server again each time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codes])

  if (tables.length === 0) return null

  const giveUp = (code: string) => {
    forgetSeat(code)
    setTables(knownTables())
  }

  return (
    <section className="mt-6">
      <h2 className="smallcaps text-ink-soft mb-2 text-[11px]">
        {t('tables.heading', { n: tables.length })}
      </h2>
      <ul className="space-y-2">
        {tables.map((table) => {
          const info = looked[table.code]
          const over = info?.phase === 'over'
          return (
            <li key={table.code} className="paper-card flex items-center gap-2.5 rounded-md p-2.5">
              <button
                type="button"
                className="focusable flex min-w-0 flex-1 items-center gap-2.5 text-left"
                onClick={() => onOpen(table)}
              >
                <span className="display tnum shrink-0 text-xl tracking-[0.15em]">
                  {table.code}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold">
                    {table.name || t('tables.unnamed')}
                  </span>
                  <span className="text-ink-soft block truncate text-[11px]">
                    {info === undefined
                      ? t('tables.asking')
                      : info === null
                        ? t('tables.noAnswer')
                        : over
                          ? t('tables.finished')
                          : tn('tables.seated', info.players.length)}
                  </span>
                </span>
              </button>

              {/* The other houses, so a table is recognisable by who is at it
                  rather than by four letters nobody memorises. */}
              {info && info.players.length > 0 && (
                <span className="flex shrink-0 -space-x-1.5">
                  {info.players.slice(0, 4).map((seat) => (
                    <span
                      key={seat.id}
                      className="border-paper block rounded-full border-2"
                      style={{
                        boxShadow: `0 0 0 1px ${
                          PLAYER_COLORS[seat.colorIndex % PLAYER_COLORS.length]!.ink
                        }`,
                      }}
                      title={seat.name}
                    >
                      <Portrait traits={seat.portrait} size={22} />
                    </span>
                  ))}
                </span>
              )}

              <button
                type="button"
                className="text-ink-faint hover:text-rot btn-sm shrink-0 px-1 text-xs leading-none"
                onClick={() => giveUp(table.code)}
                aria-label={t('tables.giveUp', { code: table.code })}
                lang={locale}
              >
                ✕
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
