<script>
  import { examApi, submissionApi, userApi } from '$lib/api'
  import { user } from '$lib/stores/auth'
  import { goto } from '$app/navigation'
  import { onMount } from 'svelte'
  import { page } from '$app/stores'
  import { marked } from 'marked'

  let exam = $state(null)
  let mySubmissions = $state([])   // all attempts, newest first
  let myCredits = $state(null)     // student's current credit balance
  let loading = $state(true)
  let error = $state('')
  let publishing = $state(false)
  let expandedExpl = $state(new Set())

  const mySubmission = $derived(mySubmissions[0] ?? null)

  onMount(async () => {
    if (!$user) { goto('/login'); return }
    const id = $page.params.id
    try {
      const res = await examApi.get(id)
      if (!res.ok) { error = 'Không tìm thấy đề thi'; return }
      exam = await res.json()

      if ($user.role === 'student') {
        const [subRes, profileRes] = await Promise.all([
          submissionApi.list({ examId: id }),
          userApi.getProfile($user.id)
        ])
        if (subRes.ok) mySubmissions = await subRes.json()
        if (profileRes.ok) {
          const profile = await profileRes.json()
          myCredits = profile.credits ?? null
        }
      }
    } catch {
      error = 'Không thể kết nối server'
    } finally {
      loading = false
    }
  })

  async function togglePublish() {
    publishing = true
    try {
      await examApi.update(exam.id, { is_published: !exam.is_published })
      exam = { ...exam, is_published: !exam.is_published }
    } finally {
      publishing = false
    }
  }

  function toggleExpl(i) {
    const next = new Set(expandedExpl)
    next.has(i) ? next.delete(i) : next.add(i)
    expandedExpl = next
  }

  function correctAnswers(q) {
    if (q.question_type === 'multiple') return (q.correct_answer ?? '').split(',').filter(Boolean)
    return q.correct_answer ? [q.correct_answer] : []
  }

  const isTeacher = $derived($user?.role === 'teacher' || $user?.role === 'admin')
  const hasPassed = $derived(
    mySubmission != null && (
      exam?.passing_score == null || mySubmission.percentage >= exam.passing_score
    )
  )
  // can start/retake: no submission yet, OR allow_retake, OR failed (can always retry)
  const canStart = $derived(!mySubmission || !!exam?.allow_retake || !hasPassed)
  const creditCost = $derived(exam?.credit_cost ?? 10)
  const hasEnoughCredits = $derived(myCredits === null || myCredits >= creditCost)
</script>

<style>
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem; }
  .meta { color: #6b7280; font-size: 0.9rem; margin-top: 0.25rem; }
  .actions { display: flex; gap: 0.75rem; flex-wrap: wrap; }
  .btn { padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; font-size: 0.9rem; text-decoration: none; border: none; }
  .btn-primary { background: #1e40af; color: white; }
  .btn-success { background: #166534; color: white; }
  .btn-outline { background: white; border: 1px solid #d1d5db; color: #374151; }
  .card { background: white; border-radius: 8px; padding: 1.25rem; margin-bottom: 0.75rem; box-shadow: 0 1px 4px rgba(0,0,0,.08); }
  .q-num { font-weight: 600; margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.5rem; }
  .options { list-style: none; margin-top: 0.5rem; }
  .options li { padding: 0.25rem 0; }
  .correct { color: #166534; font-weight: 600; }
  .error { color: #dc2626; }
  .badge { display: inline-block; padding: 0.15rem 0.5rem; border-radius: 999px; font-size: 0.8rem; }
  .published { background: #dcfce7; color: #166534; }
  .draft { background: #fef9c3; color: #854d0e; }
  .type-badge { font-size: 0.72rem; background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; padding: 0.1rem 0.45rem; border-radius: 99px; }
  .type-badge.multi { background: #fefce8; color: #ca8a04; border-color: #fde68a; }
  /* Tags */
  .tags { display: flex; flex-wrap: wrap; gap: 0.4rem; margin: 0.5rem 0; }
  .tag { background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe; border-radius: 99px; padding: 0.15rem 0.65rem; font-size: 0.82rem; }
  /* Explanation */
  .expl-toggle { background: none; border: none; color: #6b7280; font-size: 0.8rem; cursor: pointer; padding: 0.2rem 0.5rem; border-radius: 4px; margin-top: 0.5rem; }
  .expl-toggle:hover { background: #f3f4f6; }
  .expl-box { margin-top: 0.5rem; background: #f9fafb; border-left: 3px solid #93c5fd; padding: 0.6rem 0.75rem; border-radius: 0 6px 6px 0; font-size: 0.9rem; line-height: 1.6; }
  .expl-box :global(p) { margin: 0 0 0.4rem; }
  .expl-box :global(p:last-child) { margin: 0; }
  .expl-box :global(code) { background: #e5e7eb; padding: 0.1rem 0.3rem; border-radius: 3px; font-size: 0.88em; }
  .expl-box :global(ul), .expl-box :global(ol) { padding-left: 1.4rem; margin: 0.25rem 0; }
  .hint-multi { font-size: 0.82rem; color: #6b7280; margin-top: 0.3rem; }
  .expl-meta { font-size: 0.8rem; color: #6b7280; margin-top: 0.25rem; }
  .mode-badge { font-size: 0.78rem; background: #f3f4f6; color: #374151; border: 1px solid #d1d5db; border-radius: 99px; padding: 0.1rem 0.6rem; display: inline-block; }
  .credit-info { display: flex; align-items: center; gap: 0.5rem; margin-top: 0.4rem; font-size: 0.85rem; flex-wrap: wrap; }
  .credit-cost { background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe; border-radius: 99px; padding: 0.15rem 0.65rem; font-weight: 600; }
  .credit-balance { color: #6b7280; }
  .credit-warn { background: #fef2f2; color: #dc2626; border: 1px solid #fca5a5; border-radius: 99px; padding: 0.15rem 0.65rem; font-weight: 600; }
  .btn-primary:disabled { opacity: 0.5; cursor: default; }
  .status-box { border-radius: 10px; padding: 1.25rem 1.5rem; margin-top: 1.5rem; text-align: center; }
  .status-box.passed { background: #f0fdf4; border: 1.5px solid #86efac; }
  .status-box.failed { background: #fef2f2; border: 1.5px solid #fca5a5; }
  .status-icon { font-size: 2.5rem; line-height: 1; margin-bottom: 0.5rem; }
  .status-title { font-size: 1.1rem; font-weight: 700; margin-bottom: 0.3rem; }
  .status-title.passed { color: #15803d; }
  .status-title.failed { color: #dc2626; }
  .status-desc { font-size: 0.9rem; color: #6b7280; margin-bottom: 1rem; }
  .status-actions { display: flex; gap: 0.75rem; justify-content: center; flex-wrap: wrap; }
  /* History table */
  .history-section { margin-top: 2rem; }
  .history-table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
  .history-table th { text-align: left; padding: 0.5rem 0.75rem; border-bottom: 2px solid #e5e7eb; color: #6b7280; font-weight: 600; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.04em; }
  .history-table td { padding: 0.6rem 0.75rem; border-bottom: 1px solid #f3f4f6; }
  .history-table tr:last-child td { border-bottom: none; }
  .history-table tr:hover td { background: #f9fafb; }
  .h-pass { color: #15803d; font-weight: 600; }
  .h-fail { color: #dc2626; }
  .h-link { color: #1e40af; text-decoration: none; font-size: 0.85rem; }
  .h-link:hover { text-decoration: underline; }
</style>

{#if loading}<p>Đang tải...</p>
{:else if error}<p class="error">{error}</p>
{:else if exam}
<div class="header">
  <div>
    <h1>
      {exam.title}
      <span class="badge {exam.is_published ? 'published' : 'draft'}" style="margin-left:0.5rem">
        {exam.is_published ? 'Đã xuất bản' : 'Nháp'}
      </span>
    </h1>
    <p class="meta">
      {exam.description ?? ''}{exam.description ? ' · ' : ''}{exam.time_limit} phút · {exam.questions?.length ?? 0} câu
      {#if exam.passing_score != null} · Điểm đạt: <strong>{exam.passing_score}</strong>{/if}
    </p>
    {#if $user?.role === 'student'}
      <div class="credit-info">
        <span class="credit-cost">💳 {creditCost} credit</span>
        {#if myCredits !== null}
          {#if hasEnoughCredits}
            <span class="credit-balance">Số dư của bạn: <strong>{myCredits}</strong></span>
          {:else}
            <span class="credit-warn">Không đủ credit (bạn có {myCredits}, cần {creditCost})</span>
          {/if}
        {/if}
      </div>
    {/if}
    {#if exam.tags?.length}
      <div class="tags">
        {#each exam.tags as t}<span class="tag">{t}</span>{/each}
      </div>
    {/if}
    {#if isTeacher}
      <p class="expl-meta">
        Giải thích sau nộp bài: <strong>{exam.show_explanation ? 'Hiển thị' : 'Ẩn'}</strong>
        &nbsp;·&nbsp;
        <span class="mode-badge">{exam.allow_retake ? 'Thi thực hành' : 'Thi chính thức'}</span>
      </p>
    {/if}
  </div>
  <div class="actions">
    {#if $user?.role === 'student'}
      {#if !mySubmission}
        {#if hasEnoughCredits}
          <a href="/exams/{exam.id}/take" class="btn btn-primary">Bắt đầu làm bài</a>
        {:else}
          <button class="btn btn-primary" disabled title="Không đủ credit">Bắt đầu làm bài</button>
        {/if}
      {:else}
        <a href="/exams/{exam.id}/result?submissionId={mySubmission.id}" class="btn btn-success">Xem kết quả</a>
        {#if canStart}
          {#if hasEnoughCredits}
            <a href="/exams/{exam.id}/take" class="btn btn-outline">Làm lại</a>
          {:else}
            <button class="btn btn-outline" disabled title="Không đủ credit">Làm lại</button>
          {/if}
        {/if}
      {/if}
    {:else}
      {#if exam.created_by === $user?.id || $user?.role === 'admin'}
        <a href="/exams/{exam.id}/edit" class="btn btn-outline">Sửa đề</a>
      {/if}
      <button class="btn {exam.is_published ? 'btn-outline' : 'btn-success'}" onclick={togglePublish} disabled={publishing}>
        {exam.is_published ? 'Gỡ xuất bản' : 'Xuất bản'}
      </button>
      <a href="/exams/{exam.id}/take" class="btn btn-outline">Xem trước</a>
    {/if}
  </div>
</div>

{#if isTeacher}
  {#each exam.questions ?? [] as q, i}
  {@const corrects = correctAnswers(q)}
  <div class="card">
    <p class="q-num">
      Câu {i + 1} · {q.points} điểm
      <span class="type-badge" class:multi={q.question_type === 'multiple'}>
        {q.question_type === 'multiple' ? 'Nhiều đáp án' : '1 đáp án'}
      </span>
    </p>
    <p>{q.content}</p>
    {#if q.question_type === 'multiple'}
      <p class="hint-multi">Chọn {corrects.length} đáp án đúng</p>
    {/if}
    <ul class="options">
      {#each q.options ?? [] as opt}
        <li class="{corrects.includes(opt.key) ? 'correct' : ''}">
          {opt.key}. {opt.text}
          {#if corrects.includes(opt.key)} ✓{/if}
        </li>
      {/each}
    </ul>
    {#if q.explanation}
      <button class="expl-toggle" onclick={() => toggleExpl(i)}>
        {expandedExpl.has(i) ? '▲ Ẩn giải thích' : '▼ Xem giải thích'}
      </button>
      {#if expandedExpl.has(i)}
        <div class="expl-box">{@html marked(q.explanation)}</div>
      {/if}
    {/if}
  </div>
  {/each}
{:else if mySubmission}
  {#if hasPassed}
    <div class="status-box passed">
      <div class="status-icon">🎉</div>
      <p class="status-title passed">Chúc mừng! Bạn đã pass bài thi này</p>
      <p class="status-desc">Điểm: <strong>{mySubmission.score}/{mySubmission.total_points}</strong> ({mySubmission.percentage?.toFixed(1)}%)</p>
      <div class="status-actions">
        <a href="/exams/{exam.id}/result?submissionId={mySubmission.id}" class="btn btn-success">Xem kết quả chi tiết</a>
        {#if exam.allow_retake}
          <a href="/exams/{exam.id}/take" class="btn btn-outline">Làm lại</a>
        {/if}
      </div>
    </div>
    <h2 style="margin: 1.5rem 0 1rem">Nội dung đề thi</h2>
    {#each exam.questions ?? [] as q, i}
    <div class="card">
      <p class="q-num">Câu {i + 1} · {q.points} điểm</p>
      <p>{q.content}</p>
      <ul class="options">
        {#each q.options ?? [] as opt}
          <li>{opt.key}. {opt.text}</li>
        {/each}
      </ul>
    </div>
    {/each}
  {:else}
    <div class="status-box failed">
      <div class="status-icon">❌</div>
      <p class="status-title failed">Chưa đạt — không xem được nội dung đề thi</p>
      <p class="status-desc">
        Điểm: <strong>{mySubmission.score}/{mySubmission.total_points}</strong> ({mySubmission.percentage?.toFixed(1)}%)
        · Cần đạt: <strong>{exam.passing_score}%</strong>
      </p>
      <div class="status-actions">
        <a href="/exams/{exam.id}/result?submissionId={mySubmission.id}" class="btn btn-outline">Xem kết quả</a>
        <a href="/exams/{exam.id}/take" class="btn btn-primary">Làm lại</a>
      </div>
    </div>
  {/if}

  {#if exam.allow_retake && mySubmissions.length > 0}
  <div class="history-section">
    <h2>Lịch sử làm bài ({mySubmissions.length} lần)</h2>
    <div class="card" style="padding:0; overflow:hidden">
      <table class="history-table">
        <thead>
          <tr>
            <th>Lần</th>
            <th>Điểm</th>
            <th>%</th>
            <th>Kết quả</th>
            <th>Thời gian nộp</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {#each mySubmissions as sub, i}
          {@const subPassed = exam.passing_score == null || sub.percentage >= exam.passing_score}
          <tr>
            <td>{mySubmissions.length - i}</td>
            <td>{sub.score}/{sub.total_points}</td>
            <td>{sub.percentage?.toFixed(1)}%</td>
            <td class="{subPassed ? 'h-pass' : 'h-fail'}">{subPassed ? 'Đạt' : 'Chưa đạt'}</td>
            <td style="color:#6b7280; font-size:0.85rem">{new Date(sub.submitted_at).toLocaleString('vi-VN')}</td>
            <td>
              {#if subPassed}
                <a href="/exams/{exam.id}/result?submissionId={sub.id}" class="h-link">Xem →</a>
              {/if}
            </td>
          </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>
  {/if}
{/if}
{/if}
