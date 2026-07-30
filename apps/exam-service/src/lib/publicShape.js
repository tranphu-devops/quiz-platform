// Shapes for answer-free question data.
//
// Extracted from GET /exams/:id so the student view and the public SEO pages
// share one implementation. These two must never drift: if one of them ever
// stops stripping `correct_answer`, that endpoint hands out the answer key.

/**
 * Remove the answer key from a question row.
 * For `multiple` questions the *number* of correct options is kept, so the UI
 * can still say "choose N" without revealing which ones.
 */
export function stripAnswer({ correct_answer, explanation, ...q }) {
  if (q.question_type === 'multiple') {
    const correct_count = (correct_answer ?? '').split(',').filter(Boolean).length
    return { ...q, correct_count }
  }
  return q
}

/**
 * Answer-free question for the public (unauthenticated) pages.
 * Drops the grading/ordering internals on top of stripAnswer(), since nothing
 * on a public page uses them.
 */
export function publicQuestion(row) {
  const { points, order_index, exam_id, deleted_at, ...q } = stripAnswer(row)
  return q
}

// Tag slugs are deliberately NOT computed here — they come from
// quiz_exams.slugify() in SQL, so the URL a page links to and the value the
// topic-hub query matches on can never be produced by two different rules.
