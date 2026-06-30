import { subject } from '@casl/ability'
import { pool } from '../db.js'
import { verifyAuth } from '../middleware/auth.js'

export default async function examRoutes(fastify) {
  fastify.addHook('preHandler', async (req, reply) => {
    if (req.url === '/health') return
    if (req.url.startsWith('/exams/internal/')) return
    await verifyAuth(req, reply)
  })

  // Internal endpoint for submission-service grading (not via Nginx)
  fastify.get('/exams/internal/:id', async (req, reply) => {
    const internalKey = req.headers['x-internal-key']
    if (!internalKey || internalKey !== process.env.INTERNAL_API_KEY) {
      return reply.status(403).send({ error: 'Forbidden', statusCode: 403 })
    }

    const { id } = req.params
    try {
      const examResult = await pool.query('SELECT * FROM exams WHERE id = $1', [id])
      if (examResult.rows.length === 0) {
        return reply.status(404).send({ error: 'Exam not found', statusCode: 404 })
      }

      const questionsResult = await pool.query(
        'SELECT * FROM questions WHERE exam_id = $1 ORDER BY order_index',
        [id]
      )

      return { ...examResult.rows[0], questions: questionsResult.rows }
    } catch (err) {
      fastify.log.error(err)
      return reply.status(500).send({ error: 'Internal server error', statusCode: 500 })
    }
  })

  // POST /exams
  fastify.post('/exams', async (req, reply) => {
    if (req.ability.cannot('create', 'Exam')) {
      return reply.status(403).send({ error: 'Forbidden', statusCode: 403 })
    }

    const { title, description, cover_image_url = null, time_limit = 30, passing_score = null, tags = [], show_explanation = false, allow_retake = false, credit_cost = null, cooldown_minutes = 0, max_attempts = null, scheduled_at = null } = req.body ?? {}
    if (!title) {
      return reply.status(400).send({ error: 'Title required', statusCode: 400 })
    }

    try {
      const result = await pool.query(
        'INSERT INTO exams (title, description, cover_image_url, time_limit, passing_score, created_by, tags, show_explanation, allow_retake, credit_cost, cooldown_minutes, max_attempts, scheduled_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *',
        [title, description, cover_image_url, time_limit, passing_score, req.user.id, tags, show_explanation, allow_retake, credit_cost, cooldown_minutes, max_attempts, scheduled_at || null]
      )
      return reply.status(201).send(result.rows[0])
    } catch (err) {
      fastify.log.error(err)
      return reply.status(500).send({ error: 'Internal server error', statusCode: 500 })
    }
  })

  // GET /exams
  fastify.get('/exams', async (req, reply) => {
    try {
      const isStudent = req.user.role === 'student'

      const { creator_id } = req.query

      // Student list: only published exams, public fields only
      const studentBase = `
        SELECT e.id, e.title, e.description, e.cover_image_url, e.time_limit,
          e.passing_score, e.tags, e.credit_cost, e.created_at, e.scheduled_at,
          e.created_by,
          COALESCE(p.full_name, au.email, 'Unknown') AS creator_name,
          p.avatar_url AS creator_avatar,
          COUNT(DISTINCT CASE WHEN (sp.role IS NULL OR sp.role != 'banned') THEN s.id END)::int AS submission_count,
          COUNT(DISTINCT CASE WHEN (sp.role IS NULL OR sp.role != 'banned') AND (e.passing_score IS NULL OR s.percentage >= e.passing_score) THEN s.id END)::int AS pass_count
        FROM exams e
        LEFT JOIN quiz_users.profiles p ON p.id = e.created_by
        LEFT JOIN auth.users au ON au.id = e.created_by
        LEFT JOIN quiz_submissions.submissions s ON s.exam_id = e.id
        LEFT JOIN quiz_users.profiles sp ON sp.id = s.user_id`

      // Teacher/admin: full fields + stats
      const fullSelect = `
        SELECT e.*,
          COALESCE(p.full_name, au.email, 'Unknown') AS creator_name,
          p.avatar_url AS creator_avatar,
          COUNT(DISTINCT CASE WHEN (sp.role IS NULL OR sp.role != 'banned') THEN s.id END)::int AS submission_count,
          COUNT(DISTINCT CASE WHEN (sp.role IS NULL OR sp.role != 'banned') AND (e.passing_score IS NULL OR s.percentage >= e.passing_score) THEN s.id END)::int AS pass_count
        FROM exams e
        LEFT JOIN quiz_users.profiles p ON p.id = e.created_by
        LEFT JOIN auth.users au ON au.id = e.created_by
        LEFT JOIN quiz_submissions.submissions s ON s.exam_id = e.id
        LEFT JOIN quiz_users.profiles sp ON sp.id = s.user_id
      `
      const group = 'GROUP BY e.id, p.full_name, p.avatar_url, au.email ORDER BY e.created_at DESC'

      let query, params = []
      if (isStudent || creator_id) {
        // When filtering by creator (public profile page), anyone gets published exams only
        if (creator_id) {
          query = `${studentBase} WHERE e.is_published = true AND e.created_by = $1 GROUP BY e.id, p.full_name, p.avatar_url, au.email ORDER BY e.created_at DESC`
          params = [creator_id]
        } else {
          query = `${studentBase} WHERE e.is_published = true GROUP BY e.id, p.full_name, p.avatar_url, au.email ORDER BY e.created_at DESC`
        }
      } else if (req.user.role === 'teacher') {
        query = `${fullSelect} WHERE e.created_by = $1 ${group}`
        params = [req.user.id]
      } else {
        query = `${fullSelect} ${group}`
      }

      const result = await pool.query(query, params)
      return result.rows
    } catch (err) {
      fastify.log.error(err)
      return reply.status(500).send({ error: 'Internal server error', statusCode: 500 })
    }
  })

  // GET /exams/:id
  // ?preview=true → returns only first 3 questions (for detail page student view)
  fastify.get('/exams/:id', async (req, reply) => {
    const { id } = req.params
    const isStudent = req.user.role === 'student'
    const isPreview = req.query.preview === 'true'

    try {
      const examResult = await pool.query('SELECT * FROM exams WHERE id = $1', [id])
      if (examResult.rows.length === 0) {
        return reply.status(404).send({ error: 'Exam not found', statusCode: 404 })
      }

      const exam = examResult.rows[0]
      if (req.ability.cannot('read', subject('Exam', exam))) {
        return reply.status(404).send({ error: 'Exam not found', statusCode: 404 })
      }

      const countResult = await pool.query(
        'SELECT COUNT(*)::int AS n FROM questions WHERE exam_id = $1',
        [id]
      )
      const question_count = countResult.rows[0].n

      const questionsResult = await pool.query(
        `SELECT * FROM questions WHERE exam_id = $1 ORDER BY order_index${isPreview ? ' LIMIT 3' : ''}`,
        [id]
      )

      let questions = questionsResult.rows
      if (isStudent) {
        questions = questions.map(({ correct_answer, explanation, ...q }) => {
          if (q.question_type === 'multiple') {
            const correct_count = (correct_answer ?? '').split(',').filter(Boolean).length
            return { ...q, correct_count }
          }
          return q
        })
      }

      // Strip internal fields not needed by students
      if (isStudent) {
        const { created_by, show_explanation, allow_retake, ...examPublic } = exam
        return { ...examPublic, question_count, questions }
      }

      return { ...exam, question_count, questions }
    } catch (err) {
      fastify.log.error(err)
      return reply.status(500).send({ error: 'Internal server error', statusCode: 500 })
    }
  })

  // PUT /exams/:id
  fastify.put('/exams/:id', async (req, reply) => {
    const { id } = req.params
    const body = req.body ?? {}
    const { title, description, cover_image_url, time_limit, passing_score, is_published, tags, show_explanation, allow_retake, credit_cost, cooldown_minutes, max_attempts } = body
    const has_scheduled_at = 'scheduled_at' in body
    const scheduled_at_val = has_scheduled_at ? (body.scheduled_at || null) : undefined

    try {
      const examResult = await pool.query('SELECT * FROM exams WHERE id = $1', [id])
      if (examResult.rows.length === 0) {
        return reply.status(404).send({ error: 'Exam not found', statusCode: 404 })
      }

      const exam = examResult.rows[0]
      if (req.ability.cannot('update', subject('Exam', exam))) {
        return reply.status(403).send({ error: 'Forbidden', statusCode: 403 })
      }

      const result = await pool.query(
        `UPDATE exams SET
          title = COALESCE($1, title),
          description = COALESCE($2, description),
          cover_image_url = COALESCE($3, cover_image_url),
          time_limit = COALESCE($4, time_limit),
          passing_score = CASE WHEN $5::float IS NOT NULL THEN $5::float ELSE passing_score END,
          is_published = COALESCE($6, is_published),
          tags = COALESCE($7, tags),
          show_explanation = COALESCE($8, show_explanation),
          allow_retake = COALESCE($10, allow_retake),
          credit_cost = COALESCE($11, credit_cost),
          cooldown_minutes = COALESCE($12, cooldown_minutes),
          max_attempts = CASE WHEN $13::int IS NOT NULL THEN $13::int ELSE max_attempts END,
          scheduled_at = CASE WHEN $14 THEN $15::timestamptz ELSE scheduled_at END
         WHERE id = $9 RETURNING *`,
        [title, description, cover_image_url ?? null, time_limit, passing_score ?? null, is_published, tags ?? null, show_explanation ?? null, id, allow_retake ?? null, credit_cost ?? null, cooldown_minutes ?? null, max_attempts ?? null, has_scheduled_at, scheduled_at_val]
      )
      return result.rows[0]
    } catch (err) {
      fastify.log.error(err)
      return reply.status(500).send({ error: 'Internal server error', statusCode: 500 })
    }
  })

  // DELETE /exams/:id
  fastify.delete('/exams/:id', async (req, reply) => {
    const { id } = req.params

    try {
      const examResult = await pool.query('SELECT * FROM exams WHERE id = $1', [id])
      if (examResult.rows.length === 0) {
        return reply.status(404).send({ error: 'Exam not found', statusCode: 404 })
      }

      const exam = examResult.rows[0]
      if (req.ability.cannot('delete', subject('Exam', exam))) {
        return reply.status(403).send({ error: 'Forbidden', statusCode: 403 })
      }

      await pool.query('DELETE FROM exams WHERE id = $1', [id])
      return reply.status(204).send()
    } catch (err) {
      fastify.log.error(err)
      return reply.status(500).send({ error: 'Internal server error', statusCode: 500 })
    }
  })

  // POST /exams/:id/questions
  fastify.post('/exams/:id/questions', async (req, reply) => {
    const { id } = req.params
    const { content, image_url = null, options, correct_answer: ca, points = 1.0, order_index = 0, explanation = null, question_type = 'single' } = req.body ?? {}
    const correct_answer = Array.isArray(ca) ? [...ca].sort().join(',') : ca

    if (!content || !options || !correct_answer) {
      return reply.status(400).send({ error: 'content, options, correct_answer required', statusCode: 400 })
    }

    try {
      const examResult = await pool.query('SELECT * FROM exams WHERE id = $1', [id])
      if (examResult.rows.length === 0) {
        return reply.status(404).send({ error: 'Exam not found', statusCode: 404 })
      }

      if (req.ability.cannot('update', subject('Exam', examResult.rows[0]))) {
        return reply.status(403).send({ error: 'Forbidden', statusCode: 403 })
      }

      const result = await pool.query(
        `INSERT INTO questions (exam_id, content, image_url, options, correct_answer, points, order_index, explanation, question_type)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
        [id, content, image_url, JSON.stringify(options), correct_answer, points, order_index, explanation, question_type]
      )
      return reply.status(201).send(result.rows[0])
    } catch (err) {
      fastify.log.error(err)
      return reply.status(500).send({ error: 'Internal server error', statusCode: 500 })
    }
  })

  // PUT /exams/:id/questions/:qid
  fastify.put('/exams/:id/questions/:qid', async (req, reply) => {
    const { id, qid } = req.params
    const { content, image_url, options, correct_answer: ca2, points, order_index, explanation, question_type } = req.body ?? {}
    const correct_answer = ca2 != null ? (Array.isArray(ca2) ? [...ca2].sort().join(',') : ca2) : undefined

    try {
      const examResult = await pool.query('SELECT * FROM exams WHERE id = $1', [id])
      if (examResult.rows.length === 0) {
        return reply.status(404).send({ error: 'Exam not found', statusCode: 404 })
      }

      if (req.ability.cannot('update', subject('Exam', examResult.rows[0]))) {
        return reply.status(403).send({ error: 'Forbidden', statusCode: 403 })
      }

      const result = await pool.query(
        `UPDATE questions SET
          content = COALESCE($1, content),
          image_url = COALESCE($2, image_url),
          options = COALESCE($3, options),
          correct_answer = COALESCE($4, correct_answer),
          points = COALESCE($5, points),
          order_index = COALESCE($6, order_index),
          explanation = COALESCE($7, explanation),
          question_type = COALESCE($8, question_type)
         WHERE id = $9 AND exam_id = $10 RETURNING *`,
        [content, image_url ?? null, options ? JSON.stringify(options) : null, correct_answer ?? null, points, order_index, explanation ?? null, question_type ?? null, qid, id]
      )

      if (result.rows.length === 0) {
        return reply.status(404).send({ error: 'Question not found', statusCode: 404 })
      }
      return result.rows[0]
    } catch (err) {
      fastify.log.error(err)
      return reply.status(500).send({ error: 'Internal server error', statusCode: 500 })
    }
  })

  // DELETE /exams/:id/questions/:qid
  fastify.delete('/exams/:id/questions/:qid', async (req, reply) => {
    const { id, qid } = req.params

    try {
      const examResult = await pool.query('SELECT * FROM exams WHERE id = $1', [id])
      if (examResult.rows.length === 0) {
        return reply.status(404).send({ error: 'Exam not found', statusCode: 404 })
      }

      if (req.ability.cannot('update', subject('Exam', examResult.rows[0]))) {
        return reply.status(403).send({ error: 'Forbidden', statusCode: 403 })
      }

      await pool.query('DELETE FROM questions WHERE id = $1 AND exam_id = $2', [qid, id])
      return reply.status(204).send()
    } catch (err) {
      fastify.log.error(err)
      return reply.status(500).send({ error: 'Internal server error', statusCode: 500 })
    }
  })
}
