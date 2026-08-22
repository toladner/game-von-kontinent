/**
 * End-to-end check of the Partieserver: two clients, one table.
 * Run against `wrangler dev` on 8787.
 */
const BASE = 'http://127.0.0.1:8787'
const WSBASE = 'ws://127.0.0.1:8787'

const fail = (m) => {
  console.error('FAIL: ' + m)
  process.exitCode = 1
}
const ok = (m) => console.log('  ok  ' + m)

function client(code, label) {
  const ws = new WebSocket(`${WSBASE}/api/games/${code}/ws`)
  const inbox = []
  const waiters = []
  ws.addEventListener('message', (e) => {
    const msg = JSON.parse(e.data)
    inbox.push(msg)
    const w = waiters.shift()
    if (w) w(msg)
  })
  return {
    label,
    ws,
    inbox,
    open: () => new Promise((r) => ws.addEventListener('open', r, { once: true })),
    next: (timeout = 4000) =>
      new Promise((resolve, reject) => {
        if (inbox.length) return resolve(inbox.shift())
        const t = setTimeout(() => reject(new Error(`${label}: timeout`)), timeout)
        waiters.push((m) => {
          clearTimeout(t)
          resolve(m)
        })
      }),
    until: async (type, timeout = 4000) => {
      const deadline = Date.now() + timeout
      for (;;) {
        const m = await this_next()
        if (m.t === type) return m
        if (Date.now() > deadline) throw new Error(`${label}: never saw ${type}`)
      }
      function this_next() {
        if (inbox.length) return Promise.resolve(inbox.shift())
        return new Promise((resolve, reject) => {
          const t = setTimeout(() => reject(new Error(`${label}: timeout for ${type}`)), timeout)
          waiters.push((m) => {
            clearTimeout(t)
            resolve(m)
          })
        })
      }
    },
    // Wait for an append carrying a particular action type, skipping the
    // broadcasts of one's own earlier moves.
    untilAction: async function (type, timeout = 4000) {
      const deadline = Date.now() + timeout
      for (;;) {
        const m = await this.until('append', Math.max(200, deadline - Date.now()))
        if (m.actions.some((a) => a.type === type)) return m
        if (Date.now() > deadline) throw new Error(`${label}: never saw action ${type}`)
      }
    },
    send: (o) => ws.send(JSON.stringify(o)),
    close: () => ws.close(),
  }
}

const res = await fetch(`${BASE}/api/games`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ totalRounds: 20, startingCapital: 500000, joinPolicy: 'jederzeit' }),
})
if (!res.ok) {
  fail(`create returned ${res.status}`)
  process.exit(1)
}
const { code } = await res.json()
ok(`table opened, code ${code}`)

const info = await (await fetch(`${BASE}/api/games/${code}`)).json()
if (info.phase !== 'lobby') fail(`expected lobby, got ${info.phase}`)
else ok('info reports a lobby')

const ada = client(code, 'Ada')
await ada.open()
ada.send({ t: 'hello', name: 'Ada' })
const adaWelcome = await ada.until('welcome')
const adaId = adaWelcome.playerId
if (!adaId) fail('Ada was not seated')
else ok(`Ada seated as ${adaId}`)

const bo = client(code, 'Bo')
await bo.open()
bo.send({ t: 'hello', name: 'Bo' })
const boWelcome = await bo.until('welcome')
const boId = boWelcome.playerId
ok(`Bo seated as ${boId}`)

if (boWelcome.actions.length !== 2) {
  fail(`Bo should see 2 join actions, saw ${boWelcome.actions.length}`)
} else ok('Bo receives the whole log on arrival')

// Bo must not be able to start: Ada opened the table.
bo.send({ t: 'action', action: { type: 'start' } })
const refused = await bo.until('error')
if (!/eröffnet/i.test(refused.reason)) fail(`unexpected refusal: ${refused.reason}`)
else ok('a guest cannot cast off: ' + refused.reason)

ada.send({ t: 'action', action: { type: 'start' } })
const started = await bo.untilAction('start')
if (!started) fail('start was not broadcast')
else ok('start reaches the other device')

// Ada is first; Bo must wait his turn.
bo.send({ t: 'action', action: { type: 'endTurn' } })
const notYours = await bo.until('error')
if (!/am Zug/.test(notYours.reason)) fail(`unexpected turn error: ${notYours.reason}`)
else ok('turn order is enforced: ' + notYours.reason)

ada.send({ t: 'action', action: { type: 'endTurn' } })
await bo.until('append')
ok('Ada provisions and hands over')

bo.send({ t: 'action', action: { type: 'endTurn' } })
await ada.until('append')
ok('Bo provisions')

ada.send({ t: 'action', action: { type: 'roll' } })
const rolled = await bo.untilAction('roll')
if (!rolled) fail('roll not broadcast')
else ok('the dice reach both devices')

// A latecomer, because this table said "jederzeit".
const zoe = client(code, 'Zoe')
await zoe.open()
zoe.send({ t: 'hello', name: 'Zoe' })
const zoeWelcome = await zoe.until('welcome')
if (!zoeWelcome.playerId) fail('Zoe was refused despite joinPolicy jederzeit')
else ok(`a latecomer joins mid-game as ${zoeWelcome.playerId}`)

// Reconnect with the remembered token keeps the same seat.
const again = client(code, 'Ada-again')
await again.open()
again.send({ t: 'hello', token: adaWelcome.token })
const back = await again.until('welcome')
if (back.playerId !== adaId) fail(`token did not restore the seat: ${back.playerId}`)
else ok('a returning device keeps its seat')

// The log survives: a fresh spectator can rebuild everything.
const watcher = client(code, 'Zuschauer')
await watcher.open()
watcher.send({ t: 'hello' })
const seen = await watcher.until('welcome')
if (seen.playerId !== null) fail('spectator was given a seat')
else ok(`a spectator replays ${seen.actions.length} actions with no seat`)

for (const c of [ada, bo, zoe, again, watcher]) c.close()

// ---------------------------------------------------------------------------
// Real time: does the world turn without being asked?
// ---------------------------------------------------------------------------

const rt = await (
  await fetch(`${BASE}/api/games`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      travel: 'echtzeit',
      minutesPerPip: 0.02, // ~1.2 s a pip, so a test can watch a whole voyage
      durationHours: 1,
      joinPolicy: 'jederzeit',
    }),
  })
).json()
ok(`real-time table opened, code ${rt.code}`)

const cap = client(rt.code, 'Kapitän')
await cap.open()
cap.send({ t: 'hello', name: 'Kapitän' })
const capWelcome = await cap.until('welcome')
if (capWelcome.meta.travel !== 'echtzeit') fail('table is not real-time')
else ok('the table runs on a clock, not a round track')

cap.send({ t: 'action', action: { type: 'start' } })
await cap.untilAction('start')

const before = await (await fetch(`${BASE}/api/games/${rt.code}`)).json()
const homePort = before.players[0].at
ok(`season opened, ship lying at ${homePort}`)

const CANDIDATES = [
  'hamburg', 'london', 'lissabon', 'newyork', 'habana', 'dakar',
  'kapstadt', 'buenosaires', 'riodejaneiro', 'valparaiso', 'sanfrancisco', 'daressalam',
]
const destination = CANDIDATES.find((c) => c !== homePort)
cap.send({ t: 'action', action: { type: 'setCourse', to: destination, by: capWelcome.playerId } })
await cap.untilAction('setCourse')
ok(`course laid in for ${destination}`)

// Trading is refused while the ship is at sea.
cap.send({ t: 'action', action: { type: 'buy', goodId: 4, by: capWelcome.playerId } })
const atSea = await cap.until('error')
if (!/See|Hafen/i.test(atSea.reason)) fail(`unexpected sea error: ${atSea.reason}`)
else ok('no trading from the open sea: ' + atSea.reason)

// Now sit in silence. Nothing is sent; the arrival has to come to us, which
// only happens if the server woke itself up.
ok('going quiet — the client sends nothing from here on')
const arrival = await cap.untilAction('tick', 90_000)
if (!arrival) fail('no unsolicited tick ever arrived')
else ok('the server woke by itself and pushed the clock forward')

const after = await (await fetch(`${BASE}/api/games/${rt.code}`)).json()
if (after.players[0].at !== destination) {
  fail(`ship did not arrive: still at ${after.players[0].at}`)
} else {
  ok(`the ship made ${destination} without anyone asking it to`)
}
if (after.players[0].destination !== null) fail('the voyage did not close out')
else ok('the voyage is complete and the ship lies in harbour')

cap.close()

// ---------------------------------------------------------------------------
// Sicht "realistisch": does the wire itself keep the secret?
// ---------------------------------------------------------------------------

const fog = await (
  await fetch(`${BASE}/api/games`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      travel: 'echtzeit',
      sicht: 'realistisch',
      minutesPerPip: 0.02,
      durationHours: 2,
    }),
  })
).json()
ok(`fog table opened, code ${fog.code}`)

const one = client(fog.code, 'Ada')
await one.open()
one.send({ t: 'hello', name: 'Ada' })
const oneWelcome = await one.until('welcome')

const two = client(fog.code, 'Bo')
await two.open()
two.send({ t: 'hello', name: 'Bo' })
const twoWelcome = await two.until('welcome')

// The log is the truth, so under fog it must not be handed out at all.
if (oneWelcome.actions.length !== 0 || twoWelcome.actions.length !== 0) {
  fail('the action log was sent to a seat under fog')
} else {
  ok('no action log is sent to a seat under fog')
}

const firstView = await two.until('view')
if (!firstView.state) fail('no projected view was sent')
else ok('each seat is sent a projected state instead')

one.send({ t: 'action', action: { type: 'start' } })
await one.until('view')

const fogInfo = await (await fetch(`${BASE}/api/games/${fog.code}`)).json()
if (fogInfo.players[0].at !== null) fail('/info leaks positions under fog')
else ok('/info reports no positions under fog')

// Ada sails. Bo must not be able to find out where she went.
one.send({
  t: 'action',
  action: { type: 'setCourse', to: 'kapstadt', by: oneWelcome.playerId },
})
await one.until('view')
await new Promise((r) => setTimeout(r, 4000))

async function viewFor(token) {
  const probe = client(fog.code, 'probe')
  await probe.open()
  probe.send({ t: 'hello', token })
  await probe.until('welcome')
  const v = await probe.until('view')
  probe.close()
  return v.state
}

const adaView = await viewFor(oneWelcome.token)
const adaSelf = adaView.players.find((p) => p.id === oneWelcome.playerId)
const adaShip = adaSelf.fleet.find((v) => v.id === adaSelf.aboard)
const adaTruePosition = adaShip.nodeId
ok(`Ada's own view puts her at ${adaTruePosition}`)

const boView = await viewFor(twoWelcome.token)
const boSeesAda = boView.players.find((p) => p.id === oneWelcome.playerId)

if (!boSeesAda.fleet.every((v) => v.hidden)) fail("Bo can see Ada's ships")
else ok("Ada's vessels are marked hidden in Bo's view")

// The decisive check: her real position must not be in the bytes Bo receives.
const boBytes = JSON.stringify(boView)
const leaked =
  boSeesAda.fleet.some((v) => v.nodeId === adaTruePosition) ||
  (adaTruePosition.startsWith('sea:') && boBytes.includes(adaTruePosition))

if (leaked) fail(`Ada's true position ${adaTruePosition} is present in Bo's payload`)
else ok("Ada's true position is nowhere in the bytes sent to Bo")

if (boSeesAda.knowledge.read.length === 0 && boSeesAda.knowledge.notebook === '') {
  ok("Ada's letters and notebook are not in Bo's payload")
} else {
  fail("Ada's private papers reached Bo")
}

one.close()
two.close()
console.log(process.exitCode ? '\nSOME CHECKS FAILED' : '\nALL CHECKS PASSED')
