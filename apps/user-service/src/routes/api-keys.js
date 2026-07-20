import crypto from 'node:crypto'
import { pool } from '../db.js'
import { verifyAuth } from '../middleware/auth.js'

// Teacher API key management (browser/JWT-protected). The key itself is used
// separately against exam-service via the X-API-Key header — see exam-service
// middleware/auth.js.

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex')

export default async function apiKeyRoutes(fastify) {
  fastify.addHook('preHandler', async (req, reply) => {
    await verifyAuth(req, reply)
    if (reply.sent) return
    // Only teachers and admins may hold API keys — a student key grants nothing useful.
    if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
      return reply.status(403).send({ error: 'Chỉ teacher/admin mới tạo được API key', statusCode: 403 })
    }
  })

  // POST /api-keys — generate a new key; returns plaintext exactly once
  fastify.post('/api-keys', { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } }, async (req, reply) => {
    const { name } = req.body ?? {}
    if (!name || typeof name !== 'string' || !name.trim()) {
      return reply.status(400).send({ error: 'Name required', statusCode: 400 })
    }
    const key = `qz_live_${crypto.randomBytes(24).toString('hex')}`
    const key_prefix = key.slice(0, 14) // "qz_live_" + 6 hex
    try {
      const { rows } = await pool.query(
        `INSERT INTO api_keys (user_id, name, key_prefix, key_hash)
         VALUES ($1, $2, $3, $4)
         RETURNING id, name, key_prefix, created_at`,
        [req.user.id, name.trim(), key_prefix, sha256(key)]
      )
      // Plaintext key returned here and never again.
      return reply.status(201).send({ ...rows[0], key })
    } catch (err) {
      fastify.log.error(err)
      return reply.status(500).send({ error: 'Internal server error', statusCode: 500 })
    }
  })

  // GET /api-keys — list caller's keys (metadata only, no secret)
  fastify.get('/api-keys', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (req, reply) => {
    try {
      const { rows } = await pool.query(
        `SELECT id, name, key_prefix, last_used_at, created_at, revoked_at
         FROM api_keys WHERE user_id = $1 ORDER BY created_at DESC`,
        [req.user.id]
      )
      return rows
    } catch (err) {
      fastify.log.error(err)
      return reply.status(500).send({ error: 'Internal server error', statusCode: 500 })
    }
  })

  // DELETE /api-keys/:id — revoke (soft; verify path checks revoked_at)
  fastify.delete('/api-keys/:id', { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (req, reply) => {
    const { id } = req.params
    try {
      const { rowCount } = await pool.query(
        `UPDATE api_keys SET revoked_at = NOW()
         WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL`,
        [id, req.user.id]
      )
      if (rowCount === 0) {
        return reply.status(404).send({ error: 'Key not found', statusCode: 404 })
      }
      return { success: true }
    } catch (err) {
      fastify.log.error(err)
      return reply.status(500).send({ error: 'Internal server error', statusCode: 500 })
    }
  })
}
