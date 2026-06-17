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

    const { title, description, time_limit = 30, passing_score = null, tags = [], show_explanation = false, allow_retake = false } = req.body ?? {}
    if (!title) {
      return reply.status(400).send({ error: 'Title required', statusCode: 400 })
    }

    try {
      const result = await pool.query(
        'INSERT INTO exams (title, description, time_limit, passing_score, created_by, tags, show_explanation, allow_retake) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
        [title, description, time_limit, passing_score, req.user.id, tags, show_explanation, allow_retake]
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
      let query, params = []

      if (req.user.role === 'student') {
        query = 'SELECT * FROM exams WHERE is_published = true ORDER BY created_at DESC'
      } else if (req.user.role === 'teacher') {
        query = 'SELECT * FROM exams WHERE created_by = $1 ORDER BY created_at DESC'
        params = [req.user.id]
      } else {
        query = 'SELECT * FROM exams ORDER BY created_at DESC'
      }

      const result = await pool.query(query, params)
      return result.rows
    } catch (err) {
      fastify.log.error(err)
      return reply.status(500).send({ error: 'Internal server error', statusCode: 500 })
    }
  })

  // GET /exams/:id
  fastify.get('/exams/:id', async (req, reply) => {
    const { id } = req.params
    const isStudent = req.user.role === 'student'

    try {
      const examResult = await pool.query('SELECT * FROM exams WHERE id = $1', [id])
      if (examResult.rows.length === 0) {
        return reply.status(404).send({ error: 'Exam not found', statusCode: 404 })
      }

      const exam = examResult.rows[0]
      if (req.ability.cannot('read', subject('Exam', exam))) {
        return reply.status(404).send({ error: 'Exam not found', statusCode: 404 })
      }

      const questionsResult = await pool.query(
        'SELECT * FROM questions WHERE exam_id = $1 ORDER BY order_index',
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

      return { ...exam, questions }
    } catch (err) {
      fastify.log.error(err)
      return reply.status(500).send({ error: 'Internal server error', statusCode: 500 })
    }
  })

  // PUT /exams/:id
  fastify.put('/exams/:id', async (req, reply) => {
    const { id } = req.params
    const { title, description, time_limit, passing_score, is_published, tags, show_explanation, allow_retake } = req.body ?? {}

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
          time_limit = COALESCE($3, time_limit),
          passing_score = CASE WHEN $4::float IS NOT NULL THEN $4::float ELSE passing_score END,
          is_published = COALESCE($5, is_published),
          tags = COALESCE($6, tags),
          show_explanation = COALESCE($7, show_explanation),
          allow_retake = COALESCE($9, allow_retake)
         WHERE id = $8 RETURNING *`,
        [title, description, time_limit, passing_score ?? null, is_published, tags ?? null, show_explanation ?? null, id, allow_retake ?? null]
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
    const { content, options, correct_answer: ca, points = 1.0, order_index = 0, explanation = null, question_type = 'single' } = req.body ?? {}
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
        `INSERT INTO questions (exam_id, content, options, correct_answer, points, order_index, explanation, question_type)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [id, content, JSON.stringify(options), correct_answer, points, order_index, explanation, question_type]
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
    const { content, options, correct_answer: ca2, points, order_index, explanation, question_type } = req.body ?? {}
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
          options = COALESCE($2, options),
          correct_answer = COALESCE($3, correct_answer),
          points = COALESCE($4, points),
          order_index = COALESCE($5, order_index),
          explanation = COALESCE($6, explanation),
          question_type = COALESCE($7, question_type)
         WHERE id = $8 AND exam_id = $9 RETURNING *`,
        [content, options ? JSON.stringify(options) : null, correct_answer ?? null, points, order_index, explanation ?? null, question_type ?? null, qid, id]
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
