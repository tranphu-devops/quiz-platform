import Fastify from 'fastify'
import cors from '@fastify/cors'
import examRoutes from './routes/exams.js'

const fastify = Fastify({ logger: true })

await fastify.register(cors, { origin: true })

fastify.get('/health', async () => ({
  status: 'ok',
  service: 'exam-service',
  timestamp: new Date().toISOString()
}))

fastify.register(examRoutes)

try {
  await fastify.listen({ port: Number(process.env.PORT) || 3003, host: '0.0.0.0' })
} catch (err) {
  fastify.log.error(err)
  process.exit(1)
}
