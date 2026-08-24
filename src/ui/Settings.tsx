import { useState } from 'react'
import { Sheet, type SheetSnap } from './Sheet'
import { NotifyCheck } from './NotifyCheck'
import { ShareRow } from './Lobby'
import type { NetState } from '@app/store'
import type { GameState } from '@engine/state'

/**
 * The one place that is about the app rather than about the game.
 *
 * Everything here was previously either unreachable or hidden at the bottom of
 * a sheet about something else. Meldungen could only be answered once, on the
 * names screen, and never revisited. Leaving a game meant finding the red
 * button under the round track. And there was no way at all to go back to the
 * title page without giving the game up — which mattered enormously once the
 * app started walking itself back into the last table.
 *
 * The two ways out are deliberately not the same button. Leaving keeps the
 * seat and the save; abandoning throws both away. A player who wants the first
 * and gets the second has lost a game, so they are worded and weighted apart.
 */
export function SettingsSheet({
  state,
  net,
  snap,
  onSnap,
  onLeave,
  onAbandon,
}: {
  state: GameState
  net: NetState | null
  snap: SheetSnap
  onSnap: (s: SheetSnap) => void
  onLeave: () => void
  onAbandon: () => void
}) {
  const [confirming, setConfirming] = useState(false)
  const realtime = state.config.travel === 'echtzeit'

  return (
    <Sheet snap={snap} onSnap={onSnap} title="Einstellungen" subtitle="Meldungen und diese Partie">
      <Group title="Meldungen">
        <p className="text-ink-soft text-[12px] leading-snug">
          {realtime
            ? 'Die Schiffe fahren weiter, während Sie anderes tun. Eine Meldung sagt Ihnen, wenn eines angelegt hat.'
            : 'In der Würfelpartie bewegt sich nichts ohne Wurf, es gibt also wenig zu melden. Die Einstellung gilt trotzdem für die nächste Echtzeitpartie.'}
        </p>
        <NotifyCheck />
      </Group>

      <Group title="Diese Partie">
        {net ? (
          <>
            <dl className="teletype space-y-1 text-[13px]">
              <Row label="Tisch" value={net.code} />
              <Row
                label="Leitung"
                value={
                  net.status === 'verbunden'
                    ? 'steht'
                    : net.status === 'verbindet'
                      ? 'wird gelegt'
                      : 'unterbrochen'
                }
              />
              <Row label="Am Tisch" value={`${net.online.length} von ${state.players.length}`} />
            </dl>
            <ShareRow code={net.code} />
          </>
        ) : (
          <p className="text-ink-soft text-[12px] leading-snug">
            An einem Gerät gespielt. Der Spielstand liegt hier auf dem Gerät und wird nach jedem
            Zug fortgeschrieben.
          </p>
        )}
      </Group>

      <Group title="Verlassen">
        <button className="btn w-full" onClick={onLeave}>
          Zum Titelbild
        </button>
        <p className="text-ink-faint mt-1.5 text-[12px] leading-snug">
          {net
            ? 'Die Partie läuft weiter und Ihr Platz bleibt Ihrer. Beim nächsten Öffnen sind Sie von selbst wieder an Bord.'
            : 'Der Spielstand bleibt erhalten. Auf der Eingangsseite steht »Angefangene Partie fortsetzen«.'}
        </p>

        {confirming ? (
          <button className="btn btn-danger mt-4 w-full" onClick={onAbandon}>
            Wirklich aufgeben — alles verwerfen
          </button>
        ) : (
          <button className="btn btn-danger mt-4 w-full" onClick={() => setConfirming(true)}>
            Partie aufgeben
          </button>
        )}
        <p className="text-ink-faint mt-1.5 text-[12px] leading-snug">
          {net
            ? 'Gibt Ihren Platz an diesem Tisch auf. Zurück kämen Sie nur als neuer Mitspieler.'
            : 'Löscht den Spielstand. Das läßt sich nicht rückgängig machen.'}
        </p>
      </Group>
    </Sheet>
  )
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6 first:mt-0">
      <h3 className="smallcaps text-ink-soft mb-2 text-[11px] tracking-[0.2em]">{title}</h3>
      {children}
    </section>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="smallcaps text-ink-soft">{label}</dt>
      <dd className="tnum font-bold">{value}</dd>
    </div>
  )
}
