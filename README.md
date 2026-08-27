# Von Kontinent zu Kontinent

A digital edition of the German board game of the import and export trade
(Stomo Spiele). Runs in the browser, on a phone as at a desk, installable as a
PWA, playable offline.

The game keeps its German title because it never had an English one — it was
published in German and only in German. Everything else can be read in either
language: pick **Deutsch** or **English** on the title page or under Settings,
and the whole thing follows, cards and reports and notifications included. The
rules, the register of goods and the card decks are taken from the originals;
they are summarised in [`rules.md`](rules.md) (in German).

**Play:** <https://von-kontinent-zu-kontinent.toladner.workers.dev>

The same address serves both the game and the table server — a Cloudflare
Worker with one Durable Object per game, running the same reducer the browser
does.

## Getting started

```bash
npm install
npm run dev            # http://localhost:5173
npm run dev -- --host  # also on the local network, for testing on a phone
```

| Command | Does |
| --- | --- |
| `npm run dev` | Development server |
| `npm test` | Rules and interface tests |
| `npm run typecheck` | Check TypeScript |
| `npm run build` | Static files into `dist/` |
| `npm run preview` | Look at the built files locally |
| `npm run server` | Table server for networked games |
| `npm run test:server` | Multiplayer run against the running server |
| `npm run deploy` | Build and publish |
| `node scripts/build-land.mjs` | Regenerate the continent outlines |

## Playing with others

A game can be played round one device or across several. For the second case a
small table server runs alongside — a Cloudflare Worker with one Durable
Object per game.

```bash
npm run server        # table server on :8787
npm run dev           # game on :5173, /api is proxied through
npm run test:server   # two players, one game, no browser
```

Whoever opens the table gets a four-character code; the others type it on the
entrance page or follow the invitation link. The server holds only the list of
moves — it decides whose turn it is and passes the moves on. The rules run in
the same reducer as in the browser; there is no second implementation of the
rulebook.

A game keeps: close the window, come back later, and you are in the same seat.
If “at any time” was chosen when the table was opened, latecomers may still
take a ship.

## Sailing in real time

Instead of throwing dice you can set a course and let the ship sail. A passage
takes real time — how much is set by the “sailing time per mark” slider when
the game is arranged. Set a course, go away, look again later.

The ships sail on whether or not anyone is watching: the table server wakes
itself for the next thing due to happen. There is no turn order any more;
everyone trades when they like. The world market turns a card at a fixed
interval, and it holds for everyone until the next one falls.

## The language

German is the original and English is the translation, which shows in small
places. Goods keep their card numbers from the printed Warenverzeichnis and
gain an English name beside the German one; harbours keep the board's own
spelling except where English trade had a settled name of its own, so Genua is
Genoa and Kopenhagen is Copenhagen, but Spalato, Batavia and Vera Cruz stand as
printed.

The phrases live in [`src/i18n/strings/`](src/i18n/strings/) as `{ de, en }`
pairs, so a line cannot be added in one language without the other — the type
checker refuses it. A test additionally checks that both halves fill the same
`{holes}`, which is the mistake that otherwise reaches a player.

At a table played across several devices each seat reads in its own language:
refusals and notifications travel as keys and become words at the edge, in the
language of whoever is looking.

## Playing

Type a name, press “Go aboard” — that is all. The name becomes a merchant
house with a rank, a home counting house and an engraved portrait; the same
name always yields the same merchant.

The entrance page offers three ways in: **Classic** (original rules, straight
off), **Full** (board, length, capital, one device or several) and **Join a
table** (a code and a name).

A local game is saved in the browser and offered again next time; networked
games live on the table server.

## Publishing

One command publishes the game and the table server together.

```bash
npm run deploy   # builds and publishes game + table server as one
```

`wrangler deploy` serves the static files and the table server from a single
address; it needs `npx wrangler login` once.

Without multiplayer a purely static host will do (`npm run build`, then upload
`dist/` — Netlify, Vercel, GitHub Pages, any web space). That leaves out the
table server, so only one device can play.

## How it is put together

In short: the rulebook is a pure reducer over a seeded random number
generator, cards and goods are data, and the interface knows nothing of rules.

At length in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — which also says
where to start for time-based sailing instead of dice, further cards and
additional goods.

```
src/engine/    Rules, pure, no DOM
src/content/   Goods, market cards, boards
src/i18n/      The phrase table, in German and English
src/ui/        Presentation
src/app/       Store, saved games, connection
server/        Table server (Cloudflare Worker + Durable Object)
rules.md       The original rules, summarised (German)
```

## Sources

Continent outlines: Natural Earth 1:110m via `world-atlas`, public domain.
