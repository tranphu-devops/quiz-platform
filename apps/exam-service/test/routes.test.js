// Route tests without a database: pool.query is replaced by an in-memory fake.
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import jwt from 'jsonwebtoken'
import Fastify from 'fastify'

process.env.DATABASE_URL ??= 'postgres://test@localhost:5432/test?search_path=quiz_exams'
process.env.JWT_SECRET = 'test-secret-test-secret-test-secret-1234'
process.env.INTERNAL_API_KEY = 'internal-test-key'
delete process.env.REDIS_URL

const { pool } = await import('../src/db.js')
const { default: examRoutes } = await import('../src/routes/exams.js')

const T1 = '11111111-1111-1111-1111-111111111111'
const T2 = '22222222-2222-2222-2222-222222222222'
const EXAM_ID = '33333333-3333-3333-3333-333333333333'
// The role the service acts on is the profiles row; token() records it there.
let dbRoles = {}
const token = (sub, role) => {
  dbRoles[sub] = role
  return jwt.sign({ sub, email: 'x@t.test', user_metadata: { role } }, process.env.JWT_SECRET)
}

let state
beforeEach(() => {
  dbRoles = {}
  state = {
    exam: { id: EXAM_ID, created_by: T1, is_published: true, slug: 's', show_explanation: false, allow_retake: true },
    questions: [{ id: 'q1', question_type: 'single', correct_answer: 'B', explanation: 'why', options: [{ key: 'A' }, { key: 'B' }] }],
    inserted: null
  }
  pool.query = async (sql, params = []) => {
    if (/FROM quiz_users\.profiles/.test(sql)) return { rows: dbRoles[params[0]] ? [{ role: dbRoles[params[0]] }] : [] }
    if (/^SELECT \* FROM exams WHERE id/.test(sql)) return { rows: state.exam ? [state.exam] : [] }
    if (/COUNT\(\*\)::int AS n FROM questions/.test(sql)) return { rows: [{ n: state.questions.length }] }
    if (/^SELECT \* FROM questions/.test(sql)) return { rows: state.questions }
    if (/INSERT INTO questions/.test(sql)) {
      state.inserted = { correct_answer: params[4], options: JSON.parse(params[3]), question_type: params[8] }
      return { rows: [state.inserted] }
    }
    return { rows: [], rowCount: 0 }
  }
})

async function app() {
  const f = Fastify()
  f.register(examRoutes)
  await f.ready()
  return f
}

test('internal endpoint: wrong/missing key → 403', async () => {
  const f = await app()
  assert.equal((await f.inject({ url: `/exams/internal/${EXAM_ID}` })).statusCode, 403)
  assert.equal((await f.inject({ url: `/exams/internal/${EXAM_ID}`, headers: { 'x-internal-key': 'nope' } })).statusCode, 403)
})

test('internal endpoint: correct key returns answer key (grader needs it)', async () => {
  const res = await (await app()).inject({ url: `/exams/internal/${EXAM_ID}`, headers: { 'x-internal-key': 'internal-test-key' } })
  assert.equal(res.statusCode, 200)
  assert.equal(res.json().questions[0].correct_answer, 'B')
})

test('GET /exams/:id as guest: no answers, no internal fields', async () => {
  const res = await (await app()).inject({ url: `/exams/${EXAM_ID}` })
  assert.equal(res.statusCode, 200)
  const body = res.json()
  assert.equal(body.questions[0].correct_answer, undefined)
  assert.equal(body.questions[0].explanation, undefined)
  assert.equal(body.created_by, undefined)
})

test('GET /exams/:id as student: no answers', async () => {
  const res = await (await app()).inject({ url: `/exams/${EXAM_ID}`, headers: { authorization: `Bearer ${token(T2, 'student')}` } })
  assert.equal(res.json().questions[0].correct_answer, undefined)
})

test('GET /exams/:id draft as guest → 404', async () => {
  state.exam.is_published = false
  assert.equal((await (await app()).inject({ url: `/exams/${EXAM_ID}` })).statusCode, 404)
})

test('GET /exams/:id with an invalid token is 401, not silently guest', async () => {
  const res = await (await app()).inject({ url: `/exams/${EXAM_ID}`, headers: { authorization: 'Bearer garbage' } })
  assert.equal(res.statusCode, 401)
})

test('write routes require auth', async () => {
  const res = await (await app()).inject({ method: 'POST', url: '/exams', payload: {} })
  assert.equal(res.statusCode, 401)
})

test('PUT /exams/:id by another teacher → 403', async () => {
  const res = await (await app()).inject({
    method: 'PUT', url: `/exams/${EXAM_ID}`, payload: { title: 'x' },
    headers: { authorization: `Bearer ${token(T2, 'teacher')}` }
  })
  assert.equal(res.statusCode, 403)
})

test('PUT /exams/:id with slug → 400 (immutable)', async () => {
  const res = await (await app()).inject({
    method: 'PUT', url: `/exams/${EXAM_ID}`, payload: { slug: 'new' },
    headers: { authorization: `Bearer ${token(T1, 'teacher')}` }
  })
  assert.equal(res.statusCode, 400)
})

test('POST question: array correct_answer is sorted + joined', async () => {
  const res = await (await app()).inject({
    method: 'POST', url: `/exams/${EXAM_ID}/questions`,
    payload: { content: 'c', options: [{ key: 'A' }, { key: 'B' }, { key: 'C' }], correct_answer: ['C', 'A'], question_type: 'multiple' },
    headers: { authorization: `Bearer ${token(T1, 'teacher')}` }
  })
  assert.equal(res.statusCode, 201)
  assert.equal(state.inserted.correct_answer, 'A,C')
})

test('POST question on another teacher\'s exam → 403', async () => {
  const res = await (await app()).inject({
    method: 'POST', url: `/exams/${EXAM_ID}/questions`,
    payload: { content: 'c', options: [{ key: 'A' }, { key: 'B' }], correct_answer: ['A'] },
    headers: { authorization: `Bearer ${token(T2, 'teacher')}` }
  })
  assert.equal(res.statusCode, 403)
})

test('POST question: string correct_answer "C,A" is normalized',
  async () => {
    await (await app()).inject({
      method: 'POST', url: `/exams/${EXAM_ID}/questions`,
      payload: { content: 'c', options: [{ key: 'A' }, { key: 'C' }], correct_answer: 'C,A', question_type: 'multiple' },
      headers: { authorization: `Bearer ${token(T1, 'teacher')}` }
    })
    assert.equal(state.inserted.correct_answer, 'A,C')
  })

test('POST question: correct_answer must be a subset of option keys',
  async () => {
    const res = await (await app()).inject({
      method: 'POST', url: `/exams/${EXAM_ID}/questions`,
      payload: { content: 'c', options: [{ key: 'A' }, { key: 'B' }], correct_answer: ['Z'] },
      headers: { authorization: `Bearer ${token(T1, 'teacher')}` }
    })
    assert.equal(res.statusCode, 400)
  })

test('POST question: single-type with 2 correct answers is rejected',
  async () => {
    const res = await (await app()).inject({
      method: 'POST', url: `/exams/${EXAM_ID}/questions`,
      payload: { content: 'c', options: [{ key: 'A' }, { key: 'B' }], correct_answer: ['A', 'B'], question_type: 'single' },
      headers: { authorization: `Bearer ${token(T1, 'teacher')}` }
    })
    assert.equal(res.statusCode, 400)
  })

test('a token claiming teacher does not get teacher rights when profiles says student', async () => {
  const forged = token(T1, 'teacher')
  dbRoles[T1] = 'student'
  const res = await (await app()).inject({
    method: 'PUT', url: `/exams/${EXAM_ID}`, payload: { title: 'x' },
    headers: { authorization: `Bearer ${forged}` }
  })
  assert.equal(res.statusCode, 403)
})
