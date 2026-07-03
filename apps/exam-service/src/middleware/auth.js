import crypto from 'node:crypto'
import jwt from 'jsonwebtoken'
import { pool } from '../db.js'
import { defineAbilityFor } from '../lib/ability.js'

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex')

// Resolve a teacher API key (X-API-Key) to a user, cross-schema — same precedent
// as the ban check reading quiz_users.profiles. Role comes from profiles (source
// of truth), so bans/role changes take effect immediately.
async function verifyApiKey(req, reply, rawKey) {
  const { rows } = await pool.query(
    `SELECT k.id, k.user_id, k.revoked_at, p.role, au.email
     FROM quiz_users.api_keys k
     JOIN quiz_users.profiles p ON p.id = k.user_id
     LEFT JOIN auth.users au ON au.id = k.user_id
     WHERE k.key_hash = $1`,
    [sha256(rawKey)]
  )
  const row = rows[0]
  if (!row || row.revoked_at) {
    return reply.status(401).send({ error: 'Invalid API key', statusCode: 401 })
  }
  if (row.role === 'banned') {
    return reply.status(403).send({ error: 'Account banned', statusCode: 403 })
  }

  req.user = { id: row.user_id, email: row.email, role: row.role ?? 'student' }
  req.ability = defineAbilityFor(req.user)

  // Fire-and-forget usage stamp — never block the request on it.
  pool.query('UPDATE quiz_users.api_keys SET last_used_at = NOW() WHERE id = $1', [row.id])
    .catch((err) => req.log.error(err))
}

export async function verifyAuth(req, reply) {
  const auth = req.headers.authorization
  const apiKey = req.headers['x-api-key']

  // API key path (programmatic teacher access) when there is no Bearer token.
  if (!auth?.startsWith('Bearer ') && apiKey) {
    try {
      return await verifyApiKey(req, reply, apiKey)
    } catch (err) {
      req.log.error(err)
      return reply.status(500).send({ error: 'Internal server error', statusCode: 500 })
    }
  }

  if (!auth?.startsWith('Bearer ')) {
    return reply.status(401).send({ error: 'Unauthorized', statusCode: 401 })
  }

  try {
    const payload = jwt.verify(auth.slice(7), process.env.JWT_SECRET)

    // Check live ban status — JWT role may be stale until token refresh
    const { rows } = await pool.query(
      'SELECT role FROM quiz_users.profiles WHERE id = $1',
      [payload.sub]
    )
    if (rows[0]?.role === 'banned') {
      return reply.status(403).send({ error: 'Account banned', statusCode: 403 })
    }

    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.user_metadata?.role ?? 'student'
    }
    req.ability = defineAbilityFor(req.user)
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return reply.status(401).send({ error: 'Invalid token', statusCode: 401 })
    }
    return reply.status(500).send({ error: 'Internal server error', statusCode: 500 })
  }
}
