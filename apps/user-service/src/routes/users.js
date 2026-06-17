import { pool } from '../db.js'
import { verifyAuth } from '../middleware/auth.js'

export default async function userRoutes(fastify) {
  fastify.addHook('preHandler', async (req, reply) => {
    if (req.routeOptions?.url === '/health') return
    await verifyAuth(req, reply)
  })

  fastify.get('/:id', async (req, reply) => {
    const { id } = req.params
    try {
      const result = await pool.query(
        'SELECT id, full_name, avatar_url, role, updated_at FROM profiles WHERE id = $1',
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
    const { full_name, avatar_url, role } = req.body ?? {}

    if (req.user.id !== id && req.user.role !== 'admin') {
      return reply.status(403).send({ error: 'Forbidden', statusCode: 403 })
    }

    // Only admin can change role
    const newRole = req.user.role === 'admin' ? (role ?? req.user.role) : undefined

    try {
      const result = await pool.query(
        `INSERT INTO profiles (id, full_name, avatar_url, role, updated_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (id) DO UPDATE
         SET full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
             avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url),
             role = COALESCE(EXCLUDED.role, profiles.role),
             updated_at = NOW()
         RETURNING *`,
        [id, full_name, avatar_url, newRole ?? req.user.role]
      )
      return result.rows[0]
    } catch (err) {
      fastify.log.error(err)
      return reply.status(500).send({ error: 'Internal server error', statusCode: 500 })
    }
  })

  fastify.get('/admin/users', async (req, reply) => {
    if (req.user.role !== 'admin') return reply.status(403).send({ error: 'Forbidden', statusCode: 403 })
    const { rows } = await pool.query(`
      SELECT id, email,
             raw_user_meta_data->>'role' AS role,
             raw_user_meta_data->>'full_name' AS full_name,
             created_at, last_sign_in_at, confirmed_at IS NOT NULL AS confirmed
      FROM auth.users
      ORDER BY created_at DESC
    `)
    return rows
  })

  fastify.patch('/admin/users/:id/role', async (req, reply) => {
    if (req.user.role !== 'admin') return reply.status(403).send({ error: 'Forbidden', statusCode: 403 })
    const { id } = req.params
    const { role } = req.body ?? {}
    if (!['admin', 'teacher', 'student'].includes(role))
      return reply.status(400).send({ error: 'Invalid role', statusCode: 400 })
    await pool.query(
      `UPDATE auth.users SET raw_user_meta_data = raw_user_meta_data || $1::jsonb WHERE id = $2`,
      [JSON.stringify({ role }), id]
    )
    return { success: true }
  })
}
