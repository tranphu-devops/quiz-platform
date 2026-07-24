import { enqueue } from '../lib/queue.js'

// Fire-and-forget entry point for producer services (submission-service,
// grader-service, interaction-service, generator-service, user-service).
// Not exposed externally — Nginx blocks /api/notifications/internal/.
export default async function internalRoutes(fastify) {
  fastify.post('/internal/notify', async (req, reply) => {
    const internalKey = req.headers['x-internal-key']
    if (!internalKey || internalKey !== process.env.INTERNAL_API_KEY) {
      return reply.status(403).send({ error: 'Forbidden', statusCode: 403 })
    }

    const { event, recipients, payload } = req.body ?? {}
    if (!event || typeof event !== 'string') {
      return reply.status(400).send({ error: 'event is required', statusCode: 400 })
    }

    try {
      const enqueued = await enqueue({ event, recipients, payload })
      return reply.status(202).send({ enqueued })
    } catch (err) {
      req.log.error(err)
      return reply.status(500).send({ error: 'Failed to enqueue notification', statusCode: 500 })
    }
  })
}
