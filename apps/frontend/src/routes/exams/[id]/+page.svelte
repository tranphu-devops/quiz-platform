<script>
  import { examApi } from '$lib/api'
  import { user } from '$lib/stores/auth'
  import { goto } from '$app/navigation'
  import { onMount } from 'svelte'
  import { page } from '$app/stores'
  import { marked } from 'marked'

  let exam = $state(null)
  let loading = $state(true)
  let error = $state('')
  let publishing = $state(false)
  let expandedExpl = $state(new Set())

  onMount(async () => {
    if (!$user) { goto('/login'); return }
    const id = $page.params.id
    try {
      const res = await examApi.get(id)
      if (!res.ok) { error = 'Không tìm thấy đề thi'; return }
      exam = await res.json()
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
    {#if exam.tags?.length}
      <div class="tags">
        {#each exam.tags as t}<span class="tag">{t}</span>{/each}
      </div>
    {/if}
    {#if isTeacher}
      <p class="expl-meta">Giải thích sau nộp bài: <strong>{exam.show_explanation ? 'Hiển thị' : 'Ẩn'}</strong></p>
    {/if}
  </div>
  <div class="actions">
    {#if $user?.role === 'student'}
      <a href="/exams/{exam.id}/take" class="btn btn-primary">Bắt đầu làm bài</a>
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
      <li class="{corrects.includes(opt.key) && isTeacher ? 'correct' : ''}">
        {opt.key}. {opt.text}
        {#if corrects.includes(opt.key) && isTeacher} ✓{/if}
      </li>
    {/each}
  </ul>
  {#if isTeacher && q.explanation}
    <button class="expl-toggle" onclick={() => toggleExpl(i)}>
      {expandedExpl.has(i) ? '▲ Ẩn giải thích' : '▼ Xem giải thích'}
    </button>
    {#if expandedExpl.has(i)}
      <div class="expl-box">{@html marked(q.explanation)}</div>
    {/if}
  {/if}
</div>
{/each}
{/if}
