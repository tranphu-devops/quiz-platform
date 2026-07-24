import { pool } from '../db.js'
import { verifyAuth } from '../middleware/auth.js'
import { findComposeContainer, inspectContainer, getContainerLogs } from '../lib/docker.js'
import { fetchHealth, KNOWN_SERVICES } from '../lib/systemHealth.js'

const QUIZ_SCHEMAS = ['quiz_users', 'quiz_exams', 'quiz_submissions', 'quiz_interactions', 'quiz_generator', 'quiz_notifications']

async function getContainerState(serviceName) {
  const container = await findComposeContainer(serviceName)
  if (!container) return { found: false }
  const info = await inspectContainer(container.Id)
  return {
    found: true,
    status: info.State.Status,
    startedAt: info.State.StartedAt,
    restartCount: info.RestartCount
  }
}

export default async function adminSystemRoutes(fastify) {
  fastify.get('/admin/system/services', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (req, reply) => {
    await verifyAuth(req, reply)
    if (reply.sent) return
    if (req.user.role !== 'admin') return reply.status(403).send({ error: 'Forbidden', statusCode: 403 })

    try {
      const services = await Promise.all(KNOWN_SERVICES.map(async (name) => {
        const [container, http] = await Promise.all([
          getContainerState(name).catch((err) => ({ found: false, error: err.message })),
          fetchHealth(name)
        ])
        return { name, container, http: http.reachable === false && http.reason === 'no-http-endpoint' ? null : http, checkedAt: new Date().toISOString() }
      }))
      return { services }
    } catch (err) {
      fastify.log.error(err)
      return reply.status(500).send({ error: 'Internal server error', statusCode: 500 })
    }
  })

  fastify.get('/admin/system/logs', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (req, reply) => {
    await verifyAuth(req, reply)
    if (reply.sent) return
    if (req.user.role !== 'admin') return reply.status(403).send({ error: 'Forbidden', statusCode: 403 })

    const { service } = req.query
    if (!KNOWN_SERVICES.includes(service)) {
      return reply.status(400).send({ error: 'Unknown service', statusCode: 400 })
    }
    const tail = Math.min(Math.max(Number(req.query.tail) || 200, 1), 2000)

    try {
      const container = await findComposeContainer(service)
      if (!container) {
        return reply.status(404).send({ error: 'Container not found', statusCode: 404 })
      }
      const rawLines = await getContainerLogs(container.Id, tail)
      const lines = rawLines.map(({ stream, line }) => {
        try {
          return { stream, parsed: JSON.parse(line) }
        } catch {
          return { stream, raw: line }
        }
      })
      return { service, tail, lines }
    } catch (err) {
      fastify.log.error(err)
      return reply.status(500).send({ error: 'Internal server error', statusCode: 500 })
    }
  })

  fastify.get('/admin/system/database', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (req, reply) => {
    await verifyAuth(req, reply)
    if (reply.sent) return
    if (req.user.role !== 'admin') return reply.status(403).send({ error: 'Forbidden', statusCode: 403 })

    try {
      const [connRes, sizeRes, schemaRes, migrationsRes] = await Promise.all([
        pool.query(
          `SELECT state, count(*)::int AS count FROM pg_stat_activity WHERE datname = current_database() GROUP BY state`
        ),
        pool.query('SELECT pg_database_size(current_database()) AS bytes'),
        pool.query(
          `SELECT schemaname AS schema,
                  sum(pg_total_relation_size(schemaname || '.' || tablename))::bigint AS bytes
           FROM pg_tables
           WHERE schemaname = ANY($1)
           GROUP BY schemaname
           ORDER BY schemaname`,
          [QUIZ_SCHEMAS]
        ),
        pool.query('SELECT filename, applied_at FROM public.schema_migrations ORDER BY applied_at DESC LIMIT 20')
      ])

      const connections = { total: 0 }
      for (const row of connRes.rows) {
        const state = row.state || 'unknown'
        connections[state] = row.count
        connections.total += row.count
      }

      return {
        connections,
        databaseSizeBytes: Number(sizeRes.rows[0].bytes),
        schemas: schemaRes.rows.map((r) => ({ schema: r.schema, bytes: Number(r.bytes) })),
        recentMigrations: migrationsRes.rows.map((r) => ({ filename: r.filename, appliedAt: r.applied_at })),
        pool: { totalCount: pool.totalCount, idleCount: pool.idleCount, waitingCount: pool.waitingCount }
      }
    } catch (err) {
      fastify.log.error(err)
      return reply.status(500).send({ error: 'Internal server error', statusCode: 500 })
    }
  })
}
