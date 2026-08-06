import { pool } from '../db.js'
import { verifyAuth } from '../middleware/auth.js'
import { listUploadedObjects, deleteS3ObjectsByKeys, keyFromUrl, publicUrlForKey } from '../lib/s3.js'

const DEFAULT_MIN_AGE_HOURS = 24
const MAX_DELETE_KEYS = 500

// Every DB column across services that can hold an uploaded (uploads/…) S3 URL.
// profiles is in this service's own schema (quiz_users); the rest live in quiz_exams,
// reachable because all services share one Postgres instance (see admin-system.js).
async function fetchReferencedKeys() {
  const { rows } = await pool.query(`
    SELECT avatar_url AS url FROM profiles WHERE avatar_url IS NOT NULL
    UNION ALL
    SELECT cover_image_url AS url FROM quiz_exams.exams WHERE cover_image_url IS NOT NULL
    UNION ALL
    SELECT image_url AS url FROM quiz_exams.questions WHERE image_url IS NOT NULL
    UNION ALL
    SELECT badge_image_url AS url FROM quiz_exams.collections WHERE badge_image_url IS NOT NULL
  `)
  const keys = new Set()
  for (const row of rows) {
    const key = keyFromUrl(row.url)
    if (key) keys.add(key)
  }
  return keys
}

export default async function adminStorageRoutes(fastify) {
  fastify.get('/admin/storage/orphans', { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (req, reply) => {
    await verifyAuth(req, reply)
    if (reply.sent) return
    if (req.user.role !== 'admin') return reply.status(403).send({ error: 'Forbidden', statusCode: 403 })

    const minAgeHours = Math.max(Number(req.query.minAgeHours) || DEFAULT_MIN_AGE_HOURS, 0)
    const cutoff = Date.now() - minAgeHours * 60 * 60 * 1000

    try {
      const [referencedKeys, objects] = await Promise.all([
        fetchReferencedKeys(),
        listUploadedObjects()
      ])

      let referencedCount = 0
      let referencedBytes = 0
      let tooRecentCount = 0
      let tooRecentBytes = 0
      const orphans = []

      for (const obj of objects) {
        if (referencedKeys.has(obj.key)) {
          referencedCount++
          referencedBytes += obj.size
          continue
        }
        if (new Date(obj.lastModified).getTime() > cutoff) {
          tooRecentCount++
          tooRecentBytes += obj.size
          continue
        }
        orphans.push({ key: obj.key, url: publicUrlForKey(obj.key), size: obj.size, lastModified: obj.lastModified })
      }

      const orphanBytes = orphans.reduce((sum, o) => sum + o.size, 0)

      return {
        orphans,
        summary: {
          totalObjects: objects.length,
          totalBytes: objects.reduce((sum, o) => sum + o.size, 0),
          referencedCount,
          referencedBytes,
          orphanCount: orphans.length,
          orphanBytes,
          tooRecentCount,
          tooRecentBytes,
          minAgeHours
        }
      }
    } catch (err) {
      fastify.log.error(err)
      return reply.status(500).send({ error: 'Internal server error', statusCode: 500 })
    }
  })

  fastify.delete('/admin/storage/orphans', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (req, reply) => {
    await verifyAuth(req, reply)
    if (reply.sent) return
    if (req.user.role !== 'admin') return reply.status(403).send({ error: 'Forbidden', statusCode: 403 })

    const keys = Array.isArray(req.body?.keys) ? req.body.keys.filter(k => typeof k === 'string' && k.startsWith('uploads/')) : []
    if (keys.length === 0) return reply.status(400).send({ error: 'No valid keys provided', statusCode: 400 })
    if (keys.length > MAX_DELETE_KEYS) {
      return reply.status(400).send({ error: `Too many keys, max ${MAX_DELETE_KEYS} per request`, statusCode: 400 })
    }

    try {
      // Re-check against the DB right before deleting — a key may have become
      // referenced since the client last loaded the orphan list.
      const referencedKeys = await fetchReferencedKeys()
      const skipped = keys.filter(k => referencedKeys.has(k))
      const toDelete = keys.filter(k => !referencedKeys.has(k))

      const { deleted, errors } = await deleteS3ObjectsByKeys(toDelete)

      return { deleted, skipped, errors }
    } catch (err) {
      fastify.log.error(err)
      return reply.status(500).send({ error: 'Internal server error', statusCode: 500 })
    }
  })
}
