import jwt from 'jsonwebtoken'
import { pool } from '../db.js'
import { defineAbilityFor } from '../lib/ability.js'

export async function verifyAuth(req, reply) {
  const auth = req.headers.authorization
  if (!auth?.startsWith('Bearer ')) {
    return reply.status(401).send({ error: 'Unauthorized', statusCode: 401 })
  }

  try {
    const payload = jwt.verify(auth.slice(7), process.env.JWT_SECRET)

    // Check live ban status — JWT role may be stale until token refresh
    const { rows } = await pool.query(
      'SELECT role FROM profiles WHERE id = $1',
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
