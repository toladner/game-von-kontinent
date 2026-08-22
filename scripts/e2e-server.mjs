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
console.log(process.exitCode ? '\nSOME CHECKS FAILED' : '\nALL CHECKS PASSED')
