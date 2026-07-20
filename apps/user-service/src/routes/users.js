import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'
import { pool } from '../db.js'
import { verifyAuth } from '../middleware/auth.js'
import { getOrSet, invalidate } from '../lib/cache.js'

// Cached at first call — deriving public key from private is deterministic
let _backendPublicKey = null
function backendPublicKey() {
  if (_backendPublicKey) return _backendPublicKey
  if (!process.env.API_ENCRYPTION_KEY) return null
  const ecdh = crypto.createECDH('prime256v1')
  ecdh.setPrivateKey(Buffer.from(process.env.API_ENCRYPTION_KEY, 'base64'))
  _backendPublicKey = ecdh.getPublicKey('base64')
  return _backendPublicKey
}

// Linear-time shape check (no backtracking regex) — avoids ReDoS on crafted input.
function isValidEmail(email) {
  const at = email.indexOf('@')
  if (at <= 0 || at !== email.lastIndexOf('@')) return false
  const local = email.slice(0, at)
  const domain = email.slice(at + 1)
  if (/\s/.test(local) || /\s/.test(domain)) return false
  const dot = domain.lastIndexOf('.')
  return dot > 0 && dot < domain.length - 1
}

export default async function userRoutes(fastify) {
  // Internal endpoint — no JWT auth, uses x-internal-key
  fastify.post('/internal/credits/deduct', { config: { rateLimit: { max: 100, timeWindow: '1 minute' } } }, async (req, reply) => {
    const key = req.headers['x-internal-key']
    if (!key || key !== process.env.INTERNAL_API_KEY) {
      return reply.status(403).send({ error: 'Forbidden', statusCode: 403 })
    }
    const { user_id, amount } = req.body ?? {}
    if (!user_id || typeof amount !== 'number' || amount < 0) {
      return reply.status(400).send({ error: 'Invalid params', statusCode: 400 })
    }
    try {
      const result = await pool.query(
        'UPDATE profiles SET credits = credits - $1 WHERE id = $2 AND credits >= $1 RETURNING credits',
        [amount, user_id]
      )
      if (result.rows.length === 0) {
        return reply.status(402).send({ error: 'Không đủ credit', statusCode: 402 })
      }
      return { success: true, new_balance: result.rows[0].credits }
    } catch (err) {
      fastify.log.error(err)
      return reply.status(500).send({ error: 'Internal server error', statusCode: 500 })
    }
  })

  // Public endpoint — returns backend EC public key for ECDH key exchange
  // Returns 404 when encryption is not configured (dev / key not set)
  fastify.get('/public/crypto-key', async (req, reply) => {
    const key = backendPublicKey()
    if (!key) return reply.status(404).send({ error: 'Encryption not configured', statusCode: 404 })
    return { key }
  })

  // Public endpoint — returns public profile of any user (for creator profile page)
  fastify.get('/public/profile/:userId', async (req, reply) => {
    const { userId } = req.params
    try {
      const row = await getOrSet(`public:profile:${userId}`, 60, async () => {
        const { rows } = await pool.query(`
          SELECT p.id, p.full_name, p.avatar_url, p.role, p.bio, p.birth_year,
                 p.gender, p.interests, p.facebook_url, p.zalo, p.tiktok_url,
                 p.youtube_url, p.instagram_url, p.linkedin_url, p.website_url,
                 p.updated_at, au.email, au.created_at AS joined_at
          FROM profiles p
          JOIN auth.users au ON au.id = p.id
          WHERE p.id = $1`,
          [userId])
        return rows[0] ?? null
      })
      if (!row) return reply.status(404).send({ error: 'User not found', statusCode: 404 })
      return row
    } catch (err) {
      fastify.log.error(err)
      return reply.status(500).send({ error: 'Internal server error', statusCode: 500 })
    }
  })

  // Public endpoint — returns non-sensitive settings for client display
  fastify.get('/public/settings', async (req, reply) => {
    try {
      return await getOrSet('public:settings', 60, async () => {
        const { rows } = await pool.query(
          "SELECT key, value FROM admin_settings WHERE key IN ('teacher_upgrade_cost', 'default_credits', 'default_exam_cost', 'ai_generation_enabled', 'ai_generation_credit_cost')"
        )
        return Object.fromEntries(rows.map(r => [r.key, r.value]))
      })
    } catch (err) {
      fastify.log.error(err)
      return reply.status(500).send({ error: 'Internal server error', statusCode: 500 })
    }
  })

  fastify.addHook('preHandler', async (req, reply) => {
    if (req.url === '/health') return
    if (req.url.startsWith('/internal/')) return
    if (req.url.startsWith('/public/')) return
    await verifyAuth(req, reply)
  })

  // GET /badges/:userId — student badges earned from completing collections
  fastify.get('/badges/:userId', async (req, reply) => {
    const { userId } = req.params
    try {
      // Badges are awarded by submission-service, so there's no local write
      // path to invalidate from here — rely on the TTL alone (60s staleness
      // window is acceptable for a "new badge" notice).
      return await getOrSet(`badges:${userId}`, 60, async () => {
        const r = await pool.query(`
          SELECT sb.id, sb.earned_at, sb.collection_id,
                 qe.title AS collection_title, qe.badge_image_url, qe.description
          FROM quiz_submissions.student_badges sb
          JOIN quiz_exams.collections qe ON qe.id = sb.collection_id
          WHERE sb.user_id = $1
          ORDER BY sb.earned_at DESC`, [userId])
        return r.rows
      })
    } catch (err) {
      fastify.log.error(err)
      return reply.status(500).send({ error: 'Internal server error', statusCode: 500 })
    }
  })

  fastify.get('/:id', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (req, reply) => {
    const { id } = req.params
    try {
      const result = await pool.query(
        `SELECT id, full_name, avatar_url, role, credits, updated_at,
                bio, birth_year, gender, interests,
                facebook_url, zalo, tiktok_url, youtube_url, instagram_url, linkedin_url, website_url
         FROM profiles WHERE id = $1`,
        [id]
      )
      if (result.rows.length === 0) {
        return reply.status(404).send({ error: 'User not found', statusCode: 404 })
      }
      return result.rows[0]
    } catch (err) {
      fastify.log.error(err)
      return reply.status(500).send({ error: 'Internal server error', statusCode: 500 })
    }
  })

  fastify.put('/:id', { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (req, reply) => {
    const { id } = req.params
    const {
      full_name, avatar_url,
      bio, birth_year, gender, interests,
      facebook_url, zalo, tiktok_url, youtube_url, instagram_url, linkedin_url, website_url
    } = req.body ?? {}

    if (req.user.id !== id && req.user.role !== 'admin') {
      return reply.status(403).send({ error: 'Forbidden', statusCode: 403 })
    }

    try {
      const result = await pool.query(
        `INSERT INTO profiles (id, full_name, avatar_url, role, credits, bio, birth_year, gender, interests,
           facebook_url, zalo, tiktok_url, youtube_url, instagram_url, linkedin_url, website_url, updated_at)
         VALUES ($1, $2, $3, 'student',
           (SELECT COALESCE(value::int, 20) FROM admin_settings WHERE key = 'default_credits'),
           $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())
         ON CONFLICT (id) DO UPDATE
         SET full_name      = COALESCE(EXCLUDED.full_name, profiles.full_name),
             avatar_url     = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url),
             bio            = EXCLUDED.bio,
             birth_year     = EXCLUDED.birth_year,
             gender         = EXCLUDED.gender,
             interests      = EXCLUDED.interests,
             facebook_url   = EXCLUDED.facebook_url,
             zalo           = EXCLUDED.zalo,
             tiktok_url     = EXCLUDED.tiktok_url,
             youtube_url    = EXCLUDED.youtube_url,
             instagram_url  = EXCLUDED.instagram_url,
             linkedin_url   = EXCLUDED.linkedin_url,
             website_url    = EXCLUDED.website_url,
             updated_at     = NOW()
         RETURNING *`,
        [id, full_name ?? null, avatar_url ?? null,
         bio ?? null, birth_year ?? null, gender ?? null, interests ?? null,
         facebook_url ?? null, zalo ?? null, tiktok_url ?? null,
         youtube_url ?? null, instagram_url ?? null, linkedin_url ?? null, website_url ?? null]
      )
      invalidate(`public:profile:${id}`)
      return result.rows[0]
    } catch (err) {
      fastify.log.error(err)
      return reply.status(500).send({ error: 'Internal server error', statusCode: 500 })
    }
  })

  // Student upgrade to teacher by spending credits
  fastify.post('/upgrade-to-teacher', { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (req, reply) => {
    if (req.user.role !== 'student') {
      return reply.status(400).send({ error: 'Chỉ student mới có thể nâng cấp', statusCode: 400 })
    }
    try {
      const settingRes = await pool.query(
        "SELECT value FROM admin_settings WHERE key = 'teacher_upgrade_cost'"
      )
      const cost = settingRes.rows.length > 0 ? parseInt(settingRes.rows[0].value, 10) : 100

      const deductResult = await pool.query(
        'UPDATE profiles SET credits = credits - $1 WHERE id = $2 AND credits >= $1 RETURNING credits',
        [cost, req.user.id]
      )
      if (deductResult.rows.length === 0) {
        return reply.status(402).send({ error: `Không đủ credit. Cần ${cost} credit để nâng cấp.`, statusCode: 402 })
      }

      await pool.query(
        `UPDATE auth.users SET raw_user_meta_data = raw_user_meta_data || '{"role":"teacher"}'::jsonb WHERE id = $1`,
        [req.user.id]
      )
      await pool.query('UPDATE profiles SET role = $1 WHERE id = $2', ['teacher', req.user.id])

      return {
        success: true,
        new_balance: deductResult.rows[0].credits,
        message: 'Nâng cấp thành công! Vui lòng đăng xuất và đăng nhập lại để kích hoạt role Teacher.'
      }
    } catch (err) {
      fastify.log.error(err)
      return reply.status(500).send({ error: 'Internal server error', statusCode: 500 })
    }
  })

  fastify.get('/admin/users', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (req, reply) => {
    if (req.user.role !== 'admin') return reply.status(403).send({ error: 'Forbidden', statusCode: 403 })
    const { rows } = await pool.query(`
      SELECT u.id, u.email,
             u.raw_user_meta_data->>'role' AS role,
             u.raw_user_meta_data->>'full_name' AS full_name,
             p.credits,
             u.created_at, u.last_sign_in_at, u.confirmed_at IS NOT NULL AS confirmed
      FROM auth.users u
      LEFT JOIN profiles p ON p.id = u.id
      ORDER BY u.created_at DESC
    `)
    return rows
  })

  fastify.patch('/admin/users/:id/role', { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (req, reply) => {
    if (req.user.role !== 'admin') return reply.status(403).send({ error: 'Forbidden', statusCode: 403 })
    const { id } = req.params
    const { role } = req.body ?? {}
    if (!['admin', 'teacher', 'student', 'banned'].includes(role))
      return reply.status(400).send({ error: 'Invalid role', statusCode: 400 })
    await pool.query(
      `UPDATE auth.users SET raw_user_meta_data = raw_user_meta_data || $1::jsonb WHERE id = $2`,
      [JSON.stringify({ role }), id]
    )
    await pool.query(
      `UPDATE profiles SET role = $1, updated_at = NOW() WHERE id = $2`,
      [role, id]
    )
    invalidate(`public:profile:${id}`)
    return { success: true }
  })

  fastify.patch('/admin/users/:id/credits', { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (req, reply) => {
    if (req.user.role !== 'admin') return reply.status(403).send({ error: 'Forbidden', statusCode: 403 })
    const { id } = req.params
    const { credits } = req.body ?? {}
    if (typeof credits !== 'number' || credits < 0) {
      return reply.status(400).send({ error: 'Invalid credits value', statusCode: 400 })
    }
    await pool.query(
      `INSERT INTO profiles (id, credits, updated_at) VALUES ($1, $2, NOW())
       ON CONFLICT (id) DO UPDATE SET credits = EXCLUDED.credits, updated_at = NOW()`,
      [id, credits]
    )
    return { success: true }
  })

  // ── GET /admin/users/:id — full profile for edit form ────────────────────
  fastify.get('/admin/users/:id', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (req, reply) => {
    if (req.user.role !== 'admin') return reply.status(403).send({ error: 'Forbidden', statusCode: 403 })
    const { id } = req.params
    const { rows } = await pool.query(`
      SELECT u.id, u.email,
             u.raw_user_meta_data->>'role' AS role,
             p.full_name, p.avatar_url, p.credits,
             p.bio, p.birth_year, p.gender, p.interests,
             p.facebook_url, p.zalo, p.tiktok_url, p.youtube_url,
             p.instagram_url, p.linkedin_url, p.website_url,
             u.created_at, u.last_sign_in_at
      FROM auth.users u
      LEFT JOIN profiles p ON p.id = u.id
      WHERE u.id = $1
    `, [id])
    if (rows.length === 0) return reply.status(404).send({ error: 'Không tìm thấy người dùng', statusCode: 404 })
    return rows[0]
  })

  // ── POST /admin/users — tạo tài khoản mới ────────────────────────────────
  fastify.post('/admin/users', { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } }, async (req, reply) => {
    if (req.user.role !== 'admin') return reply.status(403).send({ error: 'Forbidden', statusCode: 403 })
    const { email, password, full_name, role = 'student' } = req.body ?? {}

    if (!email || !password) return reply.status(400).send({ error: 'Email và mật khẩu là bắt buộc', statusCode: 400 })
    if (!isValidEmail(email)) return reply.status(400).send({ error: 'Email không hợp lệ', statusCode: 400 })
    if (password.length < 8) return reply.status(400).send({ error: 'Mật khẩu phải có ít nhất 8 ký tự', statusCode: 400 })
    if (!['student', 'teacher'].includes(role)) return reply.status(400).send({ error: 'Role phải là student hoặc teacher', statusCode: 400 })

    const normalizedEmail = email.toLowerCase().trim()
    const { rows: existing } = await pool.query('SELECT id FROM auth.users WHERE email = $1', [normalizedEmail])
    if (existing.length > 0) return reply.status(409).send({ error: 'Email đã được sử dụng', statusCode: 409 })

    const id = crypto.randomUUID()
    const encryptedPassword = await bcrypt.hash(password, 10)
    const meta = JSON.stringify({ role, full_name: full_name ?? '' })

    try {
      await pool.query(`
        INSERT INTO auth.users
          (id, instance_id, aud, role, email, encrypted_password,
           email_confirmed_at, raw_user_meta_data, created_at, updated_at)
        VALUES ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          $2, $3, NOW(), $4, NOW(), NOW())
      `, [id, normalizedEmail, encryptedPassword, meta])

      const { rows: cs } = await pool.query(
        `SELECT COALESCE(value::int, 20) AS v FROM admin_settings WHERE key = 'default_credits'`
      )
      const defaultCredits = cs[0]?.v ?? 20

      await pool.query(`
        INSERT INTO profiles (id, full_name, role, credits, updated_at)
        VALUES ($1, $2, $3, $4, NOW())
      `, [id, full_name ?? null, role, defaultCredits])

      return reply.status(201).send({ id, email: normalizedEmail, role, full_name: full_name ?? null, credits: defaultCredits })
    } catch (err) {
      fastify.log.error(err)
      return reply.status(500).send({ error: 'Lỗi tạo tài khoản', statusCode: 500 })
    }
  })

  fastify.get('/admin/settings', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (req, reply) => {
    if (req.user.role !== 'admin') return reply.status(403).send({ error: 'Forbidden', statusCode: 403 })
    const { rows } = await pool.query('SELECT key, value FROM admin_settings ORDER BY key')
    return Object.fromEntries(rows.map(r => [r.key, r.value]))
  })

  fastify.put('/admin/settings', { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (req, reply) => {
    if (req.user.role !== 'admin') return reply.status(403).send({ error: 'Forbidden', statusCode: 403 })
    const settings = req.body ?? {}
    for (const [key, value] of Object.entries(settings)) {
      await pool.query(
        `INSERT INTO admin_settings (key, value, updated_at) VALUES ($1, $2, NOW())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        [key, String(value)]
      )
    }
    invalidate('public:settings')
    return { success: true }
  })
}
