import { pool } from '../db.js'
import { verifyAuth } from '../middleware/auth.js'

const TEACHER_ROLES = ['teacher', 'admin']

export default async function examRoutes(fastify) {
  fastify.addHook('preHandler', async (req, reply) => {
    if (req.url === '/health') return
    if (req.url.startsWith('/exams/internal/')) return
    await verifyAuth(req, reply, fastify)
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
    if (!TEACHER_ROLES.includes(req.user.role)) {
      return reply.status(403).send({ error: 'Forbidden', statusCode: 403 })
    }

    const { title, description, time_limit = 30 } = req.body ?? {}
    if (!title) {
      return reply.status(400).send({ error: 'Title required', statusCode: 400 })
    }

    try {
      const result = await pool.query(
        'INSERT INTO exams (title, description, time_limit, created_by) VALUES ($1, $2, $3, $4) RETURNING *',
        [title, description, time_limit, req.user.userId]
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
        params = [req.user.userId]
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
      if (isStudent && !exam.is_published) {
        return reply.status(404).send({ error: 'Exam not found', statusCode: 404 })
      }

      const questionsResult = await pool.query(
        'SELECT * FROM questions WHERE exam_id = $1 ORDER BY order_index',
        [id]
      )

      let questions = questionsResult.rows
      if (isStudent) {
        questions = questions.map(({ correct_answer, ...q }) => q)
      }

      return { ...exam, questions }
    } catch (err) {
      fastify.log.error(err)
      return reply.status(500).send({ error: 'Internal server error', statusCode: 500 })
    }
  })

  // PUT /exams/:id
  fastify.put('/exams/:id', async (req, reply) => {
    if (!TEACHER_ROLES.includes(req.user.role)) {
      return reply.status(403).send({ error: 'Forbidden', statusCode: 403 })
    }

    const { id } = req.params
    const { title, description, time_limit, is_published } = req.body ?? {}

    try {
      const examResult = await pool.query('SELECT * FROM exams WHERE id = $1', [id])
      if (examResult.rows.length === 0) {
        return reply.status(404).send({ error: 'Exam not found', statusCode: 404 })
      }

      const exam = examResult.rows[0]
      if (req.user.role === 'teacher' && exam.created_by !== req.user.userId) {
        return reply.status(403).send({ error: 'Forbidden', statusCode: 403 })
      }

      const result = await pool.query(
        `UPDATE exams SET
          title = COALESCE($1, title),
          description = COALESCE($2, description),
          time_limit = COALESCE($3, time_limit),
          is_published = COALESCE($4, is_published)
         WHERE id = $5 RETURNING *`,
        [title, description, time_limit, is_published, id]
      )
      return result.rows[0]
    } catch (err) {
      fastify.log.error(err)
      return reply.status(500).send({ error: 'Internal server error', statusCode: 500 })
    }
  })

  // DELETE /exams/:id
  fastify.delete('/exams/:id', async (req, reply) => {
    if (!TEACHER_ROLES.includes(req.user.role)) {
      return reply.status(403).send({ error: 'Forbidden', statusCode: 403 })
    }

    const { id } = req.params

    try {
      const examResult = await pool.query('SELECT * FROM exams WHERE id = $1', [id])
      if (examResult.rows.length === 0) {
        return reply.status(404).send({ error: 'Exam not found', statusCode: 404 })
      }

      const exam = examResult.rows[0]
      if (req.user.role === 'teacher' && exam.created_by !== req.user.userId) {
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
    if (!TEACHER_ROLES.includes(req.user.role)) {
      return reply.status(403).send({ error: 'Forbidden', statusCode: 403 })
    }

    const { id } = req.params
    const { content, options, correct_answer, points = 1.0, order_index = 0 } = req.body ?? {}

    if (!content || !options || !correct_answer) {
      return reply.status(400).send({ error: 'content, options, correct_answer required', statusCode: 400 })
    }

    try {
      const result = await pool.query(
        `INSERT INTO questions (exam_id, content, options, correct_answer, points, order_index)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [id, content, JSON.stringify(options), correct_answer, points, order_index]
      )
      return reply.status(201).send(result.rows[0])
    } catch (err) {
      fastify.log.error(err)
      return reply.status(500).send({ error: 'Internal server error', statusCode: 500 })
    }
  })

  // PUT /exams/:id/questions/:qid
  fastify.put('/exams/:id/questions/:qid', async (req, reply) => {
    if (!TEACHER_ROLES.includes(req.user.role)) {
      return reply.status(403).send({ error: 'Forbidden', statusCode: 403 })
    }

    const { id, qid } = req.params
    const { content, options, correct_answer, points, order_index } = req.body ?? {}

    try {
      const result = await pool.query(
        `UPDATE questions SET
          content = COALESCE($1, content),
          options = COALESCE($2, options),
          correct_answer = COALESCE($3, correct_answer),
          points = COALESCE($4, points),
          order_index = COALESCE($5, order_index)
         WHERE id = $6 AND exam_id = $7 RETURNING *`,
        [content, options ? JSON.stringify(options) : null, correct_answer, points, order_index, qid, id]
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
    if (!TEACHER_ROLES.includes(req.user.role)) {
      return reply.status(403).send({ error: 'Forbidden', statusCode: 403 })
    }

    const { id, qid } = req.params

    try {
      await pool.query('DELETE FROM questions WHERE id = $1 AND exam_id = $2', [qid, id])
      return reply.status(204).send()
    } catch (err) {
      fastify.log.error(err)
      return reply.status(500).send({ error: 'Internal server error', statusCode: 500 })
    }
  })
}
