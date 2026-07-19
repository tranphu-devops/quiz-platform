import Fastify from 'fastify'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import examRoutes from './routes/exams.js'
import collectionRoutes from './routes/collections.js'
import { encryptOnSend } from './lib/encryptResponse.js'

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
fastify.addHook('onSend', encryptOnSend)

fastify.get('/health', async () => ({
  status: 'ok',
  service: 'exam-service',
  timestamp: new Date().toISOString()
}))

fastify.register(examRoutes)
fastify.register(collectionRoutes)

try {
  await fastify.listen({ port: Number(process.env.PORT) || 3003, host: '0.0.0.0' })
} catch (err) {
  fastify.log.error(err)
  process.exit(1)
}
