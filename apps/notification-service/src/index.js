import Fastify from 'fastify'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'

const fastify = Fastify({ logger: true, trustProxy: true })

await fastify.register(cors, { origin: true })
await fastify.register(rateLimit, {
  max: 300,
  timeWindow: '1 minute',
  allowList: (req) => req.headers['x-internal-key'] === process.env.INTERNAL_API_KEY,
  errorResponseBuilder: (req, context) => ({
    statusCode: 429,
    error: 'Too Many Requests',
    message: `Quá nhiều yêu cầu, thử lại sau ${context.after}`
  })
})

fastify.get('/health', async () => ({
  status: 'ok',
  service: 'notification-service',
  timestamp: new Date().toISOString()
}))

// Routes (internal enqueue, preferences, admin) and the queue-worker
// node-cron schedule are wired up in a later change once the queue/channel
// logic lands — this skeleton only proves the service boots and migrates.

try {
  await fastify.listen({ port: Number(process.env.PORT) || 3007, host: '0.0.0.0' })
} catch (err) {
  fastify.log.error(err)
  process.exit(1)
}
