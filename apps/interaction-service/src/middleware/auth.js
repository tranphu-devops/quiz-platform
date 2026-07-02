import jwt from 'jsonwebtoken'
import { pool } from '../db.js'
import { defineAbilityFor } from '../lib/ability.js'

// Decode + verify a Bearer token, returning the app user or null.
// Shared by strict verifyAuth and lenient optionalAuth.
async function resolveUser(req) {
  const auth = req.headers.authorization
  if (!auth?.startsWith('Bearer ')) return { ok: false, banned: false }

  const payload = jwt.verify(auth.slice(7), process.env.JWT_SECRET)

  // Check live ban status — JWT role may be stale until token refresh
  const { rows } = await pool.query(
    'SELECT role FROM quiz_users.profiles WHERE id = $1',
    [payload.sub]
  )
  if (rows[0]?.role === 'banned') return { ok: false, banned: true }

  return {
    ok: true,
    user: {
      id: payload.sub,
      email: payload.email,
      role: payload.user_metadata?.role ?? 'student'
    }
  }
}

// Strict: rejects when no/invalid token or banned account.
export async function verifyAuth(req, reply) {
  try {
    const res = await resolveUser(req)
    if (res.banned) {
      return reply.status(403).send({ error: 'Account banned', statusCode: 403 })
    }
    if (!res.ok) {
      return reply.status(401).send({ error: 'Unauthorized', statusCode: 401 })
    }
    req.user = res.user
    req.ability = defineAbilityFor(req.user)
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return reply.status(401).send({ error: 'Invalid token', statusCode: 401 })
    }
    return reply.status(500).send({ error: 'Internal server error', statusCode: 500 })
  }
}

// Lenient: sets req.user/req.ability when a valid token is present, otherwise
// continues anonymously. Used by public read endpoints that still want to know
// the caller (e.g. whether they already liked an exam). A banned account is
// treated as anonymous rather than rejected.
export async function optionalAuth(req) {
  try {
    const res = await resolveUser(req)
    if (res.ok) {
      req.user = res.user
      req.ability = defineAbilityFor(req.user)
    }
  } catch {
    // ignore malformed/expired token → anonymous
  }
}
