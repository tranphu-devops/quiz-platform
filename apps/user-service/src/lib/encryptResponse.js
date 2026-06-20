import crypto from 'crypto'

const PRIVATE_KEY_B64 = process.env.API_ENCRYPTION_KEY

// Cache derived AES keys per client public key (ECDH is expensive; same session = same key)
const keyCache = new Map()
const KEY_CACHE_MAX = 500

function deriveAesKey(clientPubKeyB64) {
  if (keyCache.has(clientPubKeyB64)) return keyCache.get(clientPubKeyB64)

  const ecdh = crypto.createECDH('prime256v1')
  ecdh.setPrivateKey(Buffer.from(PRIVATE_KEY_B64, 'base64'))

  // Client sends uncompressed EC point (04 || x || y, 65 bytes) as base64
  const sharedSecret = ecdh.computeSecret(Buffer.from(clientPubKeyB64, 'base64'))

  // HKDF → 256-bit AES key. Salt = 32 zero bytes (matches Web Crypto default).
  const aesKey = crypto.hkdfSync(
    'sha256',
    sharedSecret,
    Buffer.alloc(32),
    Buffer.from('quiz-api-v1', 'utf8'),
    32
  )

  if (keyCache.size >= KEY_CACHE_MAX) keyCache.delete(keyCache.keys().next().value)
  keyCache.set(clientPubKeyB64, aesKey)
  return aesKey
}

function encrypt(aesKey, plaintext) {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', aesKey, iv)
  const body = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()  // 16 bytes, appended to ciphertext
  return {
    iv: iv.toString('base64'),
    data: Buffer.concat([body, tag]).toString('base64')
  }
}

// Call once at startup: fastify.addHook('onSend', encryptOnSend)
export async function encryptOnSend(req, reply, payload) {
  if (!PRIVATE_KEY_B64) return payload

  const clientPubKey = req.headers['x-client-pubkey']
  if (!clientPubKey || typeof payload !== 'string') return payload

  try {
    const aesKey = deriveAesKey(clientPubKey)
    reply.header('content-type', 'application/json; charset=utf-8')
    return JSON.stringify(encrypt(aesKey, payload))
  } catch (err) {
    this.log.warn({ err }, 'response encryption failed, returning plain')
    return payload
  }
}
