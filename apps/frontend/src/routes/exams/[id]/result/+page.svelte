<script>
  import { submissionApi, examApi, reportApi } from '$lib/api'
  import { user } from '$lib/stores/auth'
  import { goto } from '$app/navigation'
  import { onMount } from 'svelte'
  import { page } from '$app/stores'
  import { marked } from 'marked'
  import { t } from '$lib/i18n'

  let submission = $state(null)
  let exam = $state(null)
  let loading = $state(true)
  let error = $state('')

  // ── Report a problem ──────────────────────────────────────────────────────
  const REPORT_CATEGORIES = $derived([
    { value: 'question_wrong', label: $t('examResult.reportCatQuestionWrong') },
    { value: 'answer_wrong',   label: $t('examResult.reportCatAnswerWrong') },
    { value: 'image_issue',    label: $t('examResult.reportCatImageIssue') },
    { value: 'other',          label: $t('examResult.reportCatOther') }
  ])
  let showReport = $state(false)
  let reportCategory = $state('question_wrong')
  let reportDescription = $state('')
  let reportSubmitting = $state(false)
  let reportDone = $state(false)
  let reportError = $state('')

  async function submitReport() {
    const desc = reportDescription.trim()
    if (!desc || reportSubmitting) return
    reportSubmitting = true
    reportError = ''
    try {
      const res = await reportApi.create(submission.exam_id, reportCategory, desc)
      if (res.ok) {
        reportDone = true
        reportDescription = ''
      } else {
        const err = await res.json().catch(() => ({}))
        reportError = err.error ?? $t('examResult.reportSendFailed')
      }
    } catch {
      reportError = $t('imageUpload.connectionError')
    } finally {
      reportSubmitting = false
    }
  }

  onMount(async () => {
    if (!$user) { goto('/login'); return }
    const submissionId = $page.url.searchParams.get('submissionId')
    if (!submissionId) { goto('/exams'); return }
    try {
      const res = await submissionApi.get(submissionId)
      if (!res.ok) { error = $t('examResult.notFound'); return }
      submission = await res.json()
      const examRes = await examApi.get(submission.exam_id)
      if (examRes.ok) exam = await examRes.json()
    } catch {
      error = $t('examResult.loadFailed')
    } finally {
      loading = false
    }
  })

  function grade(pct) {
    if (pct >= 90) return { label: $t('examResult.gradeExcellent'),  color: '#16a34a', bg: '#dcfce7', ring: '#22c55e' }
    if (pct >= 70) return { label: $t('examResult.gradeGood'),         color: '#1d4ed8', bg: '#dbeafe', ring: '#6366f1' }
    if (pct >= 50) return { label: $t('examResult.gradeAverage'),  color: '#92400e', bg: '#fef9c3', ring: '#f59e0b' }
    return           { label: $t('examResult.gradeFail'),         color: '#dc2626', bg: '#fee2e2', ring: '#ef4444' }
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
    background: var(--surface); color: var(--text);
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

  /* ── Report a problem ─────────────────────────────────────────────────────────*/
  .report-link {
    display: block; margin: 1rem auto 0; background: none; border: none;
    color: var(--muted); font-size: 0.82rem; font-weight: 600; cursor: pointer;
    text-decoration: underline; text-underline-offset: 2px;
  }
  .report-link:hover { color: var(--danger); }
  .report-backdrop {
    position: fixed; inset: 0; z-index: 100;
    background: rgba(20,18,45,0.55); backdrop-filter: blur(2px);
    display: flex; align-items: center; justify-content: center; padding: 1rem;
  }
  .report-modal {
    background: var(--surface); border-radius: var(--radius-card);
    border: 1px solid var(--border); box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    padding: 1.75rem; width: 100%; max-width: 460px; text-align: left;
  }
  .report-modal h3 { font-size: 1.15rem; font-weight: 800; color: var(--text); margin-bottom: 0.25rem; }
  .report-sub { font-size: 0.85rem; color: var(--muted); margin-bottom: 1.25rem; }
  .report-field { display: block; margin-bottom: 1rem; }
  .report-field span { display: block; font-size: 0.8rem; font-weight: 700; color: var(--text); margin-bottom: 0.35rem; }
  .report-field select, .report-field textarea {
    width: 100%; box-sizing: border-box; resize: vertical;
    background: var(--bg); color: var(--text);
    border: 1px solid var(--border); border-radius: 8px;
    padding: 0.6rem 0.75rem; font: inherit; font-size: 0.9rem;
  }
  .report-field select:focus, .report-field textarea:focus { outline: none; border-color: var(--primary); }
  .report-err { color: var(--danger); font-size: 0.85rem; margin-bottom: 0.75rem; }
  .report-actions { display: flex; justify-content: flex-end; gap: 0.6rem; }
  .report-success { text-align: center; }
  .report-success-icon { font-size: 2.5rem; margin-bottom: 0.5rem; }
  .report-success h3 { margin-bottom: 0.4rem; }
  .report-success p { font-size: 0.88rem; color: var(--muted); margin-bottom: 1.25rem; line-height: 1.5; }

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
  .correct-chosen  { background: rgba(22,163,74,0.18); color: #16a34a; font-weight: 600; border-color: rgba(22,163,74,0.4); }
  .correct-unchosen{ background: rgba(22,163,74,0.08); color: #16a34a; border-color: rgba(22,163,74,0.25); }
  .wrong-chosen    { background: rgba(239,68,68,0.12); color: #dc2626; border-color: rgba(239,68,68,0.35); }

  .expl-box {
    margin-top: 1rem; background: var(--primary-light); border-left: 3px solid var(--primary);
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
  <div style="text-align:center;padding:4rem 0;color:var(--muted)">{$t('examResult.loadingResult')}</div>
{:else if error}
  <p class="error">{error}</p>
{:else if submission}
{@const g = grade(submission.percentage)}
<div class="result-hero">
  {#if hasPassed}
    <div class="celebrate">🎉</div>
    <h1>{$t('examResult.congrats')}</h1>
    <p class="subtitle">{$t('examResult.congratsSub')}</p>
  {:else}
    <div class="celebrate">💪</div>
    <h1>{$t('examResult.resultTitle')}</h1>
    <p class="subtitle">{$t('examResult.keepTryingSub')}</p>
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
      <div class="lbl">{$t('examResult.scoreEarned')}</div>
    </div>
    <div class="stat-item">
      <div class="val">{submission.total_points}</div>
      <div class="lbl">{$t('examResult.totalPoints')}</div>
    </div>
    {#if exam?.passing_score != null}
    <div class="stat-item">
      <div class="val">{exam.passing_score}%</div>
      <div class="lbl">{$t('examResult.requiredScore')}</div>
    </div>
    {/if}
  </div>

  {#if hasPassed}
    <div class="pass-banner">✓ {$t('examResult.passBanner')}</div>
  {:else}
    <div class="fail-banner">
      <strong>{$t('examResult.failTitle')}</strong>
      {$t('examResult.failMsg', { pct: exam?.passing_score ?? submission.results_detail?.passing_score })}
    </div>
  {/if}

  <div class="actions">
    {#if hasPassed}
      <a href="/exams/{submission.exam_id}" class="btn-outline">← {$t('examResult.backToExam')}</a>
    {/if}
    <a href="/exams" class="btn-primary">{$t('examResult.viewAllExams')}</a>
    {#if !hasPassed}
      <a href="/exams/{submission.exam_id}/take" class="btn-retry">{$t('dashboard.retake')}</a>
    {/if}
  </div>

  <button class="report-link" onclick={() => { showReport = true; reportDone = false; reportError = '' }}>
    ⚠ {$t('examResult.reportThisExam')}
  </button>
</div>

{#if showReport}
<div class="report-backdrop" onclick={() => (showReport = false)}>
  <div class="report-modal" onclick={(e) => e.stopPropagation()}>
    {#if reportDone}
      <div class="report-success">
        <div class="report-success-icon">✅</div>
        <h3>{$t('examResult.reportSent')}</h3>
        <p>{$t('examResult.reportSentMsg')}</p>
        <button class="btn-primary" onclick={() => (showReport = false)}>{$t('common.close')}</button>
      </div>
    {:else}
      <h3>{$t('examResult.reportModalTitle')}</h3>
      <p class="report-sub">{$t('examResult.reportModalSub')}</p>

      <label class="report-field">
        <span>{$t('examResult.reportCategoryLabel')}</span>
        <select bind:value={reportCategory}>
          {#each REPORT_CATEGORIES as c}
            <option value={c.value}>{c.label}</option>
          {/each}
        </select>
      </label>

      <label class="report-field">
        <span>{$t('examResult.reportDescLabel')}</span>
        <textarea
          bind:value={reportDescription}
          rows="4"
          maxlength="4000"
          placeholder={$t('examResult.reportDescPlaceholder')}
        ></textarea>
      </label>

      {#if reportError}<p class="report-err">{reportError}</p>{/if}

      <div class="report-actions">
        <button class="btn-outline" onclick={() => (showReport = false)}>{$t('common.cancel')}</button>
        <button class="btn-primary" onclick={submitReport} disabled={reportSubmitting || !reportDescription.trim()}>
          {reportSubmitting ? $t('examResult.sending') : $t('examResult.sendReport')}
        </button>
      </div>
    {/if}
  </div>
</div>
{/if}

{#if hasPassed && submission.results_detail?.show_explanation && submission.results_detail?.questions?.length}
<h2 class="review-header">{$t('examResult.reviewHeader')}</h2>
{#each submission.results_detail.questions as q, i}
{@const corrects = q.correct_answer.split(',').filter(Boolean)}
<div class="q-card">
  <div class="q-head">
    <span class="q-icon">{q.is_correct ? '✅' : '❌'}</span>
    <span class="q-num">{$t('examTake.questionN', { n: i + 1 })}</span>
    <span class="q-pts">{$t('examResult.earnedOfPoints', { earned: q.earned, points: q.points })}</span>
  </div>
  <p class="q-text">{q.content}</p>
  {#if q.question_type === 'multiple'}
    <p class="multi-hint">{$t('examResult.correctAnswerIs', { keys: corrects.join(', ') })}</p>
  {/if}
  <ul class="options">
    {#each q.options as opt}
      {@const cls = optClass(q, opt.key)}
      <li class={cls}>{opt.key}. {opt.text}{corrects.includes(opt.key) ? ' ✓' : ''}</li>
    {/each}
  </ul>
  {#if q.explanation}
    <div class="expl-box">
      <p class="expl-title">{$t('examDetail.explanationLabel')}</p>
      {@html marked(q.explanation)}
    </div>
  {/if}
</div>
{/each}

{:else if !hasPassed}
<div class="locked-box">
  <strong>🔒 {$t('examResult.lockedTitle')}</strong>
  <p>{$t('examResult.lockedMsg', { pct: exam?.passing_score ?? submission.results_detail?.passing_score })}</p>
</div>
{/if}
{/if}
