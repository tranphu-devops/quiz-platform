import crypto from 'node:crypto'

// Constant-time check of the x-internal-key header. False when the key is
// unset, so a missing env var can never make "no header" look authorised.
export function isInternalRequest(req) {
  const expected = process.env.INTERNAL_API_KEY
  const given = req.headers['x-internal-key']
  if (!expected || typeof given !== 'string') return false
  const a = Buffer.from(given)
  const b = Buffer.from(expected)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}
