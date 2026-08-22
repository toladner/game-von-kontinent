# Von Kontinent zu Kontinent

Eine digitale Fassung des Gesellschaftsspiels um den Import- und Exporthandel
(Stomo Spiele). Läuft im Browser, auf dem Telefon wie am Schreibtisch,
installierbar als PWA, offline spielbar.

Die Spielsprache ist Deutsch. Regeln, Warenverzeichnis und Kartensätze sind
den Originalen in [`based/`](based/) entnommen.

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
| `node scripts/build-land.mjs` | Kontinentumrisse neu erzeugen |

## Spielen

Name eintragen, „An Bord gehen“ — mehr nicht. Aus dem Namen entsteht ein
Handelshaus samt Rang, Heimatkontor und gestochenem Porträt; derselbe Name
ergibt immer denselben Kaufmann.

Gespielt wird reihum an einem Gerät (Hotseat). Der Spielstand liegt im
Browser und wird beim nächsten Aufruf angeboten.

## Veröffentlichen

Das Ergebnis ist eine rein statische Seite (`dist/`), ohne Server, ohne
Datenbank. `base` steht auf `./`, die Dateien laufen daher unter jedem Pfad.

```bash
npm run build
```

- **Cloudflare Pages / Netlify / Vercel** — Repository verbinden,
  Build-Befehl `npm run build`, Ausgabeverzeichnis `dist`.
- **GitHub Pages** — `dist/` in den Branch `gh-pages` schieben.
- **Irgendein Webspace** — Inhalt von `dist/` hochladen.

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
src/app/       Store, Speicherstand
based/         Anleitung und Scans des Originalspiels
```

## Quellen

Kontinentumrisse: Natural Earth 1:110m über `world-atlas`, gemeinfrei.
