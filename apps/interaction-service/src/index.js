import Fastify from 'fastify'
import cors from '@fastify/cors'
import interactionRoutes from './routes/interactions.js'
import { encryptOnSend } from './lib/encryptResponse.js'

const fastify = Fastify({ logger: true })

await fastify.register(cors, { origin: true })
fastify.addHook('onSend', encryptOnSend)

fastify.get('/health', async () => ({
  status: 'ok',
  service: 'interaction-service',
  timestamp: new Date().toISOString()
}))

fastify.register(interactionRoutes)

try {
  await fastify.listen({ port: Number(process.env.PORT) || 3005, host: '0.0.0.0' })
} catch (err) {
  fastify.log.error(err)
  process.exit(1)
}
