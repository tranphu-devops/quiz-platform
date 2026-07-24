import { pool } from '../db.js'
import { verifyAuth } from '../middleware/auth.js'
import { listEventTypes, getSubscriptions, replaceSubscriptions, getTargets, upsertTargets } from '../lib/subscriptions.js'

const QUEUE_STATUSES = ['pending', 'processing', 'sent', 'failed', 'dead']

// Manual role check (matches generator-service's platform-key routes) —
// notification-service's CASL ability doesn't distinguish admin/teacher
// beyond 'manage all' for admin, so a plain check is simplest here.
function requireAdmin(req, reply) {
  if (req.user.role !== 'admin') {
    reply.status(403).send({ error: 'Forbidden', statusCode: 403 })
    return false
  }
  return true
}

// Admin's own opt-ins into system/ops events (event_types.audience = 'admin').
// Each admin manages their own alert subscriptions independently — there is
// no single "the admin setting", since multiple admin accounts may want
// different alert sets.
export default async function adminRoutes(fastify) {
  fastify.get('/admin/subscriptions', { preHandler: verifyAuth, config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (req, reply) => {
    if (!requireAdmin(req, reply)) return
    const [eventTypes, subscriptions, targets] = await Promise.all([
      listEventTypes('admin', req.user.role),
      getSubscriptions(req.user.id),
      getTargets(req.user.id)
    ])
    return { eventTypes, subscriptions, targets }
  })

  fastify.put('/admin/subscriptions', { preHandler: verifyAuth, config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (req, reply) => {
    if (!requireAdmin(req, reply)) return
    const { subscriptions, targets } = req.body ?? {}
    try {
      if (Array.isArray(subscriptions)) await replaceSubscriptions(req.user.id, subscriptions)
      if (targets && typeof targets === 'object') await upsertTargets(req.user.id, targets)
      return { success: true }
    } catch (err) {
      req.log.error(err)
      return reply.status(500).send({ error: 'Failed to save subscriptions', statusCode: 500 })
    }
  })

  // Read-only log viewer for ops visibility into recent sends/failures.
  fastify.get('/admin/queue', { preHandler: verifyAuth, config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (req, reply) => {
    if (!requireAdmin(req, reply)) return
    const status = QUEUE_STATUSES.includes(req.query.status) ? req.query.status : null
    const page = Math.max(1, parseInt(req.query.page, 10) || 1)
    const limit = 20
    const offset = (page - 1) * limit

    try {
      const { rows } = await pool.query(
        `SELECT id, event_type, channel, recipient_user_id, status, attempts, last_error, created_at, sent_at
         FROM notification_queue
         WHERE ($1::text IS NULL OR status = $1)
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
        [status, limit, offset]
      )
      return { items: rows, page }
    } catch (err) {
      req.log.error(err)
      return reply.status(500).send({ error: 'Failed to load queue', statusCode: 500 })
    }
  })

  // Manually resurrect a dead-lettered row after fixing whatever caused it
  // (e.g. a misconfigured token) — resets attempts so it gets the full
  // retry budget again.
  fastify.post('/admin/queue/:id/retry', { preHandler: verifyAuth, config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (req, reply) => {
    if (!requireAdmin(req, reply)) return
    const { id } = req.params
    try {
      const result = await pool.query(
        `UPDATE notification_queue
         SET status = 'pending', attempts = 0, available_at = NOW(), last_error = NULL
         WHERE id = $1 AND status = 'dead'
         RETURNING id`,
        [id]
      )
      if (result.rowCount === 0) {
        return reply.status(404).send({ error: 'Dead queue item not found', statusCode: 404 })
      }
      return { success: true }
    } catch (err) {
      req.log.error(err)
      return reply.status(500).send({ error: 'Failed to retry queue item', statusCode: 500 })
    }
  })
}
