import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import jwt from 'jsonwebtoken'
import Fastify from 'fastify'

process.env.DATABASE_URL ??= 'postgres://test@localhost:5432/test?search_path=quiz_users'
process.env.JWT_SECRET = 'test-secret-test-secret-test-secret-1234'
process.env.INTERNAL_API_KEY = 'internal-test-key'
delete process.env.REDIS_URL
delete process.env.NOTIFICATION_SERVICE_URL

const { pool } = await import('../src/db.js')
const { default: userRoutes } = await import('../src/routes/users.js')

const ME = '11111111-1111-1111-1111-111111111111'
const OTHER = '22222222-2222-2222-2222-222222222222'
// `claimed` is the token's user_metadata role; the service acts on dbRole.
const token = (sub, claimed = 'student') => jwt.sign({ sub, email: 'x@t.test', user_metadata: { role: claimed } }, process.env.JWT_SECRET)
let dbRole

let calls
beforeEach(() => {
  calls = []
  dbRole = 'student'
  pool.query = async (sql, params = []) => {
    calls.push(sql)
    if (/^SELECT role FROM profiles/.test(sql)) return { rows: [{ role: dbRole }] }
    if (/UPDATE profiles SET credits = credits - \$1/.test(sql)) {
      return params[0] <= 10 ? { rows: [{ credits: 10 - params[0] }] } : { rows: [] }
    }
    if (/FROM profiles WHERE id = \$1/.test(sql)) {
      return { rows: [{ id: params[0], full_name: 'N', role: 'student', credits: 42, birth_year: 2001 }] }
    }
    return { rows: [], rowCount: 0 }
  }
})

async function app() {
  const f = Fastify()
  // index.js registers userRoutes behind a verifyAuth preHandler; mirror that.
  const { verifyAuth } = await import('../src/middleware/auth.js')
  f.addHook('preHandler', async (req, reply) => {
    if (req.url.startsWith('/internal/') || req.url.startsWith('/public/') || req.url.startsWith('/badges/')) return
    await verifyAuth(req, reply)
  })
  f.register(userRoutes)
  await f.ready()
  return f
}

const deduct = (headers, payload) => app().then(f => f.inject({ method: 'POST', url: '/internal/credits/deduct', headers, payload }))

test('credits/deduct: missing or wrong internal key → 403', async () => {
  assert.equal((await deduct({}, { user_id: ME, amount: 1 })).statusCode, 403)
  assert.equal((await deduct({ 'x-internal-key': 'bad' }, { user_id: ME, amount: 1 })).statusCode, 403)
})

test('credits/deduct: negative / non-number amount → 400 (no credit minting)', async () => {
  const h = { 'x-internal-key': 'internal-test-key' }
  assert.equal((await deduct(h, { user_id: ME, amount: -50 })).statusCode, 400)
  assert.equal((await deduct(h, { user_id: ME, amount: '5' })).statusCode, 400)
})

test('credits/deduct: insufficient balance → 402, sufficient → new balance', async () => {
  const h = { 'x-internal-key': 'internal-test-key' }
  assert.equal((await deduct(h, { user_id: ME, amount: 50 })).statusCode, 402)
  const ok = await deduct(h, { user_id: ME, amount: 4 })
  assert.equal(ok.statusCode, 200)
  assert.equal(ok.json().new_balance, 6)
})

test('PUT /:id on someone else\'s profile → 403', async () => {
  const res = await (await app()).inject({ method: 'PUT', url: `/${OTHER}`, payload: { full_name: 'x' }, headers: { authorization: `Bearer ${token(ME)}` } })
  assert.equal(res.statusCode, 403)
})

test('admin routes: student → 403', async () => {
  const f = await app()
  const h = { authorization: `Bearer ${token(ME)}` }
  for (const [method, url] of [['GET', '/admin/users'], ['PATCH', `/admin/users/${OTHER}/role`], ['PATCH', `/admin/users/${OTHER}/credits`], ['PUT', '/admin/settings']]) {
    const res = await f.inject({ method, url, headers: h, payload: {} })
    assert.equal(res.statusCode, 403, `${method} ${url}`)
  }
})

test('admin role change: invalid role → 400', async () => {
  dbRole = 'admin'
  const res = await (await app()).inject({
    method: 'PATCH', url: `/admin/users/${OTHER}/role`, payload: { role: 'root' },
    headers: { authorization: `Bearer ${token(ME, 'admin')}` }
  })
  assert.equal(res.statusCode, 400)
})

test('admin routes go by the profiles role, not the token\'s user_metadata',
  async () => {
    const res = await (await app()).inject({ method: 'GET', url: '/admin/users', headers: { authorization: `Bearer ${token(ME, 'admin')}` } })
    assert.equal(res.statusCode, 403) // DB says student
  })

test('GET /:id of another user hides credits and birth_year',
  async () => {
    const res = await (await app()).inject({ url: `/${OTHER}`, headers: { authorization: `Bearer ${token(ME)}` } })
    assert.equal(res.json().credits, undefined)
    assert.equal(res.json().birth_year, undefined)
  })

test('GET /:id of yourself still includes credits', async () => {
  const res = await (await app()).inject({ url: `/${ME}`, headers: { authorization: `Bearer ${token(ME)}` } })
  assert.equal(res.json().credits, 42)
})

test('admin settings: unknown keys and malformed values → 400, nothing written', async () => {
  dbRole = 'admin'
  const f = await app()
  const put = (payload) => f.inject({ method: 'PUT', url: '/admin/settings', payload, headers: { authorization: `Bearer ${token(ME)}` } })
  for (const bad of [{ default_exam_cost: 'abc' }, { default_credits: -5 }, { nope: 1 }, { ai_generation_pdf_engine: 'x' }, { default_credits: 5, upload_allowed_types: 'text/html' }]) {
    calls = []
    assert.equal((await put(bad)).statusCode, 400, JSON.stringify(bad))
    assert.equal(calls.some(s => /INSERT INTO admin_settings/.test(s)), false)
  }
  const ok = await put({ default_credits: 20, ai_generation_enabled: 'true', upload_max_size_mb: '2.5', ai_generation_default_model: 'deepseek/deepseek-v4-flash' })
  assert.equal(ok.statusCode, 200)
})

test('PUT /:id only overwrites the fields that were sent', async () => {
  const f = await app()
  const h = { authorization: `Bearer ${token(ME)}` }
  await f.inject({ method: 'PUT', url: `/${ME}`, payload: { full_name: 'New' }, headers: h })
  let sql = calls.find(s => /INSERT INTO profiles/.test(s))
  assert.doesNotMatch(sql, /bio = EXCLUDED\.bio/)
  calls = []
  await f.inject({ method: 'PUT', url: `/${ME}`, payload: { bio: null, zalo: '09' }, headers: h })
  sql = calls.find(s => /INSERT INTO profiles/.test(s))
  assert.match(sql, /bio = EXCLUDED\.bio/)
  assert.match(sql, /zalo = EXCLUDED\.zalo/)
  assert.doesNotMatch(sql, /gender = EXCLUDED\.gender/)
})

test('API key is refused outside /upload', async () => {
  const res = await (await app()).inject({ url: '/admin/users', headers: { 'x-api-key': 'qz_live_whatever' } })
  assert.equal(res.statusCode, 401)
})
