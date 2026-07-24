import { verifyAuth } from '../middleware/auth.js'
import { listEventTypes, getSubscriptions, replaceSubscriptions, getTargets, upsertTargets } from '../lib/subscriptions.js'

// Self-service "my activity" notification preferences (student/teacher/admin
// alike) — event_types.audience = 'user', filtered to rows applicable to the
// caller's own role.
export default async function preferenceRoutes(fastify) {
  fastify.get('/preferences', { preHandler: verifyAuth, config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (req) => {
    const [eventTypes, subscriptions, targets] = await Promise.all([
      listEventTypes('user', req.user.role),
      getSubscriptions(req.user.id),
      getTargets(req.user.id)
    ])
    return { eventTypes, subscriptions, targets }
  })

  fastify.put('/preferences', { preHandler: verifyAuth, config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (req, reply) => {
    const { subscriptions, targets } = req.body ?? {}
    try {
      if (Array.isArray(subscriptions)) await replaceSubscriptions(req.user.id, subscriptions)
      if (targets && typeof targets === 'object') await upsertTargets(req.user.id, targets)
      return { success: true }
    } catch (err) {
      req.log.error(err)
      return reply.status(500).send({ error: 'Failed to save preferences', statusCode: 500 })
    }
  })
}
