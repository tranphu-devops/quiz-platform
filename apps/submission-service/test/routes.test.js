// Route tests with no database: pool.query and global fetch are replaced by
// in-memory fakes, so these exercise the real Fastify routes + auth hook.
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import jwt from 'jsonwebtoken'
import Fastify from 'fastify'

process.env.DATABASE_URL ??= 'postgres://test@localhost:5432/test?search_path=quiz_submissions'
process.env.JWT_SECRET = 'test-secret-test-secret-test-secret-1234'
process.env.INTERNAL_API_KEY = 'internal-test-key'
process.env.EXAM_SERVICE_URL = 'http://exam'
process.env.USER_SERVICE_URL = 'http://user'
delete process.env.NOTIFICATION_SERVICE_URL

const { pool } = await import('../src/db.js')
const { default: submissionRoutes } = await import('../src/routes/submissions.js')

const STUDENT = '11111111-1111-1111-1111-111111111111'
const OTHER = '22222222-2222-2222-2222-222222222222'
const EXAM_ID = '33333333-3333-3333-3333-333333333333'
const SUB_ID = '44444444-4444-4444-4444-444444444444'

// `claimed` is what the token's user_metadata says; the role the services act
// on is the profiles row (db.profileRole).
const token = (sub, claimed = 'student') =>
  jwt.sign({ sub, email: `${sub.slice(0, 4)}@t.test`, role: 'authenticated', user_metadata: { role: claimed } }, process.env.JWT_SECRET)

let db // { profileRole, submission, deducted, inserts, deletes, insertError, ownsExam }
let exam

beforeEach(() => {
  exam = {
    id: EXAM_ID, title: 'T', is_published: true, scheduled_at: null, credit_cost: 5,
    time_limit: 30, max_attempts: null, cooldown_minutes: 0, passing_score: 50,
    show_explanation: false, created_by: OTHER,
    questions: [{ id: 'q1', question_type: 'single', correct_answer: 'A', points: 1, explanation: 'because' }]
  }
  db = { profileRole: 'student', submission: null, deducted: 0, inserts: 0, deletes: 0, insertError: null, ownsExam: false, deductStatus: 200 }

  pool.query = async (sql, params = []) => {
    if (/FROM quiz_users\.profiles/.test(sql)) return { rows: [{ role: db.profileRole }] }
    if (/^SELECT \* FROM submissions WHERE id/.test(sql)) return { rows: db.submission ? [db.submission] : [] }
    if (/status = 'in_progress'\s+LIMIT 1/.test(sql)) return { rows: [] }
    if (/FROM quiz_exams\.exams WHERE id = \$1 AND created_by/.test(sql)) return { rows: db.ownsExam ? [{}] : [] }
    if (/^DELETE FROM submissions/.test(sql)) { db.deletes++; return { rows: [], rowCount: 1 } }
    if (/INSERT INTO submissions/.test(sql)) {
      if (db.insertError) throw db.insertError
      db.inserts++
      return { rows: [{ id: SUB_ID, expires_at: new Date(Date.now() + 1800e3).toISOString() }] }
    }
    if (/SET status = \$7/.test(sql)) {
      return { rows: [{ id: params[5], score: params[1], total_points: params[2], percentage: params[3], status: params[6] }] }
    }
    if (/UPDATE submissions/.test(sql)) return { rows: [], rowCount: 1 }
    return { rows: [] }
  }

  globalThis.fetch = async (url, opts = {}) => {
    if (String(url).startsWith('http://exam/exams/internal/')) {
      return Response.json(exam)
    }
    if (String(url) === 'http://user/internal/credits/deduct') {
      if (db.deductStatus !== 200) return Response.json({ error: 'Không đủ credit' }, { status: db.deductStatus })
      db.deducted += JSON.parse(opts.body).amount
      return Response.json({ success: true, new_balance: 100 })
    }
    return new Response('{}', { status: 404 })
  }
})

async function app() {
  const f = Fastify()
  f.register(submissionRoutes)
  await f.ready()
  return f
}

const inProgress = (over = {}) => ({
  id: SUB_ID, exam_id: EXAM_ID, user_id: STUDENT, status: 'in_progress',
  expires_at: new Date(Date.now() + 600e3), exam_session_id: 'sess-1', answers: {}, ...over
})

// ── auth hook ────────────────────────────────────────────────────────────────

test('no token → 401', async () => {
  const res = await (await app()).inject({ method: 'GET', url: `/submissions/${SUB_ID}` })
  assert.equal(res.statusCode, 401)
})

test('forged token → 401', async () => {
  const bad = jwt.sign({ sub: STUDENT }, 'wrong-secret')
  const res = await (await app()).inject({ method: 'GET', url: `/submissions/${SUB_ID}`, headers: { authorization: `Bearer ${bad}` } })
  assert.equal(res.statusCode, 401)
})

test('banned in DB → 403 even with a valid token', async () => {
  db.profileRole = 'banned'
  const res = await (await app()).inject({ method: 'GET', url: `/submissions/${SUB_ID}`, headers: { authorization: `Bearer ${token(STUDENT)}` } })
  assert.equal(res.statusCode, 403)
})

test('role comes from the profiles row, not from the token\'s user_metadata',
  async () => {
    db.profileRole = 'student'
    db.submission = inProgress({ user_id: OTHER, status: 'completed' })
    const res = await (await app()).inject({
      method: 'GET', url: `/submissions/${SUB_ID}`,
      headers: { authorization: `Bearer ${token(STUDENT, 'admin')}` }
    })
    assert.equal(res.statusCode, 403)
  })

// ── start ────────────────────────────────────────────────────────────────────

test('start: rejects non-UUID exam_id before any outbound call', async () => {
  let called = false
  globalThis.fetch = async () => { called = true; return Response.json({}) }
  const res = await (await app()).inject({
    method: 'POST', url: '/submissions/start', payload: { exam_id: '../../admin' },
    headers: { authorization: `Bearer ${token(STUDENT)}` }
  })
  assert.equal(res.statusCode, 400)
  assert.equal(called, false)
})

test('start: deducts credit_cost and creates a session', async () => {
  const res = await (await app()).inject({
    method: 'POST', url: '/submissions/start', payload: { exam_id: EXAM_ID },
    headers: { authorization: `Bearer ${token(STUDENT)}` }
  })
  assert.equal(res.statusCode, 200)
  assert.equal(db.deducted, 5)
  assert.ok(res.json().session_id)
})

test('start: scheduled exam in the future → 423, no charge', async () => {
  exam.scheduled_at = new Date(Date.now() + 3600e3).toISOString()
  const res = await (await app()).inject({
    method: 'POST', url: '/submissions/start', payload: { exam_id: EXAM_ID },
    headers: { authorization: `Bearer ${token(STUDENT)}` }
  })
  assert.equal(res.statusCode, 423)
  assert.equal(db.deducted, 0)
})

test('start: teacher cannot take exams (CASL) → 403', async () => {
  db.profileRole = 'teacher'
  const res = await (await app()).inject({
    method: 'POST', url: '/submissions/start', payload: { exam_id: EXAM_ID },
    headers: { authorization: `Bearer ${token(STUDENT, 'teacher')}` }
  })
  assert.equal(res.statusCode, 403)
})

test('start: unpublished (draft) exam is not startable',
  async () => {
    exam.is_published = false
    const res = await (await app()).inject({
      method: 'POST', url: '/submissions/start', payload: { exam_id: EXAM_ID },
      headers: { authorization: `Bearer ${token(STUDENT)}` }
    })
    assert.equal(res.statusCode, 404)
    assert.equal(db.deducted, 0)
  })

test('start: insufficient credits → 402 and the uncharged row is removed', async () => {
  db.deductStatus = 402
  const res = await (await app()).inject({
    method: 'POST', url: '/submissions/start', payload: { exam_id: EXAM_ID },
    headers: { authorization: `Bearer ${token(STUDENT)}` }
  })
  assert.equal(res.statusCode, 402)
  assert.equal(db.inserts, 1)
  assert.equal(db.deletes, 1)
})

test('start: concurrent duplicate (unique index) → 409, nothing charged', async () => {
  db.insertError = Object.assign(new Error('duplicate key'), { code: '23505' })
  const res = await (await app()).inject({
    method: 'POST', url: '/submissions/start', payload: { exam_id: EXAM_ID },
    headers: { authorization: `Bearer ${token(STUDENT)}` }
  })
  assert.equal(res.statusCode, 409)
  assert.equal(db.deducted, 0)
})

// ── submit ───────────────────────────────────────────────────────────────────

test('submit: grades and completes own submission', async () => {
  db.submission = inProgress()
  const res = await (await app()).inject({
    method: 'POST', url: `/submissions/${SUB_ID}/submit`, payload: { answers: { q1: 'A' } },
    headers: { authorization: `Bearer ${token(STUDENT)}`, 'x-exam-session': 'sess-1' }
  })
  assert.equal(res.statusCode, 200)
  assert.equal(res.json().percentage, 100)
})

test('submit: another user\'s submission → 403', async () => {
  db.submission = inProgress({ user_id: OTHER })
  const res = await (await app()).inject({
    method: 'POST', url: `/submissions/${SUB_ID}/submit`, payload: { answers: {} },
    headers: { authorization: `Bearer ${token(STUDENT)}` }
  })
  assert.equal(res.statusCode, 403)
})

test('submit: already graded → 409', async () => {
  db.submission = inProgress({ status: 'completed' })
  const res = await (await app()).inject({
    method: 'POST', url: `/submissions/${SUB_ID}/submit`, payload: { answers: {} },
    headers: { authorization: `Bearer ${token(STUDENT)}` }
  })
  assert.equal(res.statusCode, 409)
})

test('submit: mismatched session → 409', async () => {
  db.submission = inProgress()
  const res = await (await app()).inject({
    method: 'POST', url: `/submissions/${SUB_ID}/submit`, payload: { answers: {} },
    headers: { authorization: `Bearer ${token(STUDENT)}`, 'x-exam-session': 'other-device' }
  })
  assert.equal(res.statusCode, 409)
})

test('submit: missing x-exam-session header is rejected',
  async () => {
    db.submission = inProgress()
    const res = await (await app()).inject({
      method: 'POST', url: `/submissions/${SUB_ID}/submit`, payload: { answers: { q1: 'A' } },
      headers: { authorization: `Bearer ${token(STUDENT)}` }
    })
    assert.equal(res.statusCode, 409)
  })

test('submit: past the deadline + grace, the body is ignored and saved answers are graded', async () => {
  db.submission = inProgress({ expires_at: new Date(Date.now() - 10 * 60e3), answers: {} })
  const res = await (await app()).inject({
    method: 'POST', url: `/submissions/${SUB_ID}/submit`, payload: { answers: { q1: 'A' } },
    headers: { authorization: `Bearer ${token(STUDENT)}`, 'x-exam-session': 'sess-1' }
  })
  assert.equal(res.statusCode, 200)
  assert.equal(res.json().percentage, 0)
  assert.equal(res.json().status, 'timed_out')
})

test('submit: within the grace window the body still counts', async () => {
  db.submission = inProgress({ expires_at: new Date(Date.now() - 5e3) })
  const res = await (await app()).inject({
    method: 'POST', url: `/submissions/${SUB_ID}/submit`, payload: { answers: { q1: 'A' } },
    headers: { authorization: `Bearer ${token(STUDENT)}`, 'x-exam-session': 'sess-1' }
  })
  assert.equal(res.json().percentage, 100)
  assert.equal(res.json().status, 'completed')
})

test('progress: expired → 410', async () => {
  db.submission = inProgress({ expires_at: new Date(Date.now() - 1000) })
  const res = await (await app()).inject({
    method: 'PUT', url: `/submissions/${SUB_ID}/progress`, payload: { answers: {} },
    headers: { authorization: `Bearer ${token(STUDENT)}`, 'x-exam-session': 'sess-1' }
  })
  assert.equal(res.statusCode, 410)
})

// ── reads ────────────────────────────────────────────────────────────────────

test('GET submission: student cannot read another student\'s result', async () => {
  db.submission = inProgress({ user_id: OTHER, status: 'completed' })
  const res = await (await app()).inject({ method: 'GET', url: `/submissions/${SUB_ID}`, headers: { authorization: `Bearer ${token(STUDENT)}` } })
  assert.equal(res.statusCode, 403)
})

test('GET /submissions?userId=other: student → 403', async () => {
  const res = await (await app()).inject({ method: 'GET', url: `/submissions?userId=${OTHER}`, headers: { authorization: `Bearer ${token(STUDENT)}` } })
  assert.equal(res.statusCode, 403)
})

const detail = (show_explanation, passing_score = 50) => ({
  show_explanation, passing_score,
  questions: [{ id: 'q1', correct_answer: 'A', explanation: 'because', is_correct: true }]
})

test('GET submission: answer key only when passed AND the exam enables review', async () => {
  const get = async (sub) => {
    db.submission = inProgress({ status: 'completed', ...sub })
    return (await (await app()).inject({ method: 'GET', url: `/submissions/${SUB_ID}`, headers: { authorization: `Bearer ${token(STUDENT)}` } })).json()
  }
  assert.equal((await get({ percentage: 80, results_detail: detail(true) })).results_detail.questions.length, 1)
  assert.equal((await get({ percentage: 80, results_detail: detail(false) })).results_detail.questions.length, 0)
  assert.equal((await get({ percentage: 20, results_detail: detail(true) })).results_detail.questions.length, 0)
})

test('GET submission: teacher sees full detail for their own exam only', async () => {
  db.profileRole = 'teacher'
  db.submission = inProgress({ user_id: OTHER, status: 'completed', percentage: 0, results_detail: detail(false) })
  const f = await app()
  const h = { authorization: `Bearer ${token(STUDENT)}` }
  assert.equal((await f.inject({ method: 'GET', url: `/submissions/${SUB_ID}`, headers: h })).statusCode, 403)
  db.ownsExam = true
  const res = await f.inject({ method: 'GET', url: `/submissions/${SUB_ID}`, headers: h })
  assert.equal(res.json().results_detail.questions.length, 1)
})

test('non-UUID ids are a 4xx, not a database error', async () => {
  const f = await app()
  const h = { authorization: `Bearer ${token(STUDENT)}` }
  assert.equal((await f.inject({ method: 'GET', url: '/submissions/abc', headers: h })).statusCode, 404)
  assert.equal((await f.inject({ method: 'GET', url: '/submissions/active?exam_id=abc', headers: h })).statusCode, 400)
  assert.equal((await f.inject({ method: 'GET', url: '/submissions?examId=abc', headers: h })).statusCode, 400)
})

// ── guest ────────────────────────────────────────────────────────────────────

test('guest-submit: draft exam → 404', async () => {
  exam.is_published = false
  const res = await (await app()).inject({ method: 'POST', url: '/submissions/guest-submit', payload: { exam_id: EXAM_ID, answers: {} } })
  assert.equal(res.statusCode, 404)
})

test('guest-submit: grades without auth and without charging', async () => {
  const res = await (await app()).inject({ method: 'POST', url: '/submissions/guest-submit', payload: { exam_id: EXAM_ID, answers: { q1: 'A' } } })
  assert.equal(res.statusCode, 200)
  assert.equal(res.json().percentage, 100)
  assert.equal(db.deducted, 0)
})

test('guest-submit: no per-question detail unless passed and review is enabled', async () => {
  const f = await app()
  const post = (answers) => f.inject({ method: 'POST', url: '/submissions/guest-submit', payload: { exam_id: EXAM_ID, answers } })
  assert.deepEqual((await post({})).json().results_detail.questions, [])
  assert.deepEqual((await post({ q1: 'A' })).json().results_detail.questions, [])
  exam.show_explanation = true
  assert.deepEqual((await post({})).json().results_detail.questions, []) // failed
  assert.equal((await post({ q1: 'A' })).json().results_detail.questions[0].correct_answer, 'A')
})
