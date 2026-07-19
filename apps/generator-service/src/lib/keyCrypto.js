import crypto from 'crypto'

// Reversible AES-256-GCM encryption for teacher-supplied LLM API keys.
// Distinct from the SHA-256 one-way hashing used for our own Teacher API
// keys (quiz_users.api_keys) — we must be able to decrypt this to actually
// call the provider on the teacher's behalf. Also distinct from the ECDH
// response encryption in encryptResponse.js, which encrypts outbound HTTP
// payloads per-request rather than a secret at rest.
//
// GENERATOR_KEY_ENCRYPTION_KEY: 32 raw bytes, hex-encoded (64 hex chars).
function getKey() {
  const hex = process.env.GENERATOR_KEY_ENCRYPTION_KEY
  if (!hex) throw new Error('GENERATOR_KEY_ENCRYPTION_KEY not configured')
  const key = Buffer.from(hex, 'hex')
  if (key.length !== 32) throw new Error('GENERATOR_KEY_ENCRYPTION_KEY must be 32 bytes (64 hex chars)')
  return key
}

// Stored as base64(iv (12 bytes) || authTag (16 bytes) || ciphertext)
export function encryptKey(plaintext) {
  const key = getKey()
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const body = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, body]).toString('base64')
}

export function decryptKey(encoded) {
  const key = getKey()
  const buf = Buffer.from(encoded, 'base64')
  const iv = buf.subarray(0, 12)
  const tag = buf.subarray(12, 28)
  const body = buf.subarray(28)
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(body), decipher.final()]).toString('utf8')
}

// Short, non-sensitive fragment for display in key listings (never the
// plaintext key itself) — e.g. "sk-ant-...ab12".
export function keyPrefix(plaintext) {
  const head = plaintext.slice(0, 8)
  const tail = plaintext.slice(-4)
  return `${head}...${tail}`
}
