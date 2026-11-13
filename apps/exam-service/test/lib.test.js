import { test } from 'node:test'
import assert from 'node:assert/strict'
import { subject } from '@casl/ability'
import { sanitizeDescription, descriptionToText, excerpt } from '../src/lib/sanitizeDescription.js'
import { stripAnswer, publicQuestion } from '../src/lib/publicShape.js'
import { defineAbilityFor } from '../src/lib/ability.js'
import { normalizeAnswerKey } from '../src/lib/answerKey.js'

// ── sanitizeDescription ──────────────────────────────────────────────────────

test('sanitize: removes script/iframe with content, keeps formatting', () => {
  const out = sanitizeDescription('<p><b>Hi</b><script>alert(1)</script><iframe src="x">y</iframe></p>')
  assert.equal(out, '<p><b>Hi</b></p>')
})

test('sanitize: strips event handlers and javascript: URLs', () => {
  const out = sanitizeDescription('<a href="javascript:alert(1)" onclick="x()">l</a><img src=x onerror=alert(1)>')
  assert.doesNotMatch(out, /javascript:|onclick|onerror|<img/i)
})

test('sanitize: links forced to target=_blank rel=noopener noreferrer nofollow', () => {
  const out = sanitizeDescription('<a href="https://e.com" target="_self">l</a>')
  assert.match(out, /target="_blank"/)
  assert.match(out, /rel="noopener noreferrer nofollow"/)
})

test('sanitize: svg payload removed with content', () => {
  assert.equal(sanitizeDescription('<svg><script>alert(1)</script></svg>ok'), 'ok')
})

test('sanitize: non-string → empty', () => {
  assert.equal(sanitizeDescription(null), '')
  assert.equal(sanitizeDescription({ a: 1 }), '')
})

test('descriptionToText / excerpt', () => {
  assert.equal(descriptionToText('<p>a&nbsp;<b>b</b></p>'), 'a b')
  assert.doesNotMatch(descriptionToText('<<p>>x<scr<b>ipt>'), /<[a-z]/i)
  const e = excerpt('<p>' + 'word '.repeat(100) + '</p>', 50)
  assert.ok(e.length <= 51 && e.endsWith('…'))
})

// ── publicShape: answer key must never leave on student/public paths ────────

test('stripAnswer: single drops correct_answer + explanation', () => {
  const q = stripAnswer({ id: 1, question_type: 'single', correct_answer: 'A', explanation: 'x', content: 'c' })
  assert.deepEqual(q, { id: 1, question_type: 'single', content: 'c' })
})

test('stripAnswer: multiple keeps only correct_count', () => {
  const q = stripAnswer({ id: 1, question_type: 'multiple', correct_answer: 'A,C', explanation: 'x' })
  assert.equal(q.correct_count, 2)
  assert.equal('correct_answer' in q, false)
})

test('publicQuestion also drops grading internals', () => {
  const q = publicQuestion({ id: 1, correct_answer: 'A', points: 2, order_index: 0, exam_id: 'e', deleted_at: null, content: 'c' })
  assert.deepEqual(q, { id: 1, content: 'c' })
})

// ── CASL ─────────────────────────────────────────────────────────────────────

const exam = (over) => subject('Exam', { created_by: 'T1', is_published: true, ...over })

test('ability: teacher manages only own exams', () => {
  const a = defineAbilityFor({ id: 'T1', role: 'teacher' })
  assert.equal(a.can('update', exam()), true)
  assert.equal(a.can('update', exam({ created_by: 'T2' })), false)
  assert.equal(a.can('delete', exam({ created_by: 'T2' })), false)
})

test('ability: student/guest read published only, never write', () => {
  for (const role of ['student', 'guest']) {
    const a = defineAbilityFor({ id: 'S', role })
    assert.equal(a.can('read', exam()), true, role)
    assert.equal(a.can('read', exam({ is_published: false })), false, role)
    assert.equal(a.can('update', exam()), false, role)
    assert.equal(a.can('create', 'Exam'), false, role)
  }
})

test('ability: banned has nothing, admin has everything', () => {
  assert.equal(defineAbilityFor({ id: 'B', role: 'banned' }).can('read', exam()), false)
  assert.equal(defineAbilityFor({ id: 'A', role: 'admin' }).can('delete', exam({ created_by: 'x' })), true)
})

test('ability: unknown role falls back to student, not admin', () => {
  const a = defineAbilityFor({ id: 'X', role: 'superuser' })
  assert.equal(a.can('update', exam()), false)
})

// ── answer key ───────────────────────────────────────────────────────────────

const opts = [{ key: 'A' }, { key: 'B' }, { key: 'C' }]

test('answerKey: array and string forms normalize to the same sorted string', () => {
  assert.deepEqual(normalizeAnswerKey({ correct_answer: ['C', 'A'], options: opts, question_type: 'multiple' }), { correct_answer: 'A,C' })
  assert.deepEqual(normalizeAnswerKey({ correct_answer: ' C , A,A ', options: opts, question_type: 'multiple' }), { correct_answer: 'A,C' })
  assert.deepEqual(normalizeAnswerKey({ correct_answer: 'B', options: opts }), { correct_answer: 'B' })
})

test('answerKey: rejects what could never be graded correct', () => {
  const bad = [
    { correct_answer: ['Z'], options: opts },
    { correct_answer: ['A', 'B'], options: opts, question_type: 'single' },
    { correct_answer: [], options: opts },
    { correct_answer: 'A', options: [{ key: 'A' }, { key: 'A' }] },
    { correct_answer: 'A', options: [{ key: 'A' }] },
    { correct_answer: 'A', options: opts, question_type: 'essay' },
    { correct_answer: 'A', options: 'nope' }
  ]
  for (const b of bad) assert.ok(normalizeAnswerKey(b).error, JSON.stringify(b))
})
