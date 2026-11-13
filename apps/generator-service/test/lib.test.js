import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'

process.env.GENERATOR_KEY_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex')
const { encryptKey, decryptKey, keyPrefix } = await import('../src/lib/keyCrypto.js')
const { buildDocumentBlock, generateExam } = await import('../src/lib/llm.js')

// ── keyCrypto ────────────────────────────────────────────────────────────────

test('keyCrypto: round-trip, random IV, never contains plaintext', () => {
  const k = 'sk-or-v1-abcdef0123456789'
  const a = encryptKey(k), b = encryptKey(k)
  assert.notEqual(a, b)
  assert.equal(decryptKey(a), k)
  assert.doesNotMatch(Buffer.from(a, 'base64').toString('latin1'), /sk-or/)
})

test('keyCrypto: tampered ciphertext fails auth tag check', () => {
  const buf = Buffer.from(encryptKey('sk-or-v1-secret-value'), 'base64')
  buf[buf.length - 1] ^= 1
  assert.throws(() => decryptKey(buf.toString('base64')))
})

test('keyCrypto: wrong-length key is rejected', () => {
  const saved = process.env.GENERATOR_KEY_ENCRYPTION_KEY
  process.env.GENERATOR_KEY_ENCRYPTION_KEY = 'abcd'
  try { assert.throws(() => encryptKey('x'), /32 bytes/) } finally { process.env.GENERATOR_KEY_ENCRYPTION_KEY = saved }
})

test('keyPrefix shows head + tail only', () => {
  assert.equal(keyPrefix('sk-or-v1-0123456789abcd'), 'sk-or-v1...abcd')
})

// ── buildDocumentBlock ───────────────────────────────────────────────────────

test('PDF → file block with sanitized .pdf basename', () => {
  const b = buildDocumentBlock({ mimetype: 'application/pdf', buffer: Buffer.from('%PDF'), filename: '../../etc/notes' })
  assert.equal(b.type, 'file')
  assert.equal(b.file.filename, 'notes.pdf')
  assert.match(b.file.file_data, /^data:application\/pdf;base64,/)
})

test('PDF with pre-extracted text → text block (firecrawl path)', () => {
  const b = buildDocumentBlock({ mimetype: 'application/pdf', buffer: Buffer.from('%PDF'), extractedText: 'x'.repeat(40) })
  assert.equal(b.type, 'text')
})

test('near-empty text document fails up front with empty_document', () => {
  assert.throws(
    () => buildDocumentBlock({ mimetype: 'text/plain', buffer: Buffer.from('  hi  ') }),
    (e) => e.detail?.reason === 'empty_document'
  )
})

// ── generateExam (OpenRouter mocked) ─────────────────────────────────────────

const doc = { type: 'text', text: 'doc' }
let llmReply
beforeEach(() => {
  llmReply = null
  globalThis.fetch = async (_url, opts) => {
    globalThis.lastBody = JSON.parse(opts.body)
    return Response.json(llmReply.body ?? llmReply, { status: llmReply.status ?? 200 })
  }
})
const reply = (exam, finish_reason = 'stop') => ({ choices: [{ finish_reason, message: { content: JSON.stringify(exam) } }] })
const q = (over = {}) => ({
  content: 'Q', question_type: 'single', explanation: 'e',
  options: [{ key: 'A', text: 'a' }, { key: 'B', text: 'b' }], correct_answer: ['A'], ...over
})
const run = () => generateExam({ apiKey: 'k', model: 'm/x', documentBlock: doc, questionCount: 2, language: 'vi', difficulty: 'dễ' })

test('generateExam: valid output normalized with sequential order_index', async () => {
  llmReply = reply({ title: 'T', description: 'D', tags: ['t'], questions: [q(), q({ correct_answer: ['B'] })] })
  const { exam } = await run()
  assert.deepEqual(exam.questions.map(x => x.order_index), [0, 1])
  assert.equal(globalThis.lastBody.response_format.json_schema.strict, true)
  assert.equal(globalThis.lastBody.plugins, undefined) // text block → no file-parser plugin
})

test('generateExam: correct_answer keys not in options are dropped; none left → error', async () => {
  llmReply = reply({ title: 'T', questions: [q({ correct_answer: ['Z'] })] })
  await assert.rejects(run, /không có đáp án đúng/)
})

test('generateExam: duplicate option keys rejected', async () => {
  llmReply = reply({ title: 'T', questions: [q({ options: [{ key: 'A', text: 'a' }, { key: 'A', text: 'b' }] })] })
  await assert.rejects(run, /trùng/)
})

test('generateExam: multiple with 1 correct answer rejected', async () => {
  llmReply = reply({ title: 'T', questions: [q({ question_type: 'multiple' })] })
  await assert.rejects(run, /multiple/)
})

test('generateExam: zero questions → empty_exam with model\'s own description kept', async () => {
  llmReply = reply({ title: 'T', description: 'file trống', questions: [] })
  await assert.rejects(run, (e) => e.detail.reason === 'empty_exam' && e.detail.llm_description === 'file trống')
})

test('generateExam: truncated output (finish_reason=length) reported as length', async () => {
  llmReply = reply({}, 'length')
  await assert.rejects(run, (e) => e.detail.reason === 'length')
})

test('generateExam: non-JSON content → parse_error', async () => {
  llmReply = { choices: [{ finish_reason: 'stop', message: { content: '{"title": "unterminated' } }] }
  await assert.rejects(run, (e) => e.detail.reason === 'parse_error')
})

test('generateExam: provider HTTP error carries status + source', async () => {
  llmReply = { status: 403, body: { error: { message: 'region blocked', code: 403 } } }
  await assert.rejects(run, (e) => e.detail.source === 'openrouter' && e.detail.http_status === 403)
})

test('generateExam: single-type with 2 correct answers rejected',
  async () => {
    llmReply = reply({ title: 'T', questions: [q({ correct_answer: ['A', 'B'] })] })
    await assert.rejects(run)
  })
