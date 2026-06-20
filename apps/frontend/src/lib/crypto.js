// Application-layer encryption: ECDH P-256 + AES-256-GCM
// Backend public key is embedded at build time via PUBLIC_API_ENCRYPTION_PUBKEY.
// If the env var is absent (dev/local), encryption is skipped transparently.

const BACKEND_PUBKEY_B64 = import.meta.env.PUBLIC_API_ENCRYPTION_PUBKEY

let _sessionPromise = null
let _clientPubKeyB64 = null  // base64 of ephemeral public key → sent in X-Client-Pubkey
let _aesKey = null            // CryptoKey for AES-256-GCM decrypt

async function _initSession() {
  if (!BACKEND_PUBKEY_B64) return  // not configured → no-op

  // Ephemeral ECDH key pair — private key non-extractable, stays in memory only
  const keyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    ['deriveBits']
  )

  // Export our public key (uncompressed 65-byte point) to send to backend
  const rawPub = await crypto.subtle.exportKey('raw', keyPair.publicKey)
  _clientPubKeyB64 = btoa(String.fromCharCode(...new Uint8Array(rawPub)))

  // Import backend's static public key (uncompressed 65-byte point, base64)
  const backendRaw = Uint8Array.from(atob(BACKEND_PUBKEY_B64), c => c.charCodeAt(0))
  const backendPub = await crypto.subtle.importKey(
    'raw', backendRaw, { name: 'ECDH', namedCurve: 'P-256' }, false, []
  )

  // ECDH → 256 shared bits (x-coordinate of shared EC point)
  const sharedBits = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: backendPub },
    keyPair.privateKey,
    256
  )

  // HKDF → AES-256-GCM key
  // Salt = 32 zero bytes, info = 'quiz-api-v1' — must match backend encryptResponse.js
  const hkdfBase = await crypto.subtle.importKey('raw', sharedBits, 'HKDF', false, ['deriveKey'])
  _aesKey = await crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new Uint8Array(32),
      info: new TextEncoder().encode('quiz-api-v1')
    },
    hkdfBase,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  )
}

// Singleton init — safe to call multiple times concurrently
function initSession() {
  if (!_sessionPromise) _sessionPromise = _initSession()
  return _sessionPromise
}

// Returns the base64 ephemeral public key to send as X-Client-Pubkey header.
// Returns null if encryption is not configured (dev/local).
export async function getClientPubKey() {
  await initSession()
  return _clientPubKeyB64
}

// Decrypts { iv, data } responses from the backend.
// Returns the body unchanged if it is not an encrypted envelope.
export async function decryptIfNeeded(body) {
  if (!body || typeof body !== 'object' || !body.iv || !body.data) return body
  await initSession()
  if (!_aesKey) return body

  const iv = Uint8Array.from(atob(body.iv), c => c.charCodeAt(0))
  // data = ciphertext || 16-byte GCM auth tag (appended by backend)
  const data = Uint8Array.from(atob(body.data), c => c.charCodeAt(0))

  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, _aesKey, data)
  return JSON.parse(new TextDecoder().decode(decrypted))
}
