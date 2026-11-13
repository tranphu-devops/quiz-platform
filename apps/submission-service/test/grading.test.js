import { test } from 'node:test'
import assert from 'node:assert/strict'

process.env.DATABASE_URL ??= 'postgres://test@localhost:5432/test?search_path=quiz_submissions'
const { isCorrect, buildGradeResult } = await import('../src/routes/submissions.js')
const grader = await import('../../grader-service/src/grade.js')

const single = { id: 'q1', question_type: 'single', correct_answer: 'B', points: 1 }
const multi = { id: 'q2', question_type: 'multiple', correct_answer: 'A,C', points: 2 }

test('single: exact key match only', () => {
  assert.equal(isCorrect(single, 'B'), true)
  assert.equal(isCorrect(single, 'A'), false)
  assert.equal(isCorrect(single, undefined), false)
  assert.equal(isCorrect(single, ['B']), false)
})

test('multiple: order-insensitive, must match the full set', () => {
  assert.equal(isCorrect(multi, ['C', 'A']), true)
  assert.equal(isCorrect(multi, ['A']), false)
  assert.equal(isCorrect(multi, ['A', 'B', 'C']), false)
  assert.equal(isCorrect(multi, 'A,C'), false) // non-array answer never counts
  assert.equal(isCorrect(multi, null), false)
})

test('question_type missing defaults to single semantics', () => {
  assert.equal(isCorrect({ correct_answer: 'A' }, 'A'), true)
})

test('buildGradeResult: weighted score, percentage, detail', () => {
  const exam = { questions: [single, multi], passing_score: 50, show_explanation: true }
  const r = buildGradeResult(exam, { q1: 'B', q2: ['A'] })
  assert.equal(r.score, 1)
  assert.equal(r.total_points, 3)
  assert.equal(Math.round(r.percentage * 100) / 100, 33.33)
  assert.equal(r.results_detail.questions[0].is_correct, true)
  assert.equal(r.results_detail.questions[1].earned, 0)
  assert.equal(r.results_detail.passing_score, 50)
})

test('buildGradeResult: points default to 1, empty exam is 0%', () => {
  const r = buildGradeResult({ questions: [{ id: 'x', correct_answer: 'A' }] }, { x: 'A' })
  assert.equal(r.score, 1)
  assert.equal(r.percentage, 100)
  assert.equal(buildGradeResult({ questions: [] }, {}).percentage, 0)
})

test('grader-service and submission-service grade identically', () => {
  const cases = [
    [single, 'B'], [single, 'C'], [single, undefined],
    [multi, ['A', 'C']], [multi, ['C', 'A']], [multi, ['A']], [multi, 'A,C'], [multi, null]
  ]
  for (const [q, a] of cases) {
    assert.equal(grader.isCorrect(q, a), isCorrect(q, a), JSON.stringify([q.question_type, a]))
  }
})

test('unanswered question with null correct_answer is not marked correct',
  () => {
    const r = buildGradeResult({ questions: [{ id: 'q', correct_answer: null }] }, {})
    assert.equal(r.results_detail.questions[0].is_correct, false)
  })
