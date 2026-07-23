import { pool } from '../db.js'
import { verifyAuth } from '../middleware/auth.js'
import { encryptKey, decryptKey, keyPrefix } from '../lib/keyCrypto.js'
import { extractDocxText } from '../lib/docParse.js'
import { buildDocumentBlock, generateExam, DEFAULT_MODEL } from '../lib/llm.js'

const EXAM_SERVICE_URL = process.env.EXAM_SERVICE_URL
const USER_SERVICE_URL = process.env.USER_SERVICE_URL

const MIME_TYPES = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'text/plain': 'txt'
}

// Loose shape check for a free-typed OpenRouter model slug (own-key mode has
// no allowlist — it's the teacher's own key/cost). Just enough to catch
// empty/garbage input before it reaches OpenRouter as a 400.
function isPlausibleModelSlug(value) {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length < 100 && value.includes('/')
}

async function getAdminSettings(keys) {
  const { rows } = await pool.query(
    'SELECT key, value FROM quiz_users.admin_settings WHERE key = ANY($1)',
    [keys]
  )
  return Object.fromEntries(rows.map(r => [r.key, r.value]))
}

async function insertJob(fields) {
  const { rows } = await pool.query(
    `INSERT INTO generation_jobs
      (user_id, status, key_source, model, source_filename, source_file_type,
       question_count, exam_id, credits_charged, error_message, completed_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
     RETURNING *`,
    [
      fields.userId, fields.status, fields.keySource, fields.model,
      fields.filename, fields.fileType, fields.questionCount ?? null,
      fields.examId ?? null, fields.creditsCharged ?? null, fields.errorMessage ?? null
    ]
  )
  return rows[0]
}

async function importExam(authHeader, { title, description, tags, questions }, creditCost) {
  // exam-service's POST /exams inserts credit_cost as-given rather than
  // falling back to its own DEFAULT when the field is omitted — an explicit
  // NULL still violates the column's NOT NULL constraint. Since our Teacher
  // API contract treats credit_cost as optional ("null = admin default"),
  // we resolve that default ourselves and always send a concrete value.
  const examRes = await fetch(`${EXAM_SERVICE_URL}/exams`, {
    method: 'POST',
    headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, description, tags, credit_cost: creditCost })
  })
  if (!examRes.ok) {
    const err = await examRes.json().catch(() => ({}))
    throw new Error(err.error ?? `Tạo đề thi thất bại (${examRes.status})`)
  }
  const exam = await examRes.json()

  for (const q of questions) {
    const qRes = await fetch(`${EXAM_SERVICE_URL}/exams/${exam.id}/questions`, {
      method: 'POST',
      headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify(q)
    })
    if (!qRes.ok) {
      const err = await qRes.json().catch(() => ({}))
      throw new Error(err.error ?? `Thêm câu hỏi thất bại (${qRes.status})`)
    }
  }

  return exam.id
}

export default async function generateRoutes(fastify) {
  fastify.addHook('preHandler', async (req, reply) => {
    if (req.url === '/health') return
    await verifyAuth(req, reply)
    if (reply.sent) return
    if (req.ability.cannot('manage', 'Generation')) {
      return reply.status(403).send({ error: 'Chỉ teacher/admin mới dùng được tính năng này', statusCode: 403 })
    }
  })

  // ── BYO LLM key management ──────────────────────────────────────────────

  fastify.post('/generate/keys', { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (req, reply) => {
    const { api_key } = req.body ?? {}
    if (!api_key || typeof api_key !== 'string' || api_key.trim().length < 10) {
      return reply.status(400).send({ error: 'api_key required', statusCode: 400 })
    }
    try {
      const trimmed = api_key.trim()
      const { rows } = await pool.query(
        `INSERT INTO llm_keys (user_id, provider, encrypted_key, key_prefix, scope)
         VALUES ($1, 'openrouter', $2, $3, 'user') RETURNING id, provider, key_prefix, created_at`,
        [req.user.id, encryptKey(trimmed), keyPrefix(trimmed)]
      )
      return reply.status(201).send(rows[0])
    } catch (err) {
      fastify.log.error(err)
      return reply.status(500).send({ error: 'Internal server error', statusCode: 500 })
    }
  })

  fastify.get('/generate/keys', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (req, reply) => {
    try {
      const { rows } = await pool.query(
        `SELECT id, provider, key_prefix, created_at, last_used_at
         FROM llm_keys WHERE user_id = $1 AND scope = 'user' AND revoked_at IS NULL ORDER BY created_at DESC`,
        [req.user.id]
      )
      return rows
    } catch (err) {
      fastify.log.error(err)
      return reply.status(500).send({ error: 'Internal server error', statusCode: 500 })
    }
  })

  fastify.delete('/generate/keys/:id', { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (req, reply) => {
    try {
      const { rowCount } = await pool.query(
        `UPDATE llm_keys SET revoked_at = NOW()
         WHERE id = $1 AND user_id = $2 AND scope = 'user' AND revoked_at IS NULL`,
        [req.params.id, req.user.id]
      )
      if (rowCount === 0) return reply.status(404).send({ error: 'Key not found', statusCode: 404 })
      return { success: true }
    } catch (err) {
      fastify.log.error(err)
      return reply.status(500).send({ error: 'Internal server error', statusCode: 500 })
    }
  })

  // ── Platform-wide LLM key management (admin-only) ───────────────────────
  // Stored the same way as BYO keys (llm_keys, AES-256-GCM encrypted_key),
  // scope='platform' instead of scoped by user_id. Falls back to the
  // OPENROUTER_API_KEY env var when no row is active (see POST /generate),
  // so an existing deployment keeps working with zero required action.

  fastify.post('/generate/platform-key', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (req, reply) => {
    if (req.user.role !== 'admin') return reply.status(403).send({ error: 'Forbidden', statusCode: 403 })
    const { api_key } = req.body ?? {}
    if (!api_key || typeof api_key !== 'string' || api_key.trim().length < 10) {
      return reply.status(400).send({ error: 'api_key required', statusCode: 400 })
    }
    const client = await pool.connect()
    try {
      const trimmed = api_key.trim()
      await client.query('BEGIN')
      await client.query(`UPDATE llm_keys SET revoked_at = NOW() WHERE scope = 'platform' AND revoked_at IS NULL`)
      const { rows } = await client.query(
        `INSERT INTO llm_keys (user_id, provider, encrypted_key, key_prefix, scope)
         VALUES ($1, 'openrouter', $2, $3, 'platform') RETURNING id, key_prefix, created_at`,
        [req.user.id, encryptKey(trimmed), keyPrefix(trimmed)]
      )
      await client.query('COMMIT')
      return reply.status(201).send(rows[0])
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {})
      fastify.log.error(err)
      return reply.status(500).send({ error: 'Internal server error', statusCode: 500 })
    } finally {
      client.release()
    }
  })

  fastify.get('/generate/platform-key', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (req, reply) => {
    if (req.user.role !== 'admin') return reply.status(403).send({ error: 'Forbidden', statusCode: 403 })
    try {
      const { rows } = await pool.query(
        `SELECT id, key_prefix, created_at, last_used_at
         FROM llm_keys WHERE scope = 'platform' AND revoked_at IS NULL ORDER BY created_at DESC LIMIT 1`
      )
      return rows[0] ?? null
    } catch (err) {
      fastify.log.error(err)
      return reply.status(500).send({ error: 'Internal server error', statusCode: 500 })
    }
  })

  fastify.delete('/generate/platform-key', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (req, reply) => {
    if (req.user.role !== 'admin') return reply.status(403).send({ error: 'Forbidden', statusCode: 403 })
    try {
      const { rowCount } = await pool.query(
        `UPDATE llm_keys SET revoked_at = NOW() WHERE scope = 'platform' AND revoked_at IS NULL`
      )
      if (rowCount === 0) return reply.status(404).send({ error: 'Chưa cấu hình platform key', statusCode: 404 })
      return { success: true }
    } catch (err) {
      fastify.log.error(err)
      return reply.status(500).send({ error: 'Internal server error', statusCode: 500 })
    }
  })

  // ── Generate exam from uploaded document ────────────────────────────────

  fastify.post('/generate', { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } }, async (req, reply) => {
    const authHeader = req.headers.authorization
    const data = await req.file()
    if (!data) return reply.status(400).send({ error: 'No file uploaded', statusCode: 400 })

    const fileType = MIME_TYPES[data.mimetype]
    if (!fileType) {
      return reply.status(400).send({
        error: 'Chỉ chấp nhận PDF, DOCX hoặc file text',
        statusCode: 400
      })
    }

    // Drain the file stream into a buffer BEFORE touching data.fields — with
    // @fastify/multipart, the "params" field is sent after "file" in our
    // multipart body, and reading data.fields first was observed to leave
    // toBuffer() with an empty result (surfaced as "Corrupted zip" on the
    // DOCX path). Buffering the file first, then reading fields, is safe.
    const buffer = await data.toBuffer()

    let params
    try {
      params = JSON.parse(data.fields?.params?.value ?? '{}')
    } catch {
      return reply.status(400).send({ error: 'params phải là JSON hợp lệ', statusCode: 400 })
    }

    const keySource = params.key_source === 'platform' ? 'platform' : 'own'
    const language = params.language === 'en' ? 'en' : 'vi'
    const difficulty = params.difficulty ?? 'trung bình'

    const settings = await getAdminSettings([
      'ai_generation_enabled', 'ai_generation_credit_cost', 'ai_generation_default_model',
      'ai_generation_max_file_size_mb', 'ai_generation_max_questions', 'default_exam_cost'
    ])
    const defaultModel = settings.ai_generation_default_model || DEFAULT_MODEL
    const maxFileSizeMb = Number(settings.ai_generation_max_file_size_mb ?? 20)
    const maxQuestions = Number(settings.ai_generation_max_questions ?? 30)
    const questionCount = Math.max(1, Math.min(Number(params.question_count) || 15, maxQuestions))

    if (buffer.length > maxFileSizeMb * 1024 * 1024) {
      return reply.status(400).send({ error: `File quá lớn. Tối đa ${maxFileSizeMb}MB`, statusCode: 400 })
    }

    let apiKey
    let model
    let creditsCharged = null

    if (keySource === 'platform') {
      if (settings.ai_generation_enabled !== 'true') {
        return reply.status(403).send({ error: 'Tính năng dùng key nền tảng chưa được bật', statusCode: 403 })
      }
      // Platform-key generations always use the admin-configured default —
      // no per-request model choice, since admin controls platform spend.
      model = defaultModel
      const { rows: platformKeyRows } = await pool.query(
        `SELECT id, encrypted_key FROM llm_keys
         WHERE scope = 'platform' AND revoked_at IS NULL ORDER BY created_at DESC LIMIT 1`
      )
      if (platformKeyRows.length > 0) {
        try {
          apiKey = decryptKey(platformKeyRows[0].encrypted_key)
        } catch (err) {
          fastify.log.error(err)
          return reply.status(500).send({ error: 'Không thể giải mã platform key', statusCode: 500 })
        }
        pool.query(`UPDATE llm_keys SET last_used_at = NOW() WHERE id = $1`, [platformKeyRows[0].id]).catch(() => {})
      } else {
        apiKey = process.env.OPENROUTER_API_KEY
      }
      if (!apiKey) {
        return reply.status(500).send({ error: 'Chưa cấu hình key nền tảng', statusCode: 500 })
      }
      const cost = Math.max(0, Number(settings.ai_generation_credit_cost ?? 5))
      const deductRes = await fetch(`${USER_SERVICE_URL}/internal/credits/deduct`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-internal-key': process.env.INTERNAL_API_KEY },
        body: JSON.stringify({ user_id: req.user.id, amount: cost })
      })
      if (!deductRes.ok) {
        const err = await deductRes.json().catch(() => ({}))
        return reply.status(deductRes.status).send({ error: err.error ?? 'Không đủ credit', statusCode: deductRes.status })
      }
      creditsCharged = cost
    } else {
      // Own key — free model choice, it's the teacher's own key/cost.
      model = isPlausibleModelSlug(params.model) ? params.model.trim() : defaultModel
      const { rows } = await pool.query(
        `SELECT id, encrypted_key FROM llm_keys
         WHERE user_id = $1 AND scope = 'user' AND revoked_at IS NULL ORDER BY created_at DESC LIMIT 1`,
        [req.user.id]
      )
      if (rows.length === 0) {
        return reply.status(400).send({ error: 'Chưa lưu LLM API key. Vui lòng nhập key trước.', statusCode: 400 })
      }
      try {
        apiKey = decryptKey(rows[0].encrypted_key)
      } catch (err) {
        fastify.log.error(err)
        return reply.status(500).send({ error: 'Không thể giải mã key đã lưu', statusCode: 500 })
      }
      pool.query(`UPDATE llm_keys SET last_used_at = NOW() WHERE id = $1`, [rows[0].id]).catch(() => {})
    }

    try {
      const documentBlock = buildDocumentBlock({
        mimetype: data.mimetype,
        buffer,
        extractedText: fileType === 'docx' ? await extractDocxText(buffer) : undefined
      })

      const { exam } = await generateExam({ apiKey, model, documentBlock, questionCount, language, difficulty })
      const defaultExamCost = Math.max(0, Number(settings.default_exam_cost ?? 10))
      const examId = await importExam(authHeader, exam, defaultExamCost)

      const job = await insertJob({
        userId: req.user.id, status: 'completed', keySource, model,
        filename: data.filename, fileType, questionCount: exam.questions.length,
        examId, creditsCharged
      })

      return reply.status(201).send({ job_id: job.id, exam_id: examId })
    } catch (err) {
      fastify.log.error(err)
      await insertJob({
        userId: req.user.id, status: 'failed', keySource, model,
        filename: data.filename, fileType, creditsCharged,
        errorMessage: err.message
      }).catch(() => {})
      return reply.status(502).send({ error: err.message ?? 'Sinh đề thi thất bại', statusCode: 502 })
    }
  })

  // ── Job history ──────────────────────────────────────────────────────────

  fastify.get('/generate/jobs', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (req, reply) => {
    try {
      const { rows } = await pool.query(
        `SELECT * FROM generation_jobs WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
        [req.user.id]
      )
      return rows
    } catch (err) {
      fastify.log.error(err)
      return reply.status(500).send({ error: 'Internal server error', statusCode: 500 })
    }
  })

  fastify.get('/generate/jobs/:id', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (req, reply) => {
    try {
      const { rows } = await pool.query(
        `SELECT * FROM generation_jobs WHERE id = $1 AND user_id = $2`,
        [req.params.id, req.user.id]
      )
      if (rows.length === 0) return reply.status(404).send({ error: 'Job not found', statusCode: 404 })
      return rows[0]
    } catch (err) {
      fastify.log.error(err)
      return reply.status(500).send({ error: 'Internal server error', statusCode: 500 })
    }
  })
}
