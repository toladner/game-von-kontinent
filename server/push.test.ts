import { afterEach, describe, expect, it, vi } from 'vitest'
/**
 * The crypto here is the one part of the game nothing can check by eye: a
 * message sealed with the two public keys in the wrong order is perfectly
 * valid, encrypts and sends without complaint, and simply never appears on
 * anybody's telephone. So the test plays the browser's part — it generates a
 * subscription the way `pushManager.subscribe` would, and decrypts what the
 * server produced. If the round trip closes, the bytes are right.
 */
import { b64, sealed, sendPush, unb64, vapidToken, type PushSub, type Vapid } from './push'

// Cloudflare's type shim spells ECDH's counterpart key `$public`; the runtime
// wants `public`. Same disagreement as in `push.ts`, same one-line answer.
const ecdhWith = (key: CryptoKey) =>
  ({ name: 'ECDH', public: key }) as unknown as Parameters<SubtleCrypto['deriveBits']>[0]

const NUL = String.fromCharCode(0)
const bytes = new TextEncoder()

const vapid: Vapid = {
  publicKey: 'BPnt9drJNcmXVhyPa9bgck02XIDTt-bizjP1CWBn8u49g_kKzfbBvBUn4VzJY-PI7sdKouPfcxuRyWdo83Vz2Rk',
  privateKey: 'KqSR5sAMUw6AVTDGfSlG4bQ0Ab4vMk06503RaHbcDFM',
  subject: 'mailto:test@example.invalid',
}

// --- the browser's half -----------------------------------------------------

async function hmac(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ])
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, data))
}

async function derive(
  salt: Uint8Array,
  ikm: Uint8Array,
  info: Uint8Array,
  length: number,
): Promise<Uint8Array> {
  const prk = await hmac(salt, ikm)
  const block = await hmac(prk, new Uint8Array([...info, 1]))
  return block.slice(0, length)
}

/** A subscription, made the way a browser makes one. */
async function subscribe() {
  const pair = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
    'deriveBits',
  ])) as CryptoKeyPair
  const publicKey = new Uint8Array(
    (await crypto.subtle.exportKey('raw', pair.publicKey)) as ArrayBuffer,
  )
  const auth = crypto.getRandomValues(new Uint8Array(16))
  return {
    privateKey: pair.privateKey,
    publicKey,
    sub: {
      endpoint: 'https://fcm.googleapis.com/fcm/send/abc123',
      keys: { p256dh: b64(publicKey), auth: b64(auth) },
    } satisfies PushSub,
    auth,
  }
}

/** Open a sealed message the way the browser's push machinery does. */
async function open(
  body: Uint8Array,
  reader: Awaited<ReturnType<typeof subscribe>>,
): Promise<string> {
  const salt = body.slice(0, 16)
  const keyLength = body[20]!
  const theirPublic = body.slice(21, 21 + keyLength)
  const cipher = body.slice(21 + keyLength)

  const theirKey = await crypto.subtle.importKey(
    'raw',
    theirPublic,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    [],
  )
  const shared = new Uint8Array(
    await crypto.subtle.deriveBits(ecdhWith(theirKey), reader.privateKey, 256),
  )
  const ikm = await derive(
    reader.auth,
    shared,
    new Uint8Array([
      ...bytes.encode('WebPush: info' + NUL),
      ...reader.publicKey,
      ...theirPublic,
    ]),
    32,
  )
  const cek = await derive(salt, ikm, bytes.encode('Content-Encoding: aes128gcm' + NUL), 16)
  const nonce = await derive(salt, ikm, bytes.encode('Content-Encoding: nonce' + NUL), 12)

  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt'])
  const plain = new Uint8Array(
    await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, key, cipher),
  )
  // The last byte is the record delimiter, not part of the message.
  return new TextDecoder().decode(plain.slice(0, -1))
}

// --- the tests --------------------------------------------------------------

describe('a message sealed to one subscription', () => {
  it('is the message again when the subscriber opens it', async () => {
    const reader = await subscribe()
    const text = JSON.stringify({
      title: 'Schiff eingelaufen',
      body: 'Ihr Schiff liegt in Hamburg. Es wartet auf Order.',
    })
    const opened = await open(await sealed(text, reader.sub.keys.p256dh, reader.sub.keys.auth), reader)
    expect(opened).toBe(text)
  })

  it('carries the sender’s key and a record size in its header', async () => {
    const reader = await subscribe()
    const body = await sealed('kurz', reader.sub.keys.p256dh, reader.sub.keys.auth)
    // salt(16) + record size(4) + key length(1) + key(65) + at least a tag.
    expect(body[20]).toBe(65)
    expect(new DataView(body.buffer, body.byteOffset).getUint32(16)).toBe(4096)
    expect(body.length).toBeGreaterThan(21 + 65)
  })

  it('seals the same words differently every time', async () => {
    const reader = await subscribe()
    const once = await sealed('gleich', reader.sub.keys.p256dh, reader.sub.keys.auth)
    const twice = await sealed('gleich', reader.sub.keys.p256dh, reader.sub.keys.auth)
    expect(b64(once)).not.toBe(b64(twice))
    // …and both still open.
    expect(await open(twice, reader)).toBe('gleich')
  })

  it('cannot be opened by a different subscriber', async () => {
    const reader = await subscribe()
    const stranger = await subscribe()
    const body = await sealed('geheim', reader.sub.keys.p256dh, reader.sub.keys.auth)
    await expect(open(body, stranger)).rejects.toThrow()
  })
})

describe('the token that gets us past the push service', () => {
  const parse = (jwt: string) =>
    JSON.parse(new TextDecoder().decode(unb64(jwt.split('.')[1]!))) as Record<string, unknown>

  it('is signed for that service and nobody else', async () => {
    const jwt = await vapidToken('https://fcm.googleapis.com', vapid)
    const claim = parse(jwt)
    expect(claim['aud']).toBe('https://fcm.googleapis.com')
    expect(claim['sub']).toBe('mailto:test@example.invalid')
    expect(Number(claim['exp'])).toBeGreaterThan(Date.now() / 1000)
    // Twenty-four hours is the outside limit push services accept.
    expect(Number(claim['exp'])).toBeLessThan(Date.now() / 1000 + 24 * 3600)
  })

  it('verifies against the public key we hand the browser', async () => {
    const jwt = await vapidToken('https://updates.push.services.mozilla.com', vapid)
    const [head, claim, signature] = jwt.split('.') as [string, string, string]

    const key = await crypto.subtle.importKey(
      'raw',
      unb64(vapid.publicKey),
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['verify'],
    )
    const ok = await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      key,
      unb64(signature),
      bytes.encode(`${head}.${claim}`),
    )
    expect(ok).toBe(true)
    expect(JSON.parse(new TextDecoder().decode(unb64(head)))).toEqual({
      typ: 'JWT',
      alg: 'ES256',
    })
  })
})

describe('what the push service answers', () => {
  afterEach(() => vi.unstubAllGlobals())

  const sub: PushSub = {
    endpoint: 'https://fcm.googleapis.com/fcm/send/abc123',
    keys: { p256dh: '', auth: '' },
  }

  const answering = async (make: () => Response | Promise<Response> | never) => {
    const reader = await subscribe()
    vi.stubGlobal('fetch', vi.fn(make))
    return sendPush({ ...sub, keys: reader.sub.keys }, 'hallo', vapid)
  }

  it('takes 201 for delivered', async () => {
    expect(await answering(() => new Response(null, { status: 201 }))).toBe('ok')
  })

  /*
   * 404 and 410 mean the subscription itself is gone — the app uninstalled,
   * the browser data cleared. Retrying is pointless and keeping it is a slow
   * leak, so it is told apart from a service having a bad afternoon.
   */
  it('takes 410 for a subscription that no longer exists', async () => {
    expect(await answering(() => new Response(null, { status: 410 }))).toBe('weg')
  })

  it('takes 500 for a bad afternoon, which is not the same thing', async () => {
    expect(await answering(() => new Response(null, { status: 500 }))).toBe('fehler')
  })

  it('never throws, so a dead push service cannot take the tick with it', async () => {
    expect(
      await answering(() => {
        throw new Error('kein Netz')
      }),
    ).toBe('fehler')
  })

  it('sends the token and the encoding the service expects', async () => {
    const reader = await subscribe()
    const spy = vi.fn(() => new Response(null, { status: 201 }))
    vi.stubGlobal('fetch', spy)
    await sendPush({ ...sub, keys: reader.sub.keys }, 'hallo', vapid)

    const [url, init] = spy.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe(sub.endpoint)
    const headers = init.headers as Record<string, string>
    expect(headers['authorization']).toMatch(new RegExp(`^vapid t=[\\w-]+\\.[\\w-]+\\.[\\w-]+, k=${vapid.publicKey}$`))
    expect(headers['content-encoding']).toBe('aes128gcm')
    expect(Number(headers['ttl'])).toBeGreaterThan(0)
    // And the body is the sealed message, which the subscriber can open.
    expect(await open(init.body as Uint8Array, reader)).toBe('hallo')
  })
})
