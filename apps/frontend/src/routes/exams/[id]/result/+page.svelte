<script>
  import { submissionApi, examApi } from '$lib/api'
  import { user } from '$lib/stores/auth'
  import { goto } from '$app/navigation'
  import { onMount } from 'svelte'
  import { page } from '$app/stores'
  import { marked } from 'marked'

  let submission = $state(null)
  let exam = $state(null)
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
      const examRes = await examApi.get(submission.exam_id)
      if (examRes.ok) exam = await examRes.json()
    } catch {
      error = 'Không thể tải kết quả'
    } finally {
      loading = false
    }
  })

  function grade(pct) {
    if (pct >= 90) return { label: 'Xuất sắc!',  color: '#16a34a', bg: '#dcfce7', ring: '#22c55e' }
    if (pct >= 70) return { label: 'Tốt',         color: '#1d4ed8', bg: '#dbeafe', ring: '#6366f1' }
    if (pct >= 50) return { label: 'Trung bình',  color: '#92400e', bg: '#fef9c3', ring: '#f59e0b' }
    return           { label: 'Chưa đạt',         color: '#dc2626', bg: '#fee2e2', ring: '#ef4444' }
  }

  const hasPassed = $derived(
    submission != null && (exam?.passing_score == null || submission.percentage >= exam.passing_score)
  )

  function optClass(q, optKey) {
    const corrects = q.correct_answer.split(',').filter(Boolean)
    const studentAnswers = Array.isArray(q.student_answer) ? q.student_answer : (q.student_answer ? [q.student_answer] : [])
    const isCorrect = corrects.includes(optKey)
    const isChosen  = studentAnswers.includes(optKey)
    if (isCorrect && isChosen)  return 'correct-chosen'
    if (isCorrect)               return 'correct-unchosen'
    if (isChosen)                return 'wrong-chosen'
    return ''
  }
</script>

<style>
  /* ── Hero result card ─────────────────────────────────────────────────────────*/
  .result-hero {
    background: var(--surface); border-radius: var(--radius-card);
    padding: 2.5rem 2rem; text-align: center;
    max-width: 500px; margin: 0 auto 2rem;
    box-shadow: var(--shadow); border: 1px solid var(--border);
  }
  .celebrate { font-size: 2.5rem; margin-bottom: 0.5rem; }
  .result-hero h1 { font-size: 1.5rem; font-weight: 800; margin-bottom: 0.25rem; }
  .result-hero .subtitle { color: var(--muted); font-size: 0.9rem; margin-bottom: 2rem; }

  /* Score ring */
  .score-ring-wrap { position: relative; width: 160px; height: 160px; margin: 0 auto 1.75rem; }
  .score-ring {
    width: 160px; height: 160px; border-radius: 50%;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    position: relative;
  }
  .score-ring::before {
    content: '';
    position: absolute; inset: 0; border-radius: 50%;
    border: 8px solid transparent;
    border-top-color: currentColor;
    border-right-color: currentColor;
    animation: none;
  }
  .score-pct { font-size: 2.4rem; font-weight: 800; line-height: 1; }
  .score-grade { font-size: 0.9rem; font-weight: 600; margin-top: 0.2rem; opacity: 0.8; }

  .stats-row {
    display: flex; justify-content: center; gap: 2rem;
    margin-bottom: 2rem; flex-wrap: wrap;
  }
  .stat-item { text-align: center; }
  .stat-item .val { font-size: 1.4rem; font-weight: 800; color: var(--text); }
  .stat-item .lbl { font-size: 0.78rem; color: var(--muted); margin-top: 2px; }

  .pass-banner {
    background: linear-gradient(135deg, #dcfce7, #bbf7d0);
    border: 1.5px solid #86efac;
    border-radius: 12px; padding: 0.75rem 1.25rem;
    color: #15803d; font-weight: 700; font-size: 0.95rem;
    margin-bottom: 1.5rem;
  }
  .fail-banner {
    background: #fef2f2; border: 1.5px solid #fca5a5;
    border-radius: 12px; padding: 0.75rem 1.25rem;
    color: #dc2626; font-weight: 600; font-size: 0.9rem;
    margin-bottom: 1.5rem; line-height: 1.5;
  }
  .fail-banner strong { display: block; font-size: 0.95rem; margin-bottom: 0.25rem; }

  .actions { display: flex; gap: 0.75rem; justify-content: center; flex-wrap: wrap; }
  .btn-primary {
    padding: 0.7rem 1.5rem; border-radius: var(--radius-btn);
    background: linear-gradient(135deg, var(--primary), var(--accent));
    color: white; font-size: 0.9rem; font-weight: 700;
    text-decoration: none; border: none; cursor: pointer;
    box-shadow: 0 4px 14px rgba(99,102,241,0.35); transition: all 0.2s;
  }
  .btn-primary:hover { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(99,102,241,0.45); }
  .btn-outline {
    padding: 0.7rem 1.5rem; border-radius: var(--radius-btn);
    background: white; color: var(--text);
    border: 1.5px solid var(--border); font-size: 0.9rem; font-weight: 600;
    text-decoration: none; cursor: pointer; transition: all 0.15s;
  }
  .btn-outline:hover { border-color: var(--primary); color: var(--primary); }
  .btn-retry {
    padding: 0.7rem 1.5rem; border-radius: var(--radius-btn);
    background: linear-gradient(135deg, #f59e0b, #ef4444);
    color: white; font-size: 0.9rem; font-weight: 700;
    text-decoration: none; border: none; cursor: pointer;
    box-shadow: 0 4px 14px rgba(239,68,68,0.3); transition: all 0.2s;
  }
  .btn-retry:hover { box-shadow: 0 6px 20px rgba(239,68,68,0.4); }

  /* ── Review section ───────────────────────────────────────────────────────────*/
  .review-header {
    font-size: 1.2rem; font-weight: 800; margin-bottom: 1.25rem;
    color: var(--text); letter-spacing: -0.01em;
  }
  .q-card {
    background: var(--surface); border-radius: 14px; padding: 1.4rem;
    margin-bottom: 1rem; box-shadow: var(--shadow); border: 1px solid var(--border);
  }
  .q-head { display: flex; align-items: center; gap: 0.6rem; margin-bottom: 0.75rem; }
  .q-icon { font-size: 1.2rem; }
  .q-num { font-weight: 700; color: var(--text); }
  .q-pts { font-size: 0.82rem; color: var(--muted); margin-left: auto; }
  .q-text { font-size: 0.95rem; line-height: 1.6; margin-bottom: 0.75rem; color: var(--text); }
  .multi-hint { font-size: 0.8rem; color: var(--muted); margin-bottom: 0.5rem; font-style: italic; }

  .options { list-style: none; display: flex; flex-direction: column; gap: 0.4rem; }
  .options li {
    padding: 0.5rem 0.85rem; border-radius: 8px; font-size: 0.9rem;
    border: 1px solid transparent;
  }
  .correct-chosen  { background: #dcfce7; color: #15803d; font-weight: 600; border-color: #86efac; }
  .correct-unchosen{ background: #f0fdf4; color: #15803d; border-color: #bbf7d0; }
  .wrong-chosen    { background: #fee2e2; color: #dc2626; border-color: #fca5a5; }

  .expl-box {
    margin-top: 1rem; background: #f5f3ff; border-left: 3px solid var(--primary);
    padding: 0.75rem 1rem; border-radius: 0 10px 10px 0; font-size: 0.9rem; line-height: 1.6;
  }
  .expl-title { font-size: 0.78rem; font-weight: 700; color: var(--primary); margin-bottom: 0.4rem; text-transform: uppercase; letter-spacing: 0.06em; }
  .expl-box :global(p)  { margin: 0 0 0.4rem; }
  .expl-box :global(p:last-child) { margin: 0; }
  .expl-box :global(code) { background: #ede9fe; padding: 0.1rem 0.3rem; border-radius: 4px; font-size: 0.88em; }
  .expl-box :global(ul), .expl-box :global(ol) { padding-left: 1.4rem; margin: 0.25rem 0; }

  .locked-box {
    background: #fef2f2; border: 1.5px solid #fca5a5; border-radius: 14px;
    padding: 2rem; text-align: center; margin-top: 1.5rem;
  }
  .locked-box strong { display: block; font-size: 1rem; color: #dc2626; margin-bottom: 0.5rem; }
  .locked-box p { color: var(--muted); font-size: 0.9rem; }

  .error { color: var(--danger); }
</style>

{#if loading}
  <div style="text-align:center;padding:4rem 0;color:var(--muted)">Đang tải kết quả...</div>
{:else if error}
  <p class="error">{error}</p>
{:else if submission}
{@const g = grade(submission.percentage)}
<div class="result-hero">
  {#if hasPassed}
    <div class="celebrate">🎉</div>
    <h1>Chúc mừng!</h1>
    <p class="subtitle">Bạn đã hoàn thành xuất sắc bài thi này.</p>
  {:else}
    <div class="celebrate">💪</div>
    <h1>Kết quả bài thi</h1>
    <p class="subtitle">Tiếp tục cố gắng, bạn sẽ làm được!</p>
  {/if}

  <div class="score-ring-wrap">
    <div class="score-ring" style="background:{g.bg}; color:{g.color}; border: 8px solid {g.ring}">
      <span class="score-pct">{Math.round(submission.percentage)}%</span>
      <span class="score-grade">{g.label}</span>
    </div>
  </div>

  <div class="stats-row">
    <div class="stat-item">
      <div class="val">{submission.score}</div>
      <div class="lbl">Điểm đạt</div>
    </div>
    <div class="stat-item">
      <div class="val">{submission.total_points}</div>
      <div class="lbl">Tổng điểm</div>
    </div>
    {#if exam?.passing_score != null}
    <div class="stat-item">
      <div class="val">{exam.passing_score}%</div>
      <div class="lbl">Điểm đạt yêu cầu</div>
    </div>
    {/if}
  </div>

  {#if hasPassed}
    <div class="pass-banner">✓ Bạn đã vượt qua bài kiểm tra!</div>
  {:else}
    <div class="fail-banner">
      <strong>Chưa đạt yêu cầu</strong>
      Cần đạt {exam?.passing_score ?? submission.results_detail?.passing_score}% để qua. Hãy ôn lại và thử lại nhé!
    </div>
  {/if}

  <div class="actions">
    {#if hasPassed}
      <a href="/exams/{submission.exam_id}" class="btn-outline">← Về đề thi</a>
    {/if}
    <a href="/exams" class="btn-primary">Xem tất cả đề</a>
    {#if !hasPassed}
      <a href="/exams/{submission.exam_id}/take" class="btn-retry">Làm lại</a>
    {/if}
  </div>
</div>

{#if hasPassed && submission.results_detail?.show_explanation && submission.results_detail?.questions?.length}
<h2 class="review-header">Xem lại bài làm</h2>
{#each submission.results_detail.questions as q, i}
{@const corrects = q.correct_answer.split(',').filter(Boolean)}
<div class="q-card">
  <div class="q-head">
    <span class="q-icon">{q.is_correct ? '✅' : '❌'}</span>
    <span class="q-num">Câu {i + 1}</span>
    <span class="q-pts">{q.earned}/{q.points} điểm</span>
  </div>
  <p class="q-text">{q.content}</p>
  {#if q.question_type === 'multiple'}
    <p class="multi-hint">Đáp án đúng: {corrects.join(', ')}</p>
  {/if}
  <ul class="options">
    {#each q.options as opt}
      {@const cls = optClass(q, opt.key)}
      <li class={cls}>{opt.key}. {opt.text}{corrects.includes(opt.key) ? ' ✓' : ''}</li>
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

{:else if !hasPassed}
<div class="locked-box">
  <strong>🔒 Chưa đạt — không xem được bài làm</strong>
  <p>Cần đạt {exam?.passing_score ?? submission.results_detail?.passing_score}% để mở khoá xem lại. Hãy làm lại bài!</p>
</div>
{/if}
{/if}
