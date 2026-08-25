/**
 * Web Push — reaching a telephone whose app has been closed.
 *
 * Everything else in this game speaks over the open socket, which is fine
 * while somebody is looking. A voyage takes real hours, though, and the whole
 * promise of real-time play is that you put the telephone away: the moment the
 * app is swiped off the screen its timers die with it, and a ship that makes
 * port at three in the morning has nobody left to tell. Only a push from the
 * outside survives that, so the Partieserver knocks on the push service of
 * whichever browser installed the app.
 *
 * Two specifications and no library. `web-push` on npm is written against
 * Node's crypto and does not run on a Worker, and the two things it does are
 * both plain WebCrypto:
 *
 *   - RFC 8292 (VAPID): an ES256 token saying who is sending, so the push
 *     service will accept us at all.
 *   - RFC 8291/8188 (aes128gcm): the message itself, sealed to the key pair
 *     the browser handed out with the subscription. The push service forwards
 *     it and cannot read it — which is the point.
 *
 * Nothing here holds state, and every byte is verifiable: the round trip in
 * `push.test.ts` plays the browser's part and decrypts what this produces.
 */

/** What `pushManager.subscribe` handed the browser, passed through as-is. */
export interface PushSub {
  readonly endpoint: string
  readonly keys: {
    /** The subscription's public key, raw P-256, base64url. */
    readonly p256dh: string
    /** The 16-byte shared salt the browser generated, base64url. */
    readonly auth: string
  }
}

export interface Vapid {
  /** Raw P-256 public key, base64url. Public by design; it ships to clients. */
  readonly publicKey: string
  /** The JWK `d` component, base64url. A secret, and only ever the server's. */
  readonly privateKey: string
  /** `mailto:` for the push service to complain to. */
  readonly subject: string
}

/**
 * How it went.
 *
 * "weg" is worth its own answer: a push service says 404 or 410 when the
 * subscription has been thrown away at the other end — the app uninstalled,
 * the browser data cleared. That is not a failure to retry but a note to
 * forget the subscription, so the caller is told apart from a service having
 * a bad afternoon.
 */
export type PushResult = 'ok' | 'weg' | 'fehler'

const bytes = new TextEncoder()

/**
 * Send one.
 *
 * Never throws: a push service that is down or slow must not take the tick
 * that was being committed down with it.
 */
export async function sendPush(sub: PushSub, payload: string, vapid: Vapid): Promise<PushResult> {
  try {
    const body = await sealed(payload, sub.keys.p256dh, sub.keys.auth)
    const token = await vapidToken(new URL(sub.endpoint).origin, vapid)
    const res = await fetch(sub.endpoint, {
      method: 'POST',
      headers: {
        authorization: `vapid t=${token}, k=${vapid.publicKey}`,
        'content-encoding': 'aes128gcm',
        'content-type': 'application/octet-stream',
        // Twelve hours: a ship that made port in the night is still lying
        // there in the morning, so the news is worth keeping that long.
        ttl: '43200',
        // It wakes a screen, which is what "high" means to a dozing phone.
        urgency: 'high',
      },
      body,
    })
    if (res.status === 404 || res.status === 410) return 'weg'
    return res.ok ? 'ok' : 'fehler'
  } catch {
    return 'fehler'
  }
}

// ---------------------------------------------------------------------------
// RFC 8291: the sealed message
// ---------------------------------------------------------------------------

/**
 * Seal a payload to one subscription.
 *
 * The shape on the wire (RFC 8188) is a 21-byte header followed by one
 * record: salt, record size, the length of the sender's key, the key itself,
 * then the ciphertext. One record, because a notification is a sentence and
 * the smallest legal record holds four kilobytes of it.
 */
export async function sealed(
  payload: string,
  p256dh: string,
  authSecret: string,
): Promise<Uint8Array> {
  const theirs = unb64(p256dh)
  const auth = unb64(authSecret)

  // A fresh key pair per message: the salt and the sender's key are what make
  // two identical notices encrypt differently.
  const mine = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
    'deriveBits',
  ])) as CryptoKeyPair
  const minePublic = new Uint8Array(
    (await crypto.subtle.exportKey('raw', mine.publicKey)) as ArrayBuffer,
  )
  const theirKey = await crypto.subtle.importKey(
    'raw',
    theirs,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    [],
  )
  const shared = new Uint8Array(
    await crypto.subtle.deriveBits(ecdhWith(theirKey), mine.privateKey, 256),
  )

  // Two stages, and the order of the two public keys is fixed by the spec:
  // the receiver's first. Getting it backwards yields a key that is perfectly
  // valid and that nothing on earth can decrypt.
  const ikm = await derive(
    auth,
    shared,
    joined(bytes.encode('WebPush: info\u0000'), theirs, minePublic),
    32,
  )
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const cek = await derive(salt, ikm, bytes.encode('Content-Encoding: aes128gcm\u0000'), 16)
  const nonce = await derive(salt, ikm, bytes.encode('Content-Encoding: nonce\u0000'), 12)

  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt'])
  // 0x02 marks the last record. Without it the browser rejects the message.
  const plain = joined(bytes.encode(payload), Uint8Array.of(2))
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, plain),
  )

  const header = new Uint8Array(21)
  header.set(salt, 0)
  new DataView(header.buffer).setUint32(16, 4096)
  header[20] = minePublic.length
  return joined(header, minePublic, ciphertext)
}

/**
 * HKDF, expanded to a single block.
 *
 * The full construction allows arbitrary lengths by chaining blocks; nothing
 * here asks for more than 32 bytes, so the chain is one link and writing it
 * out is shorter than explaining which corners were cut.
 */
async function derive(
  salt: Uint8Array,
  ikm: Uint8Array,
  info: Uint8Array,
  length: number,
): Promise<Uint8Array> {
  const prk = await hmac(salt, ikm)
  const block = await hmac(prk, joined(info, Uint8Array.of(1)))
  return block.slice(0, length)
}

/**
 * The counterpart key, in the shape `deriveBits` wants it.
 *
 * Cloudflare's type shim spells this field `$public` while the runtime — and
 * every other environment — wants `public`. One named cast beats scattering
 * the disagreement through the code above.
 */
function ecdhWith(key: CryptoKey): Parameters<SubtleCrypto['deriveBits']>[0] {
  return { name: 'ECDH', public: key } as unknown as Parameters<SubtleCrypto['deriveBits']>[0]
}

async function hmac(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ])
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, data))
}

// ---------------------------------------------------------------------------
// RFC 8292: who is knocking
// ---------------------------------------------------------------------------

/**
 * The token that gets us past the push service's door.
 *
 * Signed for one audience — the push service's own origin, and no other — and
 * short-lived, so a token overheard on the wire is worth little and worth
 * nothing at a different service.
 */
export async function vapidToken(audience: string, vapid: Vapid): Promise<string> {
  const pub = unb64(vapid.publicKey)
  const key = await crypto.subtle.importKey(
    'jwk',
    {
      kty: 'EC',
      crv: 'P-256',
      // The private JWK wants the public point spelled out beside it; it is
      // the raw key with its leading 0x04 "uncompressed" byte split in two.
      x: b64(pub.slice(1, 33)),
      y: b64(pub.slice(33, 65)),
      d: vapid.privateKey,
      ext: true,
    },
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  )

  const head = b64(bytes.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })))
  const claim = b64(
    bytes.encode(
      JSON.stringify({
        aud: audience,
        exp: Math.floor(Date.now() / 1000) + 12 * 3600,
        sub: vapid.subject,
      }),
    ),
  )
  const signed = `${head}.${claim}`
  const signature = new Uint8Array(
    await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, bytes.encode(signed)),
  )
  return `${signed}.${b64(signature)}`
}

// ---------------------------------------------------------------------------
// base64url, which is base64 with two letters swapped and the padding dropped
// ---------------------------------------------------------------------------

export function b64(raw: Uint8Array): string {
  let s = ''
  for (const byte of raw) s += String.fromCharCode(byte)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function unb64(text: string): Uint8Array {
  const s = atob(text.replace(/-/g, '+').replace(/_/g, '/'))
  const out = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i)
  return out
}

function joined(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let at = 0
  for (const part of parts) {
    out.set(part, at)
    at += part.length
  }
  return out
}
