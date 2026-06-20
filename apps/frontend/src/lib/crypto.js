// Application-layer encryption: ECDH P-256 + AES-256-GCM
// Backend EC public key is fetched at runtime from /api/users/public/crypto-key.
// If the endpoint returns 404 (dev / key not configured), encryption is skipped transparently.

const CRYPTO_KEY_URL = '/api/users/public/crypto-key'

let _sessionPromise = null
let _clientPubKeyB64 = null  // base64 ephemeral public key → sent in X-Client-Pubkey header
let _aesKey = null            // CryptoKey for AES-256-GCM decrypt

async function _initSession() {
  // Fetch backend's static EC public key (plain fetch — no encryption header yet)
  let backendPubKeyB64
  try {
    const res = await fetch(CRYPTO_KEY_URL)
    if (!res.ok) return  // 404 = encryption not configured on backend; skip silently
    const data = await res.json()
    backendPubKeyB64 = data.key
  } catch {
    return  // network error — encryption unavailable, continue with plain responses
  }

  // Generate ephemeral ECDH key pair — private key non-extractable, stays in memory only
  const keyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    ['deriveBits']
  )

  // Export our public key (uncompressed 65-byte EC point) to send to backend
  const rawPub = await crypto.subtle.exportKey('raw', keyPair.publicKey)
  _clientPubKeyB64 = btoa(String.fromCharCode(...new Uint8Array(rawPub)))

  // Import backend's static public key (uncompressed 65-byte EC point, base64)
  const backendRaw = Uint8Array.from(atob(backendPubKeyB64), c => c.charCodeAt(0))
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

// Singleton — safe to call concurrently; _initSession runs exactly once per page load
function initSession() {
  if (!_sessionPromise) _sessionPromise = _initSession()
  return _sessionPromise
}

// Returns the base64 ephemeral public key for X-Client-Pubkey header.
// Returns null when encryption is not active (dev / backend key not set).
export async function getClientPubKey() {
  await initSession()
  return _clientPubKeyB64
}

// Decrypts { iv, data } response envelopes from the backend.
// Returns body unchanged when not encrypted.
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
