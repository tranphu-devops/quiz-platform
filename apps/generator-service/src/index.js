import Fastify from 'fastify'
import cors from '@fastify/cors'
import multipart from '@fastify/multipart'
import rateLimit from '@fastify/rate-limit'
import generateRoutes from './routes/generate.js'

const fastify = Fastify({ logger: true, trustProxy: true })

await fastify.register(cors, { origin: true })
await fastify.register(multipart, { limits: { fileSize: 20 * 1024 * 1024, files: 1 } })
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
  service: 'generator-service',
  timestamp: new Date().toISOString()
}))

fastify.register(generateRoutes)

try {
  await fastify.listen({ port: Number(process.env.PORT) || 3006, host: '0.0.0.0' })
} catch (err) {
  fastify.log.error(err)
  process.exit(1)
}
