# Von Kontinent zu Kontinent

Eine digitale Fassung des Gesellschaftsspiels um den Import- und Exporthandel
(Stomo Spiele). Läuft im Browser, auf dem Telefon wie am Schreibtisch,
installierbar als PWA, offline spielbar.

Die Spielsprache ist Deutsch. Regeln, Warenverzeichnis und Kartensätze sind
den Originalen entnommen; die Regeln stehen zusammengefaßt in
[`rules.md`](rules.md).

## Loslegen

```bash
npm install
npm run dev            # http://localhost:5173
npm run dev -- --host  # zusätzlich im WLAN, zum Testen am Telefon
```

| Befehl | Tut |
| --- | --- |
| `npm run dev` | Entwicklungsserver |
| `npm test` | Regelwerk- und Oberflächentests |
| `npm run typecheck` | TypeScript prüfen |
| `npm run build` | Statische Dateien nach `dist/` |
| `npm run preview` | Gebaute Dateien lokal ansehen |
| `npm run server` | Partieserver für Netzpartien |
| `npm run test:server` | Mehrspieler-Durchlauf gegen den laufenden Server |
| `npm run deploy` | Bauen und veröffentlichen |
| `node scripts/build-land.mjs` | Kontinentumrisse neu erzeugen |

## Zu mehreren spielen

Eine Partie kann an einem Gerät reihum gespielt werden oder über mehrere
Geräte hinweg. Für den zweiten Fall läuft ein kleiner Partieserver mit —
ein Cloudflare Worker mit je einem Durable Object pro Partie.

```bash
npm run server   # Partieserver auf :8787
npm run dev      # Spiel auf :5173, /api wird durchgereicht
npm run test:server   # Zwei Spieler, eine Partie, ohne Browser
```

Wer eröffnet, bekommt einen vierstelligen Code; die anderen geben ihn auf der
Eingangsseite ein oder folgen dem Einladungslink. Der Server hält nur die
Zugliste — er entscheidet, wer am Zug ist, und verteilt die Züge weiter. Die
Regeln laufen dabei im selben Reducer wie im Browser, es gibt keine zweite
Umsetzung des Regelwerks.

Eine Partie bleibt liegen: wer das Fenster schließt und später zurückkommt,
sitzt wieder auf demselben Platz. Wird beim Eröffnen „jederzeit" gewählt,
dürfen auch Nachzügler noch ein Schiff nehmen.

## Echtzeitfahrt

Statt zu würfeln kann man Kurs setzen und das Schiff fahren lassen. Eine
Überfahrt dauert echte Zeit — wie lange, bestimmt der Regler „Fahrzeit je
Punkt" beim Einrichten. Man setzt Kurs, geht weg, und sieht später nach.

Die Schiffe fahren auch dann weiter, wenn niemand zusieht: der Partieserver
weckt sich selbst zum nächsten Ereignis. Es gibt keine Reihenfolge mehr, jeder
handelt, wann er mag. Der Weltmarkt dreht in festem Takt eine Konjunkturkarte,
die für alle gilt, bis die nächste fällt.

## Spielen

Name eintragen, „An Bord gehen“ — mehr nicht. Aus dem Namen entsteht ein
Handelshaus samt Rang, Heimatkontor und gestochenem Porträt; derselbe Name
ergibt immer denselben Kaufmann.

Auf der Eingangsseite stehen drei Wege: **Klassisch** (Originalregeln, sofort
los), **Vollständig** (Plan, Dauer, Kapital, ein Gerät oder mehrere) und
**Partie beitreten** (nur Code und Name).

Der Spielstand einer örtlichen Partie liegt im Browser und wird beim nächsten
Aufruf angeboten; Netzpartien liegen beim Partieserver.

## Veröffentlichen

Ein Befehl veröffentlicht Spiel und Partieserver gemeinsam.

```bash
npm run deploy   # baut und veröffentlicht Spiel + Partieserver zusammen
```

`wrangler deploy` stellt die statischen Dateien und den Partieserver unter
einer Adresse bereit; dafür ist einmalig `npx wrangler login` nötig.

Ohne Mehrspielerbetrieb genügt auch eine rein statische Ablage
(`npm run build`, dann `dist/` hochladen — Netlify, Vercel, GitHub Pages,
beliebiger Webspace). Dann fehlt allerdings der Partieserver, und es kann nur
an einem Gerät gespielt werden.

## Aufbau

Kurz: das Regelwerk ist ein reiner Reducer über einem gesäten Zufallsgenerator,
Karten und Waren sind Daten, die Oberfläche weiß nichts von Regeln.

Ausführlich in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — dort steht
auch, wo man ansetzt für zeitbasierte Seefahrt statt Würfel, weitere Karten
und zusätzliche Waren.

```
src/engine/    Regeln, rein, ohne DOM
src/content/   Waren, Konjunkturkarten, Spielpläne
src/ui/        Darstellung
src/app/       Store, Speicherstand, Verbindung
server/        Partieserver (Cloudflare Worker + Durable Object)
rules.md       Die Regeln des Originals, zusammengefaßt
```

## Quellen

Kontinentumrisse: Natural Earth 1:110m über `world-atlas`, gemeinfrei.
