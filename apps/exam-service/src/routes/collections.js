import { subject } from '@casl/ability'
import { pool } from '../db.js'
import { verifyAuth } from '../middleware/auth.js'
import { getOrSet, invalidate } from '../lib/cache.js'

// Cache keys for GET /collections list variants that could include a given collection
const collectionListKeys = createdBy => [
  'collections:list:admin',
  'collections:list:student',
  `collections:list:teacher:${createdBy}`
]

export default async function collectionRoutes(fastify) {
  fastify.addHook('preHandler', async (req, reply) => {
    if (req.url === '/health') return
    if (req.routeOptions?.url?.startsWith('/collections/internal/')) return
    await verifyAuth(req, reply)
  })

  // GET /collections — published for students; own for teachers; all for admin
  fastify.get('/collections', async (req, reply) => {
    try {
      const cacheKey = req.user.role === 'admin'
        ? 'collections:list:admin'
        : req.user.role === 'teacher'
          ? `collections:list:teacher:${req.user.id}`
          : 'collections:list:student'

      return await getOrSet(cacheKey, 60, async () => {
        let rows
        if (req.user.role === 'admin') {
          const r = await pool.query(`
            SELECT c.*,
              COALESCE(p.full_name, au.email, 'Unknown') AS creator_name,
              COALESCE(json_agg(json_build_object('id', e.id, 'title', e.title) ORDER BY ce.position)
                FILTER (WHERE e.id IS NOT NULL), '[]') AS exams,
              COALESCE((
                SELECT array_agg(DISTINCT t ORDER BY t)
                FROM collection_exams ce2
                JOIN exams e2 ON e2.id = ce2.exam_id
                CROSS JOIN LATERAL unnest(COALESCE(e2.tags, ARRAY[]::text[])) AS t
                WHERE ce2.collection_id = c.id
              ), ARRAY[]::text[]) AS tags,
              COUNT(DISTINCT sb.user_id)::int AS badge_count
            FROM collections c
            LEFT JOIN quiz_users.profiles p ON p.id = c.created_by
            LEFT JOIN auth.users au ON au.id = c.created_by
            LEFT JOIN collection_exams ce ON ce.collection_id = c.id
            LEFT JOIN exams e ON e.id = ce.exam_id
            LEFT JOIN quiz_submissions.student_badges sb ON sb.collection_id = c.id
            WHERE c.deleted_at IS NULL
            GROUP BY c.id, p.full_name, au.email ORDER BY c.created_at DESC`)
          rows = r.rows
        } else if (req.user.role === 'teacher') {
          const r = await pool.query(`
            SELECT c.*,
              COALESCE(p.full_name, au.email, 'Unknown') AS creator_name,
              COALESCE(json_agg(json_build_object('id', e.id, 'title', e.title) ORDER BY ce.position)
                FILTER (WHERE e.id IS NOT NULL), '[]') AS exams,
              COALESCE((
                SELECT array_agg(DISTINCT t ORDER BY t)
                FROM collection_exams ce2
                JOIN exams e2 ON e2.id = ce2.exam_id
                CROSS JOIN LATERAL unnest(COALESCE(e2.tags, ARRAY[]::text[])) AS t
                WHERE ce2.collection_id = c.id
              ), ARRAY[]::text[]) AS tags
            FROM collections c
            LEFT JOIN quiz_users.profiles p ON p.id = c.created_by
            LEFT JOIN auth.users au ON au.id = c.created_by
            LEFT JOIN collection_exams ce ON ce.collection_id = c.id
            LEFT JOIN exams e ON e.id = ce.exam_id
            WHERE c.created_by = $1 AND c.deleted_at IS NULL
            GROUP BY c.id, p.full_name, au.email ORDER BY c.created_at DESC`, [req.user.id])
          rows = r.rows
        } else {
          // Student: only published collections that have ≥1 published exam; only show published exams within
          const r = await pool.query(`
            SELECT c.*,
              COALESCE(p.full_name, au.email, 'Unknown') AS creator_name,
              COALESCE(json_agg(
                json_build_object(
                  'id', e.id, 'title', e.title, 'time_limit', e.time_limit,
                  'cover_image_url', e.cover_image_url, 'description', e.description,
                  'passing_score', e.passing_score, 'credit_cost', e.credit_cost
                ) ORDER BY ce.position
              ) FILTER (WHERE e.id IS NOT NULL AND e.is_published = true), '[]') AS exams,
              COALESCE((
                SELECT array_agg(DISTINCT t ORDER BY t)
                FROM collection_exams ce2
                JOIN exams e2 ON e2.id = ce2.exam_id
                CROSS JOIN LATERAL unnest(COALESCE(e2.tags, ARRAY[]::text[])) AS t
                WHERE ce2.collection_id = c.id AND e2.is_published = true
              ), ARRAY[]::text[]) AS tags
            FROM collections c
            LEFT JOIN quiz_users.profiles p ON p.id = c.created_by
            LEFT JOIN auth.users au ON au.id = c.created_by
            LEFT JOIN collection_exams ce ON ce.collection_id = c.id
            LEFT JOIN exams e ON e.id = ce.exam_id
            WHERE c.is_published = true AND c.deleted_at IS NULL
            GROUP BY c.id, p.full_name, au.email
            HAVING COUNT(DISTINCT e.id) FILTER (WHERE e.is_published = true) > 0
            ORDER BY c.created_at DESC`)
          rows = r.rows
        }
        return rows
      })
    } catch (err) {
      fastify.log.error(err)
      return reply.status(500).send({ error: 'Internal server error', statusCode: 500 })
    }
  })

  // POST /collections
  fastify.post('/collections', async (req, reply) => {
    if (req.ability.cannot('create', 'Collection')) {
      return reply.status(403).send({ error: 'Forbidden', statusCode: 403 })
    }
    const { title, description, badge_image_url, exam_ids = [] } = req.body ?? {}
    if (!title) return reply.status(400).send({ error: 'title required', statusCode: 400 })

    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const r = await client.query(
        `INSERT INTO collections (title, description, created_by, badge_image_url)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [title, description ?? null, req.user.id, badge_image_url ?? null]
      )
      const col = r.rows[0]
      if (exam_ids.length) {
        const vals = exam_ids.map((eid, i) => `($1, $${i + 2}, ${i})`).join(', ')
        await client.query(
          `INSERT INTO collection_exams (collection_id, exam_id, position) VALUES ${vals}`,
          [col.id, ...exam_ids]
        )
      }
      await client.query('COMMIT')
      col.exams = exam_ids
      invalidate(...collectionListKeys(req.user.id))
      return reply.status(201).send(col)
    } catch (err) {
      await client.query('ROLLBACK')
      fastify.log.error(err)
      return reply.status(500).send({ error: 'Internal server error', statusCode: 500 })
    } finally {
      client.release()
    }
  })

  // GET /collections/:id
  fastify.get('/collections/:id', async (req, reply) => {
    const { id } = req.params
    try {
      // The row itself is cheap (single indexed lookup) and needed for the
      // ability check on every request, so it is always read fresh — only
      // the aggregated exams/tags join below gets cached.
      const base = await pool.query('SELECT id, created_by, is_published, deleted_at FROM collections WHERE id = $1', [id])
      if (base.rows.length === 0 || base.rows[0].deleted_at) return reply.status(404).send({ error: 'Not found', statusCode: 404 })
      const baseCol = base.rows[0]

      if (req.ability.cannot('read', subject('Collection', baseCol))) {
        return reply.status(403).send({ error: 'Forbidden', statusCode: 403 })
      }

      const fetchFull = async () => {
        const r = await pool.query(`
          SELECT c.*,
            COALESCE(json_agg(
              json_build_object('id', e.id, 'title', e.title, 'time_limit', e.time_limit, 'is_published', e.is_published, 'passing_score', e.passing_score, 'credit_cost', e.credit_cost)
              ORDER BY ce.position
            ) FILTER (WHERE e.id IS NOT NULL), '[]') AS exams
          FROM collections c
          LEFT JOIN collection_exams ce ON ce.collection_id = c.id
          LEFT JOIN exams e ON e.id = ce.exam_id
          WHERE c.id = $1 AND c.deleted_at IS NULL
          GROUP BY c.id`, [id])
        return r.rows[0]
      }

      // Only cache when published: content is then identical for every
      // authorized viewer (student/teacher/admin all passed the same ability
      // check above), so sharing the cached body carries no leak risk.
      const col = baseCol.is_published
        ? await getOrSet(`collection:detail:${id}`, 60, fetchFull)
        : await fetchFull()

      return col
    } catch (err) {
      fastify.log.error(err)
      return reply.status(500).send({ error: 'Internal server error', statusCode: 500 })
    }
  })

  // PUT /collections/:id
  fastify.put('/collections/:id', async (req, reply) => {
    const { id } = req.params
    const { title, description, badge_image_url, is_published, exam_ids } = req.body ?? {}

    try {
      const existing = await pool.query('SELECT * FROM collections WHERE id = $1 AND deleted_at IS NULL', [id])
      if (existing.rows.length === 0) return reply.status(404).send({ error: 'Not found', statusCode: 404 })
      const col = existing.rows[0]

      if (req.ability.cannot('update', subject('Collection', col))) {
        return reply.status(403).send({ error: 'Forbidden', statusCode: 403 })
      }

      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        const r = await client.query(`
          UPDATE collections SET
            title          = COALESCE($1, title),
            description    = COALESCE($2, description),
            badge_image_url= COALESCE($3, badge_image_url),
            is_published   = COALESCE($4, is_published),
            updated_at     = NOW()
          WHERE id = $5 RETURNING *`,
          [title ?? null, description ?? null, badge_image_url ?? null, is_published ?? null, id]
        )
        if (exam_ids !== undefined) {
          await client.query('DELETE FROM collection_exams WHERE collection_id = $1', [id])
          if (exam_ids.length) {
            const vals = exam_ids.map((eid, i) => `($1, $${i + 2}, ${i})`).join(', ')
            await client.query(
              `INSERT INTO collection_exams (collection_id, exam_id, position) VALUES ${vals}`,
              [id, ...exam_ids]
            )
          }
        }
        await client.query('COMMIT')
        invalidate(...collectionListKeys(col.created_by), `collection:detail:${id}`)
        return r.rows[0]
      } catch (err) {
        await client.query('ROLLBACK')
        throw err
      } finally {
        client.release()
      }
    } catch (err) {
      fastify.log.error(err)
      return reply.status(500).send({ error: 'Internal server error', statusCode: 500 })
    }
  })

  // DELETE /collections/:id — soft delete
  fastify.delete('/collections/:id', async (req, reply) => {
    const { id } = req.params
    try {
      const existing = await pool.query('SELECT * FROM collections WHERE id = $1 AND deleted_at IS NULL', [id])
      if (existing.rows.length === 0) return reply.status(404).send({ error: 'Not found', statusCode: 404 })

      if (req.ability.cannot('delete', subject('Collection', existing.rows[0]))) {
        return reply.status(403).send({ error: 'Forbidden', statusCode: 403 })
      }
      await pool.query('UPDATE collections SET deleted_at = NOW() WHERE id = $1', [id])
      invalidate(...collectionListKeys(existing.rows[0].created_by), `collection:detail:${id}`)
      return { success: true }
    } catch (err) {
      fastify.log.error(err)
      return reply.status(500).send({ error: 'Internal server error', statusCode: 500 })
    }
  })

  // GET /collections/internal/check-badge — called by submission-service
  fastify.get('/collections/internal/check-badge', async (req, reply) => {
    const key = req.headers['x-internal-key']
    if (!key || key !== process.env.INTERNAL_API_KEY) {
      return reply.status(403).send({ error: 'Forbidden', statusCode: 403 })
    }
    const { exam_id } = req.query
    if (!exam_id) return reply.status(400).send({ error: 'exam_id required', statusCode: 400 })

    try {
      const r = await pool.query(`
        SELECT c.id, c.title, c.badge_image_url,
          (SELECT array_agg(ce2.exam_id) FROM collection_exams ce2 WHERE ce2.collection_id = c.id) AS exam_ids
        FROM collection_exams ce
        JOIN collections c ON c.id = ce.collection_id
        WHERE ce.exam_id = $1 AND c.is_published = true AND c.deleted_at IS NULL`, [exam_id])
      return r.rows
    } catch (err) {
      fastify.log.error(err)
      return reply.status(500).send({ error: 'Internal server error', statusCode: 500 })
    }
  })
}
