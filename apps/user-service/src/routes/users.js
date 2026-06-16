import { pool } from '../db.js'

async function verifyToken(req, reply, fastify) {
  const auth = req.headers.authorization
  if (!auth?.startsWith('Bearer ')) {
    return reply.status(401).send({ error: 'Unauthorized', statusCode: 401 })
  }

  try {
    const res = await fetch(`${process.env.AUTH_SERVICE_URL}/auth/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: auth.slice(7) })
    })
    if (!res.ok) return reply.status(401).send({ error: 'Unauthorized', statusCode: 401 })
    req.user = await res.json()
  } catch (err) {
    fastify.log.error(err)
    return reply.status(503).send({ error: 'Auth service unavailable', statusCode: 503 })
  }
}

export default async function userRoutes(fastify) {
  fastify.addHook('preHandler', async (req, reply) => {
    if (req.routeOptions?.url === '/health') return
    await verifyToken(req, reply, fastify)
  })

  fastify.get('/:id', async (req, reply) => {
    const { id } = req.params
    try {
      const result = await pool.query(
        'SELECT id, full_name, avatar_url, updated_at FROM profiles WHERE id = $1',
        [id]
      )
      if (result.rows.length === 0) {
        return reply.status(404).send({ error: 'User not found', statusCode: 404 })
      }
      return result.rows[0]
    } catch (err) {
      fastify.log.error(err)
      return reply.status(500).send({ error: 'Internal server error', statusCode: 500 })
    }
  })

  fastify.put('/:id', async (req, reply) => {
    const { id } = req.params
    const { full_name, avatar_url } = req.body ?? {}

    if (req.user.userId !== id && req.user.role !== 'admin') {
      return reply.status(403).send({ error: 'Forbidden', statusCode: 403 })
    }

    try {
      const result = await pool.query(
        `INSERT INTO profiles (id, full_name, avatar_url, updated_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (id) DO UPDATE
         SET full_name = EXCLUDED.full_name,
             avatar_url = EXCLUDED.avatar_url,
             updated_at = NOW()
         RETURNING *`,
        [id, full_name, avatar_url]
      )
      return result.rows[0]
    } catch (err) {
      fastify.log.error(err)
      return reply.status(500).send({ error: 'Internal server error', statusCode: 500 })
    }
  })
}
