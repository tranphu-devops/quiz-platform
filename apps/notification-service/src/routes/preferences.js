import { verifyAuth } from '../middleware/auth.js'
import {
  listEventTypes,
  getSubscriptions,
  replaceSubscriptions,
  disableChannelsExcept,
  getTargets,
  upsertTargets,
  channelsForRole,
  needsChannelTargets
} from '../lib/subscriptions.js'

// Self-service "my activity" notification preferences (student/teacher/admin
// alike) — event_types.audience = 'user', filtered to rows applicable to the
// caller's own role. Non-admin roles get email only (channelsForRole), sent to
// their account email, so they have no channel targets to manage at all.
export default async function preferenceRoutes(fastify) {
  fastify.get('/preferences', { preHandler: verifyAuth, config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (req) => {
    const channels = channelsForRole(req.user.role)
    const [eventTypes, subscriptions, targets] = await Promise.all([
      listEventTypes('user', req.user.role),
      getSubscriptions(req.user.id),
      // Channel targets are an admin-only concern; don't hand a non-admin back
      // stale pushover/telegram keys they can no longer manage.
      needsChannelTargets(channels) ? getTargets(req.user.id) : null
    ])
    return {
      eventTypes,
      subscriptions,
      targets: targets ?? {},
      channels,
      // Where email-only recipients are actually reached (worker.js falls back
      // to auth.users.email when there's no override).
      email: req.user.email ?? null
    }
  })

  fastify.put('/preferences', { preHandler: verifyAuth, config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (req, reply) => {
    const { subscriptions, targets } = req.body ?? {}
    const channels = channelsForRole(req.user.role)
    try {
      if (Array.isArray(subscriptions)) {
        await replaceSubscriptions(req.user.id, subscriptions.filter((s) => channels.includes(s?.channel)))
        await disableChannelsExcept(req.user.id, channels)
      }
      // Only admins have channels whose target is user-supplied; for everyone
      // else ignore `targets` entirely rather than writing an empty object
      // (upsertTargets is a full replace, not a merge).
      if (needsChannelTargets(channels) && targets && typeof targets === 'object') {
        await upsertTargets(req.user.id, targets)
      }
      return { success: true }
    } catch (err) {
      req.log.error(err)
      return reply.status(500).send({ error: 'Failed to save preferences', statusCode: 500 })
    }
  })
}
