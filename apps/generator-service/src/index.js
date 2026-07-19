import Fastify from 'fastify'
import cors from '@fastify/cors'
import multipart from '@fastify/multipart'
import generateRoutes from './routes/generate.js'

const fastify = Fastify({ logger: true })

await fastify.register(cors, { origin: true })
await fastify.register(multipart, { limits: { fileSize: 20 * 1024 * 1024, files: 1 } })

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
