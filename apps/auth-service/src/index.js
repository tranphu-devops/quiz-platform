import Fastify from 'fastify'
import cors from '@fastify/cors'
import authRoutes from './routes/auth.js'

const fastify = Fastify({ logger: true })

await fastify.register(cors, { origin: true })

fastify.get('/health', async () => ({
  status: 'ok',
  service: 'auth-service',
  timestamp: new Date().toISOString()
}))

fastify.register(authRoutes, { prefix: '/auth' })

try {
  await fastify.listen({ port: Number(process.env.PORT) || 3001, host: '0.0.0.0' })
} catch (err) {
  fastify.log.error(err)
  process.exit(1)
}
