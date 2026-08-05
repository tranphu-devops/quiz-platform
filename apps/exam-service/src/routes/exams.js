import { subject } from '@casl/ability'
import { pool } from '../db.js'
import { verifyAuth } from '../middleware/auth.js'
import { getOrSet, invalidate } from '../lib/cache.js'
import { sanitizeDescription } from '../lib/sanitizeDescription.js'
import { stripAnswer } from '../lib/publicShape.js'

const LANGUAGES = ['vi', 'en', 'ja']

// An exam is offered in one or more `languages`; `language` (0023) is the
// primary one, which owns its public /{lang}/exams/{slug} URL. The DB CHECK
// requires `language = languages[1]`, so the two are always resolved together
// — including for Teacher API callers that only know about `language`.
//
// Returns `{}` when neither field was sent (PUT: leave both alone), or
// `{ error }` for a caller mistake.
function resolveLanguages({ languages, language }) {
  let list
  if (languages !== undefined) {
    if (!Array.isArray(languages)) {
      return { error: 'languages must be an array' }
    }
    // Order is meaningful — the first entry becomes the primary — so dedup
    // without sorting. A `language` sent alongside names the primary rather
    // than contradicting the array.
    list = [...new Set(languages)]
    if (language !== undefined) list = [language, ...list.filter(l => l !== language)]
  } else if (language !== undefined) {
    list = [language]
  } else {
    return {}
  }

  if (list.length === 0) {
    return { error: 'languages must contain at least one language' }
  }
  if (list.some(l => !LANGUAGES.includes(l))) {
    return { error: `languages must be a subset of ${LANGUAGES.join(', ')}` }
  }
  return { languages: list, language: list[0] }
}

// Cache keys for GET /exams list variants that could include a given exam
const examListKeys = createdBy => [
  'exams:list:public',
  'exams:list:admin',
  `exams:list:teacher:${createdBy}`,
  `exams:list:public:creator:${createdBy}`
]
// Cache keys for GET /exams/:id (student-safe variants only, see below).
// The public detail page is invalidated here too — unpublishing or deleting an
// exam has to take its public URL down promptly, not after a 10-minute TTL.
// The public *list* keys deliberately are not: their key space is
// language × every tag × every page and lib/cache.js only exposes del(), so a
// new exam simply appears in the catalog within the 300s TTL. If that ever
// needs to be immediate, add an INCR-based version prefix to cache.js.
const examDetailKeys = (id, slug) => [
  `exam:detail:${id}:student:preview`,
  `exam:detail:${id}:student:full`,
  ...(slug ? [`public:exam:${slug}`] : [])
]

// Editing questions changes what a public exam page shows, so it has to move
// the exam's own updated_at — that is what <lastmod> in the sitemap reports.
// (The BEFORE UPDATE trigger sets updated_at as well; this is explicit so the
// intent survives if the trigger is ever changed.)
const touchExam = id => pool.query('UPDATE exams SET updated_at = NOW() WHERE id = $1', [id])

export default async function examRoutes(fastify) {
  fastify.addHook('preHandler', async (req, reply) => {
    if (req.url === '/health') return
    if (req.url.startsWith('/exams/internal/')) return
    await verifyAuth(req, reply)
  })

  // Internal endpoint for submission-service grading (not via Nginx)
  fastify.get('/exams/internal/:id', { config: { rateLimit: { max: 100, timeWindow: '1 minute' } } }, async (req, reply) => {
    const internalKey = req.headers['x-internal-key']
    if (!internalKey || internalKey !== process.env.INTERNAL_API_KEY) {
      return reply.status(403).send({ error: 'Forbidden', statusCode: 403 })
    }

    const { id } = req.params
    try {
      const examResult = await pool.query('SELECT * FROM exams WHERE id = $1 AND deleted_at IS NULL', [id])
      if (examResult.rows.length === 0) {
        return reply.status(404).send({ error: 'Exam not found', statusCode: 404 })
      }

      const questionsResult = await pool.query(
        'SELECT * FROM questions WHERE exam_id = $1 AND deleted_at IS NULL ORDER BY order_index',
        [id]
      )

      return { ...examResult.rows[0], questions: questionsResult.rows }
    } catch (err) {
      fastify.log.error(err)
      return reply.status(500).send({ error: 'Internal server error', statusCode: 500 })
    }
  })

  // POST /exams
  fastify.post('/exams', { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (req, reply) => {
    if (req.ability.cannot('create', 'Exam')) {
      return reply.status(403).send({ error: 'Forbidden', statusCode: 403 })
    }

    const { title, description, cover_image_url = null, time_limit = 30, passing_score = null, tags = [], show_explanation = false, allow_retake = false, credit_cost = null, cooldown_minutes = 0, max_attempts = null, scheduled_at = null } = req.body ?? {}
    if (!title) {
      return reply.status(400).send({ error: 'Title required', statusCode: 400 })
    }

    const langs = resolveLanguages(req.body ?? {})
    if (langs.error) {
      return reply.status(400).send({ error: langs.error, statusCode: 400 })
    }
    // Omitting both fields keeps the pre-multi-language default: Vietnamese.
    const languages = langs.languages ?? ['vi']
    const language = langs.language ?? 'vi'

    try {
      // Sanitized on the way in, so every reader — the app, the Teacher API,
      // and the server-rendered public pages — gets the same trusted HTML.
      const result = await pool.query(
        'INSERT INTO exams (title, description, cover_image_url, time_limit, passing_score, created_by, tags, show_explanation, allow_retake, credit_cost, cooldown_minutes, max_attempts, scheduled_at, language, languages) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING *',
        [title, sanitizeDescription(description), cover_image_url, time_limit, passing_score, req.user.id, tags, show_explanation, allow_retake, credit_cost, cooldown_minutes, max_attempts, scheduled_at || null, language, languages]
      )
      invalidate(...examListKeys(req.user.id))
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

      const cacheKey = (isStudent || creator_id)
        ? (creator_id ? `exams:list:public:creator:${creator_id}` : 'exams:list:public')
        : (req.user.role === 'teacher' ? `exams:list:teacher:${req.user.id}` : 'exams:list:admin')

      // Student list: only published exams, public fields only
      const studentBase = `
        SELECT e.id, e.title, e.description, e.cover_image_url, e.time_limit,
          e.passing_score, e.tags, e.credit_cost, e.created_at, e.scheduled_at,
          e.created_by, e.languages,
          COALESCE(p.full_name, au.email, 'Unknown') AS creator_name,
          p.avatar_url AS creator_avatar,
          COUNT(DISTINCT CASE WHEN (sp.role IS NULL OR sp.role != 'banned') THEN s.id END)::int AS submission_count,
          COUNT(DISTINCT CASE WHEN (sp.role IS NULL OR sp.role != 'banned') AND (e.passing_score IS NULL OR s.percentage >= e.passing_score) THEN s.id END)::int AS pass_count,
          (SELECT COUNT(*)::int FROM quiz_interactions.likes li WHERE li.exam_id = e.id) AS like_count,
          (SELECT COUNT(*)::int FROM quiz_interactions.comments co WHERE co.exam_id = e.id) AS comment_count
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
          COUNT(DISTINCT CASE WHEN (sp.role IS NULL OR sp.role != 'banned') AND (e.passing_score IS NULL OR s.percentage >= e.passing_score) THEN s.id END)::int AS pass_count,
          (SELECT COUNT(*)::int FROM quiz_interactions.likes li WHERE li.exam_id = e.id) AS like_count,
          (SELECT COUNT(*)::int FROM quiz_interactions.comments co WHERE co.exam_id = e.id) AS comment_count
        FROM exams e
        LEFT JOIN quiz_users.profiles p ON p.id = e.created_by
        LEFT JOIN auth.users au ON au.id = e.created_by
        LEFT JOIN quiz_submissions.submissions s ON s.exam_id = e.id
        LEFT JOIN quiz_users.profiles sp ON sp.id = s.user_id
      `
      const group = 'GROUP BY e.id, p.full_name, p.avatar_url, au.email ORDER BY e.created_at DESC'

      let query, params = []
      if (isStudent || creator_id) {
        if (creator_id) {
          query = `${studentBase} WHERE e.is_published = true AND e.deleted_at IS NULL AND e.created_by = $1 GROUP BY e.id, p.full_name, p.avatar_url, au.email ORDER BY e.created_at DESC`
          params = [creator_id]
        } else {
          query = `${studentBase} WHERE e.is_published = true AND e.deleted_at IS NULL GROUP BY e.id, p.full_name, p.avatar_url, au.email ORDER BY e.created_at DESC`
        }
      } else if (req.user.role === 'teacher') {
        query = `${fullSelect} WHERE e.created_by = $1 AND e.deleted_at IS NULL ${group}`
        params = [req.user.id]
      } else {
        query = `${fullSelect} WHERE e.deleted_at IS NULL ${group}`
      }

      return await getOrSet(cacheKey, 60, async () => {
        const result = await pool.query(query, params)
        return result.rows
      })
    } catch (err) {
      fastify.log.error(err)
      return reply.status(500).send({ error: 'Internal server error', statusCode: 500 })
    }
  })

  // GET /exams/:id
  // ?preview=true → returns only first 3 questions (for detail page student view)
  fastify.get('/exams/:id', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (req, reply) => {
    const { id } = req.params
    const isStudent = req.user.role === 'student'
    const isPreview = req.query.preview === 'true'

    try {
      const examResult = await pool.query('SELECT * FROM exams WHERE id = $1 AND deleted_at IS NULL', [id])
      if (examResult.rows.length === 0) {
        return reply.status(404).send({ error: 'Exam not found', statusCode: 404 })
      }

      const exam = examResult.rows[0]
      if (req.ability.cannot('read', subject('Exam', exam))) {
        return reply.status(404).send({ error: 'Exam not found', statusCode: 404 })
      }

      const buildResponse = async () => {
        const countResult = await pool.query(
          'SELECT COUNT(*)::int AS n FROM questions WHERE exam_id = $1 AND deleted_at IS NULL',
          [id]
        )
        const question_count = countResult.rows[0].n

        // Preview (student detail page): a single random sample question.
        // Full (teacher/take): all questions in authored order.
        const questionsResult = await pool.query(
          isPreview
            ? `SELECT * FROM questions WHERE exam_id = $1 AND deleted_at IS NULL ORDER BY RANDOM() LIMIT 1`
            : `SELECT * FROM questions WHERE exam_id = $1 AND deleted_at IS NULL ORDER BY order_index`,
          [id]
        )

        let questions = questionsResult.rows
        if (isStudent) {
          questions = questions.map(stripAnswer)
        }

        // Strip internal fields not needed by students
        if (isStudent) {
          const { created_by, show_explanation, allow_retake, ...examPublic } = exam
          return { ...examPublic, question_count, questions }
        }

        return { ...exam, question_count, questions }
      }

      // Only cache the student view of a *published* exam: it's identical for
      // every student (already stripped of correct_answer/explanation) and the
      // ability check above still runs fresh on every request, so this can
      // never leak a draft or another teacher's exam. The privileged (teacher/
      // admin) view is skipped — low traffic, and it carries correct answers.
      if (isStudent && exam.is_published) {
        return await getOrSet(`exam:detail:${id}:student:${isPreview ? 'preview' : 'full'}`, 60, buildResponse)
      }
      return await buildResponse()
    } catch (err) {
      fastify.log.error(err)
      return reply.status(500).send({ error: 'Internal server error', statusCode: 500 })
    }
  })

  // PUT /exams/:id
  fastify.put('/exams/:id', { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (req, reply) => {
    const { id } = req.params
    const body = req.body ?? {}
    const { title, description, cover_image_url, time_limit, passing_score, is_published, tags, show_explanation, allow_retake, credit_cost, cooldown_minutes, max_attempts } = body
    const has_scheduled_at = 'scheduled_at' in body
    const scheduled_at_val = has_scheduled_at ? (body.scheduled_at || null) : undefined

    try {
      const examResult = await pool.query('SELECT * FROM exams WHERE id = $1 AND deleted_at IS NULL', [id])
      if (examResult.rows.length === 0) {
        return reply.status(404).send({ error: 'Exam not found', statusCode: 404 })
      }

      const exam = examResult.rows[0]
      if (req.ability.cannot('update', subject('Exam', exam))) {
        return reply.status(403).send({ error: 'Forbidden', statusCode: 403 })
      }

      // The slug is fixed at creation (a DB trigger enforces it) so that an
      // indexed public URL survives a rename. Reject an attempt to set it
      // rather than accepting the request and silently ignoring the field.
      if ('slug' in body) {
        return reply.status(400).send({ error: 'slug is immutable', statusCode: 400 })
      }
      const langs = resolveLanguages(body)
      if (langs.error) {
        return reply.status(400).send({ error: langs.error, statusCode: 400 })
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
          scheduled_at = CASE WHEN $14 THEN $15::timestamptz ELSE scheduled_at END,
          -- Always written as a pair: the CHECK on this table requires
          -- language = languages[1], and resolveLanguages() returns both or
          -- neither, so these two COALESCEs can never disagree.
          language = COALESCE($16, language),
          languages = COALESCE($17::text[], languages)
         WHERE id = $9 AND deleted_at IS NULL RETURNING *`,
        [title, description === undefined ? null : sanitizeDescription(description), cover_image_url ?? null, time_limit, passing_score ?? null, is_published, tags ?? null, show_explanation ?? null, id, allow_retake ?? null, credit_cost ?? null, cooldown_minutes ?? null, max_attempts ?? null, has_scheduled_at, scheduled_at_val, langs.language ?? null, langs.languages ?? null]
      )
      invalidate(...examListKeys(exam.created_by), ...examDetailKeys(id, exam.slug))
      return result.rows[0]
    } catch (err) {
      fastify.log.error(err)
      return reply.status(500).send({ error: 'Internal server error', statusCode: 500 })
    }
  })

  // DELETE /exams/:id — soft delete
  fastify.delete('/exams/:id', { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (req, reply) => {
    const { id } = req.params

    try {
      const examResult = await pool.query('SELECT * FROM exams WHERE id = $1 AND deleted_at IS NULL', [id])
      if (examResult.rows.length === 0) {
        return reply.status(404).send({ error: 'Exam not found', statusCode: 404 })
      }

      const exam = examResult.rows[0]
      if (req.ability.cannot('delete', subject('Exam', exam))) {
        return reply.status(403).send({ error: 'Forbidden', statusCode: 403 })
      }

      const now = new Date()
      await pool.query('UPDATE exams SET deleted_at = $1 WHERE id = $2', [now, id])
      // Cascade soft-delete to questions
      await pool.query('UPDATE questions SET deleted_at = $1 WHERE exam_id = $2 AND deleted_at IS NULL', [now, id])

      invalidate(...examListKeys(exam.created_by), ...examDetailKeys(id, exam.slug))
      return reply.status(204).send()
    } catch (err) {
      fastify.log.error(err)
      return reply.status(500).send({ error: 'Internal server error', statusCode: 500 })
    }
  })

  // POST /exams/:id/questions
  // Higher than other mutation routes (20/min): generator-service imports up
  // to ai_generation_max_questions (default 50) sequentially in one job via
  // this route, all from the same caller IP within seconds of each other.
  fastify.post('/exams/:id/questions', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (req, reply) => {
    const { id } = req.params
    const { content, image_url = null, options, correct_answer: ca, points = 1.0, order_index = 0, explanation = null, question_type = 'single' } = req.body ?? {}
    const correct_answer = Array.isArray(ca) ? [...ca].sort().join(',') : ca

    if (!content || !options || !correct_answer) {
      return reply.status(400).send({ error: 'content, options, correct_answer required', statusCode: 400 })
    }

    try {
      const examResult = await pool.query('SELECT * FROM exams WHERE id = $1 AND deleted_at IS NULL', [id])
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
      await touchExam(id)
      invalidate(...examDetailKeys(id, examResult.rows[0].slug))
      return reply.status(201).send(result.rows[0])
    } catch (err) {
      fastify.log.error(err)
      return reply.status(500).send({ error: 'Internal server error', statusCode: 500 })
    }
  })

  // PUT /exams/:id/questions/:qid
  fastify.put('/exams/:id/questions/:qid', { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (req, reply) => {
    const { id, qid } = req.params
    const { content, image_url, options, correct_answer: ca2, points, order_index, explanation, question_type } = req.body ?? {}
    const correct_answer = ca2 != null ? (Array.isArray(ca2) ? [...ca2].sort().join(',') : ca2) : undefined

    try {
      const examResult = await pool.query('SELECT * FROM exams WHERE id = $1 AND deleted_at IS NULL', [id])
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
         WHERE id = $9 AND exam_id = $10 AND deleted_at IS NULL RETURNING *`,
        [content, image_url ?? null, options ? JSON.stringify(options) : null, correct_answer ?? null, points, order_index, explanation ?? null, question_type ?? null, qid, id]
      )

      if (result.rows.length === 0) {
        return reply.status(404).send({ error: 'Question not found', statusCode: 404 })
      }
      await touchExam(id)
      invalidate(...examDetailKeys(id, examResult.rows[0].slug))
      return result.rows[0]
    } catch (err) {
      fastify.log.error(err)
      return reply.status(500).send({ error: 'Internal server error', statusCode: 500 })
    }
  })

  // DELETE /exams/:id/questions/:qid — soft delete
  fastify.delete('/exams/:id/questions/:qid', { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (req, reply) => {
    const { id, qid } = req.params

    try {
      const examResult = await pool.query('SELECT * FROM exams WHERE id = $1 AND deleted_at IS NULL', [id])
      if (examResult.rows.length === 0) {
        return reply.status(404).send({ error: 'Exam not found', statusCode: 404 })
      }

      if (req.ability.cannot('update', subject('Exam', examResult.rows[0]))) {
        return reply.status(403).send({ error: 'Forbidden', statusCode: 403 })
      }

      const result = await pool.query(
        'UPDATE questions SET deleted_at = NOW() WHERE id = $1 AND exam_id = $2 AND deleted_at IS NULL RETURNING id',
        [qid, id]
      )
      if (result.rows.length === 0) {
        return reply.status(404).send({ error: 'Question not found', statusCode: 404 })
      }

      await touchExam(id)
      invalidate(...examDetailKeys(id, examResult.rows[0].slug))
      return reply.status(204).send()
    } catch (err) {
      fastify.log.error(err)
      return reply.status(500).send({ error: 'Internal server error', statusCode: 500 })
    }
  })
}
