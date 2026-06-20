import { subject } from '@casl/ability'
import { pool } from '../db.js'
import { verifyAuth } from '../middleware/auth.js'

// ── Shared grading logic ──────────────────────────────────────────────────────

function isCorrect(q, studentAnswer) {
  if (q.question_type === 'multiple') {
    const sorted = Array.isArray(studentAnswer) ? [...studentAnswer].sort().join(',') : ''
    return sorted === q.correct_answer
  }
  return studentAnswer === q.correct_answer
}

function buildGradeResult(exam, answers) {
  const questions = exam.questions
  let score = 0, total_points = 0

  for (const q of questions) {
    total_points += q.points ?? 1
    if (isCorrect(q, answers[q.id])) score += q.points ?? 1
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
        id: q.id, content: q.content, options: q.options,
        question_type: q.question_type ?? 'single',
        correct_answer: q.correct_answer, student_answer: sa,
        is_correct: correct, points: q.points ?? 1,
        earned: correct ? (q.points ?? 1) : 0,
        explanation: q.explanation ?? null
      }
    })
  }

  return { score, total_points, percentage, results_detail }
}

async function awardBadgesIfEarned(userId, examId, log) {
  try {
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

      const placeholders = examIds.map((_, i) => `$${i + 2}`).join(', ')
      const r = await pool.query(
        `SELECT COUNT(DISTINCT s.exam_id) AS passed_count
         FROM quiz_submissions.submissions s
         JOIN quiz_exams.exams e ON e.id = s.exam_id
         WHERE s.user_id = $1
           AND s.exam_id IN (${placeholders})
           AND s.status IN ('completed', 'timed_out')
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

// Inline-grade an expired in_progress submission so it doesn't block a new attempt.
// Uses UPDATE ... WHERE status='in_progress' as optimistic lock against the batch grader.
async function gradeExpiredInline(submission, exam, log) {
  try {
    const answers = submission.answers ?? {}
    const { score, total_points, percentage, results_detail } = buildGradeResult(exam, answers)
    await pool.query(
      `UPDATE submissions
          SET status = 'timed_out', score = $1, total_points = $2,
              percentage = $3, results_detail = $4, submitted_at = NOW()
        WHERE id = $5 AND status = 'in_progress'`,
      [score, total_points, percentage, JSON.stringify(results_detail), submission.id]
    )
    const passed = exam.passing_score == null || percentage >= exam.passing_score
    if (passed) awardBadgesIfEarned(submission.user_id, submission.exam_id, log).catch(() => {})
  } catch (err) {
    log.warn({ err }, 'inline grade of expired submission failed (non-critical)')
  }
}

// ── Route plugin ──────────────────────────────────────────────────────────────

export default async function submissionRoutes(fastify) {
  fastify.addHook('preHandler', async (req, reply) => {
    if (req.url === '/health') return
    await verifyAuth(req, reply)
  })

  // POST /submissions/start
  // Creates an in_progress submission row and deducts credits.
  // If an unexpired in_progress row already exists, resumes it without charging again.
  // If an expired in_progress row exists, grades it inline then allows a fresh start.
  fastify.post('/submissions/start', async (req, reply) => {
    if (req.ability.cannot('create', 'Submission')) {
      return reply.status(403).send({ error: 'Forbidden', statusCode: 403 })
    }

    const { exam_id } = req.body ?? {}
    if (!exam_id) {
      return reply.status(400).send({ error: 'exam_id required', statusCode: 400 })
    }

    try {
      // ── Fetch exam (needed for all subsequent checks) ──────────────────────
      const examRes = await fetch(
        `${process.env.EXAM_SERVICE_URL}/exams/internal/${exam_id}`,
        { headers: { 'x-internal-key': process.env.INTERNAL_API_KEY } }
      )
      if (!examRes.ok) {
        return reply.status(404).send({ error: 'Exam not found', statusCode: 404 })
      }
      const exam = await examRes.json()

      // ── Scheduled exam lock ────────────────────────────────────────────────
      if (exam.scheduled_at && new Date(exam.scheduled_at) > new Date()) {
        return reply.status(423).send({
          error: 'Đề thi chưa mở. Vui lòng chờ đến thời gian quy định.',
          scheduled_at: exam.scheduled_at,
          statusCode: 423
        })
      }

      // ── Resume or clean up any existing in_progress submission ─────────────
      const ipRes = await pool.query(
        `SELECT id, expires_at, answers FROM submissions
          WHERE exam_id = $1 AND user_id = $2 AND status = 'in_progress'
          LIMIT 1`,
        [exam_id, req.user.id]
      )
      if (ipRes.rows.length > 0) {
        const existing = ipRes.rows[0]
        if (new Date(existing.expires_at) > new Date()) {
          // Still valid — resume without charging credit again
          return reply.send({
            success: true,
            submission_id: existing.id,
            expires_at: existing.expires_at,
            credit_cost: 0,
            new_balance: null,
            resumed: true
          })
        }
        // Expired — grade it inline so it counts toward max_attempts, then continue
        await gradeExpiredInline(existing, exam, fastify.log)
      }

      // ── max_attempts (only completed/timed_out rows count) ─────────────────
      if (exam.max_attempts != null) {
        const countRes = await pool.query(
          `SELECT COUNT(*)::int AS n FROM submissions
            WHERE exam_id = $1 AND user_id = $2 AND status IN ('completed', 'timed_out')`,
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

      // ── Cooldown (only completed/timed_out rows count) ─────────────────────
      if (exam.cooldown_minutes > 0) {
        const lastRes = await pool.query(
          `SELECT submitted_at FROM submissions
            WHERE exam_id = $1 AND user_id = $2 AND status IN ('completed', 'timed_out')
            ORDER BY submitted_at DESC LIMIT 1`,
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

      // ── Deduct credits ─────────────────────────────────────────────────────
      const creditCost = exam.credit_cost ?? 10

      const deductRes = await fetch(
        `${process.env.USER_SERVICE_URL}/internal/credits/deduct`,
        {
          method: 'POST',
          headers: { 'x-internal-key': process.env.INTERNAL_API_KEY, 'Content-Type': 'application/json' },
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

      // ── Create in_progress submission row ──────────────────────────────────
      const timeLimit = exam.time_limit ?? 30
      const insertRes = await pool.query(
        `INSERT INTO submissions (exam_id, user_id, status, started_at, expires_at)
         VALUES ($1, $2, 'in_progress', NOW(), NOW() + ($3 * interval '1 minute'))
         RETURNING id, expires_at`,
        [exam_id, req.user.id, timeLimit]
      )
      const { id: submission_id, expires_at } = insertRes.rows[0]

      return reply.send({ success: true, submission_id, expires_at, credit_cost: creditCost, new_balance })
    } catch (err) {
      fastify.log.error(err)
      return reply.status(500).send({ error: 'Internal server error', statusCode: 500 })
    }
  })

  // PUT /submissions/:id/progress
  // Saves the student's current answers without grading. Fire-and-forget safe.
  fastify.put('/submissions/:id/progress', async (req, reply) => {
    const { id } = req.params
    const { answers } = req.body ?? {}

    try {
      const result = await pool.query('SELECT * FROM submissions WHERE id = $1', [id])
      if (!result.rows.length) {
        return reply.status(404).send({ error: 'Submission not found', statusCode: 404 })
      }

      const sub = result.rows[0]
      if (sub.user_id !== req.user.id) {
        return reply.status(403).send({ error: 'Forbidden', statusCode: 403 })
      }
      if (sub.status !== 'in_progress') {
        return reply.status(409).send({ error: 'Bài thi đã được nộp', statusCode: 409 })
      }
      if (sub.expires_at && new Date(sub.expires_at) < new Date()) {
        return reply.status(410).send({ error: 'Bài thi đã hết giờ', statusCode: 410 })
      }

      await pool.query(
        'UPDATE submissions SET answers = $1 WHERE id = $2',
        [JSON.stringify(answers ?? {}), id]
      )
      return reply.send({ saved: true })
    } catch (err) {
      fastify.log.error(err)
      return reply.status(500).send({ error: 'Internal server error', statusCode: 500 })
    }
  })

  // POST /submissions/:id/submit
  // Grades an in_progress submission and marks it completed.
  // Returns 409 if already graded (e.g. by the batch auto-grader).
  fastify.post('/submissions/:id/submit', async (req, reply) => {
    if (req.ability.cannot('create', 'Submission')) {
      return reply.status(403).send({ error: 'Forbidden', statusCode: 403 })
    }

    const { id } = req.params
    const { answers } = req.body ?? {}

    try {
      const result = await pool.query('SELECT * FROM submissions WHERE id = $1', [id])
      if (!result.rows.length) {
        return reply.status(404).send({ error: 'Submission not found', statusCode: 404 })
      }

      const sub = result.rows[0]
      if (sub.user_id !== req.user.id) {
        return reply.status(403).send({ error: 'Forbidden', statusCode: 403 })
      }
      if (sub.status !== 'in_progress') {
        return reply.status(409).send({ error: 'Bài thi đã được nộp', submission_id: sub.id, statusCode: 409 })
      }

      const examRes = await fetch(
        `${process.env.EXAM_SERVICE_URL}/exams/internal/${sub.exam_id}`,
        { headers: { 'x-internal-key': process.env.INTERNAL_API_KEY } }
      )
      if (!examRes.ok) {
        return reply.status(500).send({ error: 'Exam fetch failed', statusCode: 500 })
      }
      const exam = await examRes.json()

      const finalAnswers = answers ?? sub.answers ?? {}
      const { score, total_points, percentage, results_detail } = buildGradeResult(exam, finalAnswers)

      const updateRes = await pool.query(
        `UPDATE submissions
            SET status = 'completed', answers = $1, score = $2, total_points = $3,
                percentage = $4, results_detail = $5, submitted_at = NOW()
          WHERE id = $6 AND status = 'in_progress'
          RETURNING id, exam_id, user_id, score, total_points, percentage, submitted_at`,
        [JSON.stringify(finalAnswers), score, total_points, percentage, JSON.stringify(results_detail), id]
      )

      if (!updateRes.rows.length) {
        // Race: batch grader already updated it — treat as already submitted
        return reply.status(409).send({ error: 'Bài thi đã được nộp', submission_id: id, statusCode: 409 })
      }

      const passed = exam.passing_score == null || percentage >= exam.passing_score
      if (passed) awardBadgesIfEarned(req.user.id, sub.exam_id, fastify.log).catch(() => {})

      return reply.status(200).send(updateRes.rows[0])
    } catch (err) {
      fastify.log.error(err)
      return reply.status(500).send({ error: 'Internal server error', statusCode: 500 })
    }
  })

  // POST /submissions — legacy endpoint, kept for backward compatibility
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

      const { score, total_points, percentage, results_detail } = buildGradeResult(exam, answers)

      const result = await pool.query(
        `INSERT INTO submissions (exam_id, user_id, answers, score, total_points, percentage, results_detail, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'completed')
         RETURNING id, exam_id, user_id, score, total_points, percentage, submitted_at`,
        [exam_id, req.user.id, JSON.stringify(answers), score, total_points, percentage, JSON.stringify(results_detail)]
      )
      const submission = result.rows[0]

      const passed = exam.passing_score == null || percentage >= exam.passing_score
      if (passed) awardBadgesIfEarned(req.user.id, exam_id, fastify.log).catch(() => {})

      return reply.status(201).send(submission)
    } catch (err) {
      fastify.log.error(err)
      return reply.status(500).send({ error: 'Internal server error', statusCode: 500 })
    }
  })

  // GET /submissions/active?exam_id=
  // Returns the caller's current in_progress submission for an exam (if not expired).
  // Used by take page to detect a resumable session after re-login or cross-device navigation.
  fastify.get('/submissions/active', async (req, reply) => {
    const { exam_id } = req.query
    if (!exam_id) {
      return reply.status(400).send({ error: 'exam_id required', statusCode: 400 })
    }

    try {
      const result = await pool.query(
        `SELECT id, exam_id, user_id, answers, started_at, expires_at
           FROM submissions
          WHERE exam_id = $1 AND user_id = $2
            AND status = 'in_progress' AND expires_at > NOW()
          LIMIT 1`,
        [exam_id, req.user.id]
      )

      if (!result.rows.length) {
        return reply.status(404).send({ error: 'No active submission', statusCode: 404 })
      }
      return result.rows[0]
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
      if (!result.rows.length) {
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
      const conditions = [`status != 'in_progress'`]
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
        `SELECT id, exam_id, user_id, score, total_points, percentage, status, submitted_at
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
