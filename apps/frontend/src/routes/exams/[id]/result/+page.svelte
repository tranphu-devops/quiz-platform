<script>
  import { submissionApi } from '$lib/api'
  import { user } from '$lib/stores/auth'
  import { goto } from '$app/navigation'
  import { onMount } from 'svelte'
  import { page } from '$app/stores'
  import { marked } from 'marked'

  let submission = $state(null)
  let loading = $state(true)
  let error = $state('')

  onMount(async () => {
    if (!$user) { goto('/login'); return }
    const submissionId = $page.url.searchParams.get('submissionId')
    if (!submissionId) { goto('/exams'); return }
    try {
      const res = await submissionApi.get(submissionId)
      if (!res.ok) { error = 'Không tìm thấy kết quả'; return }
      submission = await res.json()
    } catch {
      error = 'Không thể tải kết quả'
    } finally {
      loading = false
    }
  })

  function grade(pct) {
    if (pct >= 90) return { label: 'Xuất sắc', color: '#166534' }
    if (pct >= 70) return { label: 'Tốt', color: '#1e40af' }
    if (pct >= 50) return { label: 'Trung bình', color: '#854d0e' }
    return { label: 'Chưa đạt', color: '#dc2626' }
  }

  function optClass(q, optKey) {
    const corrects = q.correct_answer.split(',').filter(Boolean)
    const studentAnswers = Array.isArray(q.student_answer) ? q.student_answer : (q.student_answer ? [q.student_answer] : [])
    const isCorrect = corrects.includes(optKey)
    const isChosen = studentAnswers.includes(optKey)
    if (isCorrect && isChosen) return 'correct-chosen'
    if (isCorrect) return 'correct-unchosen'
    if (isChosen) return 'wrong-chosen'
    return ''
  }
</script>

<style>
  .result-card { background: white; border-radius: 12px; padding: 2.5rem; text-align: center; box-shadow: 0 2px 12px rgba(0,0,0,.1); max-width: 480px; margin: 0 auto 2rem; }
  .score-circle { width: 140px; height: 140px; border-radius: 50%; display: flex; flex-direction: column; align-items: center; justify-content: center; margin: 1.5rem auto; border: 6px solid; }
  .score-pct { font-size: 2rem; font-weight: 700; }
  .score-label { font-size: 0.9rem; margin-top: 0.25rem; }
  .details { margin-top: 1.5rem; color: #6b7280; font-size: 0.95rem; }
  .details p { margin: 0.3rem 0; }
  .actions { margin-top: 2rem; display: flex; gap: 1rem; justify-content: center; }
  .btn { padding: 0.6rem 1.2rem; border-radius: 6px; text-decoration: none; font-size: 0.95rem; border: none; cursor: pointer; }
  .btn-primary { background: #1e40af; color: white; }
  .btn-outline { background: white; border: 1px solid #d1d5db; color: #374151; }
  /* Review section */
  h2 { margin-bottom: 1rem; }
  .q-card { background: white; border-radius: 8px; padding: 1.25rem; margin-bottom: 0.75rem; box-shadow: 0 1px 4px rgba(0,0,0,.08); }
  .q-header { display: flex; align-items: center; gap: 0.6rem; margin-bottom: 0.5rem; font-weight: 600; }
  .result-icon { font-size: 1.1rem; }
  .options { list-style: none; margin-top: 0.5rem; display: flex; flex-direction: column; gap: 0.3rem; }
  .options li { padding: 0.3rem 0.6rem; border-radius: 6px; font-size: 0.9rem; }
  .correct-chosen { background: #dcfce7; color: #166534; font-weight: 600; }
  .correct-unchosen { background: #f0fdf4; color: #166534; border: 1px solid #bbf7d0; }
  .wrong-chosen { background: #fee2e2; color: #dc2626; }
  .error { color: #dc2626; }
  .expl-box { margin-top: 0.75rem; background: #f9fafb; border-left: 3px solid #93c5fd; padding: 0.6rem 0.75rem; border-radius: 0 6px 6px 0; font-size: 0.9rem; line-height: 1.6; }
  .expl-title { font-size: 0.8rem; font-weight: 600; color: #3b82f6; margin-bottom: 0.3rem; }
  .expl-box :global(p) { margin: 0 0 0.4rem; }
  .expl-box :global(p:last-child) { margin: 0; }
  .expl-box :global(code) { background: #e5e7eb; padding: 0.1rem 0.3rem; border-radius: 3px; font-size: 0.88em; }
  .expl-box :global(ul), .expl-box :global(ol) { padding-left: 1.4rem; margin: 0.25rem 0; }
  .hint-multi { font-size: 0.8rem; color: #6b7280; margin-bottom: 0.4rem; }
</style>

{#if loading}<p>Đang tải kết quả...</p>
{:else if error}<p class="error">{error}</p>
{:else if submission}
{@const g = grade(submission.percentage)}
<div class="result-card">
  <h1>Kết quả bài thi</h1>
  <div class="score-circle" style="border-color: {g.color}; color: {g.color}">
    <span class="score-pct">{Math.round(submission.percentage)}%</span>
    <span class="score-label">{g.label}</span>
  </div>
  <div class="details">
    <p>Điểm: <strong>{submission.score}</strong> / {submission.total_points}</p>
    <p>Nộp lúc: {new Date(submission.submitted_at).toLocaleString('vi-VN')}</p>
  </div>
  <div class="actions">
    <a href="/exams/{submission.exam_id}" class="btn btn-outline">Xem lại đề</a>
    <a href="/exams" class="btn btn-primary">Về danh sách đề</a>
  </div>
</div>

{#if submission.results_detail?.show_explanation && submission.results_detail?.questions?.length}
<h2>Xem lại bài làm</h2>
{#each submission.results_detail.questions as q, i}
{@const corrects = q.correct_answer.split(',').filter(Boolean)}
<div class="q-card">
  <div class="q-header">
    <span class="result-icon">{q.is_correct ? '✅' : '❌'}</span>
    <span>Câu {i + 1}</span>
    <span style="font-weight:400; color:#6b7280; font-size:0.85rem">
      {q.earned}/{q.points} điểm
    </span>
  </div>
  <p style="font-size:0.95rem">{q.content}</p>
  {#if q.question_type === 'multiple'}
    <p class="hint-multi">Đáp án đúng: {corrects.join(', ')}</p>
  {/if}
  <ul class="options">
    {#each q.options as opt}
      {@const cls = optClass(q, opt.key)}
      <li class={cls}>
        {opt.key}. {opt.text}
        {#if corrects.includes(opt.key)} ✓{/if}
      </li>
    {/each}
  </ul>
  {#if q.explanation}
    <div class="expl-box">
      <p class="expl-title">Giải thích</p>
      {@html marked(q.explanation)}
    </div>
  {/if}
</div>
{/each}
{/if}
{/if}
