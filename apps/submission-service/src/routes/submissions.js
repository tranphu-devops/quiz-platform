import { subject } from '@casl/ability'
import { pool } from '../db.js'
import { verifyAuth } from '../middleware/auth.js'

async function awardBadgesIfEarned(userId, examId, log) {
  try {
    // Find collections that contain this exam
    const collectionsRes = await fetch(
      `${process.env.EXAM_SERVICE_URL}/collections/internal/check-badge?exam_id=${examId}`,
      { headers: { 'x-internal-key': process.env.INTERNAL_API_KEY } }
    )
    if (!collectionsRes.ok) return
    const collections = await collectionsRes.json()
    if (!collections.length) return

    for (const col of collections) {
      const examIds = col.exam_ids ?? []
      if (!examIds.length) continue

      // Check if student has passed all exams in this collection
      const placeholders = examIds.map((_, i) => `$${i + 2}`).join(', ')
      const r = await pool.query(
        `SELECT COUNT(DISTINCT s.exam_id) AS passed_count
         FROM quiz_submissions.submissions s
         JOIN quiz_exams.exams e ON e.id = s.exam_id
         WHERE s.user_id = $1
           AND s.exam_id IN (${placeholders})
           AND (e.passing_score IS NULL OR s.percentage >= e.passing_score)`,
        [userId, ...examIds]
      )
      const passedCount = parseInt(r.rows[0]?.passed_count ?? 0, 10)
      if (passedCount >= examIds.length) {
        await pool.query(
          `INSERT INTO quiz_submissions.student_badges (user_id, collection_id)
           VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [userId, col.id]
        )
      }
    }
  } catch (err) {
    log.warn({ err }, 'badge award failed (non-critical)')
  }
}

export default async function submissionRoutes(fastify) {
  fastify.addHook('preHandler', async (req, reply) => {
    if (req.url === '/health') return
    await verifyAuth(req, reply)
  })

  // POST /submissions/start — deduct credits when student starts an exam
  fastify.post('/submissions/start', async (req, reply) => {
    if (req.ability.cannot('create', 'Submission')) {
      return reply.status(403).send({ error: 'Forbidden', statusCode: 403 })
    }

    const { exam_id } = req.body ?? {}
    if (!exam_id) {
      return reply.status(400).send({ error: 'exam_id required', statusCode: 400 })
    }

    try {
      const examRes = await fetch(
        `${process.env.EXAM_SERVICE_URL}/exams/internal/${exam_id}`,
        { headers: { 'x-internal-key': process.env.INTERNAL_API_KEY } }
      )
      if (!examRes.ok) {
        return reply.status(404).send({ error: 'Exam not found', statusCode: 404 })
      }
      const exam = await examRes.json()

      // Check max_attempts
      if (exam.max_attempts != null) {
        const countRes = await pool.query(
          'SELECT COUNT(*)::int AS n FROM submissions WHERE exam_id = $1 AND user_id = $2',
          [exam_id, req.user.id]
        )
        if (countRes.rows[0].n >= exam.max_attempts) {
          return reply.status(429).send({
            error: `Đã đạt giới hạn ${exam.max_attempts} lần thi cho đề thi này`,
            reason: 'max_attempts',
            statusCode: 429
          })
        }
      }

      // Check cooldown between attempts
      if (exam.cooldown_minutes > 0) {
        const lastRes = await pool.query(
          'SELECT submitted_at FROM submissions WHERE exam_id = $1 AND user_id = $2 ORDER BY submitted_at DESC LIMIT 1',
          [exam_id, req.user.id]
        )
        if (lastRes.rows.length > 0) {
          const elapsed = (Date.now() - new Date(lastRes.rows[0].submitted_at).getTime()) / 60000
          if (elapsed < exam.cooldown_minutes) {
            const remaining = Math.ceil(exam.cooldown_minutes - elapsed)
            return reply.status(429).send({
              error: `Cần chờ ${remaining} phút nữa trước khi thi lại`,
              reason: 'cooldown',
              cooldown_remaining: remaining,
              statusCode: 429
            })
          }
        }
      }

      const creditCost = exam.credit_cost ?? 10

      const deductRes = await fetch(
        `${process.env.USER_SERVICE_URL}/internal/credits/deduct`,
        {
          method: 'POST',
          headers: {
            'x-internal-key': process.env.INTERNAL_API_KEY,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ user_id: req.user.id, amount: creditCost })
        }
      )

      if (deductRes.status === 402) {
        const err = await deductRes.json()
        return reply.status(402).send({ error: err.error, credit_cost: creditCost, statusCode: 402 })
      }
      if (!deductRes.ok) {
        const rawBody = await deductRes.text().catch(() => '')
        fastify.log.error({ status: deductRes.status, body: rawBody }, 'user-service credit deduct failed')
        return reply.status(500).send({ error: 'Credit service error', detail: deductRes.status, statusCode: 500 })
      }

      const { new_balance } = await deductRes.json()
      return { success: true, credit_cost: creditCost, new_balance }
    } catch (err) {
      fastify.log.error(err)
      return reply.status(500).send({ error: 'Internal server error', statusCode: 500 })
    }
  })

  // POST /submissions — submit exam and auto-grade
  fastify.post('/submissions', async (req, reply) => {
    if (req.ability.cannot('create', 'Submission')) {
      return reply.status(403).send({ error: 'Forbidden', statusCode: 403 })
    }

    const { exam_id, answers } = req.body ?? {}
    if (!exam_id || !answers) {
      return reply.status(400).send({ error: 'exam_id and answers required', statusCode: 400 })
    }

    try {
      const examRes = await fetch(
        `${process.env.EXAM_SERVICE_URL}/exams/internal/${exam_id}`,
        { headers: { 'x-internal-key': process.env.INTERNAL_API_KEY } }
      )

      if (!examRes.ok) {
        return reply.status(404).send({ error: 'Exam not found', statusCode: 404 })
      }

      const exam = await examRes.json()
      const questions = exam.questions

      function isCorrect(q, studentAnswer) {
        if (q.question_type === 'multiple') {
          const sorted = Array.isArray(studentAnswer) ? [...studentAnswer].sort().join(',') : ''
          return sorted === q.correct_answer
        }
        return studentAnswer === q.correct_answer
      }

      let score = 0
      let total_points = 0

      for (const q of questions) {
        total_points += q.points ?? 1
        if (isCorrect(q, answers[q.id])) {
          score += q.points ?? 1
        }
      }

      const percentage = total_points > 0 ? (score / total_points) * 100 : 0

      const results_detail = {
        show_explanation: exam.show_explanation ?? false,
        passing_score: exam.passing_score ?? null,
        allow_retake: exam.allow_retake ?? false,
        questions: questions.map(q => {
          const sa = answers[q.id] ?? null
          const correct = isCorrect(q, sa)
          return {
            id: q.id,
            content: q.content,
            options: q.options,
            question_type: q.question_type ?? 'single',
            correct_answer: q.correct_answer,
            student_answer: sa,
            is_correct: correct,
            points: q.points ?? 1,
            earned: correct ? (q.points ?? 1) : 0,
            explanation: q.explanation ?? null
          }
        })
      }

      const result = await pool.query(
        `INSERT INTO submissions (exam_id, user_id, answers, score, total_points, percentage, results_detail)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, exam_id, user_id, score, total_points, percentage, submitted_at`,
        [exam_id, req.user.id, JSON.stringify(answers), score, total_points, percentage, JSON.stringify(results_detail)]
      )
      const submission = result.rows[0]

      // Badge check: only if student passed this exam
      const passed = exam.passing_score == null || percentage >= exam.passing_score
      if (passed) {
        awardBadgesIfEarned(req.user.id, exam_id, fastify.log).catch(() => {})
      }

      return reply.status(201).send(submission)
    } catch (err) {
      fastify.log.error(err)
      return reply.status(500).send({ error: 'Internal server error', statusCode: 500 })
    }
  })

  // GET /submissions/:id
  fastify.get('/submissions/:id', async (req, reply) => {
    const { id } = req.params

    try {
      const result = await pool.query('SELECT * FROM submissions WHERE id = $1', [id])
      if (result.rows.length === 0) {
        return reply.status(404).send({ error: 'Submission not found', statusCode: 404 })
      }

      const sub = result.rows[0]
      if (req.ability.cannot('read', subject('Submission', sub))) {
        return reply.status(403).send({ error: 'Forbidden', statusCode: 403 })
      }

      return sub
    } catch (err) {
      fastify.log.error(err)
      return reply.status(500).send({ error: 'Internal server error', statusCode: 500 })
    }
  })

  // GET /submissions?examId=&userId=
  fastify.get('/submissions', async (req, reply) => {
    const { examId, userId } = req.query

    try {
      const conditions = ['1=1']
      const params = []

      if (examId) {
        params.push(examId)
        conditions.push(`exam_id = $${params.length}`)
      }

      if (userId) {
        if (userId !== req.user.id && !['admin', 'teacher'].includes(req.user.role)) {
          return reply.status(403).send({ error: 'Forbidden', statusCode: 403 })
        }
        params.push(userId)
        conditions.push(`user_id = $${params.length}`)
      } else if (req.user.role === 'student') {
        params.push(req.user.id)
        conditions.push(`user_id = $${params.length}`)
      }

      const result = await pool.query(
        `SELECT id, exam_id, user_id, score, total_points, percentage, submitted_at
         FROM submissions WHERE ${conditions.join(' AND ')} ORDER BY submitted_at DESC`,
        params
      )
      return result.rows
    } catch (err) {
      fastify.log.error(err)
      return reply.status(500).send({ error: 'Internal server error', statusCode: 500 })
    }
  })
}
