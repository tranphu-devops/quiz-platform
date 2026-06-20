import Fastify from 'fastify'
import cors from '@fastify/cors'
import multipart from '@fastify/multipart'
import userRoutes from './routes/users.js'
import uploadRoutes from './routes/upload.js'
import { encryptOnSend } from './lib/encryptResponse.js'

const fastify = Fastify({ logger: true })

await fastify.register(cors, { origin: true })
await fastify.register(multipart, { limits: { fileSize: 10 * 1024 * 1024, files: 1 } })
fastify.addHook('onSend', encryptOnSend)

fastify.get('/health', async () => ({
  status: 'ok',
  service: 'user-service',
  timestamp: new Date().toISOString()
}))

fastify.register(userRoutes, { prefix: '/' })
fastify.register(uploadRoutes, { prefix: '/' })

try {
  await fastify.listen({ port: Number(process.env.PORT) || 3002, host: '0.0.0.0' })
} catch (err) {
  fastify.log.error(err)
  process.exit(1)
}
