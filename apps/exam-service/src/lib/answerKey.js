// One rule for what a storable answer key looks like. Grading compares the
// stored string to the student's sorted keys (submission-service isCorrect),
// so anything not in exactly this form is a question nobody can get right.

const TYPES = ['single', 'multiple']

/**
 * @returns {{ correct_answer: string } | { error: string }}
 *   correct_answer: sorted, de-duplicated, comma-separated option keys.
 */
export function normalizeAnswerKey({ correct_answer, options, question_type = 'single' }) {
  if (!TYPES.includes(question_type)) {
    return { error: `question_type must be one of ${TYPES.join(', ')}` }
  }
  if (!Array.isArray(options) || options.length < 2 || !options.every(o => o && typeof o.key === 'string' && o.key !== '')) {
    return { error: 'options must be an array of at least 2 items, each with a string "key"' }
  }
  const optionKeys = options.map(o => o.key)
  if (new Set(optionKeys).size !== optionKeys.length) {
    return { error: 'option keys must be unique' }
  }

  const raw = Array.isArray(correct_answer) ? correct_answer : String(correct_answer ?? '').split(',')
  const keys = [...new Set(raw.map(k => String(k).trim()).filter(Boolean))].sort()
  if (keys.length === 0) {
    return { error: 'correct_answer required' }
  }
  if (keys.some(k => !optionKeys.includes(k))) {
    return { error: 'correct_answer must only contain option keys' }
  }
  if (question_type === 'single' && keys.length !== 1) {
    return { error: 'a "single" question must have exactly one correct answer' }
  }
  return { correct_answer: keys.join(',') }
}
