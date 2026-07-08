import { subject } from '@casl/ability'
import { pool } from '../db.js'
import { verifyAuth, optionalAuth } from '../middleware/auth.js'
import { getOrSet, invalidate } from '../lib/cache.js'

const COMMENTS_PER_PAGE = 10
const REPORT_CATEGORIES = ['question_wrong', 'answer_wrong', 'image_issue', 'other']

export default async function interactionRoutes(fastify) {
  // ── Public reads (lenient auth: know caller if a token is present) ──────────

  // Aggregate counts + caller's like state for an exam hero/detail page.
  // Counts are shared/global so they're cached; `liked` is per-caller and
  // always computed fresh so it's never served from another user's cache.
  fastify.get('/exams/:examId/summary', { preHandler: optionalAuth }, async (req) => {
    const { examId } = req.params
    const [counts, liked] = await Promise.all([
      getOrSet(`interactions:counts:${examId}`, 60, async () => {
        const [likeCount, commentCount] = await Promise.all([
          pool.query('SELECT COUNT(*)::int AS n FROM quiz_interactions.likes WHERE exam_id = $1', [examId]),
          pool.query('SELECT COUNT(*)::int AS n FROM quiz_interactions.comments WHERE exam_id = $1', [examId])
        ])
        return { like_count: likeCount.rows[0].n, comment_count: commentCount.rows[0].n }
      }),
      req.user
        ? pool.query('SELECT 1 FROM quiz_interactions.likes WHERE exam_id = $1 AND user_id = $2', [examId, req.user.id])
        : Promise.resolve({ rowCount: 0 })
    ])
    return {
      like_count: counts.like_count,
      comment_count: counts.comment_count,
      liked: liked.rowCount > 0
    }
  })

  // Paginated comments (10/page) with author name + avatar (cross-schema join)
  fastify.get('/exams/:examId/comments', { preHandler: optionalAuth }, async (req) => {
    const { examId } = req.params
    const page = Math.max(1, parseInt(req.query.page ?? '1', 10) || 1)
    const offset = (page - 1) * COMMENTS_PER_PAGE

    const [items, count] = await Promise.all([
      pool.query(
        `SELECT c.id, c.exam_id, c.user_id, c.content, c.created_at, c.updated_at,
                p.full_name, p.avatar_url
         FROM quiz_interactions.comments c
         LEFT JOIN quiz_users.profiles p ON p.id = c.user_id
         WHERE c.exam_id = $1
         ORDER BY c.created_at DESC
         LIMIT $2 OFFSET $3`,
        [examId, COMMENTS_PER_PAGE, offset]
      ),
      pool.query('SELECT COUNT(*)::int AS n FROM quiz_interactions.comments WHERE exam_id = $1', [examId])
    ])

    const total = count.rows[0].n
    return {
      comments: items.rows,
      page,
      per_page: COMMENTS_PER_PAGE,
      total,
      total_pages: Math.max(1, Math.ceil(total / COMMENTS_PER_PAGE))
    }
  })

  // ── Authenticated writes/reads ──────────────────────────────────────────────

  // Comments: any logged-in user may create
  fastify.post('/exams/:examId/comments', { preHandler: verifyAuth }, async (req, reply) => {
    if (req.ability.cannot('create', 'Comment')) {
      return reply.status(403).send({ error: 'Forbidden', statusCode: 403 })
    }
    const { examId } = req.params
    const content = (req.body?.content ?? '').trim()
    if (!content) return reply.status(400).send({ error: 'content required', statusCode: 400 })
    if (content.length > 2000) return reply.status(400).send({ error: 'content too long', statusCode: 400 })

    const { rows } = await pool.query(
      `INSERT INTO quiz_interactions.comments (exam_id, user_id, content)
       VALUES ($1, $2, $3) RETURNING *`,
      [examId, req.user.id, content]
    )
    invalidate(`interactions:counts:${examId}`)
    // Attach author snapshot for immediate render
    const prof = await pool.query(
      'SELECT full_name, avatar_url FROM quiz_users.profiles WHERE id = $1',
      [req.user.id]
    )
    return reply.status(201).send({ ...rows[0], ...(prof.rows[0] ?? {}) })
  })

  fastify.patch('/comments/:id', { preHandler: verifyAuth }, async (req, reply) => {
    const { id } = req.params
    const content = (req.body?.content ?? '').trim()
    if (!content) return reply.status(400).send({ error: 'content required', statusCode: 400 })

    const { rows } = await pool.query('SELECT * FROM quiz_interactions.comments WHERE id = $1', [id])
    const comment = rows[0]
    if (!comment) return reply.status(404).send({ error: 'Comment not found', statusCode: 404 })
    if (req.ability.cannot('update', subject('Comment', comment))) {
      return reply.status(403).send({ error: 'Forbidden', statusCode: 403 })
    }

    const upd = await pool.query(
      `UPDATE quiz_interactions.comments SET content = $1, updated_at = NOW()
       WHERE id = $2 RETURNING *`,
      [content, id]
    )
    return upd.rows[0]
  })

  fastify.delete('/comments/:id', { preHandler: verifyAuth }, async (req, reply) => {
    const { id } = req.params
    const { rows } = await pool.query('SELECT * FROM quiz_interactions.comments WHERE id = $1', [id])
    const comment = rows[0]
    if (!comment) return reply.status(404).send({ error: 'Comment not found', statusCode: 404 })
    if (req.ability.cannot('delete', subject('Comment', comment))) {
      return reply.status(403).send({ error: 'Forbidden', statusCode: 403 })
    }
    await pool.query('DELETE FROM quiz_interactions.comments WHERE id = $1', [id])
    invalidate(`interactions:counts:${comment.exam_id}`)
    return { ok: true }
  })

  // Likes: students only; toggle heart
  fastify.post('/exams/:examId/like', { preHandler: verifyAuth }, async (req, reply) => {
    if (req.ability.cannot('create', 'Like')) {
      return reply.status(403).send({ error: 'Chỉ học viên mới có thể thích đề thi', statusCode: 403 })
    }
    const { examId } = req.params
    const existing = await pool.query(
      'SELECT 1 FROM quiz_interactions.likes WHERE exam_id = $1 AND user_id = $2',
      [examId, req.user.id]
    )
    let liked
    if (existing.rowCount > 0) {
      await pool.query('DELETE FROM quiz_interactions.likes WHERE exam_id = $1 AND user_id = $2', [examId, req.user.id])
      liked = false
    } else {
      await pool.query(
        `INSERT INTO quiz_interactions.likes (exam_id, user_id) VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [examId, req.user.id]
      )
      liked = true
    }
    invalidate(`interactions:counts:${examId}`)
    const count = await pool.query(
      'SELECT COUNT(*)::int AS n FROM quiz_interactions.likes WHERE exam_id = $1', [examId]
    )
    return { liked, like_count: count.rows[0].n }
  })

  // Reports: only users who finished the exam may file one
  fastify.post('/exams/:examId/reports', { preHandler: verifyAuth }, async (req, reply) => {
    if (req.ability.cannot('create', 'Report')) {
      return reply.status(403).send({ error: 'Forbidden', statusCode: 403 })
    }
    const { examId } = req.params
    const category = req.body?.category
    const description = (req.body?.description ?? '').trim()
    if (!REPORT_CATEGORIES.includes(category)) {
      return reply.status(400).send({ error: 'category không hợp lệ', statusCode: 400 })
    }
    if (!description) return reply.status(400).send({ error: 'description required', statusCode: 400 })
    if (description.length > 4000) return reply.status(400).send({ error: 'description too long', statusCode: 400 })

    // Must have completed a submission for this exam (cross-schema read)
    const done = await pool.query(
      `SELECT 1 FROM quiz_submissions.submissions
       WHERE exam_id = $1 AND user_id = $2 AND status IN ('completed', 'timed_out')
       LIMIT 1`,
      [examId, req.user.id]
    )
    if (done.rowCount === 0) {
      return reply.status(403).send({ error: 'Chỉ báo lỗi sau khi đã hoàn thành bài thi', statusCode: 403 })
    }

    // Denormalize exam owner for fast inbox filtering
    const owner = await pool.query('SELECT created_by FROM quiz_exams.exams WHERE id = $1', [examId])
    if (owner.rowCount === 0) return reply.status(404).send({ error: 'Exam not found', statusCode: 404 })

    const { rows } = await pool.query(
      `INSERT INTO quiz_interactions.reports (exam_id, exam_owner_id, reporter_id, category, description)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [examId, owner.rows[0].created_by, req.user.id, category, description]
    )
    return reply.status(201).send(rows[0])
  })

  // Reporter's own history (for the profile "my reports" section)
  fastify.get('/reports/mine', { preHandler: verifyAuth }, async (req) => {
    const { rows } = await pool.query(
      `SELECT r.*, e.title AS exam_title
       FROM quiz_interactions.reports r
       LEFT JOIN quiz_exams.exams e ON e.id = r.exam_id
       WHERE r.reporter_id = $1
       ORDER BY r.created_at DESC`,
      [req.user.id]
    )
    return { reports: rows }
  })

  // Teacher/admin inbox: reports on exams they own (admin sees all)
  fastify.get('/reports/inbox', { preHandler: verifyAuth }, async (req, reply) => {
    if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
      return reply.status(403).send({ error: 'Forbidden', statusCode: 403 })
    }
    const status = req.query.status // optional: 'open' | 'resolved'
    const params = []
    const where = []
    if (req.user.role !== 'admin') {
      params.push(req.user.id)
      where.push(`r.exam_owner_id = $${params.length}`)
    }
    if (status === 'open' || status === 'resolved') {
      params.push(status)
      where.push(`r.status = $${params.length}`)
    }
    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : ''

    const { rows } = await pool.query(
      `SELECT r.*, e.title AS exam_title, p.full_name AS reporter_name
       FROM quiz_interactions.reports r
       LEFT JOIN quiz_exams.exams e ON e.id = r.exam_id
       LEFT JOIN quiz_users.profiles p ON p.id = r.reporter_id
       ${whereClause}
       ORDER BY r.status = 'open' DESC, r.created_at DESC`,
      params
    )
    return { reports: rows }
  })

  // Unread badge count = open reports in the caller's inbox
  fastify.get('/reports/inbox/count', { preHandler: verifyAuth }, async (req, reply) => {
    if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
      return reply.status(403).send({ error: 'Forbidden', statusCode: 403 })
    }
    const sql = req.user.role === 'admin'
      ? `SELECT COUNT(*)::int AS n FROM quiz_interactions.reports WHERE status = 'open'`
      : `SELECT COUNT(*)::int AS n FROM quiz_interactions.reports WHERE status = 'open' AND exam_owner_id = $1`
    const { rows } = await pool.query(sql, req.user.role === 'admin' ? [] : [req.user.id])
    return { open_count: rows[0].n }
  })

  // Owner/admin responds to a report → marks it resolved
  fastify.patch('/reports/:id', { preHandler: verifyAuth }, async (req, reply) => {
    const { id } = req.params
    const response = (req.body?.response ?? '').trim()
    const status = req.body?.status ?? 'resolved'
    if (!['open', 'resolved'].includes(status)) {
      return reply.status(400).send({ error: 'status không hợp lệ', statusCode: 400 })
    }

    const { rows } = await pool.query('SELECT * FROM quiz_interactions.reports WHERE id = $1', [id])
    const report = rows[0]
    if (!report) return reply.status(404).send({ error: 'Report not found', statusCode: 404 })
    if (req.ability.cannot('respond', subject('Report', report))) {
      return reply.status(403).send({ error: 'Forbidden', statusCode: 403 })
    }

    const upd = await pool.query(
      `UPDATE quiz_interactions.reports
       SET response = $1, status = $2,
           responded_by = $3, responded_at = CASE WHEN $1 <> '' THEN NOW() ELSE responded_at END
       WHERE id = $4 RETURNING *`,
      [response, status, req.user.id, id]
    )
    return upd.rows[0]
  })
}
