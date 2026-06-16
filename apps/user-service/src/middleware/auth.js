import jwt from 'jsonwebtoken'
import { defineAbilityFor } from '../lib/ability.js'

export async function verifyAuth(req, reply) {
  const auth = req.headers.authorization
  if (!auth?.startsWith('Bearer ')) {
    return reply.status(401).send({ error: 'Unauthorized', statusCode: 401 })
  }

  try {
    const payload = jwt.verify(auth.slice(7), process.env.JWT_SECRET)
    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.user_metadata?.role ?? 'student'
    }
    req.ability = defineAbilityFor(req.user)
  } catch {
    return reply.status(401).send({ error: 'Invalid token', statusCode: 401 })
  }
}
