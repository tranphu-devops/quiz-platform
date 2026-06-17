import Fastify from 'fastify'
import cors from '@fastify/cors'
import userRoutes from './routes/users.js'

const fastify = Fastify({ logger: true })

await fastify.register(cors, { origin: true })

fastify.get('/health', async () => ({
  status: 'ok',
  service: 'user-service',
  timestamp: new Date().toISOString()
}))

fastify.register(userRoutes, { prefix: '/' })

try {
  await fastify.listen({ port: Number(process.env.PORT) || 3002, host: '0.0.0.0' })
} catch (err) {
  fastify.log.error(err)
  process.exit(1)
}
