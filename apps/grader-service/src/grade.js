function isCorrect(q, studentAnswer) {
  if (q.question_type === 'multiple') {
    const sorted = Array.isArray(studentAnswer) ? [...studentAnswer].sort().join(',') : ''
    return sorted === q.correct_answer
  }
  return studentAnswer === q.correct_answer
}

async function awardBadgesIfEarned(pool, userId, examId) {
  const collectionsRes = await fetch(
    `${process.env.EXAM_SERVICE_URL}/collections/internal/check-badge?exam_id=${examId}`,
    { headers: { 'x-internal-key': process.env.INTERNAL_API_KEY } }
  )
  if (!collectionsRes.ok) return
  const collections = await collectionsRes.json()
  if (!collections.length) return

  for (const col of collections) {
    const examIds = col.exam_ids ?? []
    if (!examIds.length) continue
    const placeholders = examIds.map((_, i) => `$${i + 2}`).join(', ')
    const r = await pool.query(
      `SELECT COUNT(DISTINCT s.exam_id) AS passed_count
       FROM submissions s
       JOIN quiz_exams.exams e ON e.id = s.exam_id
       WHERE s.user_id = $1
         AND s.exam_id IN (${placeholders})
         AND s.status IN ('completed', 'timed_out')
         AND (e.passing_score IS NULL OR s.percentage >= e.passing_score)`,
      [userId, ...examIds]
    )
    const passedCount = parseInt(r.rows[0]?.passed_count ?? 0, 10)
    if (passedCount >= examIds.length) {
      await pool.query(
        `INSERT INTO student_badges (user_id, collection_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [userId, col.id]
      )
    }
  }
}

export async function runAutoGrade(pool) {
  const { rows } = await pool.query(
    `SELECT * FROM submissions WHERE status = 'in_progress' AND expires_at < NOW()`
  )
  if (!rows.length) return 0

  let count = 0
  for (const sub of rows) {
    try {
      const examRes = await fetch(
        `${process.env.EXAM_SERVICE_URL}/exams/internal/${sub.exam_id}`,
        { headers: { 'x-internal-key': process.env.INTERNAL_API_KEY } }
      )
      if (!examRes.ok) continue
      const exam = await examRes.json()

      const answers = sub.answers ?? {}
      let score = 0, total_points = 0
      for (const q of exam.questions) {
        total_points += q.points ?? 1
        if (isCorrect(q, answers[q.id])) score += q.points ?? 1
      }
      const percentage = total_points > 0 ? (score / total_points) * 100 : 0

      const results_detail = {
        show_explanation: exam.show_explanation ?? false,
        passing_score: exam.passing_score ?? null,
        allow_retake: exam.allow_retake ?? false,
        questions: exam.questions.map(q => {
          const sa = answers[q.id] ?? null
          const correct = isCorrect(q, sa)
          return {
            id: q.id, content: q.content, options: q.options,
            question_type: q.question_type ?? 'single',
            correct_answer: q.correct_answer, student_answer: sa,
            is_correct: correct, points: q.points ?? 1,
            earned: correct ? (q.points ?? 1) : 0,
            explanation: q.explanation ?? null
          }
        })
      }

      // UPDATE WHERE status='in_progress' guards against racing with submit endpoint
      const updated = await pool.query(
        `UPDATE submissions
            SET status = 'timed_out', score = $1, total_points = $2,
                percentage = $3, results_detail = $4, submitted_at = NOW()
          WHERE id = $5 AND status = 'in_progress'`,
        [score, total_points, percentage, JSON.stringify(results_detail), sub.id]
      )

      if (updated.rowCount > 0) {
        count++
        const passed = exam.passing_score == null || percentage >= exam.passing_score
        if (passed) {
          await awardBadgesIfEarned(pool, sub.user_id, sub.exam_id).catch(() => {})
        }
      }
    } catch (err) {
      console.error(`[grader] Failed to grade submission ${sub.id}:`, err.message)
    }
  }
  return count
}
