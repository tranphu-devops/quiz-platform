import Fastify from 'fastify'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import cron from 'node-cron'
import internalRoutes from './routes/internal.js'
import preferenceRoutes from './routes/preferences.js'
import adminRoutes from './routes/admin.js'
import { tick } from './lib/worker.js'

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

fastify.register(internalRoutes)
fastify.register(preferenceRoutes)
fastify.register(adminRoutes)

try {
  await fastify.listen({ port: Number(process.env.PORT) || 3007, host: '0.0.0.0' })
} catch (err) {
  fastify.log.error(err)
  process.exit(1)
}

// Queue worker loop lives in this same process as the Fastify listener (see
// docker-compose.yml's notification-service comment for why: Postgres queue,
// no separate BullMQ/Redis service). Polls every 10s; also runs once at
// startup to drain anything queued while the service was down, same as
// grader-service's tick() precedent.
cron.schedule('*/10 * * * * *', tick)
tick()
