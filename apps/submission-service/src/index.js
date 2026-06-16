import Fastify from 'fastify'
import cors from '@fastify/cors'
import submissionRoutes from './routes/submissions.js'

const fastify = Fastify({ logger: true })

await fastify.register(cors, { origin: true })

fastify.get('/health', async () => ({
  status: 'ok',
  service: 'submission-service',
  timestamp: new Date().toISOString()
}))

fastify.register(submissionRoutes)

try {
  await fastify.listen({ port: Number(process.env.PORT) || 3004, host: '0.0.0.0' })
} catch (err) {
  fastify.log.error(err)
  process.exit(1)
}
