import { pool } from '../db.js'
import { verifyAuth } from '../middleware/auth.js'

export default async function userRoutes(fastify) {
  // Internal endpoint — no JWT auth, uses x-internal-key
  fastify.post('/internal/credits/deduct', async (req, reply) => {
    const key = req.headers['x-internal-key']
    if (!key || key !== process.env.INTERNAL_API_KEY) {
      return reply.status(403).send({ error: 'Forbidden', statusCode: 403 })
    }
    const { user_id, amount } = req.body ?? {}
    if (!user_id || typeof amount !== 'number' || amount < 0) {
      return reply.status(400).send({ error: 'Invalid params', statusCode: 400 })
    }
    const result = await pool.query(
      'UPDATE profiles SET credits = credits - $1 WHERE id = $2 AND credits >= $1 RETURNING credits',
      [amount, user_id]
    )
    if (result.rows.length === 0) {
      return reply.status(402).send({ error: 'Không đủ credit', statusCode: 402 })
    }
    return { success: true, new_balance: result.rows[0].credits }
  })

  // Public endpoint — returns non-sensitive settings for client display
  fastify.get('/public/settings', async (req, reply) => {
    try {
      const { rows } = await pool.query(
        "SELECT key, value FROM admin_settings WHERE key IN ('teacher_upgrade_cost', 'default_credits', 'default_exam_cost')"
      )
      return Object.fromEntries(rows.map(r => [r.key, r.value]))
    } catch (err) {
      fastify.log.error(err)
      return reply.status(500).send({ error: 'Internal server error', statusCode: 500 })
    }
  })

  fastify.addHook('preHandler', async (req, reply) => {
    if (req.routeOptions?.url === '/health') return
    if (req.routeOptions?.url?.startsWith('/internal/')) return
    if (req.routeOptions?.url?.startsWith('/public/')) return
    await verifyAuth(req, reply)
  })

  // GET /badges/:userId — student badges earned from completing collections
  fastify.get('/badges/:userId', async (req, reply) => {
    const { userId } = req.params
    try {
      // Badges are in quiz_submissions schema; use fully-qualified names
      const r = await pool.query(`
        SELECT sb.id, sb.earned_at, sb.collection_id,
               qe.title AS collection_title, qe.badge_image_url, qe.description
        FROM quiz_submissions.student_badges sb
        JOIN quiz_exams.collections qe ON qe.id = sb.collection_id
        WHERE sb.user_id = $1
        ORDER BY sb.earned_at DESC`, [userId])
      return r.rows
    } catch (err) {
      fastify.log.error(err)
      return reply.status(500).send({ error: 'Internal server error', statusCode: 500 })
    }
  })

  fastify.get('/:id', async (req, reply) => {
    const { id } = req.params
    try {
      const result = await pool.query(
        'SELECT id, full_name, avatar_url, role, credits, updated_at FROM profiles WHERE id = $1',
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

  fastify.put('/:id', async (req, reply) => {
    const { id } = req.params
    const { full_name, avatar_url } = req.body ?? {}

    if (req.user.id !== id && req.user.role !== 'admin') {
      return reply.status(403).send({ error: 'Forbidden', statusCode: 403 })
    }

    try {
      const result = await pool.query(
        `INSERT INTO profiles (id, full_name, avatar_url, role, credits, updated_at)
         VALUES ($1, $2, $3, 'student',
           (SELECT COALESCE(value::int, 20) FROM admin_settings WHERE key = 'default_credits'),
           NOW())
         ON CONFLICT (id) DO UPDATE
         SET full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
             avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url),
             updated_at = NOW()
         RETURNING *`,
        [id, full_name ?? null, avatar_url ?? null]
      )
      return result.rows[0]
    } catch (err) {
      fastify.log.error(err)
      return reply.status(500).send({ error: 'Internal server error', statusCode: 500 })
    }
  })

  // Student upgrade to teacher by spending credits
  fastify.post('/upgrade-to-teacher', async (req, reply) => {
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

  fastify.get('/admin/users', async (req, reply) => {
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

  fastify.patch('/admin/users/:id/role', async (req, reply) => {
    if (req.user.role !== 'admin') return reply.status(403).send({ error: 'Forbidden', statusCode: 403 })
    const { id } = req.params
    const { role } = req.body ?? {}
    if (!['admin', 'teacher', 'student'].includes(role))
      return reply.status(400).send({ error: 'Invalid role', statusCode: 400 })
    await pool.query(
      `UPDATE auth.users SET raw_user_meta_data = raw_user_meta_data || $1::jsonb WHERE id = $2`,
      [JSON.stringify({ role }), id]
    )
    await pool.query(
      `UPDATE profiles SET role = $1, updated_at = NOW() WHERE id = $2`,
      [role, id]
    )
    return { success: true }
  })

  fastify.patch('/admin/users/:id/credits', async (req, reply) => {
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

  fastify.get('/admin/settings', async (req, reply) => {
    if (req.user.role !== 'admin') return reply.status(403).send({ error: 'Forbidden', statusCode: 403 })
    const { rows } = await pool.query('SELECT key, value FROM admin_settings ORDER BY key')
    return Object.fromEntries(rows.map(r => [r.key, r.value]))
  })

  fastify.put('/admin/settings', async (req, reply) => {
    if (req.user.role !== 'admin') return reply.status(403).send({ error: 'Forbidden', statusCode: 403 })
    const settings = req.body ?? {}
    for (const [key, value] of Object.entries(settings)) {
      await pool.query(
        `INSERT INTO admin_settings (key, value, updated_at) VALUES ($1, $2, NOW())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        [key, String(value)]
      )
    }
    return { success: true }
  })
}
